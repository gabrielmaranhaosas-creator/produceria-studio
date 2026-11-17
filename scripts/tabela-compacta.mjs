// Plugin do Vite: embute src/lib/servicos.json em colunas (valores repetidos viram índices de um dicionário).
// O módulo resultante remonta exatamente as mesmas linhas; só ocupa menos espaço na página.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARQUIVO = fileURLToPath(new URL('../src/lib/servicos.json', import.meta.url));
const VIRTUAL = '\0servicos-compacta';

export function compactar(linhas) {
  const chaves = Object.keys(linhas[0]);
  if (!linhas.every((l) => Object.keys(l).join() === chaves.join())) throw new Error('servicos.json: linhas com campos diferentes.');
  const colunas = chaves.map((k) => {
    const v = linhas.map((l) => l[k]);
    const d = [...new Set(v)];
    return d.length * 2 < v.length ? { d, i: v.map((x) => d.indexOf(x)) } : { v };
  });
  return `const K=${JSON.stringify(chaves)},C=${JSON.stringify(colunas)};` +
    `export default Array.from({length:${linhas.length}},(_,n)=>{const o={};K.forEach((k,j)=>{const c=C[j];o[k]=c.v?c.v[n]:c.d[c.i[n]]});return o});`;
}

export default function tabelaCompacta() {
  return {
    name: 'tabela-compacta',
    enforce: 'pre',
    // Id virtual: assim o plugin de JSON do Vite não reprocessa o módulo já convertido.
    resolveId(fonte, quem) {
      return fonte.endsWith('servicos.json') && quem && quem.includes('/src/lib/') ? VIRTUAL : null;
    },
    load(id) {
      if (id !== VIRTUAL) return null;
      this.addWatchFile(ARQUIVO);
      return compactar(JSON.parse(readFileSync(ARQUIVO, 'utf8')));
    },
  };
}
