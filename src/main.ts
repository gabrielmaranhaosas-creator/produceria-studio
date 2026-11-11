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
import captacao from './estilos/captacao.css?inline';
import vencedores from './estilos/vencedores.css?inline';
import mercado from './estilos/mercado.css?inline';
import funil from './estilos/funil.css?inline';
import estrategia from './estilos/estrategia.css?inline';
import tabela from './estilos/tabela.css?inline';
import gestao from './estilos/gestao.css?inline';
import oficina from './estilos/oficina.css?inline';
import * as pCentral from './paginas/central';
import * as pAgenda from './paginas/agenda';
import * as pCasos from './paginas/casos';
import * as pContas from './paginas/mapa-contas';
import * as pLicitacoes from './paginas/licitacoes';
import * as pCaptacao from './paginas/captacao';
import * as pVencedores from './paginas/vencedores';
import * as pMercado from './paginas/mercado';
import * as pFunil from './paginas/funil';
import * as pEstrategia from './paginas/estrategia';
import * as pTabela from './paginas/tabela';
import * as pRotinas from './paginas/rotinas';
import * as pAjustes from './paginas/ajustes';
import * as pBancada from './paginas/bancada';
import * as pGrafica from './paginas/grafica';
import * as pPlugins from './paginas/plugins';
import * as pBiblioteca from './paginas/biblioteca';
import * as pAgentes from './paginas/agentes';
import * as pInicio from './paginas/inicio';
import * as pLixeira from './paginas/lixeira';
import * as pAtelie from './paginas/atelie';
import * as pDesdobra from './paginas/desdobra';
import * as pEntrega from './paginas/entrega';
import casca from './estilos/casca.css?inline';
import { iniciarCasca } from './casca/casca';

import type { Montar } from './paginas/dom';

const paginas: Record<string, Montar> = {
  central: pCentral.montar,
  agenda: pAgenda.montar,
  casos: pCasos.montar,
  contas: pContas.montar,
  licitacoes: pLicitacoes.montar,
  captacao: pCaptacao.montar,
  vencedores: pVencedores.montar,
  mercado: pMercado.montar,
  funil: pFunil.montar,
  estrategia: pEstrategia.montar,
  tabela: pTabela.montar,
  rotinas: pRotinas.montar,
  ajustes: pAjustes.montar,
  bancada: pBancada.montar,
  grafica: pGrafica.montar,
  plugins: pPlugins.montar,
  biblioteca: pBiblioteca.montar,
  agentes: pAgentes.montar,
  inicio: pInicio.montar,
  lixeira: pLixeira.montar,
  atelie: pAtelie.montar,
  desdobra: pDesdobra.montar,
  entrega: pEntrega.montar,
};

function estilos() {
  if (document.getElementById('studio-src-css')) return;
  const el = document.createElement('style');
  el.id = 'studio-src-css';
  el.textContent = base + central + agenda + licitacoes + captacao + vencedores + mercado + funil + estrategia + tabela + gestao + oficina + casca;
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

// Studio sem o legado: a página traz <div id="root" data-casca="propria"> e a casca própria monta tudo.
const raizCasca = document.getElementById('root');
if (raizCasca?.dataset.casca === 'propria') iniciarCasca(raizCasca, paginas, estilos);

declare const __VERSAO__: string;
