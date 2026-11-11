// Cálculo das guias. Funções puras, testáveis sem o Photoshop.
// Cada guia: { dir: "h" | "v", pos: pixels a partir do topo (h) ou da esquerda (v), motivo }.

const mmParaPx = (mm, ppi) => Math.round((Number(mm) / 25.4) * Number(ppi));

// Impresso. Se o documento já inclui a sangria, a primeira guia marca o corte (linha de refile)
// e a segunda a margem de segurança, medida a partir do corte. Sem sangria no documento, só a margem.
function guiasImpresso(w, h, ppi, sangriaMm, margemMm, temSangria) {
  const s = temSangria ? mmParaPx(sangriaMm, ppi) : 0;
  const m = s + mmParaPx(margemMm, ppi);
  const g = [];
  if (s > 0) g.push(...quatro(w, h, s, "corte (sangria de " + sangriaMm + " mm)"));
  if (m > 0) g.push(...quatro(w, h, m, "margem de segurança de " + margemMm + " mm"));
  return g;
}

function quatro(w, h, d, motivo) {
  return [
    { dir: "v", pos: d, motivo }, { dir: "v", pos: w - d, motivo },
    { dir: "h", pos: d, motivo }, { dir: "h", pos: h - d, motivo },
  ];
}

const guiasCentro = (w, h) => [{ dir: "v", pos: Math.round(w / 2), motivo: "centro" }, { dir: "h", pos: Math.round(h / 2), motivo: "centro" }];

const guiasTercos = (w, h) => [1, 2].flatMap((k) => [
  { dir: "v", pos: Math.round((w * k) / 3), motivo: "terço" }, { dir: "h", pos: Math.round((h * k) / 3), motivo: "terço" },
]);

// Stories e reels (9:16): faixa de cerca de 14% no topo e na base fica sob a interface do app.
// Recomendação de mercado (Meta): confira o spec vigente do veículo antes de fechar.
function guiasStories(w, h, pct) {
  const p = Number(pct) > 0 ? Number(pct) : 14;
  const d = Math.round((h * p) / 100);
  return [{ dir: "h", pos: d, motivo: "área segura do topo (" + p + "%)" }, { dir: "h", pos: h - d, motivo: "área segura da base (" + p + "%)" }];
}

// Colunas: n colunas com calha (gutter) dentro das margens laterais, todas em pixels.
function guiasColunas(w, n, calha, margem) {
  const cols = Math.max(1, Math.min(24, Math.round(Number(n) || 1)));
  const c = Math.max(0, Number(calha) || 0), m = Math.max(0, Number(margem) || 0);
  const util = w - 2 * m - (cols - 1) * c;
  if (util <= 0) throw new Error("Margem e calha maiores que a largura do documento.");
  const larg = util / cols, g = [];
  for (let i = 0; i < cols; i++) {
    const x0 = m + i * (larg + c);
    g.push({ dir: "v", pos: Math.round(x0), motivo: "coluna " + (i + 1) });
    g.push({ dir: "v", pos: Math.round(x0 + larg), motivo: "coluna " + (i + 1) });
  }
  return g;
}

// Remove repetidas e fora do documento.
function limpar(guias, w, h) {
  const vistos = new Set();
  return guias.filter((g) => {
    const lim = g.dir === "v" ? w : h;
    const k = g.dir + g.pos;
    if (g.pos < 0 || g.pos > lim || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

module.exports = { mmParaPx, guiasImpresso, guiasCentro, guiasTercos, guiasStories, guiasColunas, limpar };
