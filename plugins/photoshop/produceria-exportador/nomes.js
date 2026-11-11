// Regras de nome dos arquivos de saída. Funções puras, testáveis sem o Photoshop.

const PADRAO_NOME = /^[^_\s]+_[^_\s]+_[^_\s]+_v\d{2,}/i; // CLIENTE_campanha_formato_v01

function semExtensao(nome) {
  return String(nome || "").replace(/\.[^.]+$/, "");
}

// Troca caracteres proibidos em nomes de arquivo e espaços por hífen.
function sanitizar(base) {
  return String(base || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

// Gera o nome de saída. `usados` é um Set com nomes já gerados nesta rodada,
// para nunca sobrescrever um arquivo com o de outro documento de mesmo nome.
function nomeSaida(nomeDoc, extensao, usados) {
  let base = sanitizar(semExtensao(nomeDoc)) || "sem-nome";
  let nome = base + "." + extensao;
  let n = 2;
  while (usados && usados.has(nome.toLowerCase())) {
    nome = base + "-" + n + "." + extensao;
    n += 1;
  }
  if (usados) usados.add(nome.toLowerCase());
  return nome;
}

function seguePadrao(nomeDoc) {
  return PADRAO_NOME.test(semExtensao(nomeDoc));
}

function limitarQualidade(valor) {
  const n = Math.round(Number(valor));
  if (!isFinite(n)) return 10;
  return Math.min(12, Math.max(1, n));
}

module.exports = { sanitizar, nomeSaida, seguePadrao, semExtensao, limitarQualidade };
