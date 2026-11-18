/**
 * Kit de componentes compartilhados pelas páginas com código-fonte.
 * Tudo devolve HTML em texto (as páginas montam com innerHTML) ou liga comportamento num elemento existente.
 * Textos que vêm de dados passam sempre por `esc` antes de chegar aqui, exceto onde o parâmetro diz "html".
 */
import { esc } from '../lib/formato';

/**
 * Um indicador do topo da página: rótulo, número e uma nota curta. `valor` e `nota` já são HTML.
 * Todo número leva a algum lugar: `kpi` vira botão (`data-kpi`, a página filtra ou ordena a lista e rola até ela;
 * `ativo` marca o filtro ligado) e `href` vira link para a tela que detalha o número. `acao` é o verbo dito ao leitor
 * de tela e na dica ("Ver os 12", "Ordenar por valor").
 */
export interface Indicador { rotulo: string; valor: string; nota?: string; kpi?: string; href?: string; ativo?: boolean; acao?: string }

export function kpi(i: Indicador): string {
  const corpo = `<span class="kl">${esc(i.rotulo)}</span>${i.valor}<span class="kn">${i.nota ?? ''}</span>`;
  const dica = esc(i.acao || (i.href ? 'Abrir o detalhe' : 'Mostrar na lista'));
  if (i.href) { const fora = /^https?:/.test(i.href); return `<a class="k k-ir" href="${esc(i.href)}" title="${dica}"${fora ? ' target="_blank" rel="noopener"' : ''}>${corpo}<span class="k-seta" aria-hidden="true">${dica} ${fora ? '↗' : '→'}</span>${fora ? '<span class="sr"> (abre em nova aba)</span>' : ''}</a>`; }
  if (i.kpi) return `<button type="button" class="k k-ir" data-kpi="${esc(i.kpi)}" aria-pressed="${!!i.ativo}" title="${dica}">${corpo}<span class="k-seta" aria-hidden="true">${i.ativo ? 'Mostrando na lista abaixo' : dica + ' ↓'}</span></button>`;
  return `<div class="k">${corpo}</div>`;
}

/** Rola até o bloco que o número detalha e o destaca por um instante. */
export function irPara(alvo: Element | null): void {
  if (!alvo) return;
  const r = alvo.getBoundingClientRect();
  if (r.top < 0 || r.top > window.innerHeight * 0.6) alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  alvo.classList.remove('k-pisca'); void (alvo as HTMLElement).offsetWidth; alvo.classList.add('k-pisca');
}

/** Número formatado como valor de indicador (`<b>`), com dica opcional ao passar o mouse. */
export function numero(texto: string, dica?: string): string {
  return dica ? `<b title="${esc(dica)}">${texto}</b>` : `<b>${texto}</b>`;
}

export function kpis(lista: Indicador[]): string {
  return lista.map(kpi).join('');
}

/** Estado vazio: título, explicação e, se houver, uma ação (HTML). */
export function vazio(o: { titulo?: string; texto: string; acao?: string }): string {
  const t = o.titulo ? `<h2 class="d d-sub">${esc(o.titulo)}</h2>` : '';
  return `<div class="empty">${t}<p class="note">${o.texto}</p>${o.acao ?? ''}</div>`;
}

/** Etiqueta curta (serviço, perfil, frente). `fraca` usa o estilo secundário. */
export function etiqueta(texto: string, fraca = false): string {
  return `<span class="tag${fraca ? ' w' : ''}">${esc(texto)}</span>`;
}

/**
 * Confirmação em duas etapas no próprio botão. O visualizador do claude.ai bloqueia `confirm()`
 * (ele devolve sempre false), então a confirmação tem de estar na página: o primeiro clique troca o texto
 * do botão para `pergunta`; um segundo clique em até `ms` executa `acao`; depois disso o botão volta ao normal.
 */
