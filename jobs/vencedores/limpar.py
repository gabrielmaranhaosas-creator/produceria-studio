#!/usr/bin/env python3
"""Limpa o mapa de vencedores publicado (vencedores.json) com o escopo atual de classes.py.

Tira os contratos de eventos e o ruído (cursos, software, compra de equipamento, obra, rádio e jornal que vendem
veiculação, decoração de Natal, locação de palco e som...). Gráfica, comunicação visual e mídia exterior ficam: são
núcleo da PRODUCERIA.

Os totais de empresas, órgãos e preços vieram de uma base maior que a lista de contratos do arquivo (empenhos e
contratos pequenos), por isso eles são ajustados por subtração do que saiu; calendário e modalidades são recalculados
a partir da lista limpa.

Uso: python3 limpar.py vencedores.json SAIDA_DIR
Grava SAIDA_DIR/vencedores.json e SAIDA_DIR/removidos.json; imprime um resumo."""
import collections
import json
import os
import sys

from classes import FRENTES, MEI, fornecedor_e_veiculo, norm, ruido
from novos import seg_de

SEM_CRAFT = {"grafica", "comvisual", "ooh", "eventos"}  # mesma regra do valorCraft original


def motivo(c):
    if c.get("frente") == "eventos":
        return "eventos (fora do escopo)"
    t = norm(c.get("objeto"))
    fs = [f["id"] for f in FRENTES if f["inc"].search(t) and not (f["exc"].pattern and f["exc"].search(t))]
    m = ruido(t, fs or [c.get("frente")])
    if m:
        return m
    if fornecedor_e_veiculo(c.get("fornecedor") or "", c.get("frente")):
        return "rádio, TV ou jornal (veiculação)"
    return None


