// Regras de nome de camada. Funções puras, testáveis sem o Photoshop.

// Nome padrão do Photoshop (pt e en): "Camada 1", "Layer 3 copy 2", "Grupo 1", "Group 2"...
const NOME_PADRAO = /^(layer|camada|group|grupo|shape|forma|rectangle|retângulo|ellipse|elipse)\s*\d+(\s*(copy|cópia|copia)(\s*\d+)?)?$/i;
const ehNomePadrao = (n) => NOME_PADRAO.test(String(n || "").trim());

// Padrão com marcadores: {nome} = nome atual, {n} = número com zeros à esquerda.
// Ex.: "TXT_{n}" -> TXT_01, TXT_02; "{nome} - feed" -> "Título - feed".
function novoNome(padrao, nomeAtual, indice, inicio, digitos) {
  const n = String((Number(inicio) || 1) + indice).padStart(Math.max(1, Number(digitos) || 2), "0");
  return String(padrao || "{nome}").replace(/\{nome\}/g, String(nomeAtual || "")).replace(/\{n\}/g, n).trim();
}

// Localizar e substituir, sem expressão regular (o texto é literal), sensível ou não a maiúsculas.
function substituir(nome, de, para, maiusculas) {
  if (!de) return nome;
  const esc = String(de).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(nome).replace(new RegExp(esc, maiusculas ? "g" : "gi"), String(para || ""));
}

// Prefixo da casa por tipo de camada; não repete se o nome já começa com um prefixo conhecido.
const PREFIXOS = { text: "TXT_", pixel: "IMG_", group: "GRP_", smartObject: "SO_", solidColor: "COR_", gradientFill: "COR_", patternFill: "COR_", vector: "VET_", adjustment: "AJ_" };
const PREFIXO_EXISTENTE = /^(TXT|IMG|GRP|SO|COR|VET|AJ)_/;
function comPrefixo(nome, tipo) {
  const p = PREFIXOS[tipoBase(tipo)];
  if (!p || PREFIXO_EXISTENTE.test(nome)) return nome;
  return p + nome;
}
function tipoBase(tipo) {
  const t = String(tipo || "");
  if (/text/i.test(t)) return "text";
  if (/group/i.test(t)) return "group";
  if (/smart/i.test(t)) return "smartObject";
  if (/pixel|normal/i.test(t)) return "pixel";
  if (/solid/i.test(t)) return "solidColor";
  if (/gradient/i.test(t)) return "gradientFill";
  if (/pattern/i.test(t)) return "patternFill";
  if (/vector|shape/i.test(t)) return "vector";
  if (/adjust|curves|levels|hue|brightness|exposure|vibrance|colorbalance|blackandwhite|photofilter|channelmixer|selectivecolor|gradientmap/i.test(t)) return "adjustment";
  return t;
}

module.exports = { ehNomePadrao, novoNome, substituir, comPrefixo, tipoBase };
