#!/usr/bin/env python3
"""Cérebro de licitações da PRODUCERIA.

Varre o PNCP (API pública de consulta), classifica cada contratação pelas frentes
do hub, pontua de 0 a 100 com peso maior para o trabalho de estúdio (craft) e grava
documentos prontos para o radar B2G do PRODUCER.IA Studio.

Só usa a biblioteca padrão. Uso típico:
  python3 cerebro.py --perfil perfil.json --saida out --abertas --dias 3 --existentes ids.txt
  python3 cerebro.py --perfil perfil.json --saida out --repontuar docs_existentes/   (atualiza notas)
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

API = "https://pncp.gov.br/api/consulta/v1"
BRT = timezone(timedelta(hours=-3))


def casa(term: str, t: str) -> bool:
    """termo no texto com início de palavra; termos curtos (até 6 letras) também com fim de palavra"""
    fim = r"(?![a-z0-9])" if len(term) <= 6 else ""
    return re.search(r"(?<![a-z0-9])" + re.escape(term) + fim, t) is not None


def norm(s: str) -> str:
    """minúsculas sem acento, para casar termos com e sem acentuação"""
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower())


# ---------------------------------------------------------------- PNCP
def get(path: str, params: dict, tentativas: int = 3) -> dict:
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    erro = None
    for n in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "producer-ia-cerebro/1.0"})
            with urllib.request.urlopen(req, timeout=40) as r:
                if r.status == 204:
                    return {"data": [], "totalPaginas": 0}
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            if e.code == 204:
                return {"data": [], "totalPaginas": 0}
            erro = f"HTTP {e.code} em {url}"
            if e.code in (400, 404, 422):
                break
        except Exception as e:  # rede, timeout, JSON
            erro = f"{type(e).__name__}: {e}"
        time.sleep(2 * (n + 1))
    raise RuntimeError(erro or "falha desconhecida")


def varrer(path: str, base: dict, modalidades: list[str], max_paginas: int, log, paralelo: int = 6) -> list[dict]:
    """Lê a página 1 de cada modalidade para saber o total e busca as demais em paralelo."""
    from concurrent.futures import ThreadPoolExecutor
    itens: list[dict] = []

    def pagina(m, n):
        try:
            return n, get(path, {**base, "codigoModalidadeContratacao": m, "pagina": n, "tamanhoPagina": 50})  # limite real do PNCP
        except RuntimeError as e:
            log(f"  modalidade {m} página {n}: {e}")
            return n, None

    for m in modalidades:
        _, r = pagina(m, 1)
        if not r:
            continue
        itens.extend(r.get("data") or [])
        total = min(r.get("totalPaginas") or 0, max_paginas)
        log(f"  modalidade {m}: {r.get('totalRegistros', '?')} registros em {r.get('totalPaginas', 0)} páginas (lendo {total})")
        if total > 1:
            falhas = 0
            with ThreadPoolExecutor(max_workers=paralelo) as ex:
                for n, rr in ex.map(lambda n: pagina(m, n), range(2, total + 1)):
                    if rr is None:
                        falhas += 1
                    else:
                        itens.extend(rr.get("data") or [])
            if falhas:
                log(f"  modalidade {m}: {falhas} página(s) falharam")
    return itens


# ---------------------------------------------------------------- classificação e nota
class Cerebro:
    def __init__(self, perfil: dict):
        self.p = perfil
        self.frentes = [{**f, "_t": [norm(t) for t in f["termos"]]} for f in perfil["frentes"]]
        self.pen = [{**x, "_t": [norm(t) for t in x["termos"]]} for x in perfil.get("penalidades", [])]
        self.w = perfil["pesos"]

    def classificar(self, texto: str):
        t = norm(texto)
        melhor, achados = None, []
        for f in self.frentes:
            hits = [term for term in f["_t"] if casa(term, t)]
            if not hits:
                continue
            # força = craft da frente, reforçada por mais de um termo
            forca = f["craft"] * (1 + 0.15 * min(len(hits) - 1, 3))
            achados.append((forca, f, hits))
        if not achados:
            return None, [], 1.0, ""
        achados.sort(key=lambda x: x[0], reverse=True)
        melhor = achados[0]
        fator, motivo_pen = 1.0, ""
        for pen in self.pen:
            if any(casa(term, t) for term in pen["_t"]):
                if pen["fator"] < fator:
                    fator, motivo_pen = pen["fator"], pen["motivo"]
        return melhor[1], [a[1]["nome"] for a in achados[1:3]], fator, motivo_pen

    @staticmethod
    def banda_valor(v):
        if not v or v <= 0:
            return 0.4  # valor sigiloso ou não divulgado: neutro
        # R$ 2 mil -> ~0,1 · R$ 20 mil -> ~0,45 · R$ 200 mil -> ~0,8 · R$ 1 mi+ -> 1
        return max(0.05, min(1.0, (math.log10(v) - 3.0) / 3.0))

    @staticmethod
    def banda_prazo(fim: str | None, hoje: date):
        if not fim:
            return 0.5, None
        try:
            d = datetime.fromisoformat(fim[:19]).date()
        except ValueError:
            return 0.5, None
        dias = (d - hoje).days
        if dias < 0:
            return 0.0, dias
        if dias < 3:
            return 0.2, dias
        if dias < 7:
            return 0.6, dias
        return 1.0, dias

    def pontuar(self, objeto: str, extra: str, valor, fim, modalidade: str, srp: bool, hoje: date):
        frente, outras, fator, motivo_pen = self.classificar(f"{objeto} {extra}")
        if not frente:
            return None
        prazo_b, dias = self.banda_prazo(fim, hoje)
        mod = norm(modalidade)
        rec = 1.0 if (srp or any(k in mod for k in ("credenciamento", "chamada publica", "inexigibilidade"))) else 0.3
        ader = 1.0 if frente["entidades"] else 0.4
        bruto = (self.w["craft"] * frente["craft"] + self.w["aderencia"] * ader + self.w["valor"] * self.banda_valor(valor)
                 + self.w["prazo"] * prazo_b + self.w["recorrencia"] * rec)
        nota = round(bruto * fator)
        motivos = [f"frente {frente['nome']} (craft {int(frente['craft'] * 100)})"]
        if srp:
            motivos.append("registro de preços: demanda recorrente por 12 meses")
        if rec == 1.0 and not srp:
            motivos.append(f"{modalidade.lower()}: entrada sem disputa de preço")
        if dias is not None:
            motivos.append("prazo vencido" if dias < 0 else f"{dias} dia(s) para enviar proposta")
        if motivo_pen:
            motivos.append(motivo_pen)
        return {
            "score": max(0, min(100, nota)), "craft": round(frente["craft"] * fator, 2), "frente": frente["nome"],
            "outrasFrentes": outras, "entidades": frente["entidades"],
            "aderencia": "direta" if frente["craft"] >= 0.6 and fator == 1.0 else "condicionada",
            "motivo": "; ".join(motivos),
        }


def doc_id(controle: str) -> str:
    return "pncp-" + re.sub(r"[^A-Za-z0-9_\-.~:@+]", "_", controle)[:180]


def para_doc(item: dict, nota: dict, hoje: date) -> tuple[str, dict]:
    org = item.get("orgaoEntidade") or {}
    uni = item.get("unidadeOrgao") or {}
    cnpj, ano, seq = org.get("cnpj", ""), item.get("anoCompra"), item.get("sequencialCompra")
    controle = item.get("numeroControlePNCP") or f"{cnpj}-{ano}-{seq}"
    url = f"https://pncp.gov.br/app/editais/{cnpj}/{ano}/{seq}" if cnpj and ano and seq else (item.get("linkSistemaOrigem") or "")
    fim = item.get("dataEncerramentoProposta")
    return doc_id(controle), {
        "objeto": (item.get("objetoCompra") or "").strip()[:900],
        "orgao": (org.get("razaoSocial") or "").title()[:200],
        "unidade": (uni.get("nomeUnidade") or "")[:200],
        "modalidade": item.get("modalidadeNome") or "",
        "uf": uni.get("ufSigla") or "",
        "municipio": uni.get("municipioNome") or "",
        "valor": item.get("valorTotalEstimado") or None,
        "prazo": fim[:10] if fim else None,
        "abertura": (item.get("dataAberturaProposta") or "")[:10] or None,
        "publicado": (item.get("dataPublicacaoPncp") or "")[:10] or None,
        "srp": bool(item.get("srp")),
        "frente": nota["frente"], "aderencia": nota["aderencia"], "entidades": nota["entidades"],
        "score": nota["score"], "craft": nota["craft"], "motivo": nota["motivo"],
        "ref": controle, "url": url, "nota": "", "fonte": f"Cérebro · PNCP · {hoje.strftime('%d/%m/%Y')}",
        "carteira": False,
    }


# ---------------------------------------------------------------- saída
def gravar_lotes(saida: str, docs: dict[str, dict], op: str = "set"):
    os.makedirs(os.path.join(saida, "docs"), exist_ok=True)
    writes = []
    for i, (k, v) in enumerate(sorted(docs.items(), key=lambda kv: -kv[1].get("score", 0))):
        p = os.path.abspath(os.path.join(saida, "docs", f"{k}.json"))
        with open(p, "w", encoding="utf-8") as f:
            json.dump(v, f, ensure_ascii=False)
        writes.append({"op": op, "collection": "b2g", "doc_id": k, "file_path": p})
    lotes = [writes[i:i + 50] for i in range(0, len(writes), 50)]
    for n, lote in enumerate(lotes, 1):
        with open(os.path.join(saida, f"lote_{n:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(lote, f, ensure_ascii=False)
    return len(lotes)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--perfil", required=True)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--abertas", action="store_true", help="contratações com proposta aberta (endpoint /proposta)")
    ap.add_argument("--dias", type=int, default=0, help="também varrer publicações dos últimos N dias")
    ap.add_argument("--horizonte", type=int, default=60, help="propostas que encerram em até N dias")
    ap.add_argument("--max-paginas", type=int, default=40)
    ap.add_argument("--min", type=int, default=45, help="nota mínima para entrar no radar")
    ap.add_argument("--existentes", help="arquivo com ids já presentes no radar, um por linha")
    ap.add_argument("--entrada", help="JSON local com itens no formato do PNCP (teste offline)")
    ap.add_argument("--repontuar", help="pasta com documentos do radar (<id>.json) para recalcular a nota")
    a = ap.parse_args()

    perfil = json.load(open(a.perfil, encoding="utf-8"))
    cb = Cerebro(perfil)
    hoje = datetime.now(BRT).date()
    log = lambda m: print(m, file=sys.stderr)
    os.makedirs(a.saida, exist_ok=True)

    if a.repontuar:
        docs = {}
        for nome in sorted(os.listdir(a.repontuar)):
            if not nome.endswith(".json"):
                continue
            d = json.load(open(os.path.join(a.repontuar, nome), encoding="utf-8"))
            if not str(d.get("fonte", "")).startswith("Cérebro"):
                continue  # registros da equipe ou do Atlas ficam como estão
            n = cb.pontuar(d.get("objeto", ""), "", d.get("valor"), d.get("prazo"), d.get("modalidade", ""), d.get("srp", False), hoje)
            if not n:
                # sem frente no perfil novo: zera só o que o perfil exclui de propósito (penalidade zero, ou
                # sinalização que entrava só pela palavra "placas"); o resto fica como está, porque pode ter
                # entrado pelo texto complementar do PNCP, que o radar não guarda
                t = norm(d.get("objeto", ""))
                fora = any(pen["fator"] == 0 and any(casa(x, t) for x in pen["_t"]) for pen in cb.pen)
                placa = (d.get("frenteCerebro") or d.get("frente")) == "Comunicação visual e sinalização" and "placa" in t
                if not (fora or placa):
                    continue
                n = {"score": 0, "craft": 0, "frente": d.get("frenteCerebro") or d.get("frente", ""),
                     "motivo": f"sem frente no perfil {perfil.get('versao', '')}: fora do escopo"}
            novo = {"score": n["score"], "craft": n["craft"], "motivo": n["motivo"], "frenteCerebro": n["frente"]}
            if all(d.get(k) == v for k, v in novo.items()):
                continue
            docs[nome[:-5]] = novo
        nl = gravar_lotes(a.saida, docs, op="update")
        print(json.dumps({"repontuados": len(docs), "lotes": nl}, ensure_ascii=False))
        return

    existentes = set()
    if a.existentes and os.path.exists(a.existentes):
        existentes = {l.strip() for l in open(a.existentes, encoding="utf-8") if l.strip()}

    brutos: list[dict] = []
    mods = list(perfil["modalidades"].keys())
    if a.entrada:
        brutos = json.load(open(a.entrada, encoding="utf-8"))
    else:
        if a.abertas:
            log("Propostas abertas:")
            brutos += varrer("/contratacoes/proposta", {"dataFinal": (hoje + timedelta(days=a.horizonte)).strftime("%Y%m%d")}, mods, a.max_paginas, log)
        if a.dias:
            log(f"Publicações dos últimos {a.dias} dia(s):")
            ini = (hoje - timedelta(days=a.dias)).strftime("%Y%m%d")
            brutos += varrer("/contratacoes/publicacao", {"dataInicial": ini, "dataFinal": hoje.strftime("%Y%m%d")}, mods, a.max_paginas, log)

    vistos, docs, descartes = set(), {}, {"sem frente": 0, "abaixo da nota": 0, "já no radar": 0, "prazo vencido": 0}
    for it in brutos:
        nota = cb.pontuar(it.get("objetoCompra", ""), it.get("informacaoComplementar", "") or "", it.get("valorTotalEstimado"),
                          it.get("dataEncerramentoProposta"), it.get("modalidadeNome", ""), bool(it.get("srp")), hoje)
        if not nota:
            descartes["sem frente"] += 1
            continue
        k, d = para_doc(it, nota, hoje)
        if k in vistos:
            continue
        vistos.add(k)
        if k in existentes:
            descartes["já no radar"] += 1
            continue
        if d["prazo"] and d["prazo"] < hoje.isoformat():
            descartes["prazo vencido"] += 1
            continue
        if d["score"] < a.min:
            descartes["abaixo da nota"] += 1
            continue
        docs[k] = d

    nl = gravar_lotes(a.saida, docs)
    top = sorted(docs.values(), key=lambda d: -d["score"])[:10]
    with open(os.path.join(a.saida, "resumo.md"), "w", encoding="utf-8") as f:
        f.write(f"# Cérebro de licitações · {hoje.strftime('%d/%m/%Y')}\n\n")
        f.write(f"{len(brutos)} registros lidos · {len(docs)} entram no radar · descartes: " + ", ".join(f"{k} {v}" for k, v in descartes.items()) + "\n\n")
        for d in top:
            f.write(f"- **{d['score']}** · {d['frente']} · {d['orgao']} ({d['uf']}) · {d['objeto'][:140]} · {d['url']}\n")
    print(json.dumps({"lidos": len(brutos), "novos": len(docs), "lotes": nl, "descartes": descartes}, ensure_ascii=False))


if __name__ == "__main__":
    main()
