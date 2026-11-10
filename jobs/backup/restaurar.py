#!/usr/bin/env python3
"""Prepara a restauração de um backup feito por empacotar.py.

Gera SAIDA/docs/<coleção>/<doc_id>.json e SAIDA/lote_NN.json (listas de até 50 writes {op:"set", collection,
doc_id, file_path}) para o ArtifactData "batch". Não grava nada sozinho: quem restaura revisa e envia os lotes.
Documentos que já existem no banco precisam de if_version; use --colecoes para restaurar só parte.

Uso: python3 restaurar.py studio-backup-AAAA-MM-DD.json.gz SAIDA [--colecoes alvos,b2g]"""
import argparse
import gzip
import json
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("backup")
    ap.add_argument("saida")
    ap.add_argument("--colecoes", default="")
    a = ap.parse_args()
    pacote = json.loads(gzip.decompress(open(a.backup, "rb").read()))
    so = {c for c in a.colecoes.split(",") if c}
    writes = []
    for col, docs in pacote["colecoes"].items():
        if so and col not in so:
            continue
        os.makedirs(os.path.join(a.saida, "docs", col), exist_ok=True)
        for k, d in docs.items():
            p = os.path.abspath(os.path.join(a.saida, "docs", col, f"{k}.json"))
            json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
            writes.append({"op": "set", "collection": col, "doc_id": k, "file_path": p})
    for i in range(0, len(writes), 50):
        json.dump(writes[i:i + 50], open(os.path.join(a.saida, f"lote_{i // 50:02d}.json"), "w"))
    print(json.dumps({"backup": pacote["meta"]["data"], "writes": len(writes), "lotes": (len(writes) + 49) // 50}))


if __name__ == "__main__":
    main()
