// Plugin do Vite (só no build do Studio publicado no claude.ai): os arquivos dos plugins da casa e do Bridge saem da
// página e ficam no banco do Studio, coleção `kit_plugins` (a revisão de compartilhamento do claude.ai recusa páginas
// grandes demais). No lugar do texto de cada arquivo vai uma marca com o caminho e o hash; o download troca a marca
// pelo texto do banco e confere o hash (ver `completar` em src/oficina/kit-plugins.ts). Os manifest.json ficam na
// página porque o catálogo lê versão e nome deles ao abrir. `npm run kit` gera os documentos para gravar no banco.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const MARCA = '\u0000kit:';
const PASTAS = ['plugins/photoshop', 'plugins/after-effects', 'src/oficina/bridge', 'src/lib/fontes'];
// Peças que só vão para arquivos baixados (o visor do multiverso), importadas com `?mini`: no banco vão minificadas,
// com as mesmas opções de scripts/texto-mini.mjs, e o hash é o do texto minificado.
const MINI = ['src/lib/mapa-visor.js', 'src/lib/mapa-visor.css'];
export const minificar = (rel, texto) => {
  const loader = rel.endsWith('.css') ? 'css' : 'js';
  return transformSync(texto, { loader, minify: true, legalComments: 'none', ...(loader === 'js' ? { target: 'es2017' } : {}) }).code.trim();
};
const marca = (rel, texto) => `export default ${JSON.stringify(MARCA + rel + ':' + hash(texto))}`;

export const hash = (texto) => createHash('sha1').update(texto).digest('hex').slice(0, 12);
export const idDoc = (caminho) => caminho.replace(/\//g, '~');
const relativo = (abs) => relative(RAIZ, abs).split(sep).join('/');
const fica = (rel) => rel.endsWith('/manifest.json');
const doKit = (rel) => PASTAS.some((p) => rel.startsWith(p + '/'));

export default function kitFora() {
  return {
    name: 'kit-fora',
    enforce: 'pre',
    load(id) {
      if (id.startsWith('\0mini:')) { // id virtual de scripts/texto-mini.mjs
        const rel = relativo(id.slice(6, -5));
        return MINI.includes(rel) ? marca(rel, minificar(rel, readFileSync(join(RAIZ, rel), 'utf8'))) : null;
      }
      if (!id.endsWith('?raw')) return null;
      const rel = relativo(id.slice(0, -4));
      if (!doKit(rel) || fica(rel)) return null;
      return marca(rel, readFileSync(join(RAIZ, rel), 'utf8'));
    },
  };
}

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((n) => { const c = join(pasta, n); return statSync(c).isDirectory() ? arquivos(c) : [c]; });
}

/** Grava em dist/kit-banco/ um JSON por arquivo ({caminho, hash, texto}), no formato do ArtifactData. */
export function documentosDoBanco(saida = join(RAIZ, 'dist/kit-banco')) {
  rmSync(saida, { recursive: true, force: true });
  mkdirSync(saida, { recursive: true });
  const docs = [...PASTAS.flatMap((p) => arquivos(join(RAIZ, p))).map(relativo).filter((r) => !fica(r) && !/\.txt$/.test(r)), ...MINI].sort();
  for (const caminho of docs) {
    const bruto = readFileSync(join(RAIZ, caminho), 'utf8'), texto = MINI.includes(caminho) ? minificar(caminho, bruto) : bruto;
    writeFileSync(join(saida, idDoc(caminho) + '.json'), JSON.stringify({ caminho, hash: hash(texto), texto }));
  }
  return docs;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const docs = documentosDoBanco();
  console.log(`${docs.length} documentos em dist/kit-banco/ (coleção kit_plugins, id = caminho com / trocado por ~).`);
}
