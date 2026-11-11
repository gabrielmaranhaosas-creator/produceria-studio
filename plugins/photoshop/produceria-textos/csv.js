// Leitura e escrita do CSV de revisão. Funções puras, testáveis sem o Photoshop.
// Separador ";" (padrão do Excel em português), campos entre aspas, UTF-8 com BOM.

const BOM = "﻿";
const CABECALHO = ["arquivo", "id", "camada", "texto_original", "texto_revisado"];

// Quebras de linha viram o marcador visível \n; a barra invertida vira \\.
function codificarTexto(t) {
  return String(t == null ? "" : t)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function decodificarTexto(t) {
  let saida = "";
  const s = String(t == null ? "" : t);
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const prox = s[i + 1];
      if (prox === "n") { saida += "\r"; i++; continue; } // Photoshop usa \r como quebra de parágrafo
      if (prox === "\\") { saida += "\\"; i++; continue; }
    }
    saida += s[i];
  }
  return saida;
}

function campo(v) {
  return "\"" + String(v == null ? "" : v).replace(/"/g, "\"\"") + "\"";
}

// linhas: [{arquivo, id, camada, texto}]
function serializar(linhas) {
  const corpo = linhas.map((l) =>
    [campo(l.arquivo), campo(l.id), campo(l.camada), campo(codificarTexto(l.texto)), campo("")].join(";")
  );
  return BOM + [CABECALHO.map(campo).join(";")].concat(corpo).join("\r\n") + "\r\n";
}

// Lê CSV com ";" ou "," e campos entre aspas. Devolve lista de linhas de campos.
function lerCsv(texto) {
  let t = String(texto || "");
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const primeira = t.split(/\r?\n/)[0] || "";
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ";" : ",";
  const linhas = [];
  let linha = [], atual = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === "\"") {
        if (t[i + 1] === "\"") { atual += "\""; i++; } else aspas = false;
      } else atual += c;
    } else if (c === "\"") aspas = true;
    else if (c === sep) { linha.push(atual); atual = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(atual); atual = "";
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
    } else atual += c;
  }
  linha.push(atual);
  if (linha.some((x) => x !== "")) linhas.push(linha);
  return linhas;
}

// Devolve [{arquivo, id, camada, original, revisado}] a partir do CSV revisado.
function interpretar(texto) {
  const linhas = lerCsv(texto);
  if (linhas.length < 2) return { erro: "O arquivo está vazio ou sem linhas de dados.", linhas: [] };
  const cab = linhas[0].map((x) => x.trim().toLowerCase());
  const idx = {};
  for (const nome of CABECALHO) idx[nome] = cab.indexOf(nome);
  const faltando = CABECALHO.filter((n) => idx[n] < 0);
  if (faltando.length) return { erro: "Colunas ausentes no CSV: " + faltando.join(", ") + ".", linhas: [] };
  const dados = linhas.slice(1).map((l) => ({
    arquivo: l[idx.arquivo], id: l[idx.id], camada: l[idx.camada],
    original: decodificarTexto(l[idx.texto_original]),
    revisado: decodificarTexto(l[idx.texto_revisado]),
  }));
  return { erro: null, linhas: dados };
}

// Só aplica quando há revisão preenchida e diferente do original.
function precisaAplicar(l) {
  return l.revisado !== "" && l.revisado !== l.original;
}

module.exports = { serializar, lerCsv, interpretar, codificarTexto, decodificarTexto, precisaAplicar, CABECALHO };