export function confirmarNoBotao(botao: HTMLButtonElement, pergunta: string, acao: () => void | Promise<void>, ms = 4000): void {
  const original = botao.textContent || '';
  let armado = false;
  let t: ReturnType<typeof setTimeout> | null = null;
  const desarmar = () => {
    armado = false;
    botao.textContent = original;
    botao.removeAttribute('aria-live');
    if (t) clearTimeout(t);
  };
  botao.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!armado) {
      armado = true;
      botao.setAttribute('aria-live', 'polite');
      botao.textContent = pergunta;
      t = setTimeout(desarmar, ms);
      return;
    }
    desarmar();
    await acao();
  });
}

/** Diálogo com retorno de foco: abre com `html`, guarda quem abriu e devolve o foco a ele ao fechar. */
export type DialogoComRetorno = HTMLDialogElement & { _ret?: HTMLElement | null };

export function abrirDialogo(d: DialogoComRetorno, html: string, quemAbriu: HTMLElement | null, foco?: string): void {
  d.innerHTML = html;
  d._ret = quemAbriu;
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
  if (foco) d.querySelector<HTMLElement>(foco)?.focus();
}

/** Liga o retorno de foco ao fechar (uma vez por diálogo). `reserva` recebe o foco se quem abriu sumiu. */
export function devolverFoco(d: DialogoComRetorno, reserva: () => HTMLElement | null): void {
  d.addEventListener('close', () => {
    const alvo = d._ret && d._ret.isConnected ? d._ret : reserva();
    alvo?.focus();
  });
}

/**
 * Painel visual (gráficos leves em HTML/CSS, sem biblioteca): ranking em barras e colunas por mês.
 * `dado` em cada barra vira `data-<attr>` num botão, para a página filtrar a lista ao clicar.
 */
export interface Barra { rotulo: string; valor: number; nota?: string; dado?: string; ativo?: boolean }
export interface OpcoesBarras { max?: number; fmt?: (n: number) => string; attr?: string; nota?: string; vazio?: string }

export function barras(titulo: string, itens: Barra[], o: OpcoesBarras = {}): string {
  const fmt = o.fmt || ((n: number) => n.toLocaleString('pt-BR'));
  const lista = itens.filter((b) => b.valor > 0).slice(0, o.max ?? 8);
  const topo = Math.max(...lista.map((b) => b.valor), 1);
  const linha = (b: Barra) => {
    const corpo = `<span class="pn-r" title="${esc(b.rotulo)}">${esc(b.rotulo)}${b.nota ? `<small>${esc(b.nota)}</small>` : ''}</span><span class="pn-t" aria-hidden="true"><i style="width:${Math.max(2, Math.round((100 * b.valor) / topo))}%"></i></span><b>${fmt(b.valor)}</b>`;
    return o.attr && b.dado !== undefined
      ? `<li><button type="button" class="pn-l" data-${o.attr}="${esc(b.dado)}" aria-pressed="${!!b.ativo}" aria-label="${esc(b.rotulo)}: ${fmt(b.valor)}. Filtrar a lista">${corpo}</button></li>`
      : `<li class="pn-l">${corpo}</li>`;
  };
  return `<figure class="pn-c"><figcaption>${esc(titulo)}${o.nota ? `<small>${esc(o.nota)}</small>` : ''}</figcaption>${lista.length ? `<ol class="pn-b">${lista.map(linha).join('')}</ol>` : `<p class="note">${esc(o.vazio || 'Sem dados com estes filtros.')}</p>`}</figure>`;
}

