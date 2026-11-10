#!/usr/bin/env python3
"""Nota de prioridade dos alvos da Captação (PRODUCERia Studio).

Lê os alvos exportados do Studio (<pasta>/<id>.json) e calcula, para cada um, uma nota de 0 a 100
que diz por onde começar: perfil do alvo, quão recente é o gatilho, relação prévia, contato conhecido
e alertas que a própria equipe escreveu nas notas. Grava lotes de "update" (nota, notaMotivo, notaEm)
só para os alvos cuja nota mudou. Só usa a biblioteca padrão.

  python3 nota.py --alvos pasta_alvos --saida out [--versoes versoes.json]
versoes.json (opcional): {"<doc_id>": <version>} para pinar cada escrita (if_version).
"""
from __future__ import annotations
import argparse, json, os, re, unicodedata
from datetime import date, datetime, timedelta, timezone

BRT = timezone(timedelta(hours=-3))
BASE = {"independente": 30, "publica": 28, "inhouse": 22, "eua": 22, "rede": 10}
RELACAO = ["ja trabalhou", "cliente historico", "relacao existente", "mapeamento interno", "ja atendemos", "ex-cliente"]
BAIXA = ["prioridade baixa", "encaixe menor", "producao propria", "wpp production", "hogarth"]
DUVIDA = ["confirmar", "hipotese", "nao confirmada", "nao verificado", "nao informad"]
FIM = {"Cliente", "Descartado"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower())


def datas(texto: str, hoje: date):
    """datas citadas no gatilho, na fonte (URL com /AAAA/MM/) e nas notas"""
    out = []
    for d, m, a in re.findall(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", texto):
        try: out.append(date(int(a), int(m), int(d)))
        except ValueError: pass
    for d, m in re.findall(r"\b(\d{1,2})/(\d{1,2})\b(?!/)", texto):  # "5/11" sem ano: ano corrente ou anterior
        try:
            x = date(hoje.year, int(m), int(d))
            out.append(x if x <= hoje + timedelta(days=7) else date(hoje.year - 1, int(m), int(d)))
        except ValueError: pass
    for a, m in re.findall(r"/(20\d{2})/(\d{2})(?:/|$)", texto):
        try: out.append(date(int(a), int(m), 1))
        except ValueError: pass
    for a in re.findall(r"\b(20[12]\d)\b", texto):
        out.append(date(int(a), 12, 31))  # só o ano: conta como fim do ano
    return [d for d in out if d <= hoje + timedelta(days=7)]


def pontuar(a: dict, hoje: date):
    motivos, n = [], BASE.get(a.get("perfil"), 20)
    motivos.append(f"perfil {a.get('perfil')} (+{n})")
    texto = " ".join(str(a.get(k) or "") for k in ("gatilho", "fonte", "notas"))
    t = norm(texto)
    ds = datas(texto, hoje)
    if ds:
        dias = (hoje - max(ds)).days
        if dias <= 45: g, rot = 30, "gatilho recente"
        elif dias <= 180: g, rot = 20, "gatilho do semestre"
        elif dias <= 400: g, rot = 8, "gatilho do último ano"
        else: g, rot = 0, "gatilho antigo: verificar antes de abordar"
        motivos.append(f"{rot} ({max(ds).strftime('%m/%Y')}, +{g})"); n += g
    else:
        n += 5; motivos.append("gatilho sem data (+5)")
    if any(k in t for k in RELACAO):
        n += 30; motivos.append("relação prévia (+30)")
        if ds and (hoje - max(ds)).days > 180:
            n += 10; motivos.append("a relação vale mais que o gatilho velho (+10)")
    if (a.get("contato") or "").strip():
        n += 10; motivos.append("contato conhecido (+10)")
    else:
        motivos.append("sem contato")
    if a.get("abordagem"):
        n += 5; motivos.append("abordagem pronta (+5)")
    if any(k in t for k in BAIXA):
        n -= 15; motivos.append("equipe marcou encaixe menor (-15)")
    if any(k in t for k in DUVIDA):
        n -= 5; motivos.append("dado a confirmar (-5)")
    return max(0, min(100, n)), "; ".join(motivos)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--alvos", required=True)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--versoes")
    a = ap.parse_args()
    hoje = datetime.now(BRT).date()
    vers = json.load(open(a.versoes)) if a.versoes else {}
    os.makedirs(a.saida, exist_ok=True)
    writes, linhas = [], []
    for nome in sorted(os.listdir(a.alvos)):
        if not nome.endswith(".json"): continue
        d = json.load(open(os.path.join(a.alvos, nome), encoding="utf-8"))
        d = d.get("data", d)
        did = nome[:-5]
        if d.get("status") in FIM: continue
        nota, motivo = pontuar(d, hoje)
        linhas.append((nota, d.get("nome", did), d.get("status"), motivo))
        if d.get("nota") == nota and d.get("notaMotivo") == motivo: continue
        w = {"op": "update", "collection": "alvos", "doc_id": did,
             "data": {"nota": nota, "notaMotivo": motivo, "notaEm": hoje.isoformat()}}
        if did in vers: w["if_version"] = vers[did]
        writes.append(w)
    for i in range(0, len(writes), 50):
        json.dump(writes[i:i + 50], open(os.path.join(a.saida, f"lote_{i // 50 + 1:02d}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    with open(os.path.join(a.saida, "ranking.md"), "w", encoding="utf-8") as f:
        for nota, nome, st, mot in sorted(linhas, reverse=True):
            f.write(f"- **{nota}** · {nome} · {st} · {mot}\n")
    print(json.dumps({"alvos": len(linhas), "alterados": len(writes)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
