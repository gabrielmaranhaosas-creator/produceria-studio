// Regras de versão de arquivo. Funções puras, testáveis sem o Photoshop.

// "CLI_camp_stories_v03.psd" -> "CLI_camp_stories_v04.psd". Sem versão no nome: acrescenta _v02.
function proximaVersao(nome) {
  const m = String(nome || "").match(/^(.*?)(_v)(\d+)(\.[^.]*)?$/i);
  if (m) {
    const n = parseInt(m[3], 10) + 1;
    return m[1] + m[2] + String(n).padStart(Math.max(2, m[3].length), "0") + (m[4] || "");
  }
  const ext = String(nome || "").match(/(\.[^.]*)$/);
  const base = ext ? String(nome).slice(0, -ext[1].length) : String(nome || "sem-nome");
  return base + "_v02" + (ext ? ext[1] : "");
}

// Estrutura padrão do grupo de retoque, de baixo para cima.
const CAMADAS_RETOQUE = [
  { nome: "Limpeza (carimbo)", modo: "NORMAL", neutra: false },
  { nome: "Dodge (clarear)", modo: "SOFTLIGHT", neutra: true },
  { nome: "Burn (escurecer)", modo: "SOFTLIGHT", neutra: true },
  { nome: "Cor (ajuste)", modo: "NORMAL", neutra: false },
];
const NOME_GRUPO = "RETOQUE";

module.exports = { proximaVersao, CAMADAS_RETOQUE, NOME_GRUPO };
