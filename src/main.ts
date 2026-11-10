/**
 * Ponto de entrada dos módulos com código-fonte.
 *
 * Estratégia de migração (strangler): o Studio publicado ainda é o bundle legado (legacy/studio.html).
 * Este pacote é injetado ANTES do script legado e registra as páginas já migradas em window.__studio.
 * O legado, ao montar uma dessas páginas, pergunta primeiro ao registro (ver scripts/montar.mjs);
 * se o registro não existir, ele cai na cópia antiga embutida. Cada página migrada sai do legado em seguida.
 */
import base from './estilos/base.css?inline';
import central from './estilos/central.css?inline';
import agenda from './estilos/agenda.css?inline';
import licitacoes from './estilos/licitacoes.css?inline';
import * as pCentral from './paginas/central';
import * as pAgenda from './paginas/agenda';
import * as pCasos from './paginas/casos';
import * as pContas from './paginas/mapa-contas';
import * as pLicitacoes from './paginas/licitacoes';

import type { Montar } from './paginas/dom';

const paginas: Record<string, Montar> = {
  central: pCentral.montar,
  agenda: pAgenda.montar,
  casos: pCasos.montar,
  contas: pContas.montar,
  licitacoes: pLicitacoes.montar,
};

function estilos() {
  if (document.getElementById('studio-src-css')) return;
  const el = document.createElement('style');
  el.id = 'studio-src-css';
  el.textContent = base + central + agenda + licitacoes;
  document.head.appendChild(el);
}

declare global {
  interface Window {
    __studio?: { versao: string; paginas: string[]; montar(nome: string, raiz: HTMLElement): (() => void) | void | null };
  }
}

window.__studio = {
  versao: __VERSAO__,
  paginas: Object.keys(paginas),
  montar(nome, raiz) {
    const m = paginas[nome];
    if (!m) return null;
    estilos();
    return m(raiz) || (() => {});
  },
};

declare const __VERSAO__: string;