/** Colunas por mês (os últimos `meses`, do mais antigo ao mais recente) a partir de datas AAAA-MM-DD. */
export function porMes(titulo: string, datas: string[], meses = 12, nota?: string): string {
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const d = new Date(), chaves: string[] = [];
  for (let i = meses - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); chaves.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  const n: Record<string, number> = {};
  for (const s of datas) if (s) n[s.slice(0, 7)] = (n[s.slice(0, 7)] || 0) + 1;
  const topo = Math.max(...chaves.map((k) => n[k] || 0), 1);
  const total = chaves.reduce((s, k) => s + (n[k] || 0), 0);
  return `<figure class="pn-c"><figcaption>${esc(titulo)}<small>${esc(nota || `${total.toLocaleString('pt-BR')} nos últimos ${meses} meses`)}</small></figcaption><ol class="pn-m">${chaves.map((k) => `<li title="${MES[+k.slice(5) - 1]}/${k.slice(2, 4)}: ${n[k] || 0}"><span class="pn-v">${n[k] || ''}</span><i style="height:${Math.round((100 * (n[k] || 0)) / topo)}%"></i><span class="pn-x">${MES[+k.slice(5) - 1]}</span></li>`).join('')}</ol></figure>`;
}

/** Conta itens por classe (uma ou várias por item) e devolve as barras do maior para o menor. */
export function contar<T>(lista: T[], classe: (x: T) => string | string[] | undefined | null, peso: (x: T) => number = () => 1): Barra[] {
  const m = new Map<string, number>();
  for (const x of lista) {
    const c = classe(x);
    for (const k of (Array.isArray(c) ? c : [c])) if (k) m.set(k, (m.get(k) || 0) + peso(x));
  }
  return [...m].sort((a, b) => b[1] - a[1]).map(([rotulo, valor]) => ({ rotulo, valor, dado: rotulo }));
}

/** Bloco do painel: até três gráficos lado a lado, com título opcional. */
export function painel(blocos: string[], rotulo = 'Painel'): string {
  return `<section class="pn" aria-label="${esc(rotulo)}">${blocos.filter(Boolean).join('')}</section>`;
}


/* ───────────────────────── Sugestões de busca ─────────────────────────
 * Ao clicar numa busca, antes de digitar, aparece tudo o que dá para procurar, separado por categoria e com a
 * contagem de cada uma; ao digitar, os achados de cada categoria. Escolher um item escreve o texto no campo e dispara
 * o mesmo evento "input" que a página já ouve (ou chama `aoEscolher`). Funciona por id, então sobrevive às páginas que
 * redesenham o campo.
 */
export interface ItemSug { texto: string; sub?: string; valor?: string; peso?: number }
export interface GrupoSug { nome: string; itens: ItemSug[] }
export interface OpcoesSug { aoEscolher?: (item: ItemSug, grupo: string, campo: HTMLInputElement) => void; porGrupo?: number; titulo?: string }
interface Registro { fonte: () => GrupoSug[]; o: OpcoesSug }

const REG = new Map<string, Registro>();
let aberto: { campo: HTMLInputElement; caixa: HTMLElement; reg: Registro; mais: Set<string>; itens: { item: ItemSug; grupo: string }[]; sel: number } | null = null;
const semAcento = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Liga as sugestões por categoria ao campo de busca de id `id`. Chamar de novo troca a fonte. */
export function sugerir(id: string, fonte: () => GrupoSug[], o: OpcoesSug = {}): void {
  REG.set(id, { fonte, o });
  instalarSug();
}

