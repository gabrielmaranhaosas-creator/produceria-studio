// API opcional: não sobe o requisito mínimo dos modos antigos. Sem API, a galeria continua como esquema.
async function capturar(imaging, doc) {
  if (!imaging || typeof imaging.getPixels !== "function" || typeof imaging.encodeImageData !== "function") {
    throw new Error("Prévia real indisponível: esta instalação não expõe a Imaging API do Photoshop. Use o esquema ou atualize o Photoshop e valide o painel.");
  }
  let pixels;
  try {
    const w = Number(doc.width), h = Number(doc.height), fator = Math.min(1, 440 / Math.max(w, h));
    pixels = await imaging.getPixels({ documentID: doc.id, sourceBounds: { left: 0, top: 0, right: w, bottom: h },
      targetSize: { width: Math.max(1, Math.round(w * fator)), height: Math.max(1, Math.round(h * fator)) },
      colorSpace: "RGB", colorProfile: "sRGB IEC61966-2.1", componentSize: 8, applyAlpha: true });
    const src = await imaging.encodeImageData({ imageData: pixels.imageData, base64: true });
    if (typeof src !== "string" || !/^[A-Za-z0-9+/=]+$/.test(src)) throw new Error("O Photoshop não devolveu uma miniatura JPEG válida.");
    const b = pixels.sourceBounds || { left: 0, top: 0, right: w, bottom: h }, nivel = pixels.sourceBounds ? Math.pow(2, pixels.level || 0) : 1;
    return { src: "data:image/jpeg;base64," + src, bounds: { left: b.left * nivel, top: b.top * nivel, right: b.right * nivel, bottom: b.bottom * nivel } };
  } finally { if (pixels && pixels.imageData) pixels.imageData.dispose(); }
}

module.exports = { capturar };
