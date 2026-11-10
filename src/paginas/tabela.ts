// Tabela de serviços: a planilha da casa linha por linha, com o desconto % de cada serviço (config/descontos).
// O desconto vale para a equipe toda e entra sozinho em toda proposta nova (Captação) e nos orçamentos.
import { esc, int, brl } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { SERVICOS, type Servico } from '../lib/servicos';
import { seletor } from './dom';
import { kpis, vazio, confirmarNoBotao } from '../componentes';

export const CATEGORIAS = [...new Set(SERVICOS.map((s) => s.cat))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export const ETAPAS = ['CRIAÇÃO', 'FINALIZAÇÃO', 'ADAPTAÇÃO'];
export const SITUACOES = ['Igual ao SINAPRO', 'Fora do SINAPRO', 'Divergente · atualizar'];
const POR_PAGINA = 100;

/** Situação do serviço frente ao SINAPRO, a partir da coluna da planilha. */
export function situacao(s: Pick<Servico, 'status'>): { rotulo: string; tag: string } {
  const a = (s.status || '').toUpperCase();
  if (a.startsWith('VALOR IGUAL')) return { rotulo: 'Igual ao SINAPRO', tag: 'ok' };
  if (a.startsWith('DIVERGENTE')) return { rotulo: 'Divergente · atualizar', tag: 'aviso' };
  if (a.startsWith('ÓRFÃO') || a.startsWith('ORFAO')) return { rotulo: 'Fora do SINAPRO', tag: 'w' };
  return { rotulo: 'Sem comparação', tag: 'w' };
}
/** "15", "12,5" → número entre 0 e 100. */
export const pctDe = (s: string) => Math.max(0, Math.min(100, Number(s.replace(',', '.')) || 0));
const pctTexto = (n: number) => n.toFixed(2).replace('.', ',');
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const indice = SERVICOS.map((s) => sem(`${s.id} ${s.cat} ${s.sub} ${s.esp} ${s.etapa} ${s.sinaproNome || ''}`));

export interface Filtros { busca: string; cat: string; etapa: string; situacao: string; soComDesconto: boolean }
export function filtrar(f: Filtros, descontos: Record<string, number>): Servico[] {
  const termos = sem(f.busca).split(/\s+/).filter(Boolean);
  return SERVICOS.filter((s, i) => (!f.cat || s.cat === f.cat)
    && (!f.etapa || (f.etapa === 'sem etapa' ? !s.etapa : s.etapa === f.etapa))
    && (!f.situacao || situacao(s).rotulo === f.situacao)
    && termos.every((t) => indice[i].includes(t))
    && (!f.soComDesconto || !!descontos[String(s.id)]));
}

/** Aplica mudanças sobre os descontos atuais: arredonda a 2 casas, limita a 0–100 e tira os zerados. */
export function mesclarDescontos(atual: Record<string, number>, mudancas: Record<string, number>): Record<string, number> {
  const r = { ...atual };
  for (const [id, v] of Object.entries(mudancas)) {
    const n = Math.max(0, Math.min(100, Math.round(100 * v) / 100));
    if (n) r[id] = n; else delete r[id];
  }
  return r;
}

interface Downloads { save(o: { filename: string; data: string }): Promise<{ status?: string } | void> }
const etapaTexto = (e: string) => (e ? e.charAt(0) + e.slice(1).toLowerCase() : '—');

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc tb">
  <header class="page-head"><span class="eyebrow">Tabela de serviços</span><h1 class="d d-title">Planilha com desconto</h1>
    <p class="lead measure muted">A planilha do Luciano completa, linha por linha. Preencha o desconto % de cada serviço: ele vale para a equipe toda e entra sozinho em toda proposta e orçamento novo.</p></header>
  <div id="tbK"></div><div id="tbVazio"></div>
  <div class="vc-campos tb-filtros">
    <div class="f vc-q"><label for="tbQ">Buscar</label><input id="tbQ" type="search" placeholder="Serviço, categoria ou ID"></div>
    <div class="f"><label for="tbC">Categoria</label><select id="tbC"><option value="">Todas</option>${CATEGORIAS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
    <div class="f"><label for="tbE">Etapa</label><select id="tbE"><option value="">Todas</option>${ETAPAS.map((e) => `<option value="${e}">${etapaTexto(e)}</option>`).join('')}<option value="sem etapa">Sem etapa</option></select></div>
    <div class="f"><label for="tbS">Frente ao SINAPRO</label><select id="tbS"><option value="">Todas</option>${SITUACOES.map((s) => `<option>${s}</option>`).join('')}</select></div>
  </div>
  <div class="lc-box tb-lote" role="group" aria-label="Desconto em lote">
    <div class="f"><label for="tbL">Desconto em lote (%)</label><input id="tbL" class="num" inputmode="decimal" placeholder="Ex.: 15"></div>
    <button type="button" class="sm" id="tbAplicar" disabled>Aplicar</button><button type="button" class="ghost sm" id="tbZerar">Zerar desconto</button>
    <button type="button" class="chip" id="tbSo" aria-pressed="false">Só com desconto</button><span class="tb-esp"></span>
    <button type="button" class="ghost sm" id="tbCSV">Baixar planilha (CSV)</button></div>
  <p class="sr" id="tbLive" aria-live="polite" aria-atomic="true"></p>
  <div class="tb-pag-l"><span class="note" id="tbN"></span><div id="tbP1"></div></div>
  <div class="tw"><table class="vc-t tb-t"><thead><tr><th scope="col" class="num"><span class="th">ID</span></th><th scope="col"><span class="th">Categoria</span></th><th scope="col"><span class="th">Subcategoria</span></th><th scope="col"><span class="th">Especificação</span></th><th scope="col"><span class="th">Etapa</span></th><th scope="col" class="num"><span class="th">Referência</span></th><th scope="col" class="num"><span class="th">Desc. %</span></th><th scope="col" class="num"><span class="th">Com desconto</span></th><th scope="col" class="num"><span class="th">SINAPRO</span></th><th scope="col"><span class="th">Situação</span></th></tr></thead><tbody id="tbB"></tbody></table></div>
  <div class="tb-pag-l fim"><span></span><div id="tbP2"></div></div>
  <p class="note">Fonte: “Planilha - Luciano - Finalizada” (abas Com Desconto, Mescla e Sinapro). Valor com desconto = referência × (1 − desconto %). Descontos são salvos ao sair do campo.</p>
</div>`;
  const $ = seletor(root);
  let descontos: Record<string, number> = {}, db: Banco | null = null, pagina = 0;
  const f: Filtros = { busca: '', cat: '', etapa: '', situacao: '', soComDesconto: false };
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#tbLive').textContent = t; };
  const filtrado = () => !!(f.busca || f.cat || f.etapa || f.situacao || f.soComDesconto);

  async function salvar(mudancas: Record<string, number>) {
    const novos = mesclarDescontos(descontos, mudancas);
    if (!db) { descontos = novos; render(); avisar('Sem o banco do Studio: o desconto vale só nesta sessão.'); return true; }
    try { await db.collection('config').doc('descontos').set({ valores: novos, em: new Date().toISOString() }); descontos = novos; return true; }
    catch { avisar('Não foi possível salvar o desconto.'); return false; }
  }

  function topo() {
    const com = SERVICOS.filter((s) => descontos[String(s.id)]), media = com.length ? com.reduce((s, x) => s + descontos[String(x.id)], 0) / com.length : 0;
    const n = (r: string) => SERVICOS.filter((s) => situacao(s).rotulo === r).length;
    $('#tbK').innerHTML = `<div class="kpis">${kpis([
      { rotulo: 'Serviços', valor: `<b>${int(SERVICOS.length)}</b>`, nota: `${CATEGORIAS.length} categorias` },
      { rotulo: 'Com desconto preenchido', valor: `<b>${int(com.length)}</b>`, nota: com.length ? `média ${pctTexto(media)}%` : 'nenhum ainda' },
      { rotulo: 'Iguais ao SINAPRO', valor: `<b>${int(n('Igual ao SINAPRO'))}</b>`, nota: `${n('Fora do SINAPRO')} fora do SINAPRO` },
      { rotulo: 'Divergentes', valor: `<b class="quente">${int(n('Divergente · atualizar'))}</b>`, nota: 'marcados para atualizar' },
    ])}</div>`;
    $('#tbVazio').innerHTML = com.length ? '' : `<div class="lc-box"><p><b>Nenhum desconto definido ainda</b></p><p class="note">Até alguém preencher, as propostas saem com o valor cheio da tabela. O jeito mais rápido: filtre uma categoria (ex.: Arte-final), digite o % em “Desconto em lote” e aplique. Depois ajuste linha a linha o que for diferente.</p></div>`;
  }

  function pager(total: number) {
    if (total <= 1) return '';
    return `<div class="acts" role="group" aria-label="Páginas"><button type="button" class="ghost sm" data-pag="${pagina - 1}" ${pagina === 0 ? 'disabled' : ''}>Anterior</button>${Array.from({ length: total }, (_, i) => `<button type="button" class="chip" data-pag="${i}" aria-pressed="${i === pagina}" aria-label="Página ${i + 1}">${i + 1}</button>`).join('')}<button type="button" class="ghost sm" data-pag="${pagina + 1}" ${pagina >= total - 1 ? 'disabled' : ''}>Próxima</button></div>`;
  }

  function lista() {
    const L = filtrar(f, descontos), total = Math.max(1, Math.ceil(L.length / POR_PAGINA));
    pagina = Math.min(pagina, total - 1);
    const P = L.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
    $('#tbN').textContent = `${int(L.length)} serviço(s) · página ${pagina + 1} de ${total}`;
    $('#tbP1').innerHTML = pager(total); $('#tbP2').innerHTML = pager(total);
    $('#tbAplicar').textContent = `Aplicar aos ${int(L.length)} ${filtrado() ? 'filtrados' : 'serviços'}`;
    $('#tbZerar').setAttribute('aria-label', `Zerar o desconto dos ${int(L.length)} ${filtrado() ? 'filtrados' : 'serviços'}`);
    const foco = document.activeElement as HTMLElement | null, focoId = foco?.dataset?.desc;
    $('#tbB').innerHTML = P.length ? P.map((s) => {
      const d = descontos[String(s.id)] || 0, st = situacao(s);
      return `<tr><td class="num">${s.id}</td><td class="note">${esc(s.cat)}</td><td>${esc(s.sub || '—')}</td><td>${esc(s.esp || '—')}</td><td class="note">${etapaTexto(s.etapa)}</td>
        <td class="num">${brl(s.ref)}</td><td class="num"><input class="num tb-in${d ? ' com' : ''}" inputmode="decimal" data-desc="${s.id}" aria-label="Desconto % do serviço ${s.id}" value="${d ? pctTexto(d) : ''}" placeholder="0"></td>
        <td class="num${d ? ' tb-com' : ''}">${brl(s.ref * (1 - d / 100))}</td><td class="num">${s.sinapro ? brl(s.sinapro) : '—'}</td><td><span class="tag ${st.tag}">${st.rotulo}</span></td></tr>`;
    }).join('') : `<tr><td colspan="10">${vazio({ titulo: 'Nenhum serviço com esses filtros', texto: 'Tire um filtro ou mude a busca.' })}</td></tr>`;
    if (focoId) root.querySelector<HTMLElement>(`[data-desc="${focoId}"]`)?.focus();
  }
  const render = () => { topo(); lista(); };

  async function baixar() {
    const q = (v: unknown) => { const a = String(v); return /[;"\n]/.test(a) ? '"' + a.replace(/"/g, '""') + '"' : a; };
    const linhas = SERVICOS.map((s) => { const d = descontos[String(s.id)] || 0; return [s.id, s.cat, s.sub, s.esp, s.etapa, pctTexto(s.ref), pctTexto(d), pctTexto(s.ref * (1 - d / 100)), s.sinapro ? pctTexto(s.sinapro) : '', situacao(s).rotulo].map(q).join(';'); });
    const data = '﻿' + ['ID_SERVICO;CATEGORIA;SUBCATEGORIA;ESPECIFICACAO;ETAPA;VALOR DE REFERENCIA;DESCONTO %;VALOR COM DESCONTO;VALOR SINAPRO;SITUACAO SINAPRO', ...linhas].join('\n');
    try {
      const d = (await window.claude?.use('downloads')) as Downloads | undefined;
      if (!d) { avisar('Download disponível só com o Studio aberto no Claude.'); return; }
      const r = await d.save({ filename: 'tabela-produceria-com-desconto.csv', data });
      if (r && r.status === 'saved') avisar('Arquivo salvo: tabela-produceria-com-desconto.csv');
    } catch (e) { if ((e as { code?: string })?.code !== 'declined') avisar('Não foi possível gerar o arquivo agora.'); }
  }

  async function lote(v: number) {
    const L = filtrar(f, descontos);
    if (!L.length) return;
    if (await salvar(Object.fromEntries(L.map((s) => [String(s.id), v])))) {
      render();
      avisar(v ? `${pctTexto(v)}% aplicado a ${L.length} serviço(s).` : `Desconto zerado em ${L.length} serviço(s).`);
    }
  }

  // ---------------------------------------------------------------- eventos
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'tbQ') { f.busca = t.value; pagina = 0; lista(); }
    else if (t.id === 'tbL') $<HTMLButtonElement>('#tbAplicar').disabled = !t.value.trim();
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLSelectElement;
    const k = ({ tbC: 'cat', tbE: 'etapa', tbS: 'situacao' } as const)[t.id as 'tbC'];
    if (k) { f[k] = t.value; pagina = 0; lista(); }
  });
  root.addEventListener('focusout', async (ev) => {
    const t = ev.target as HTMLInputElement;
    if (!t.dataset.desc) return;
    const id = t.dataset.desc, atual = descontos[id] || 0, novo = pctDe(t.value);
    if (novo === atual) { t.value = atual ? pctTexto(atual) : ''; return; }
    if (await salvar({ [id]: novo })) { topo(); avisar(`Serviço ${id}: ${novo ? pctTexto(novo) + '% de desconto' : 'sem desconto'}.`); const tr = t.closest('tr'); if (tr) { const s = SERVICOS.find((x) => String(x.id) === id)!; tr.children[7].textContent = brl(s.ref * (1 - novo / 100)); tr.children[7].classList.toggle('tb-com', !!novo); t.classList.toggle('com', !!novo); t.value = novo ? pctTexto(novo) : ''; } }
  });
  root.addEventListener('keydown', (ev) => { const t = ev.target as HTMLInputElement; if (t.dataset.desc && ev.key === 'Enter') t.blur(); });
  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.pag !== undefined) { pagina = Number(b.dataset.pag); lista(); root.querySelector<HTMLElement>(`#tbP1 [data-pag="${pagina}"][aria-pressed]`)?.focus(); return; }
    if (b.id === 'tbAplicar') { lote(pctDe($<HTMLInputElement>('#tbL').value)); return; }
    if (b.id === 'tbSo') { f.soComDesconto = !f.soComDesconto; b.setAttribute('aria-pressed', String(f.soComDesconto)); pagina = 0; lista(); return; }
    if (b.id === 'tbCSV') baixar();
  });
  confirmarNoBotao($<HTMLButtonElement>('#tbZerar'), 'Confirmar: zerar', () => lote(0));

  render();
  (async () => {
    db = await banco();
    if (!db) return;
    offs.push(db.collection<{ valores?: Record<string, number> }>('config').onSnapshot((s) => {
      const d = s.docs.find((x) => x.id === 'descontos');
      descontos = d?.data().valores || {};
      const a = document.activeElement as HTMLElement | null;
      if (a?.dataset?.desc) topo(); else render();
    }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
