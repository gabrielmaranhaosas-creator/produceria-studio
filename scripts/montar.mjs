// Monta dist/index.html: Studio legado + módulos com código-fonte (strangler).
// 1) injeta dist/modulos/studio-modulos.js antes do script legado;
// 2) faz o legado perguntar ao registro window.__studio antes de usar a cópia antiga de cada página.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cortarFuncao, fimDaExpressao } from './cortar.mjs';

const legado = readFileSync('legacy/studio.html', 'utf8');
const modulos = readFileSync('dist/modulos/studio-modulos.js', 'utf8');
if (/<\/script/i.test(modulos)) throw new Error('O pacote contém "</script": escape antes de embutir.');

const montagens = { initCN: 'central', initAG: 'agenda', initCS: 'casos', initMC: 'contas' };
let html = legado;
for (const [fn, nome] of Object.entries(montagens)) {
  const antes = `${fn}(r.current)`;
  const n = html.split(antes).length - 1;
  if (n !== 1) throw new Error(`Esperava 1 chamada ${antes} no legado, achei ${n}.`);
  html = html.replace(antes, `(window.__studio&&window.__studio.montar(${JSON.stringify(nome)},r.current)||${antes})`);
}

// Licitações (Fase 2): a página do código-fonte entra no lugar do componente React do legado (`te`), que fica
// como reserva enquanto a nova estabiliza. LC é um invólucro React mínimo, no mesmo escopo do MC (Mapa de contas).
{
  const uso = '(0,l.jsx)(te,{opps:a})';
  const n = html.split(uso).length - 1;
  if (n !== 1) throw new Error(`Esperava 1 uso de ${uso} no legado, achei ${n}.`);
  html = html.replace(uso, '(0,l.jsx)(window.__studio&&window.__studio.paginas.includes("licitacoes")?LC:te,{opps:a})');
  const mc = 'function MC(){';
  if (html.split(mc).length - 1 !== 1) throw new Error('Esperava 1 definição de MC no legado.');
  // Funil e receita (Fase 2): o fragmento inteiro da aba (tD + mapa de receitas a8) vira a página nova; o antigo fica de reserva.
  {
    const ini = '"funil"===n&&';
    const p0 = html.indexOf(ini) + ini.length;
    const fim = '(0,l.jsx)(a8,{})]})]})';
    const p1 = html.indexOf(fim, p0) + fim.length;
    const frag = html.slice(p0, p1);
    if (!frag.startsWith('(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(tD,{projetos:s})') || p1 - p0 > 2000) throw new Error('Fragmento do funil não reconhecido no legado.');
    html = html.slice(0, p0) + `(window.__studio&&window.__studio.paginas.includes("funil")?(0,l.jsx)(FN,{}):${frag})` + html.slice(p1);
    html = html.replace(mc, 'function FN(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("funil",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
  }
  // Oficina (Fase 3): o fragmento inteiro de cada tela (navegação + cabeçalho + componente) vira a página nova.
  for (const [rota, nome, w, comeco] of [
    ['ferramentas', 'bancada', 'BC', '(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(ns,{atual:"ferramentas"}),(0,l.jsx)(sy,'],
    ['grafica', 'grafica', 'GR', '(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(ns,{atual:"grafica"}),(0,l.jsx)(nn,'],
    ['plugins', 'plugins', 'PL', '(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(ns,{atual:"plugins"}),(0,l.jsx)(nn,'],
    ['biblioteca', 'biblioteca', 'BI', '(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(ns,{atual:"biblioteca"}),(0,l.jsx)(sE,'],
    ['agentes', 'agentes', 'AGT', '(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(ns,{atual:"agentes"}),(0,l.jsx)(st,'],
  ]) {
    const ini = `"${rota}"===e.page&&`;
    if (html.split(ini).length - 1 !== 1) throw new Error(`Esperava 1 rota ${rota} no legado.`);
    const p0 = html.indexOf(ini) + ini.length;
    if (!html.startsWith(comeco, p0)) throw new Error(`Fragmento de ${rota} não reconhecido no legado.`);
    const p1 = fimDaExpressao(html, p0);
    html = html.slice(0, p0) + `(window.__studio&&window.__studio.paginas.includes("${nome}")?(0,l.jsx)(${w},{}):${html.slice(p0, p1)})` + html.slice(p1);
    html = html.replace(mc, `function ${w}(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("${nome}",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}` + mc);
  }
  // Rotinas do Claude e Ajustes (Fase 3): trocam `s7` e `sl`, que ficam de reserva.
  for (const [nome, fn, w] of [['rotinas', 's7', 'RO'], ['ajustes', 'sl', 'AJ']]) {
    const uso = `"${nome}"===e.page&&(0,l.jsx)(${fn},{})`;
    if (html.split(uso).length - 1 !== 1) throw new Error(`Esperava 1 uso de ${uso} no legado.`);
    html = html.replace(uso, `"${nome}"===e.page&&(0,l.jsx)(window.__studio&&window.__studio.paginas.includes("${nome}")?${w}:${fn},{})`);
    html = html.replace(mc, `function ${w}(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("${nome}",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}` + mc);
  }
  // Tabela de serviços (Fase 3): troca o componente `sI`, que fica de reserva.
  {
    const uso = '"tabela"===e.page&&(0,l.jsx)(sI,{})';
    if (html.split(uso).length - 1 !== 1) throw new Error(`Esperava 1 uso de ${uso} no legado.`);
    html = html.replace(uso, '"tabela"===e.page&&(0,l.jsx)(window.__studio&&window.__studio.paginas.includes("tabela")?TB:sI,{})');
    html = html.replace(mc, 'function TB(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("tabela",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
  }
  // SWOT e frentes (Fase 2): o fragmento da aba (tj + ofertas td) vira a página nova; o antigo fica de reserva.
  {
    const ini = '"estrategia"===n&&';
    const p0 = html.indexOf(ini) + ini.length;
    const fim = '(0,l.jsx)(td,{})]})]})';
    const p1 = html.indexOf(fim, p0) + fim.length;
    const frag = html.slice(p0, p1);
    if (!frag.startsWith('(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(tj,{frentes:t,projetos:s,opps:a})') || p1 - p0 > 2000) throw new Error('Fragmento da estratégia não reconhecido no legado.');
    html = html.slice(0, p0) + `(window.__studio&&window.__studio.paginas.includes("estrategia")?(0,l.jsx)(ES,{}):${frag})` + html.slice(p1);
    html = html.replace(mc, 'function ES(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("estrategia",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
  }
  // Contas e agências (Fase 2): mesma troca, com o componente antigo `t9` de reserva.
  const usoMK = '"mercado"===n&&(0,l.jsx)(t9,{})';
  if (html.split(usoMK).length - 1 !== 1) throw new Error(`Esperava 1 uso de ${usoMK} no legado.`);
  html = html.replace(usoMK, '"mercado"===n&&(0,l.jsx)(window.__studio&&window.__studio.paginas.includes("mercado")?MK:t9,{})');
  html = html.replace(mc, 'function MK(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("mercado",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
  // Vencedores (Fase 2): mesma troca, com o componente antigo `t4` de reserva.
  const usoVC = '"vencedores"===n&&(0,l.jsx)(t4,{})';
  if (html.split(usoVC).length - 1 !== 1) throw new Error(`Esperava 1 uso de ${usoVC} no legado.`);
  html = html.replace(usoVC, '"vencedores"===n&&(0,l.jsx)(window.__studio&&window.__studio.paginas.includes("vencedores")?VC:t4,{})');
  html = html.replace(mc, 'function VC(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("vencedores",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
  // Captação (Fase 2): mesma troca, com o componente antigo `tU` de reserva.
  const usoCP = '(0,l.jsx)(tU,{projetos:s,opps:a})';
  if (html.split(usoCP).length - 1 !== 1) throw new Error(`Esperava 1 uso de ${usoCP} no legado.`);
  html = html.replace(usoCP, '(0,l.jsx)(window.__studio&&window.__studio.paginas.includes("captacao")?CP:tU,{projetos:s,opps:a})');
  html = html.replace(mc, 'function CP(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("captacao",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
  html = html.replace(mc, 'function LC(){let r=(0,c.useRef)(null);(0,c.useEffect)(()=>{r.current.dataset.th=document.documentElement.getAttribute("data-theme")||"";return window.__studio.montar("licitacoes",r.current)||void 0},[]);return(0,l.jsx)("div",{ref:r,className:"mc cn"})}' + mc);
}

// As 4 páginas migradas rodam a partir do código-fonte desde a Fase 0; as cópias antigas saem do legado.
// No lugar fica um aviso, que só aparece se o pacote de módulos não carregar.
const aviso = (f) => `function ${f}(root){root.innerHTML='<div class="wrap"><div class="empty"><h2 class="d d-sub">Esta página não carregou</h2><p class="note">Recarregue o Studio. Se continuar, avise quem cuida do sistema.</p></div></div>'}`;
let removidos = 0;
for (const fn of Object.keys(montagens)) {
  const r = cortarFuncao(html, fn, aviso(fn));
  html = r.src;
  removidos += r.removido;
}

// Frentes de eventos saíram do escopo (perfil do cérebro 2026-11-10a): tira-as também da lista de
// frentes das Licitações do legado (cadastro manual, leitura de edital).
// frentes fora do escopo do hub: só eventos (perfil 2026-11-10a). Arte-finalização, produção gráfica,
// comunicação visual e mídia exterior são o núcleo da PRODUCERIA e ficam no cadastro manual.
const frentesFora = [
  '"Produção e organização de eventos",',
  '"Infraestrutura, cenografia e locações para eventos",',
];
for (const f of frentesFora) {
  const n = html.split(f).length - 1;
  if (n !== 1) throw new Error(`Esperava 1 ocorrência de ${f} no legado, achei ${n}.`);
  html = html.replace(f, '');
}

const marca = '<script type="module">';
if (html.split(marca).length - 1 !== 1) throw new Error('Esperava exatamente um script module no legado.');
// Função como substituição: o pacote pode conter $& ou $' (expressões regulares dos plugins), que num texto de
// substituição seriam padrões especiais e corromperiam o script.
html = html.replace(marca, () => `<script type="module" data-studio="modulos">${modulos}</script>\n${marca}`);

// O legado é um script só: confere a sintaxe dele depois dos cortes, antes de gravar.
{
  const ini = html.indexOf(marca) + marca.length;
  const fim = html.indexOf('</script>', ini);
  const tmp = mkdtempSync(join(tmpdir(), 'studio-'));
  const arq = join(tmp, 'legado.mjs');
  writeFileSync(arq, html.slice(ini, fim));
  try { execFileSync(process.execPath, ['--check', arq], { stdio: 'pipe' }); }
  catch (e) { throw new Error('O script legado ficou com erro de sintaxe depois dos cortes:\n' + e.stderr); }
  finally { rmSync(tmp, { recursive: true, force: true }); }
}

mkdirSync('dist', { recursive: true });
writeFileSync('dist/legado.html', html);

// Fase 3: o Studio publicado sai sem o app React do legado. Do legado ficam só o reset do <head> e o bloco de
// estilos (fontes + CSS); a casca própria (src/casca) monta menu, rotas, busca, avisos e todas as telas.
// dist/legado.html continua sendo gerado como reserva (o mesmo Studio de antes, com as telas novas injetadas).
{
  // Fase 4: o CSS global e o reset vêm de src/estilos; do legado só saem as fontes (@font-face), até a licença
  // delas ser resolvida (ver docs/ROADMAP.md).
  const enxuto = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const embutidas = legado.match(/@font-face\{[^}]*\}/g) || [];
  if (embutidas.length !== 4) throw new Error(`Esperava 4 fontes no legado, achei ${embutidas.length}.`);
  // Nenhuma fonte vai com a página: a revisão de compartilhamento do claude.ai recusou fonte embutida (data:), fonte em
  // arquivo publicado e fonte carregada do Google Fonts. Quem tem ABC Whyte e PTYPE instaladas vê as originais
  // (ver --font-text e --font-display); os demais veem as do sistema.
  const fontes = [];
  const reset = `<style>${enxuto(readFileSync('src/estilos/reset.css', 'utf8'))}</style>`;
  const studio = `<style>${fontes.join('')}${enxuto(readFileSync('src/estilos/studio.css', 'utf8'))}</style>`;
  const novo = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${reset}<title>PRODUCERia Studio</title><meta name="claude:viewport-fit-sides" content="cover">${studio}</head>`
    + `<body><a class="sr pular" href="#conteudo">Pular para o conteúdo</a><div id="root" data-casca="propria"></div><script type="module" data-studio="modulos">${modulos}</script></body></html>`;
  if (/<script(?![^>]*data-studio)/i.test(novo.replace(modulos, ''))) throw new Error('O Studio novo não deve ter outro script além dos módulos.');
  if (/data:(?!image\/(png|jpeg|gif|webp))[a-z]+\//i.test(novo.replace(modulos, ''))) throw new Error('A página não pode embutir data: URI que não seja imagem: a revisão de compartilhamento recusa.');
  if (/<link[^>]+(stylesheet|preconnect)|@import|https?:\/\/fonts\./i.test(novo.replace(modulos, ''))) throw new Error('A página não pode carregar folha de estilo ou fonte de fora: a revisão de compartilhamento recusa.');
  writeFileSync('dist/index.html', novo);
  console.log(`dist/index.html: ${(novo.length / 1024).toFixed(0)} KB sem o legado (módulos ${(modulos.length / 1024).toFixed(0)} KB) · dist/legado.html: ${(html.length / 1024).toFixed(0)} KB de reserva`);
}