function destacar(t: string, q: string): string {
  const termos = semAcento(q).split(/\s+/).filter(Boolean); if (!termos.length) return esc(t);
  const base = semAcento(t); let i = -1, n = 0;
  for (const x of termos) { const j = base.indexOf(x); if (j >= 0 && (i < 0 || j < i)) { i = j; n = x.length; } }
  return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + n))}</mark>${esc(t.slice(i + n))}`;
}

function desenharSug() {
  if (!aberto) return;
  const { campo, caixa, reg, mais } = aberto, q = campo.value.trim(), por = reg.o.porGrupo ?? (q ? 6 : 12);
  const termos = semAcento(q).split(/\s+/).filter(Boolean);
  const grupos = reg.fonte().map((g) => {
    const vistos = new Set<string>(), itens = g.itens.filter((x) => { const k = semAcento(x.texto); if (!x.texto || vistos.has(k)) return false; vistos.add(k); return true; });
    const achados = termos.length ? itens.filter((x) => { const a = semAcento(x.texto + ' ' + (x.sub || '')); return termos.every((t) => a.includes(t)); }) : itens;
    achados.sort((a, b) => (termos.length ? (semAcento(a.texto).startsWith(termos[0]) ? 0 : 1) - (semAcento(b.texto).startsWith(termos[0]) ? 0 : 1) : 0) || (b.peso ?? 0) - (a.peso ?? 0) || a.texto.localeCompare(b.texto, 'pt-BR'));
    return { nome: g.nome, total: itens.length, achados };
  }).filter((g) => g.achados.length);
  aberto.itens = []; aberto.sel = Math.min(aberto.sel, 0);
  const opc = (item: ItemSug, grupo: string, chip: boolean) => {
    const i = aberto!.itens.push({ item, grupo }) - 1;
    return chip
      ? `<button type="button" class="sg-chip" role="option" id="sgO${i}" data-sg="${i}" aria-selected="false" title="${esc(item.sub || item.texto)}">${esc(item.texto)}</button>`
      : `<button type="button" class="sg-l" role="option" id="sgO${i}" data-sg="${i}" aria-selected="false"><span>${destacar(item.texto, q)}</span>${item.sub ? `<small>${destacar(item.sub, q)}</small>` : ''}</button>`;
  };
  const total = grupos.reduce((t, g) => t + g.achados.length, 0);
  caixa.innerHTML = grupos.length
    ? `<p class="sg-t">${q ? `${total.toLocaleString('pt-BR')} achado${total === 1 ? '' : 's'} para “${esc(q)}”` : esc(reg.o.titulo || 'Tudo o que dá para buscar aqui')}</p>` + grupos.map((g) => {
        const todos = mais.has(g.nome), vis = todos ? g.achados : g.achados.slice(0, por);
        return `<section class="sg-g"><h4>${esc(g.nome)} <span>${q ? `${g.achados.length} de ${g.total}` : g.total.toLocaleString('pt-BR')}</span></h4><div class="${q ? 'sg-ls' : 'sg-cs'}">${vis.map((x) => opc(x, g.nome, !q)).join('')}</div>${g.achados.length > vis.length ? `<button type="button" class="sg-mais" data-sgmais="${esc(g.nome)}">Ver ${todos ? 'menos' : `todos os ${g.achados.length.toLocaleString('pt-BR')}`}</button>` : ''}</section>`;
      }).join('')
    : q ? `<p class="sg-t">Nada com “${esc(q)}”. Tente parte do nome, uma cidade ou uma sigla.</p>` : '<p class="sg-t">Ainda não há dados para sugerir aqui.</p>';
  campo.setAttribute('aria-expanded', 'true');
  marcarSug();
}

function marcarSug() {
  if (!aberto) return;
  aberto.caixa.querySelectorAll('[data-sg]').forEach((b) => b.setAttribute('aria-selected', String(Number((b as HTMLElement).dataset.sg) === aberto!.sel)));
  const b = aberto.caixa.querySelector<HTMLElement>(`#sgO${aberto.sel}`);
  aberto.campo.setAttribute('aria-activedescendant', b && aberto.sel >= 0 ? b.id : '');
  if (b && aberto.sel >= 0) b.scrollIntoView({ block: 'nearest' });
}

