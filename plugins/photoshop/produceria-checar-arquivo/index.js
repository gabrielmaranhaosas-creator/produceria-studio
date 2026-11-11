const { app } = require("photoshop");
const { analisar } = require("./checks.js");

function seguro(fn, padrao) {
  try { const v = fn(); return v === undefined ? padrao : v; } catch (e) { return padrao; }
}

// Percorre as camadas, inclusive dentro de grupos
function coletarCamadas(lista, saida) {
  for (const camada of lista) {
    const tipo = String(seguro(() => camada.kind, "")).toLowerCase();
    const ehTexto = tipo.includes("text");
    saida.push({
      nome: seguro(() => camada.name, ""),
      tipo,
      visivel: seguro(() => camada.visible, true),
      ehTexto,
      fonte: ehTexto ? seguro(() => camada.textItem.characterStyle.font, null) : null,
    });
    const filhas = seguro(() => camada.layers, null);
    if (filhas && filhas.length) coletarCamadas(filhas, saida);
  }
}

function fontesInstaladas() {
  try {
    const nomes = Array.from(app.fonts).map((f) => f.postScriptName);
    return nomes.length ? new Set(nomes) : null;
  } catch (e) {
    return null;
  }
}

function coletar(doc) {
  const camadas = [];
  coletarCamadas(doc.layers, camadas);
  return {
    nome: seguro(() => doc.name, ""),
    modo: String(seguro(() => doc.mode, "")),
    perfil: seguro(() => doc.colorProfileName, null),
    resolucao: seguro(() => doc.resolution, null),
    camadas,
  };
}

function mostrar(resultado) {
  const c = resultado.contagem;
  document.getElementById("resumo").textContent =
    c.ERRO + " erro(s), " + c.AVISO + " aviso(s), " + c.OK + " ok";
  const caixa = document.getElementById("resultado");
  caixa.innerHTML = "";
  const ordem = ["ERRO", "AVISO", "MANUAL", "INFO", "OK"];
  const itens = resultado.itens.slice().sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel));
  for (const i of itens) {
    const div = document.createElement("div");
    div.className = "item";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "[" + i.nivel + "] " + i.titulo + ": ";
    div.appendChild(tag);
    div.appendChild(document.createTextNode(i.detalhe));
    caixa.appendChild(div);
  }
}

function mensagem(texto) {
  document.getElementById("resumo").textContent = texto;
  document.getElementById("resultado").innerHTML = "";
}

document.getElementById("btnChecar").addEventListener("click", () => {
  try {
    const doc = app.activeDocument;
    if (!doc) { mensagem("Abra um documento no Photoshop e clique de novo."); return; }
    const destino = document.getElementById("destino").value;
    const info = coletar(doc);
    mostrar(analisar(info, { destino, fontesInstaladas: fontesInstaladas() }));
  } catch (e) {
    mensagem("Erro ao checar: " + (e && e.message ? e.message : e));
  }
});
