#!/usr/bin/env python3
"""Empacota um backup do banco do Studio num único arquivo .json.gz.

Entrada: a pasta que o ArtifactData "list" com out_dir grava (<pasta>/<coleção>/<doc_id>.json).
Saída: studio-backup-AAAA-MM-DD.json.gz com {"meta": {...}, "colecoes": {coleção: {doc_id: documento}}}
e um resumo JSON no stdout (contagem por coleção e sha256 do arquivo).

Uso: python3 empacotar.py PASTA_EXPORTADA SAIDA_DIR [AAAA-MM-DD]
Só biblioteca padrão. O arquivo tem dados da equipe (leads, contatos): nunca o grave no repositório."""
import gzip
import hashlib
import json
import os
import sys
from datetime import date


def main():
    src, out = sys.argv[1], sys.argv[2]
    dia = sys.argv[3] if len(sys.argv) > 3 else date.today().isoformat()
    colecoes = {}
    for nome in sorted(os.listdir(src)):
        pasta = os.path.join(src, nome)
        if not os.path.isdir(pasta):
            continue
        docs = {}
        for f in sorted(os.listdir(pasta)):
            if f.endswith(".json") and not f.startswith("."):  # ignora marcadores ocultos do exportador
                docs[f[:-5]] = json.load(open(os.path.join(pasta, f), encoding="utf-8"))
        colecoes[nome] = docs
    contagem = {k: len(v) for k, v in colecoes.items()}
    pacote = {"meta": {"studio": "https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp", "data": dia,
                       "formato": 1, "contagem": contagem, "total": sum(contagem.values())},
              "colecoes": colecoes}
    os.makedirs(out, exist_ok=True)
    caminho = os.path.join(out, f"studio-backup-{dia}.json.gz")
    raw = json.dumps(pacote, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(caminho, "wb") as f:
        f.write(gzip.compress(raw, 9))
    sha = hashlib.sha256(open(caminho, "rb").read()).hexdigest()
    print(json.dumps({"arquivo": caminho, "bytes": os.path.getsize(caminho), "sha256": sha,
                      "total": pacote["meta"]["total"], "contagem": contagem}, ensure_ascii=False))


if __name__ == "__main__":
    main()
