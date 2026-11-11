// Regras da desdobra. Funções puras, testáveis sem o Photoshop.

const PADRAO_FORMATOS =
  "stories;1080;1920\nfeed-retrato;1080;1350\nfeed-quadrado;1080;1080\npaisagem;1200;628\n" +
  "banner-300x250;300;250\nbanner-728x90;728;90\nbanner-160x600;160;600\nbanner-970x250;970;250";

function limpar(txt) {
  return String(txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

// Lê uma linha por formato. Aceita:
//   stories;1080;1920        (nome;largura;altura, em pixels)
//   1920x1080  ou  1920 x 1080 px   (o nome vira 1920x1080)
//   capa: 29,7x32 cm  ou  210x297 mm   (centímetros e milímetros viram pixels pelo ppi do documento)
// Devolve { formatos, erros }.
function lerFormatos(texto, ppi) {
  const formatos = [], erros = [], vistos = new Set(), res = Number(ppi) > 0 ? Number(ppi) : 72;
  String(texto || "").split(/\r?\n/).forEach((linha, i) => {
    const t = linha.trim();
    if (!t) return;
    let nome, w, h;
    const p = t.split(";").map((x) => x.trim());
    const m = /^(?:([^:;]+):\s*)?(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)\s*(px|pixels?|mm|cm)?$/i.exec(t);
    if (p.length === 3) { nome = limpar(p[0]); w = parseInt(p[1], 10); h = parseInt(p[2], 10); }
    else if (m) {
      const un = (m[4] || "px").toLowerCase(), num = (s) => parseFloat(s.replace(",", "."));
      const fator = un === "mm" ? res / 25.4 : un === "cm" ? res / 2.54 : 1;
      w = Math.round(num(m[2]) * fator); h = Math.round(num(m[3]) * fator);
      nome = limpar(m[1] || (un === "mm" || un === "cm" ? m[2] + "x" + m[3] + un : w + "x" + h));
    }
    if (!nome || !(w > 0) || !(h > 0) || w > 30000 || h > 30000) {
      erros.push("Linha " + (i + 1) + " (\"" + t + "\"): use nome;largura;altura (ex.: stories;1080;1920) ou medidas (ex.: 1920x1080 ou 29,7x32 cm).");
      return;
    }
    if (vistos.has(nome.toLowerCase())) { erros.push("Linha " + (i + 1) + ": nome repetido (" + nome + ")."); return; }
    vistos.add(nome.toLowerCase());
    formatos.push({ nome, largura: w, altura: h });
  });
  return { formatos, erros };
}

// Tamanho que a imagem toma ANTES de ajustar a tela do formato.
function calcularEscala(origW, origH, alvoW, alvoH, modo) {
  const sx = alvoW / origW, sy = alvoH / origH;
  const s = modo === "conter" ? Math.min(sx, sy) : Math.max(sx, sy);
  return { escala: s, largura: Math.max(1, Math.ceil(origW * s)), altura: Math.max(1, Math.ceil(origH * s)) };
}

function nomeDoc(cliente, campanha, formato, versao) {
  const v = Math.max(1, parseInt(versao, 10) || 1);
  return limpar(cliente) + "_" + limpar(campanha) + "_" + limpar(formato) + "_v" + String(v).padStart(2, "0");
}

module.exports = { lerFormatos, calcularEscala, nomeDoc, limpar, PADRAO_FORMATOS };
