// Regras da prova de aprovação. Funções puras, testáveis sem o Photoshop.

// Versão a partir do nome do documento: "CLI_camp_stories_v03.psd" -> "v03"; sem versão, "v01".
function versaoDoNome(nome) {
  const m = String(nome || "").match(/_v(\d{1,3})(?:\.[^.]*)?$/i);
  return "v" + (m ? m[1].padStart(2, "0") : "01");
}

// "11/11/2026"
function dataBr(d) {
  const x = d instanceof Date ? d : new Date();
  return String(x.getDate()).padStart(2, "0") + "/" + String(x.getMonth() + 1).padStart(2, "0") + "/" + x.getFullYear();
}

// Linha de identificação no rodapé da prova.
function rodape(o) {
  return [o.cliente, o.campanha, o.versao, o.data, "PROVA PARA APROVAÇÃO"].filter(Boolean).join("  ·  ");
}

// Nome do arquivo de saída: nome do documento sem extensão + _PROVA.jpg, sem espaços nem símbolos.
function nomeProva(nomeDoc) {
  const base = String(nomeDoc || "documento").replace(/\.[^.]*$/, "")
    .normalize("NFKD").replace(/[^\x00-\x7F]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "documento";
  return base + "_PROVA.jpg";
}

// Redução para envio: maior lado até `max` (0 = sem redução). Devolve null quando não precisa reduzir.
function reduzir(w, h, max) {
  const m = Number(max) || 0;
  if (!m || Math.max(w, h) <= m) return null;
  const s = m / Math.max(w, h);
  return { largura: Math.round(w * s), altura: Math.round(h * s) };
}

// Tamanho do texto em pontos para ocupar `fracao` do menor lado do documento.
function pontos(w, h, ppi, fracao) {
  const px = Math.min(w, h) * (Number(fracao) || 0.08);
  return Math.max(6, Math.round((px * 72) / (Number(ppi) || 72)));
}

module.exports = { versaoDoNome, dataBr, rodape, nomeProva, reduzir, pontos };
