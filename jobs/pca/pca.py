#!/usr/bin/env python3
"""Coleta os Planos de Contratações Anuais (PCA) publicados no PNCP e separa o que interessa à PRODUCERIA.

O PCA é o que cada órgão pretende contratar no ano seguinte (Lei 14.133/2021, art. 12). Quem chega antes do edital
participa da pesquisa de preços e conhece a demanda. Aqui:
1. consulta o PNCP por classe do catálogo de serviços (CATSER) e ano do PCA, só nas classes onde o escopo aparece
   (ver CLASSES; a escolha está documentada em docs/DADOS.md);
2. passa a descrição de cada item pelo mesmo filtro do cérebro de licitações (jobs/cerebro/perfil.json), para o PCA
   seguir exatamente o escopo do radar (porta + exclusões);
3. agrupa por órgão e unidade, busca UF e município da unidade e grava um documento por órgão e ano na coleção
   `pca`, em lotes para o ArtifactData (como o cérebro e o Vencedores).

Uso: python3 pca.py SAIDA [--anos 2027] [--max-paginas 300]
Sem --anos, coleta o ano que vem (e o atual, se ainda estiver no 1º semestre).
Só usa a biblioteca padrão e só lê a API pública do PNCP."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "cerebro"))
import cerebro as cb  # noqa: E402

CONSULTA = "https://pncp.gov.br/api/consulta/v1"
PNCP = "https://pncp.gov.br/api/pncp/v1"
BRT = timezone(timedelta(hours=-3))

# Classes CATSER onde o escopo aparece nos PCAs (teste de 11/11/2026 com os PCAs de 2026 e 2027).
# Fora de propósito: 9611 (só locação/operação de som), 8911 (ruído de catalogação), 8439 (TI),
# 8399/5469/8739 (genéricas demais: o PNCP nem consegue responder).
CLASSES = {
    "9612": "Produção de imagem e vídeo",
    "9614": "Produção de filmes",
    "8381": "Serviços fotográficos",
    "8369": "Outros serviços de publicidade",
    "8361": "Publicação e divulgação",
    "8912": "Impressão e reprodução",
}


def http_json(url: str, tentativas: int = 3, espera: float = 2.0) -> dict:
    erro = None
    for n in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "producer-ia-pca/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                corpo = r.read()
                return json.loads(corpo.decode("utf-8")) if corpo else {}
        except urllib.error.HTTPError as e:
            if e.code == 204:
                return {}
            erro = f"HTTP {e.code}"
            if e.code in (400, 404, 422):
                break
            if e.code == 429:  # o PNCP pede para esperar: espera longa antes de tentar de novo
                time.sleep(30 * (n + 1))
                continue
        except Exception as e:  # rede, timeout, JSON
            erro = f"{type(e).__name__}: {e}"
        time.sleep(espera * (n + 1))
    raise RuntimeError(f"{erro} em {url}")


def paginas_pca(ano: int, classe: str, max_paginas: int, buscar=http_json, pausa: float = 0.4):
    """Registros de PCA (um por órgão/unidade) que têm itens da classe, página a página, com pausa entre páginas."""
    for pg in range(1, max_paginas + 1):
        if pg > 1 and pausa:
            time.sleep(pausa)
        q = urllib.parse.urlencode({"anoPca": ano, "codigoClassificacaoSuperior": classe, "pagina": pg, "tamanhoPagina": 10})
        d = buscar(f"{CONSULTA}/pca/?{q}")
        yield from d.get("data") or []
        if not d.get("paginasRestantes"):
            break


def itens_no_escopo(registro: dict, classe: str, cerebro: cb.Cerebro) -> list[dict]:
    """Itens do PCA desta classe que passam pela porta do perfil e não caem em exclusão."""
    out = []
    for i in registro.get("itens") or []:
        if str(i.get("classificacaoSuperiorCodigo")) != classe:
            continue
        desc = (i.get("descricaoItem") or "").strip()
        if not desc:
            continue
        frente, _, exclusao, _ = cerebro.classificar(desc)
        if not frente or exclusao:
            continue
        out.append({
            "numero": i.get("numeroItem"),
            "descricao": desc[:300],
            "frente": frente["nome"],
            "classe": classe,
            "valor": i.get("valorTotal") or None,
            "quantidade": i.get("quantidadeEstimada") or None,
            "unidadeFornecimento": i.get("unidadeFornecimento") or "",
            "dataDesejada": (i.get("dataDesejada") or "")[:10] or None,
            "requisitante": (i.get("unidadeRequisitante") or "")[:120],
        })
    return out


def doc_id(cnpj: str, ano) -> str:
    return "pca-" + re.sub(r"[^0-9]", "", cnpj) + f"-{ano}"


def agrupar(achados: list[tuple[dict, dict]]) -> dict[str, dict]:
    """(registro de PCA, item) → um documento por órgão e ano (as secretarias ficam listadas), sem item repetido."""
    docs: dict[str, dict] = {}
    for reg, item in achados:
        cnpj, ano = reg.get("orgaoEntidadeCnpj") or "", reg.get("anoPca")
        uni = corrigir_texto(reg.get("nomeUnidade") or "").strip().title()[:200]
        k = doc_id(cnpj, ano)
        d = docs.setdefault(k, {
            "id": k, "ano": ano, "cnpj": cnpj, "orgao": corrigir_texto(reg.get("orgaoEntidadeRazaoSocial") or "").strip().title()[:200],
            "unidades": [], "codigoUnidade": str(reg.get("codigoUnidade") or ""), "idPca": reg.get("idPcaPncp") or "",
            "atualizadoNoPncp": (reg.get("dataAtualizacaoGlobalPCA") or "")[:10] or None,
            "uf": "", "municipio": "", "esfera": "", "itens": [],
        })
        if uni and uni not in d["unidades"]:
            d["unidades"].append(uni)
        if not any(x["numero"] == item["numero"] for x in d["itens"]):
            d["itens"].append({**item, "unidade": uni})
    for d in docs.values():
        d["itens"].sort(key=lambda x: -(x["valor"] or 0))
        d["total"] = round(sum(x["valor"] or 0 for x in d["itens"]), 2)
        d["frentes"] = sorted({x["frente"] for x in d["itens"]})
        datas = [x["dataDesejada"] for x in d["itens"] if x["dataDesejada"]]
        d["primeiraData"] = min(datas) if datas else None
    return docs


def corrigir_texto(s: str) -> str:
    """O PNCP às vezes devolve UTF-8 lido como Windows-1252 ("COMUNICAÃ‡ÃƒO"); desfaz quando for o caso."""
    if "Ã" in s:
        for cod in ("cp1252", "latin-1"):
            try:
                return s.encode(cod).decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
    return s


ESFERA = {"F": "Federal", "E": "Estadual", "M": "Municipal", "D": "Distrital"}


def completar_local(docs: dict[str, dict], buscar=http_json, log=print):
    """UF, município e esfera de cada unidade (o PCA não traz). Uma consulta por unidade, com cache."""
    cache: dict[tuple, dict] = {}
    for d in docs.values():
        chave = (d["cnpj"], d["codigoUnidade"])
        if chave not in cache:
            try:
                u = buscar(f"{PNCP}/orgaos/{d['cnpj']}/unidades/{urllib.parse.quote(d['codigoUnidade'])}")
            except RuntimeError as e:
                log(f"  sem local para {chave}: {e}")
                u = {}
            mun = u.get("municipio") or {}
            cache[chave] = {"uf": ((mun.get("uf") or {}).get("siglaUF") or ""), "municipio": (mun.get("nome") or "").title(),
                            "esfera": ESFERA.get(((u.get("orgao") or {}).get("esferaId") or ""), "")}
        d.update(cache[chave])


def gravar(saida: str, docs: dict[str, dict], coletado: str):
    """pca.json com tudo e lote_NN.json com writes de ArtifactData (coleção `pca`, op set), 50 por lote."""
    os.makedirs(os.path.join(saida, "docs"), exist_ok=True)
    writes = []
    for k, v in sorted(docs.items(), key=lambda kv: -kv[1]["total"]):
        v = {**v, "coletadoEm": coletado}
        p = os.path.abspath(os.path.join(saida, "docs", f"{k}.json"))
        with open(p, "w", encoding="utf-8") as f:
            json.dump(v, f, ensure_ascii=False)
        writes.append({"op": "set", "collection": "pca", "doc_id": k, "file_path": p})
    with open(os.path.join(saida, "pca.json"), "w", encoding="utf-8") as f:
        json.dump(list(docs.values()), f, ensure_ascii=False)
    lotes = [writes[i:i + 50] for i in range(0, len(writes), 50)]
    for n, lote in enumerate(lotes, 1):
        with open(os.path.join(saida, f"lote_{n:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(lote, f, ensure_ascii=False)
    return len(lotes)


def anos_padrao(hoje: date) -> list[int]:
    return [hoje.year + 1] + ([hoje.year] if hoje.month <= 6 else [])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("saida")
    ap.add_argument("--anos", type=int, nargs="*")
    ap.add_argument("--max-paginas", type=int, default=300)
    a = ap.parse_args()
    hoje = datetime.now(BRT).date()
    anos = a.anos or anos_padrao(hoje)
    perfil = json.load(open(os.path.join(AQUI, "..", "cerebro", "perfil.json"), encoding="utf-8"))
    cerebro = cb.Cerebro(perfil)
    achados, lidos, falhas = [], 0, []
    for ano in anos:
        for classe, nome in CLASSES.items():
            n0 = len(achados)
            try:
                for reg in paginas_pca(ano, classe, a.max_paginas):
                    lidos += 1
                    achados += [(reg, it) for it in itens_no_escopo(reg, classe, cerebro)]
            except RuntimeError as e:
                falhas.append(f"{classe}/{ano}: {e}")
            print(f"{ano} {classe} {nome}: {len(achados) - n0} item(ns) no escopo", flush=True)
    docs = agrupar(achados)
    completar_local(docs)
    n = gravar(a.saida, docs, datetime.now(BRT).isoformat(timespec="seconds"))
    resumo = {"anos": anos, "registrosLidos": lidos, "itens": len(achados), "orgaos": len(docs), "lotes": n,
              "valor": round(sum(d["total"] for d in docs.values()), 2), "falhas": falhas, "perfil": perfil.get("versao")}
    with open(os.path.join(a.saida, "resumo.json"), "w", encoding="utf-8") as f:
        json.dump(resumo, f, ensure_ascii=False)
    print(json.dumps(resumo, ensure_ascii=False))


if __name__ == "__main__":
    main()
