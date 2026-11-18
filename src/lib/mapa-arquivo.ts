/**
 * O arquivo do mapa da Investigação: um HTML único, sem rede, com o multiverso desenhado e navegável (zoom, arrasto,
 * busca, dossiê, radar, ramificações). As fontes da casa vão embutidas quando a página do Studio as tem.
 */
import type { MapaArquivo } from './investigacao';
import visor from './mapa-visor.js?raw';
import estilo from './mapa-visor.css?raw';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** JSON que pode morar dentro de <script>: nada de "</script>" nem "<!--" no meio. */
const jsonSeguro = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** As @font-face da PTYPE e da ABC Whyte que a página do Studio carrega (em data: URI), para o arquivo levar junto. */
export function fontesDaPagina(doc: Document = document): string {
  const out: string[] = [];
  doc.querySelectorAll('style').forEach((s) => { for (const m of (s.textContent || '').matchAll(/@font-face\s*\{[^}]*\}/g)) if (/PTYPE|ABC Whyte/.test(m[0]) && !out.includes(m[0])) out.push(m[0]); });
  return out.join('\n');
}

export function htmlDoMapa(d: MapaArquivo, fontes = ''): string {
  const titulo = `Multiverso · ${d.sementeNome}`;
  return `<!doctype html>
<html lang="pt-BR" data-tema="escuro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · PRODUCERIA</title>
<meta name="description" content="Mapa da prospecção da PRODUCERIA: ${d.alcance} pontos alcançados a partir de ${esc(d.sementeNome)}, em ${d.camadas.length - 1} ramificações.">
<style>${fontes}
${estilo}</style>
<style id="esconde"></style>
</head>
<body>
<div class="app">
 <header class="topo">
  <div class="marca"><span class="eyebrow"><i></i>PRODUCERIA · Investigação · reação em cadeia</span><h1>${esc(titulo)}</h1></div>
  <ul class="numeros" id="num" aria-label="Tamanho do multiverso"></ul>
 </header>
 <main class="palco" aria-label="Mapa radial: o ponto de partida no centro, uma volta por ramificação">
  <div class="ferr">
   <div class="busca"><label class="sr" for="q">Buscar um ponto</label><input id="q" type="search" placeholder="Buscar empresa, agência ou pessoa" autocomplete="off"><div class="sug" id="sug"></div></div>
   <div class="seg" role="group" aria-label="O que mostrar"><button type="button" data-modo="todos" aria-pressed="true">Multiverso inteiro</button><button type="button" data-modo="abertos" aria-pressed="false">Só a reação aberta</button></div>
   <button type="button" class="btn" id="todas" aria-pressed="false">Todas as ligações</button>
   <button type="button" class="btn" id="tema">Tema claro</button>
  </div>
  <svg id="tela" role="group" aria-label="Pontos do multiverso" preserveAspectRatio="xMidYMid meet"></svg>
  <div class="zoom" role="group" aria-label="Zoom"><button type="button" id="zmais" aria-label="Aproximar">+</button><button type="button" id="zmenos" aria-label="Afastar">−</button><button type="button" id="zinicio" aria-label="Ver tudo">⌂</button></div>
  <p class="dica">Role para aproximar · arraste para andar · clique num ponto para acender o caminho</p>
 </main>
 <aside class="painel">
  <section><span class="lab">Ramificações · clique para mostrar ou esconder</span><ol class="camadas" id="voltas"></ol>
   <p class="leg"><span><svg viewBox="-7 -7 14 14"><circle r="5" fill="currentColor"></circle></svg>agência</span><span><svg viewBox="-7 -7 14 14"><circle r="5" fill="none" stroke="currentColor" stroke-width="1.4"></circle></svg>anunciante</span><span><svg viewBox="-7 -7 14 14"><circle r="3" fill="currentColor"></circle></svg>pessoa</span><span><svg viewBox="-7 -7 14 14"><circle r="5" fill="none" stroke="currentColor" stroke-dasharray="2 2"></circle></svg>extinta</span><span><svg viewBox="-7 -2 14 4"><line x1="-7" x2="7" stroke="currentColor"></line></svg>barra preta: aberto na reação</span></p></section>
  <section class="dossie" id="dossie" aria-live="polite"></section>
  <section><span class="lab">Radar · mais fortes da reação</span><ol class="radar" id="radar"></ol></section>
  <p class="rodape" id="rodape"></p>
 </aside>
</div>
<p class="sr" id="vivo" aria-live="polite"></p>
<script type="application/json" id="dados">${jsonSeguro(d)}</script>
<script>${visor.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;
}