function abrirSug(campo: HTMLInputElement) {
  const reg = REG.get(campo.id); if (!reg) return;
  if (aberto?.campo === campo) { desenharSug(); return; }
  fecharSug();
  const pai = campo.parentElement!; pai.classList.add('sg-pai');
  const caixa = document.createElement('div'); caixa.className = 'sg'; caixa.id = campo.id + 'Sg'; caixa.setAttribute('role', 'listbox'); caixa.setAttribute('aria-label', 'Sugestões de busca');
  pai.appendChild(caixa);
  campo.setAttribute('role', 'combobox'); campo.setAttribute('aria-controls', caixa.id); campo.setAttribute('aria-autocomplete', 'list'); campo.setAttribute('autocomplete', 'off');
  aberto = { campo, caixa, reg, mais: new Set(), itens: [], sel: -1 };
  desenharSug();
  // a lista precisa caber: se o campo está no pé da tela, rola até ela aparecer (sem esconder o campo)
  const r = caixa.getBoundingClientRect(), topo = campo.getBoundingClientRect().top;
  if (r.bottom > innerHeight && topo > 80) window.scrollBy({ top: Math.min(r.bottom - innerHeight + 16, topo - 80), behavior: 'auto' });
}

function fecharSug() {
  if (!aberto) return;
  aberto.caixa.remove(); aberto.campo.setAttribute('aria-expanded', 'false'); aberto.campo.removeAttribute('aria-activedescendant'); aberto = null;
}

function escolherSug(i: number) {
  if (!aberto) return;
  const x = aberto.itens[i]; if (!x) return;
  const { campo, reg } = aberto;
  fecharSug();
  if (reg.o.aoEscolher) { reg.o.aoEscolher(x.item, x.grupo, campo); return; }
  campo.value = x.item.valor ?? x.item.texto;
  campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
}

let instalado = false;
function instalarSug() {
  if (instalado || typeof document === 'undefined') return; instalado = true;
  document.addEventListener('focusin', (e) => { const t = e.target as HTMLElement; if (t instanceof HTMLInputElement && REG.has(t.id)) abrirSug(t); else if (aberto && !aberto.caixa.contains(t) && t !== aberto.campo) fecharSug(); });
  document.addEventListener('input', (e) => { if (aberto && e.target === aberto.campo) { aberto.sel = -1; aberto.mais.clear(); desenharSug(); } }, true);
  document.addEventListener('mousedown', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && REG.has(t.id)) { abrirSug(t); return; }
    if (aberto && !aberto.caixa.contains(t) && t !== aberto.campo) fecharSug();
  });
  document.addEventListener('click', (e) => {
    if (!aberto) return; const t = e.target as HTMLElement;
    const m = t.closest<HTMLElement>('[data-sgmais]'); if (m && aberto.caixa.contains(m)) { const g = m.dataset.sgmais!; aberto.mais.has(g) ? aberto.mais.delete(g) : aberto.mais.add(g); desenharSug(); aberto?.campo.focus(); return; }
    const b = t.closest<HTMLElement>('[data-sg]'); if (b && aberto.caixa.contains(b)) escolherSug(Number(b.dataset.sg));
  });
  document.addEventListener('keydown', (e) => {
    if (!aberto || e.target !== aberto.campo) return;
    const n = aberto.itens.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); aberto.sel = n ? (aberto.sel + 1) % n : -1; marcarSug(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aberto.sel = n ? (aberto.sel - 1 + n) % n : -1; marcarSug(); }
    else if (e.key === 'Enter' && aberto.sel >= 0) { e.preventDefault(); escolherSug(aberto.sel); }
    else if (e.key === 'Escape') { e.preventDefault(); fecharSug(); }
    else if (e.key === 'Tab') fecharSug();
  });
  window.addEventListener('hashchange', fecharSug);
}

/** Itens de sugestão a partir de uma lista, sem repetir e pesando pela frequência (quem aparece mais vem antes). */
export function itensDe<T>(lista: T[], texto: (x: T) => string | string[] | undefined | null, sub?: (x: T) => string | undefined): ItemSug[] {
  const m = new Map<string, ItemSug>();
  for (const x of lista) for (const t of [texto(x)].flat()) {
    const v = String(t ?? '').trim(); if (!v) continue;
    const k = semAcento(v), it = m.get(k);
    if (it) it.peso = (it.peso || 1) + 1; else m.set(k, { texto: v, sub: sub?.(x), peso: 1 });
  }
  return [...m.values()];
}
