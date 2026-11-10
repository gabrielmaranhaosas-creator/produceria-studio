#!/usr/bin/env python3
"""Atualização mensal do mapa de vencedores (rodada pela rotina do Claude).
Lê os dias colhidos por colher.py, classifica e gera lotes de escrita para a coleção "contratos_novos" do Studio.
Uso: python3 novos.py DADOS SAIDA --existentes existentes.txt
Grava SAIDA/lote_NN.json (listas de {op, collection, doc_id, file_path}) e SAIDA/docs/*.json; imprime um resumo JSON."""
import json, glob, os, re, sys, argparse
from datetime import date
from classes import classificar, fornecedor_e_veiculo, tipo_empresa, MEI

ESF = {"F": "Federal", "E": "Estadual", "M": "Municipal", "D": "Distrital", "N": "Não informada"}


def d(s):
    try:
        return date.fromisoformat((s or "")[:10])
    except ValueError:
        return None


def seg_de(tipo, frente, valor, mei):
    if mei:
        return "Microempreendedor (MEI)"
    if tipo == "Entidade ou empresa pública":
        return tipo
    if (frente == "publicidade" and valor >= 100_000) or (tipo == "Agência / comunicação" and frente == "publicidade"):
        return "Agência com conta pública"
    craft = frente in ("audiovisual", "publicidade", "cenografia", "fotografia", "conteudo", "transmissao", "audio", "design")
    if tipo == "Produtora / estúdio" and craft:
        return "Produtora concorrente"
    if craft and valor >= 30_000 and tipo in ("Outros / generalista", "Gráfica / editora", "Comunicação visual", "Eventos / cenografia"):
        return "Generalista que entrega craft"
    if frente == "eventos" or tipo == "Eventos / cenografia":
        return "Eventos e cenografia"
    if frente in ("grafica", "comvisual", "ooh") or tipo in ("Gráfica / editora", "Comunicação visual"):
        return "Gráfica e comunicação visual"
    return "Outros"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("dados"); ap.add_argument("saida"); ap.add_argument("--existentes", default="")
    a = ap.parse_args()
    hoje = date.today()
    exist = set(open(a.existentes).read().split()) if a.existentes and os.path.exists(a.existentes) else set()
    os.makedirs(f"{a.saida}/docs", exist_ok=True)
    writes, vistos, n_lidos = [], set(), 0
    for f in sorted(glob.glob(f"{a.dados}/dias/*.jsonl")):
        for l in open(f, encoding="utf-8"):
            it = json.loads(l); n_lidos += 1
            ctrl = it.get("numeroControlePNCP") or ""
            doc_id = re.sub(r"[^A-Za-z0-9_\-.~:@+]", "_", ctrl)
            if not ctrl or doc_id in exist or doc_id in vistos:
                continue
            fr, _ = classificar(it.get("objetoContrato"), it.get("informacaoComplementar"))
            if not fr or fornecedor_e_veiculo(it.get("nomeRazaoSocialFornecedor") or "", fr["id"]):
                continue  # fora do escopo, ruído, ou rádio/TV/jornal vendendo veiculação
            vg0 = it.get("valorGlobal") or 0
            # mesmo corte do arquivo publicado: frentes de craft e mídia exterior a partir de R$ 3 mil; gráfica e comunicação
            # visual só a partir de R$ 80 mil (são milhares de impressos pequenos por mês). Eventos saíram do escopo.
            if not ((fr["id"] in ("audiovisual", "publicidade", "cenografia", "fotografia", "conteudo", "transmissao", "audio", "design", "ooh") and vg0 >= 3000) or vg0 >= 80000):
                continue
            vistos.add(doc_id)
            org, uni = it.get("orgaoEntidade") or {}, it.get("unidadeOrgao") or {}
            vf, vi = d(it.get("dataVigenciaFim")), d(it.get("dataVigenciaInicio"))
            pf = it.get("tipoPessoa") == "PF"
            nome = (it.get("nomeRazaoSocialFornecedor") or "").strip()
            vg = it.get("valorGlobal") or 0
            if vg >= (400e6 if fr["id"] == "publicidade" else 100e6):
                vg = 0  # valor provavelmente digitado errado
            m = re.match(r"(\d{14})-2-0*(\d+)/(\d{4})", ctrl)
            tipo = "Pessoa física" if pf else tipo_empresa(nome)
            mei = (not pf) and bool(MEI.match(nome))
            doc = {
                "id": ctrl, "link": f"https://pncp.gov.br/app/contratos/{m.group(1)}/{m.group(3)}/{m.group(2)}" if m else "",
                "orgao": (org.get("razaoSocial") or "").strip(), "cnpjOrgao": org.get("cnpj") or "", "esfera": ESF.get(org.get("esferaId"), ""),
                "uf": uni.get("ufSigla") or "", "municipio": uni.get("municipioNome") or "",
                "fornecedor": "Pessoa física" if pf else nome, "cnpj": "" if pf else (it.get("niFornecedor") or ""),
                "objeto": re.sub(r"\s+", " ", (it.get("objetoContrato") or "").strip())[:200], "frente": fr["id"], "tipo": (it.get("tipoContrato") or {}).get("nome", ""),
                "valor": vg, "inicio": (it.get("dataVigenciaInicio") or "")[:10], "fim": (it.get("dataVigenciaFim") or "")[:10],
                "meses": round((vf - vi).days / 30.44, 1) if vf and vi and vf >= vi else None,
                "status": "sem data" if not vf else ("vigente" if vf >= hoje else "encerrado"), "modalidade": "", "estimadoCompra": None, "srp": None,
                "tipoEmpresa": tipo, "segmento": "Pessoa física" if pf else seg_de(tipo, fr["id"], vg, mei), "publicado": (it.get("dataPublicacaoPncp") or "")[:10],
            }
            p = f"{a.saida}/docs/{doc_id}.json"
            json.dump(doc, open(p, "w"), ensure_ascii=False)
            writes.append({"op": "set", "collection": "contratos_novos", "doc_id": doc_id, "file_path": os.path.abspath(p)})
    for i in range(0, len(writes), 50):
        json.dump(writes[i:i + 50], open(f"{a.saida}/lote_{i // 50:02d}.json", "w"))
    print(json.dumps({"lidos": n_lidos, "novos": len(writes), "lotes": (len(writes) + 49) // 50}))


if __name__ == "__main__":
    main()
