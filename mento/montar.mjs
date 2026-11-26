// Monta mento/dist/mento.html: uma página só, sem rede, com o script, o estilo e a fonte embutidos.
// Separada do PRODUCERia Studio: não importa nada de src/ e não lê o banco do Studio.
import { buildSync } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const aqui = (p) => fileURLToPath(new URL(p, import.meta.url));
const r = buildSync({ entryPoints: [aqui('./src/main.ts')], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, loader: { '.css': 'text', '.b64': 'text' }, legalComments: 'none' });
const js = r.outputFiles[0].text;
if (/<\/script/i.test(js)) throw new Error('O script contém "</script".');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MENTO · Reação em cadeia</title><meta name="description" content="A rede da MENTO a partir dos dados de LinkedIn da equipe: reação em cadeia, multiverso e radar. Tudo roda no navegador.">
<meta name="robots" content="noindex"></head><body><div id="app"></div><script>${js}</script></body></html>`;
mkdirSync(aqui('./dist'), { recursive: true });
writeFileSync(aqui('./dist/mento.html'), html);
console.log(`mento/dist/mento.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
