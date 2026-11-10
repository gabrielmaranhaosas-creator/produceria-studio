#!/usr/bin/env python3
"""Confere se as rotinas agendadas no claude.ai batem com rotinas/*.md.

Entrada: o JSON da listagem de rotinas (RemoteTrigger action "list", salvo num arquivo).
Compara, para cada arquivo rotinas/<nome>.md, o texto do prompt, o horário (cron) e se está ativa.
Sai com código 1 e lista as diferenças quando algo não bate; rotinas sem arquivo também aparecem.

Uso: python3 rotinas/conferir.py listagem.json [--atualizar]
--atualizar regrava os .md a partir do que está agendado (use depois de mudar uma rotina no claude.ai)."""
import json
import os
import re
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ler_md(p):
    txt = open(p, encoding="utf-8").read()
    _, front, corpo = txt.split("---\n", 2)
    meta = {}
    for linha in front.strip().splitlines():
        k, _, v = linha.partition(": ")
        meta[k] = json.loads(v)
    return meta, corpo.strip()


def escrever_md(p, r):
    ds = r["derived_state"]
    meta = {"id": r["id"], "nome": r["name"], "cron": r["cron_expression"], "ativa": r["enabled"],
            "modelo": ds.get("model"), "permissao": ds.get("permission_mode"),
            "conectores": [c.get("name") for c in (r.get("mcp_connections") or [])]}
    front = "\n".join(f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in meta.items())
    open(p, "w", encoding="utf-8").write(f"---\n{front}\n---\n\n{ds['prompt'].rstrip()}\n")


def main():
    bruto = open(sys.argv[1], encoding="utf-8").read()
    dados, _ = json.JSONDecoder().raw_decode(bruto[bruto.index("{"):])
    atualizar = "--atualizar" in sys.argv
    difs = []
    vistos = set()
    for r in dados["data"]:
        p = os.path.join(AQUI, slug(r["name"]) + ".md")
        vistos.add(os.path.basename(p))
        if atualizar:
            escrever_md(p, r)
            continue
        if not os.path.exists(p):
            difs.append(f"{r['name']}: agendada no claude.ai, sem arquivo no repositório")
            continue
        meta, corpo = ler_md(p)
        if corpo != r["derived_state"]["prompt"].strip():
            difs.append(f"{r['name']}: o texto agendado é diferente do repositório")
        if meta.get("cron") != r["cron_expression"]:
            difs.append(f"{r['name']}: horário {r['cron_expression']} no claude.ai, {meta.get('cron')} no repositório")
        if meta.get("ativa") != r["enabled"]:
            difs.append(f"{r['name']}: {'ativa' if r['enabled'] else 'pausada'} no claude.ai, diferente do repositório")
    if not atualizar:
        for f in sorted(os.listdir(AQUI)):
            if f.endswith(".md") and f != "README.md" and f not in vistos:
                difs.append(f"{f}: está no repositório, mas não existe mais no claude.ai")
    if atualizar:
        print(f"{len(vistos)} rotinas regravadas")
        return
    print("\n".join(difs) if difs else f"ok: {len(vistos)} rotinas batem com o repositório")
    sys.exit(1 if difs else 0)


if __name__ == "__main__":
    main()