def main():
    src, out = sys.argv[1], sys.argv[2]
    A = json.load(open(src, encoding="utf-8"))
    os.makedirs(out, exist_ok=True)
    fica, sai = [], []
    for c in A["contratos"]:
        m = motivo(c)
        (sai if m else fica).append((c, m))
    kept = [c for c, _ in fica]
    rem = [c for c, _ in sai]

    # ---------------- empresas
    rem_by = collections.defaultdict(list)
    kept_by = collections.defaultdict(list)
    for c in rem:
        if c.get("cnpj"):
            rem_by[c["cnpj"][:8]].append(c)
    for c in kept:
        if c.get("cnpj"):
            kept_by[c["cnpj"][:8]].append(c)
    empresas, emp_out = [], 0
    for e in A["empresas"]:
        r = e.get("raiz") or e["cnpj"][:8]
        rs, ks = rem_by.get(r, []), kept_by.get(r, [])
        e = {**e, "frentes": dict(e["frentes"]), "ufs": dict(e["ufs"]), "orgaos": list(e["orgaos"])}
        ev_fora = e["frentes"].get("eventos", 0) - sum(1 for c in rs if c["frente"] == "eventos")  # eventos pequenos fora do arquivo
        e["contratos"] -= len(rs) + max(0, ev_fora)
        for c in rs:
            e["frentes"][c["frente"]] = e["frentes"].get(c["frente"], 0) - 1
            if c.get("uf"):
                e["ufs"][c["uf"]] = e["ufs"].get(c["uf"], 0) - 1
            v = c.get("valor") or 0
            e["valorTotal"] -= v
            if c["frente"] not in SEM_CRAFT:
                e["valorCraft"] -= v
            if c.get("status") == "vigente":
                e["vigentes"] -= 1
                e["valorVigente"] -= v
        e["frentes"].pop("eventos", None)
        e["frentes"] = {k: v for k, v in e["frentes"].items() if v > 0}
        e["ufs"] = {k: v for k, v in e["ufs"].items() if v > 0}
        if e["contratos"] <= 0 or not e["frentes"] or fornecedor_e_veiculo(e["nome"], max(e["frentes"], key=e["frentes"].get)):
            emp_out += 1
            continue
        for k in ("valorTotal", "valorCraft", "valorVigente"):
            e[k] = round(max(0.0, e[k]), 2)
        e["vigentes"] = max(0, e["vigentes"])
        fp_antes = e["frentePrincipal"]
        e["frentePrincipal"] = max(e["frentes"], key=e["frentes"].get)
        if rs:
            so_rem = {c["orgao"] for c in rs} - {c["orgao"] for c in ks}
            e["orgaos"] = [o for o in e["orgaos"] if o not in so_rem]
            e["nOrgaos"] = len(e["orgaos"])
            ids_rem = {c["id"] for c in rs}
            if e.get("maior") in ids_rem:
                e["maior"] = max(ks, key=lambda c: c.get("valor") or 0)["id"] if ks else ""
            if any(c.get("fim") == e.get("proximoFim") for c in rs):
                fims = [c["fim"] for c in ks if c.get("status") == "vigente" and c.get("fim")]
                e["proximoFim"] = min(fims) if fims else ""
        if fp_antes != e["frentePrincipal"] or e["segmento"] == "Eventos e cenografia":
            if e["segmento"] not in ("Entidade ou empresa pública", "Microempreendedor (MEI)"):
                e["segmento"] = seg_de(e["tipo"], e["frentePrincipal"], e["valorTotal"], bool(MEI.match(e["nome"])))
        empresas.append(e)
    empresas.sort(key=lambda e: (-e.get("prioridade", 0), -e.get("valorVigente", 0)))

    # ---------------- órgãos
    rem_org = collections.defaultdict(list)
    for c in rem:
        rem_org[c.get("cnpjOrgao")].append(c)
    orgaos, org_out = [], 0
    for o in A["orgaos"]:
        rs = rem_org.get(o["cnpj"], [])
        o = {**o, "frentes": dict(o["frentes"])}
        ev_fora = o["frentes"].get("eventos", 0) - sum(1 for c in rs if c["frente"] == "eventos")
        o["contratos"] -= len(rs) + max(0, ev_fora)
        for c in rs:
            o["frentes"][c["frente"]] = o["frentes"].get(c["frente"], 0) - 1
            v = c.get("valor") or 0
            o["valorTotal"] -= v
            if c["frente"] not in SEM_CRAFT:
                o["valorCraft"] -= v
        o["frentes"].pop("eventos", None)
        o["frentes"] = {k: v for k, v in o["frentes"].items() if v > 0}
        if o["contratos"] <= 0 or not o["frentes"]:
            org_out += 1
            continue
        o["valorTotal"] = round(max(0.0, o["valorTotal"]), 2)
        o["valorCraft"] = round(max(0.0, o["valorCraft"]), 2)
        o["fornecedores"] = max(1, min(o["fornecedores"], o["contratos"]))
        orgaos.append(o)

    # ---------------- preços: sai eventos; nas outras frentes, desconta o que saiu
    precos = {k: dict(v) for k, v in A["precos"].items() if k != "eventos"}
    ev = A["precos"].get("eventos", {"n": 0, "total": 0, "vigentes": 0})
    rem_ne = [c for c in rem if c["frente"] != "eventos"]
    for c in rem_ne:
        p = precos.get(c["frente"])
        if not p:
            continue
        p["n"] -= 1
        p["nEmpenhos" if c.get("tipo") == "Empenho" else "nContratos"] -= 1
        p["total"] = round(p["total"] - (c.get("valor") or 0), 2)
        if c.get("status") == "vigente":
            p["vigentes"] -= 1

    # ---------------- calendário (vencimentos dos vigentes) e modalidades, a partir da lista limpa
    hoje = A["meta"]["geradoEm"][:7]
    cal = collections.defaultdict(lambda: [0, 0.0])
    mod = collections.defaultdict(lambda: [0, 0.0])
    for c in kept:
        v = c.get("valor") or 0
        if c.get("status") == "vigente" and c.get("fim") and c["fim"][:7] >= hoje and c.get("tipo") != "Empenho":
            cal[c["fim"][:7]][0] += 1
            cal[c["fim"][:7]][1] += v
        if c.get("modalidade"):
            mod[c["modalidade"]][0] += 1
            mod[c["modalidade"]][1] += v
    calendario = [{"mes": m, "contratos": n, "valor": round(v, 2)} for m, (n, v) in sorted(cal.items())][:19]
    modalidades = sorted(({"modalidade": m, "contratos": n, "valor": round(v, 2)} for m, (n, v) in mod.items()), key=lambda x: -x["contratos"])

    meta = dict(A["meta"])
    meta["noEscopo"] = A["meta"]["noEscopo"] - ev["n"] - len(rem_ne)
    meta["valorTotal"] = round(A["meta"]["valorTotal"] - ev["total"] - sum(c.get("valor") or 0 for c in rem_ne), 2)
    meta["vigentes"] = A["meta"]["vigentes"] - ev["vigentes"] - sum(1 for c in rem_ne if c.get("status") == "vigente")
    meta["empresas"] = A["meta"]["empresas"] - emp_out
    meta["orgaos"] = A["meta"]["orgaos"] - org_out
    meta["contratosNoArquivo"] = len(kept)
    meta["escopo"] = "2026-11-10: sem eventos; ruído retirado (classes.py). Gráfica, comunicação visual e mídia exterior são núcleo."

    novo = {**A, "meta": meta, "precos": precos, "calendario": calendario, "modalidades": modalidades,
            "empresas": empresas, "orgaos": orgaos, "contratos": kept}
    raw = json.dumps(novo, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    open(os.path.join(out, "vencedores.json"), "wb").write(raw)
    json.dump([{"id": c["id"], "frente": c["frente"], "motivo": m, "objeto": c["objeto"][:120]} for c, m in sai],
              open(os.path.join(out, "removidos.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(json.dumps({"contratos": [len(A["contratos"]), len(kept)], "empresas": [len(A["empresas"]), len(empresas)],
                      "orgaos": [len(A["orgaos"]), len(orgaos)],
                      "motivos": collections.Counter(m for _, m in sai).most_common(),
                      "porFrente": collections.Counter(c["frente"] for c in kept).most_common()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
