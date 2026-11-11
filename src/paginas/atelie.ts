// Ateliê: a porta da Oficina. O que a casa acredita sobre ofício e tecnologia, e as ferramentas próprias da
// PRODUCERIA, no Studio e na mesa do arte-finalista (Kit Produceria: painéis do Photoshop, After Effects, Blender, Claude).
import { esc } from '../lib/formato';
import { navOficina } from './oficina';

export const PRINCIPIOS: [string, string][] = [
  ['A mão decide.', 'A máquina faz o repetitivo: recortar, nomear, medir, empacotar. Respiro, hierarquia, cor e acabamento são decisão de quem tem ofício.'],
  ['Um padrão em toda mesa.', 'O Studio, os painéis do Photoshop e o Claude nomeiam, medem e entregam do mesmo jeito. Um arquivo da casa se reconhece pelo nome.'],
  ['Conferido antes de sair.', 'Resolução, perfil de cor, sangria e nome checados antes da entrega, e cada entrega com manifesto e sha256.'],
  ['Inventar sem perder o rigor.', 'Ferramenta nova entra quando poupa tempo de quem cria e não troca precisão por pressa.'],
];

interface Ferramenta { h: string; t: string; d: string; tag?: string }
export const FERRAMENTAS: Ferramenta[] = [
  { h: 'desdobra', t: 'Desdobra de KV', d: 'A peça-mãe em todos os formatos, com ponto de foco, cobrir ou conter, e zip com nomes e manifesto.', tag: 'nova' },
  { h: 'entrega/checar', t: 'Checar arquivo', d: 'Medidas, ppi, CMYK, perfil de cor e nome. O tamanho de impressão a 300 e 150 ppi.', tag: 'nova' },
  { h: 'entrega/nomes', t: 'Nomes e pastas', d: 'Nomes no padrão CLIENTE_campanha_formato_v01 e a estrutura do job pronta para baixar.', tag: 'nova' },
  { h: 'entrega/entrega', t: 'Montar entrega', d: 'Confere os arquivos finais, escreve o manifesto com sha256 e entrega um zip só.', tag: 'nova' },
  { h: 'grafica', t: 'Gráfica', d: 'Ficha técnica de impressão, aproveitamento de folha, checklist de fechamento e pacote do job.' },
  { h: 'ferramentas', t: 'Bancada', d: 'Orçar desdobramento, rodadas de revisão, pré-checagem de briefing e cotações.' },
  { h: 'agentes', t: 'Agentes', d: 'Especialistas da casa com acesso à tabela de serviços, às oportunidades e à memória da Produceria.' },
  { h: 'biblioteca', t: 'Biblioteca', d: 'Referências, manuais de marca e arquivos de apoio da equipe.' },
];

export const MESA: [string, string][] = [
  ['Photoshop', 'Painéis UXP do Kit: desdobra, retoque com versão, checar arquivo, exportador e textos. E o Produceria Bridge, que liga o Photoshop ao Studio.'],
  ['After Effects e Blender', 'Variações de template a partir de uma planilha (uma composição por linha) e render do produto em vários ângulos, já com o nome da casa.'],
  ['Magnific e custos de IA', 'Ampliação em lote sem tocar nos originais, com registro de cada imagem, e o custo das IAs somado por trabalho e por mês.'],
  ['Claude', 'Servidor "produceria" com as mesmas regras: gerar nomes, criar a pasta do job, checar imagem, desdobrar e montar a entrega.'],
];

export function montar(root: HTMLElement): void {
  root.innerHTML = `${navOficina('atelie')}<div class="wrap vc at">
  <header class="page-head at-head"><span class="eyebrow">Oficina PRODUCERIA</span>
    <h1 class="d d-title">Ofício de arte-final, ferramentas de agora.</h1>
    <p class="lead measure muted">As ferramentas que a casa faz para a própria mesa: o rigor da arte-finalização e da produção gráfica, com a tecnologia fazendo o trabalho repetitivo.</p></header>
  <section class="at-man" aria-labelledby="at-m"><h2 class="sr" id="at-m">Como a casa trabalha</h2>
    <ol class="at-prin">${PRINCIPIOS.map(([t, d], i) => `<li><span class="at-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><b class="d">${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol></section>
  <section aria-labelledby="at-f"><div class="ph"><h2 class="d d-sub" id="at-f">Ferramentas da casa</h2><span class="note">no Studio, sem instalar nada</span></div>
    <ul class="at-grade">${FERRAMENTAS.map((f) => `<li><a class="at-card" href="#${f.h}"><span class="at-t"><b>${esc(f.t)}</b>${f.tag ? `<span class="tag ok">${esc(f.tag)}</span>` : ''}</span><span class="note">${esc(f.d)}</span><span class="at-ir" aria-hidden="true">→</span></a></li>`).join('')}</ul></section>
  <section class="lc-box" aria-labelledby="at-k"><span class="lab">Kit Produceria v1.0</span><h2 class="d d-sub" id="at-k">Na mesa do arte-finalista</h2>
    <p class="measure">As mesmas regras, nos programas onde a arte-final acontece. Um nome gerado aqui é igual ao do painel do Photoshop e ao do Claude.</p>
    <dl class="at-mesa">${MESA.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
    <div class="acts"><a class="lnk" href="#plugins">Plugins e instalação →</a></div></section></div>`;
}
