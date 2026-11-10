// Monta dist/index.html: Studio legado + módulos com código-fonte (strangler).
// 1) injeta dist/modulos/studio-modulos.js antes do script legado;
// 2) faz o legado perguntar ao registro window.__studio antes de usar a cópia antiga de cada página.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cortarFuncao } from './cortar.mjs';

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
html = html.replace(marca, `<script type="module" data-studio="modulos">${modulos}</script>\n${marca}`);

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
writeFileSync('dist/index.html', html);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(0)} KB (módulos ${(modulos.length / 1024).toFixed(0)} KB, ${(removidos / 1024).toFixed(0)} KB de cópias antigas retiradas)`);
