// Regras da desdobra. Funções puras, testáveis sem o Photoshop.

const PADRAO_FORMATOS =
  "stories;1080;1920\nfeed-retrato;1080;1350\nfeed-quadrado;1080;1080\npaisagem;1200;628\n" +
  "banner-300x250;300;250\nbanner-728x90;728;90\nbanner-160x600;160;600\nbanner-970x250;970;250";

function limpar(txt) {
  return String(txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

// Lê as linhas "nome;largura;altura". Devolve { formatos, erros }.
function lerFormatos(texto) {
  const formatos = [], erros = [], vistos = new Set();
  String(texto || "").split(/\r?\n/).forEach((linha, i) => {
    if (!linha.trim()) return;
    const p = linha.split(";").map((x) => x.trim());
    const w = parseInt(p[1], 10), h = parseInt(p[2], 10);
    const nome = limpar(p[0]);
    if (p.length !== 3 || !nome || !(w > 0) || !(h > 0) || w > 30000 || h > 30000) {
      erros.push("Linha " + (i + 1) + ": use nome;largura;altura (ex.: stories;1080;1920).");
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
