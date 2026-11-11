/**
 * ZIP mínimo, sem compressão (método "store"), feito no navegador: pastas da estrutura do job, desdobras e entregas.
 * Imagens já vêm comprimidas (PNG/JPG), então guardar sem recomprimir não aumenta o tamanho. Nomes em UTF-8.
 */
const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABELA[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface EntradaZip { caminho: string; dados?: Uint8Array | string }

function dataDos(d = new Date()) {
  return { hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

/** Monta o .zip. Caminho terminado em "/" vira pasta. */
export function zipar(entradas: EntradaZip[], quando = new Date()): Uint8Array {
  const enc = new TextEncoder(), { hora, dia } = dataDos(quando);
  const locais: Uint8Array[] = [], centrais: Uint8Array[] = [];
  let pos = 0;
  for (const e of entradas) {
    const nome = enc.encode(e.caminho), pasta = e.caminho.endsWith('/');
    const dados = pasta ? new Uint8Array(0) : typeof e.dados === 'string' ? enc.encode(e.dados) : e.dados || new Uint8Array(0);
    const crc = crc32(dados);
    const loc = new Uint8Array(30 + nome.length), v = new DataView(loc.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint16(10, hora, true); v.setUint16(12, dia, true); v.setUint32(14, crc, true);
    v.setUint32(18, dados.length, true); v.setUint32(22, dados.length, true); v.setUint16(26, nome.length, true); v.setUint16(28, 0, true);
    loc.set(nome, 30);
    const cen = new Uint8Array(46 + nome.length), w = new DataView(cen.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(10, 0, true);
    w.setUint16(12, hora, true); w.setUint16(14, dia, true); w.setUint32(16, crc, true); w.setUint32(20, dados.length, true); w.setUint32(24, dados.length, true);
    w.setUint16(28, nome.length, true); w.setUint32(38, pasta ? 0x10 : 0, true); w.setUint32(42, pos, true);
    cen.set(nome, 46);
    locais.push(loc, dados); centrais.push(cen);
    pos += loc.length + dados.length;
  }
  const tamCentral = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22), f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, entradas.length, true); f.setUint16(10, entradas.length, true);
  f.setUint32(12, tamCentral, true); f.setUint32(16, pos, true);
  const total = pos + tamCentral + 22, out = new Uint8Array(total);
  let o = 0;
  for (const p of [...locais, ...centrais, fim]) { out.set(p, o); o += p.length; }
  return out;
}
