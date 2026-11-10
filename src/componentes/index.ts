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
