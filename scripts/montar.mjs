// Monta dist/index.html: Studio legado + módulos com código-fonte (strangler).
// 1) injeta dist/modulos/studio-modulos.js antes do script legado;
// 2) faz o legado perguntar ao registro window.__studio antes de usar a cópia antiga de cada página.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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

const marca = '<script type="module">';
if (html.split(marca).length - 1 !== 1) throw new Error('Esperava exatamente um script module no legado.');
html = html.replace(marca, `<script type="module" data-studio="modulos">${modulos}</script>\n${marca}`);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(0)} KB (módulos ${(modulos.length / 1024).toFixed(0)} KB)`);
