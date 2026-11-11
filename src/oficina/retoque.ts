/**
 * Ajustes de retoque feitos no navegador sobre os pixels (RGBA): exposição, contraste, realces, sombras,
 * temperatura, saturação e nitidez (máscara de nitidez), e a ampliação clássica em passos de até 2x.
 * É a base do retoque, não substitui o Photoshop: serve para acertar a imagem antes da arte-final e para provas.
 */
export interface Ajustes { exposicao: number; contraste: number; realces: number; sombras: number; temperatura: number; saturacao: number; nitidez: number }
export const ZERO: Ajustes = { exposicao: 0, contraste: 0, realces: 0, sombras: 0, temperatura: 0, saturacao: 0, nitidez: 0 };
/** Faixa de cada controle: [mínimo, máximo, passo, rótulo, unidade]. Exposição em EV; o resto de −100 a 100 (nitidez 0 a 100). */
export const CONTROLES: [keyof Ajustes, number, number, number, string, string][] = [
  ['exposicao', -2, 2, 0.05, 'Exposição', 'EV'], ['contraste', -100, 100, 1, 'Contraste', ''], ['realces', -100, 100, 1, 'Realces', ''],
  ['sombras', -100, 100, 1, 'Sombras', ''], ['temperatura', -100, 100, 1, 'Temperatura', ''], ['saturacao', -100, 100, 1, 'Saturação', ''], ['nitidez', 0, 100, 1, 'Nitidez', ''],
];
export const neutro = (a: Ajustes) => (Object.keys(ZERO) as (keyof Ajustes)[]).every((k) => a[k] === ZERO[k]);

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Aplica os ajustes de tom e cor em `d` (RGBA 0–255), no lugar. A nitidez é à parte (precisa dos vizinhos). */
export function ajustarTom(d: Uint8ClampedArray, a: Ajustes): void {
  if (neutro({ ...a, nitidez: 0 })) return;
  const ev = Math.pow(2, a.exposicao), t = a.temperatura / 100, cf = 1 + a.contraste / 100, sf = 1 + a.saturacao / 100;
  const sh = (a.sombras / 100) * 0.35, hi = (a.realces / 100) * 0.35;
  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i] / 255) * ev * (1 + 0.12 * t), g = (d[i + 1] / 255) * ev, b = (d[i + 2] / 255) * ev * (1 - 0.12 * t);
    let L = lum(r, g, b);
    if ((sh || hi) && L > 0.0005) {
      const lc = Math.min(1, L), dl = sh * (1 - lc) * (1 - lc) + hi * lc * lc, k = Math.max(0, L + dl) / L;
      r *= k; g *= k; b *= k;
    }
    r = (r - 0.5) * cf + 0.5; g = (g - 0.5) * cf + 0.5; b = (b - 0.5) * cf + 0.5;
    if (sf !== 1) { L = lum(r, g, b); r = L + (r - L) * sf; g = L + (g - L) * sf; b = L + (b - L) * sf; }
    d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255; // Uint8ClampedArray já arredonda e limita a 0–255
  }
}

/** Máscara de nitidez com desfoque 3×3: realça bordas sem mexer nas áreas lisas. `quanto` de 0 a 100. */
export function nitidez(d: Uint8ClampedArray, w: number, h: number, quanto: number): void {
  if (quanto <= 0 || w < 3 || h < 3) return;
  const k = (quanto / 100) * 1.5, o = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += o[p + (dy * w + dx) * 4 + c];
        d[p + c] = o[p + c] + k * (o[p + c] - s / 9);
      }
    }
  }
}

export function aplicar(img: ImageData, a: Ajustes): ImageData {
  ajustarTom(img.data, a);
  nitidez(img.data, img.width, img.height, a.nitidez);
  return img;
}

export const MAX_LADO_AMPLIADO = 12000;
/** Medidas finais da ampliação, limitadas ao maior lado que o navegador desenha com segurança. */
export function medidasAmpliadas(w: number, h: number, fator: number) {
  const f = Math.min(fator, MAX_LADO_AMPLIADO / Math.max(w, h));
  return { largura: Math.round(w * f), altura: Math.round(h * f), fator: Math.round(f * 100) / 100, limitado: f < fator };
}

/** Ampliação clássica: passos de até 2x com suavização de alta qualidade (menos serrilhado que um salto só). */
export function ampliar(fonte: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let atual = fonte;
  while (atual.width < w || atual.height < h) {
    const nw = Math.min(w, atual.width * 2), nh = Math.min(h, atual.height * 2);
    const c = document.createElement('canvas'); c.width = nw; c.height = nh;
    const x = c.getContext('2d')!; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(atual, 0, 0, nw, nh);
    if (atual !== fonte) atual.width = atual.height = 0;
    atual = c;
  }
  return atual;
}
