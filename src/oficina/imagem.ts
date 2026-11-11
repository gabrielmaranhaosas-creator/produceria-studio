/**
 * Leitura do cabeçalho de imagens no navegador, sem bibliotecas: medidas, resolução (ppi), CMYK e perfil de cor.
 * Cobre o que passa pela arte-finalização: JPG (JFIF, EXIF, ICC, Adobe), PNG (pHYs, iCCP), PSD, GIF e WebP.
 * Nada é enviado: os bytes são lidos na máquina de quem usa.
 */
export interface Cabecalho { formato: string; largura: number; altura: number; dpi: number | null; cmyk: boolean; perfilIcc: boolean }

const txt = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

export function lerCabecalho(b: Uint8Array): Cabecalho | null {
  if (b.length < 26) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0x89 && txt(b, 1, 3) === 'PNG') return png(b, v);
  if (b[0] === 0xff && b[1] === 0xd8) return jpg(b, v);
  if (txt(b, 0, 4) === '8BPS') return { formato: 'PSD', altura: v.getUint32(14), largura: v.getUint32(18), dpi: null, cmyk: v.getUint16(24) === 4, perfilIcc: false };
  if (txt(b, 0, 3) === 'GIF') return { formato: 'GIF', largura: v.getUint16(6, true), altura: v.getUint16(8, true), dpi: null, cmyk: false, perfilIcc: false };
  if (txt(b, 0, 4) === 'RIFF' && txt(b, 8, 4) === 'WEBP') return webp(b, v);
  return null;
}

function png(b: Uint8Array, v: DataView): Cabecalho {
  const r: Cabecalho = { formato: 'PNG', largura: v.getUint32(16), altura: v.getUint32(20), dpi: null, cmyk: false, perfilIcc: false };
  let i = 8;
  while (i + 8 <= b.length) {
    const n = v.getUint32(i), tipo = txt(b, i + 4, 4);
    if (tipo === 'pHYs' && i + 17 <= b.length && b[i + 16] === 1) r.dpi = Math.round(v.getUint32(i + 8) * 0.0254);
    if (tipo === 'iCCP') r.perfilIcc = true;
    if (tipo === 'IDAT' || tipo === 'IEND') break;
    i += 12 + n;
  }
  return r;
}

function jpg(b: Uint8Array, v: DataView): Cabecalho | null {
  const r: Cabecalho = { formato: 'JPEG', largura: 0, altura: 0, dpi: null, cmyk: false, perfilIcc: false };
  let i = 2, dpiExif: number | null = null, dpiJfif: number | null = null;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xda || m === 0xd9) break;
    const n = v.getUint16(i + 2), s = i + 4;
    if (m === 0xe0 && txt(b, s, 4) === 'JFIF' && s + 12 <= b.length) {
      const un = b[s + 7], x = v.getUint16(s + 8);
      if (x > 1 && un === 1) dpiJfif = x; else if (x > 1 && un === 2) dpiJfif = Math.round(x * 2.54);
    }
    if (m === 0xe1 && txt(b, s, 4) === 'Exif') dpiExif = exifDpi(v, s + 6, Math.min(b.length, i + 2 + n));
    if (m === 0xe2 && txt(b, s, 11) === 'ICC_PROFILE') r.perfilIcc = true;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && s + 6 <= b.length) {
      r.altura = v.getUint16(s + 1); r.largura = v.getUint16(s + 3); r.cmyk = b[s + 5] === 4;
    }
    i += 2 + n;
  }
  r.dpi = dpiExif ?? dpiJfif;
  return r.largura ? r : null;
}

/** XResolution (0x011A) e ResolutionUnit (0x0128) do IFD0 do EXIF. */
function exifDpi(v: DataView, t: number, fim: number): number | null {
  try {
    const le = v.getUint16(t) === 0x4949, u16 = (o: number) => v.getUint16(t + o, le), u32 = (o: number) => v.getUint32(t + o, le);
    const ifd = u32(4), qtd = u16(ifd);
    let x: number | null = null, un = 2;
    for (let k = 0; k < qtd; k++) {
      const e = ifd + 2 + k * 12;
      if (t + e + 12 > fim) break;
      const tag = u16(e);
      if (tag === 0x011a) { const o = u32(e + 8); const d = u32(o + 4); x = d ? u32(o) / d : null; }
      if (tag === 0x0128) un = u16(e + 8);
    }
    if (!x || x <= 1) return null;
    return Math.round(un === 3 ? x * 2.54 : x);
  } catch { return null; }
}

function webp(b: Uint8Array, v: DataView): Cabecalho | null {
  const c = txt(b, 12, 4), r: Cabecalho = { formato: 'WebP', largura: 0, altura: 0, dpi: null, cmyk: false, perfilIcc: false };
  if (c === 'VP8X') { r.largura = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)); r.altura = 1 + (b[27] | (b[28] << 8) | (b[29] << 16)); r.perfilIcc = !!(b[20] & 0x20); }
  else if (c === 'VP8 ' && b.length >= 30) { r.largura = v.getUint16(26, true) & 0x3fff; r.altura = v.getUint16(28, true) & 0x3fff; }
  else if (c === 'VP8L' && b.length >= 25) { const n = v.getUint32(21, true); r.largura = 1 + (n & 0x3fff); r.altura = 1 + ((n >> 14) & 0x3fff); }
  return r.largura ? r : null;
}

/** sha256 em hexadecimal (crypto do navegador). */
export async function sha256(b: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', b as unknown as ArrayBuffer));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
}
