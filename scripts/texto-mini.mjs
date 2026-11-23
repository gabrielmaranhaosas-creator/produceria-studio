// Importações `?mini`: o arquivo entra como texto já minificado (o `?raw` do Vite embute com comentários e espaços).
// Usado pelo visor do arquivo do multiverso, que vai inteiro dentro do HTML baixado.
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

export default function textoMini() {
  return {
    name: 'texto-mini',
    enforce: 'pre',
    async resolveId(id, quem) {
      if (!id.endsWith('?mini')) return null;
      const r = await this.resolve(id.slice(0, -5), quem, { skipSelf: true });
      return r ? '\0mini:' + r.id + '.mini' : null; // id virtual (sem terminar em .css): o plugin de CSS do Vite não pega
    },
    async load(id) {
      if (!id.startsWith('\0mini:')) return null;
      const arq = id.slice(6, -5), loader = arq.endsWith('.css') ? 'css' : 'js';
      const { code } = await transform(readFileSync(arq, 'utf8'), { loader, minify: true, legalComments: 'none', ...(loader === 'js' ? { target: 'es2017' } : {}) });
      return `export default ${JSON.stringify(code.trim())};`;
    },
  };
}
