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
