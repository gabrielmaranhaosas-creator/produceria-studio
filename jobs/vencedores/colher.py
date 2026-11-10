#!/usr/bin/env python3
"""Colhe contratos publicados no PNCP (API de consulta) e guarda só os que tocam o escopo da Produceria.
Uso: python3 colher.py SAIDA DATA_INI DATA_FIM [workers]
Grava SAIDA/dias/AAAAMMDD.jsonl (contratos do escopo) e SAIDA/dias/AAAAMMDD.ok (total lido), para retomar."""
import json, os, re, sys, time, unicodedata, urllib.request, urllib.parse, urllib.error
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor

API = "https://pncp.gov.br/api/consulta/v1/contratos"
def norm(s): s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode(); return re.sub(r"\s+", " ", s.lower())

# termos amplos (filtro de entrada); a classificação fina acontece depois, em analisar.py
TERMOS = [
 "audiovisual","audiovisuais","video","videos","filme","filmes","filmagem","videografia","documentario","pos-producao","pos producao","motion","animacao 2d","animacao 3d","animacao grafica","websérie","webserie","teaser","videoclipe",
 "transmissao ao vivo","transmissao online","streaming","live stream","webinar",
 "fotografi","fotografic","banco de imagens","cobertura audiovisual","drone",
 "cenografi","cenografic","direcao de arte","ambientacao","expografi","museografi","instalacao artistica","montagem de exposicao","exposicao",
 "mixagem","trilha sonora","locucao","producao de audio","spot","jingle","podcast",
 "campanha","publicidade","publicitari","propaganda","producao de conteudo","conteudo digital","redes sociais","comunicacao institucional","comunicacao social","identidade visual","marketing","design",
 "midia exterior","outdoor","painel de led","paineis de led","midia digital","dooh","front light","backlight",
 "organizacao de eventos","producao de eventos","estande","montagem de evento","cerimonial","eventos",
 "comunicacao visual","sinalizacao","fachada","totem","backdrop","letreiro",
 "servicos graficos","material grafico","grafica","graficos","impressao","impressos","banner","folder","cartilha","arte-final","arte final","diagramacao","editora","editorial","livro","revista",
]
TERMOS_N = [norm(t) for t in TERMOS]
RX = re.compile("|".join(r"(?<![a-z0-9])" + re.escape(t) for t in TERMOS_N))

def get(params, tent=5):
    url = API + "?" + urllib.parse.urlencode(params); err = None
    for n in range(tent):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "produceria-mapa-vencedores/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                if r.status == 204: return {"data": [], "totalPaginas": 0, "totalRegistros": 0}
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            if e.code == 204: return {"data": [], "totalPaginas": 0, "totalRegistros": 0}
            err = f"HTTP {e.code}"
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
        time.sleep(3 * (n + 1))
    raise RuntimeError(err)

def dia(saida, d, pool):
    tag = d.strftime("%Y%m%d"); okf = f"{saida}/dias/{tag}.ok"
    if os.path.exists(okf): return tag, "já"
    p1 = get({"dataInicial": tag, "dataFinal": tag, "pagina": 1, "tamanhoPagina": 500})
    tot = p1.get("totalPaginas") or 0; regs = p1.get("totalRegistros") or 0
    paginas = [p1]; falhas = []
    def pg(n):
        try: return n, get({"dataInicial": tag, "dataFinal": tag, "pagina": n, "tamanhoPagina": 500})
        except RuntimeError as e: return n, None
    if tot > 1:
        for n, r in pool.map(pg, range(2, tot + 1)):
            if r is None: falhas.append(n)
            else: paginas.append(r)
    lidos, guardados = 0, 0
    with open(f"{saida}/dias/{tag}.jsonl", "w", encoding="utf-8") as f:
        for r in paginas:
            for it in r.get("data") or []:
                lidos += 1
                txt = norm((it.get("objetoContrato") or "") + " " + (it.get("informacaoComplementar") or ""))
                if RX.search(txt):
                    guardados += 1; f.write(json.dumps(it, ensure_ascii=False) + "\n")
    json.dump({"dia": tag, "registros": regs, "paginas": tot, "lidos": lidos, "guardados": guardados, "falhas": falhas}, open(okf if not falhas else okf + ".parcial", "w"))
    return tag, f"{lidos}/{regs} lidos, {guardados} no escopo" + (f", {len(falhas)} páginas falharam" if falhas else "")

def main():
    saida, ini, fim = sys.argv[1], date.fromisoformat(sys.argv[2]), date.fromisoformat(sys.argv[3])
    w = int(sys.argv[4]) if len(sys.argv) > 4 else 8
    os.makedirs(f"{saida}/dias", exist_ok=True)
    dias = [fim - timedelta(days=i) for i in range((fim - ini).days + 1)]  # do mais novo para o mais antigo
    with ThreadPoolExecutor(max_workers=w) as pool:
        for d in dias:
            t0 = time.time()
            try: tag, msg = dia(saida, d, pool)
            except Exception as e: tag, msg = d.isoformat(), f"ERRO {e}"
            print(f"{tag} {msg} ({time.time()-t0:.0f}s)", flush=True)

if __name__ == "__main__": main()
