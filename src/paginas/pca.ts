// PCA dos órgãos: o que cada órgão planeja contratar no ano que vem (Plano de Contratações Anual, PNCP),
// já filtrado pelo escopo do cérebro (jobs/pca). Entra como aba de Licitações.
import { esc, int, brl, brk, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { comId } from './dom';
import { kpis, vazio } from '../componentes';

export interface ItemPca { numero: number; descricao: string; frente: string; classe: string; valor: number | null; quantidade: number | null; unidadeFornecimento: string; dataDesejada: string | null; requisitante?: string; unidade?: string }
export interface Pca {
  id: string; ano: number; cnpj: string; orgao: string; unidades: string[]; codigoUnidade: string; idPca: string; atualizadoNoPncp: string | null;
  uf: string; municipio: string; esfera: string; itens: ItemPca[]; total: number; frentes: string[]; primeiraData: string | null; coletadoEm?: string;
}
export interface FiltroPca { frente: string; uf: string; q: string; ordem: 'valor' | 'data' }

/** Link público do PCA no PNCP: "04665345000115-0-000001/2027" → /app/pca/04665345000115/2027/1 */
export function linkPca(idPca: string): string {
  const m = /^(\d{14})-\d+-0*(\d+)\/(\d{4})$/.exec(idPca || '');
  return m ? `https://pncp.gov.br/app/pca/${m[1]}/${m[3]}/${m[2]}` : 'https://pncp.gov.br/app/pca';
}

export function filtrarPca(L: Pca[], f: FiltroPca): Pca[] {
  const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = sem(f.q.trim());
  return L.filter((p) => (!f.frente || p.frentes.includes(f.frente)) && (!f.uf || p.uf === f.uf)
    && (!q || sem(`${p.orgao} ${p.unidades.join(' ')} ${p.municipio} ${p.itens.map((i) => i.descricao).join(' ')}`).includes(q)))
    .sort((a, b) => (f.ordem === 'data' ? (a.primeiraData || '9').localeCompare(b.primeiraData || '9') : b.total - a.total));
}

const tituloFunil = (p: Pca) => `PCA ${p.ano} · ${p.orgao}`.slice(0, 140);

/** Monta a aba dentro de `el`. Devolve a função de desmontar. */
export function montarPca(el: HTMLElement, avisar: (t: string) => void): () => void {
  el.innerHTML = `<section class="lc-cerebro pca" aria-labelledby="pca-h"><h2 class="d d-sub" id="pca-h">O que os órgãos planejam contratar</h2>
    <p>O Plano de Contratações Anual (PCA, Lei 14.133/2021, art. 12) mostra o que cada órgão pretende comprar no ano seguinte. Quem chega antes do edital entra na pesquisa de preços e no cadastro de fornecedores. Aqui só ficam os itens que passam pelo mesmo filtro do radar.</p>
    <p class="note" id="pcaFonte"></p></section>
    <div id="pcaK"></div>
    <div class="lc-filtros"><div class="f lc-q"><label for="pcaQ">Buscar</label><input id="pcaQ" type="search" placeholder="Órgão, município ou item…"></div>
      <div class="f"><label for="pcaFr">Frente</label><select id="pcaFr"><option value="">Todas</option></select></div>
      <div class="f"><label for="pcaUF">UF</label><select id="pcaUF"><option value="">Todo o Brasil</option></select></div>
      <div class="f"><label for="pcaO">Ordem</label><select id="pcaO" class="lc-ord"><option value="valor">Maior valor</option><option value="data">Data desejada mais próxima</option></select></div></div>
    <div id="pcaL"><p class="note">Carregando…</p></div>`;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector(s) as T;
  let P: Pca[] = [], funil: { titulo?: string }[] = [], db: Banco | null = null, carregado = false, limite = 40;
  const abertos = new Set<string>();
  const f: FiltroPca = { frente: '', uf: '', q: '', ordem: 'valor' };
  const offs: (() => void)[] = [];

  function opcoes() {
    const fr = [...new Set(P.flatMap((p) => p.frentes))].sort(), ufs = [...new Set(P.map((p) => p.uf).filter(Boolean))].sort();
    $('#pcaFr').innerHTML = `<option value="">Todas</option>${fr.map((x) => `<option${x === f.frente ? ' selected' : ''}>${esc(x)}</option>`).join('')}`;
    $('#pcaUF').innerHTML = `<option value="">Todo o Brasil</option>${ufs.map((x) => `<option${x === f.uf ? ' selected' : ''}>${x}</option>`).join('')}`;
  }
  function render() {
    const anos = [...new Set(P.map((p) => p.ano))].sort(), itens = P.reduce((s, p) => s + p.itens.length, 0), total = P.reduce((s, p) => s + p.total, 0);
    const sp = P.filter((p) => p.uf === 'SP'), col = P.map((p) => p.coletadoEm || '').sort().pop();
    $('#pcaFonte').textContent = carregado && P.length ? `PCA ${anos.join(' e ')} publicados no PNCP${col ? `, coletados em ${dt(col)}` : ''}. Atualização mensal pela rotina do Claude.` : '';
    $('#pcaK').innerHTML = carregado && P.length ? `<div class="kpis">${kpis([
      { rotulo: 'Órgãos com demanda no escopo', valor: `<b>${int(P.length)}</b>`, nota: `${int(itens)} itens planejados` },
      { rotulo: 'Valor planejado', valor: `<b title="${esc(brl(total))}">${brk(total)}</b>`, nota: 'estimativa dos próprios órgãos' },
      { rotulo: 'Em São Paulo', valor: `<b>${int(sp.length)}</b>`, nota: sp.length ? brk(sp.reduce((s, p) => s + p.total, 0)) + ' planejados' : 'nenhum ainda' },
      { rotulo: 'No funil', valor: `<b>${int(P.filter((p) => funil.some((x) => x.titulo === tituloFunil(p))).length)}</b>`, nota: 'levados ao funil daqui' },
    ])}</div>` : '';
    const L = filtrarPca(P, f);
    $('#pcaL').innerHTML = !carregado ? '<p class="note">Carregando…</p>'
      : !P.length ? vazio({ titulo: 'Nenhum PCA coletado ainda', texto: 'A rotina mensal do Claude coleta os PCAs do PNCP e grava aqui só o que passa pelo filtro do radar. Até a primeira coleta, esta aba fica vazia.' })
      : !L.length ? vazio({ titulo: 'Nada com esses filtros', texto: 'Tire um filtro ou mude a busca.' })
      : `<p class="note">${int(L.length)} órgão(s)${f.ordem === 'valor' ? ', do maior valor planejado para o menor' : ', da data desejada mais próxima para a mais distante'}.</p>
      <ul class="lc-l">${L.slice(0, limite).map((p) => {
        const no = funil.some((x) => x.titulo === tituloFunil(p)), ab = abertos.has(p.id);
        return `<li class="lc-it pca-it"><div class="lc-c"><div class="lc-tags"><span class="tag">PCA ${p.ano}</span>${p.frentes.map((x) => `<span class="tag w">${esc(x)}</span>`).join('')}</div>
          <span class="lc-obj">${esc(p.orgao)}</span><span class="note">${esc([p.municipio, p.uf, p.esfera].filter(Boolean).join(' · '))}${p.unidades.length ? ` · ${p.unidades.length === 1 ? esc(p.unidades[0]) : `${p.unidades.length} secretarias/unidades`}` : ''}</span>
          <button type="button" class="lnk" data-pca-abre="${esc(p.id)}" aria-expanded="${ab}">${ab ? 'Fechar itens' : `Ver ${p.itens.length} item(ns)`}</button>
          ${ab ? `<ul class="pca-itens">${p.itens.map((i) => `<li><span>${esc(i.descricao)}</span><span class="note">${esc(i.frente)}${i.quantidade ? ` · ${String(i.quantidade).replace('.', ',')} ${esc(i.unidadeFornecimento || '')}` : ''}${i.dataDesejada ? ` · desejado para ${dt(i.dataDesejada)}` : ''}${i.unidade && p.unidades.length > 1 ? ` · ${esc(i.unidade)}` : ''}${i.requisitante ? ` · ${esc(i.requisitante)}` : ''}</span><span class="num">${i.valor ? brl(i.valor) : '—'}</span></li>`).join('')}</ul>` : ''}</div>
          <div class="lc-v"><span class="lc-val num" title="${esc(brl(p.total))}">${p.total ? brk(p.total) : '—'}</span>${p.primeiraData ? `<span class="note">a partir de ${dt(p.primeiraData)}</span>` : ''}
            <div class="lc-acts">${no ? '<span class="tag ok">No funil</span>' : `<button type="button" class="ghost sm" data-pca-funil="${esc(p.id)}">Levar ao funil</button>`}
            <a class="cn-f" href="${esc(linkPca(p.idPca))}" target="_blank" rel="noopener">PCA no PNCP ↗<span class="sr"> (abre em nova aba)</span></a></div></div></li>`;
      }).join('')}</ul>${L.length > limite ? `<button type="button" class="ghost sm" data-pca-mais="1">Mostrar mais ${int(Math.min(40, L.length - limite))}</button>` : ''}`;
  }

  el.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !el.contains(b)) return;
    const d = b.dataset;
    if (d.pcaAbre) { if (abertos.has(d.pcaAbre)) abertos.delete(d.pcaAbre); else abertos.add(d.pcaAbre); render(); el.querySelector<HTMLElement>(`[data-pca-abre="${CSS.escape(d.pcaAbre)}"]`)?.focus(); return; }
    if (d.pcaMais) { limite += 40; render(); return; }
    if (d.pcaFunil) {
      const p = P.find((x) => x.id === d.pcaFunil); if (!p) return;
      if (!db) { avisar('O funil só funciona com o banco do Studio.'); return; }
      const id = 'fn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      b.disabled = true;
      try {
        await db.collection('pipeline').doc(id).set({ id, eixo: 'Público', titulo: tituloFunil(p), alvo: p.orgao, valor: p.total || null, estagio: 'Identificada',
          proximoPasso: `Pedir ao setor de compras para participar da pesquisa de preços${p.primeiraData ? ` (demanda prevista a partir de ${dt(p.primeiraData)})` : ''}`,
          prazo: p.primeiraData || '', fonte: linkPca(p.idPca), criadoEm: new Date().toISOString(), origem: 'PCA' });
        avisar(`${p.orgao} entrou no funil, eixo Público.`);
      } catch { b.disabled = false; avisar('Não foi possível levar ao funil. Tente de novo.'); }
    }
  });
  el.addEventListener('input', (ev) => { const t = ev.target as HTMLInputElement; if (t.id === 'pcaQ') { f.q = t.value; limite = 40; render(); } });
  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLSelectElement;
    if (t.id === 'pcaFr') f.frente = t.value; else if (t.id === 'pcaUF') f.uf = t.value; else if (t.id === 'pcaO') f.ordem = t.value as FiltroPca['ordem']; else return;
    limite = 40; render();
  });

  render();
  (async () => {
    db = await banco();
    if (!db) { carregado = true; render(); return; }
    offs.push(db.collection<Pca>('pca').onSnapshot((s) => { P = s.docs.map(comId).map((p) => ({ ...p, itens: p.itens || [], frentes: p.frentes || [], unidades: p.unidades || [] })); carregado = true; opcoes(); render(); }, () => { carregado = true; render(); }));
    offs.push(db.collection<{ titulo?: string }>('pipeline').onSnapshot((s) => { funil = s.docs.map(comId); if (carregado) render(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
