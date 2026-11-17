/**
 * Kit de componentes compartilhados pelas páginas com código-fonte.
 * Tudo devolve HTML em texto (as páginas montam com innerHTML) ou liga comportamento num elemento existente.
 * Textos que vêm de dados passam sempre por `esc` antes de chegar aqui, exceto onde o parâmetro diz "html".
 */
import { esc } from '../lib/formato';

/** Um indicador do topo da página: rótulo, número e uma nota curta. `valor` e `nota` já são HTML. */
export interface Indicador { rotulo: string; valor: string; nota?: string }

export function kpi(i: Indicador): string {
  return `<div class="k"><span class="kl">${esc(i.rotulo)}</span>${i.valor}<span class="kn">${i.nota ?? ''}</span></div>`;
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
    const corpo = `<span class="pn-r">${esc(b.rotulo)}${b.nota ? `<small>${esc(b.nota)}</small>` : ''}</span><span class="pn-t" aria-hidden="true"><i style="width:${Math.max(2, Math.round((100 * b.valor) / topo))}%"></i></span><b>${fmt(b.valor)}</b>`;
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
