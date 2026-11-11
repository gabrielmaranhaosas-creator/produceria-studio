const { app, core, constants } = require("photoshop");
const G = require("./guias.js");

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
function resumo(t) { $("resumo").textContent = t; $("resultado").innerHTML = ""; }
function linha(t) { const d = document.createElement("div"); d.className = "item"; d.textContent = t; $("resultado").appendChild(d); }

function calcular(doc) {
  const w = Math.round(doc.width), h = Math.round(doc.height), ppi = Number(doc.resolution) || 72;
  const guias = [];
  if ($("gImpresso").checked) guias.push(...G.guiasImpresso(w, h, ppi, $("sangria").value, $("margem").value, $("temSangria").checked));
  if ($("gCentro").checked) guias.push(...G.guiasCentro(w, h));
  if ($("gTercos").checked) guias.push(...G.guiasTercos(w, h));
  if ($("gStories").checked) guias.push(...G.guiasStories(w, h, $("pctStories").value));
  if ($("gColunas").checked) guias.push(...G.guiasColunas(w, $("colunas").value, $("calha").value, $("margemCol").value));
  return { guias: G.limpar(guias, w, h), w, h, ppi };
}

$("btnAplicar").addEventListener("click", async () => {
  const doc = app.activeDocument;
  if (!doc) { resumo("Abra um documento no Photoshop e clique de novo."); return; }
  let r;
  try { r = calcular(doc); } catch (e) { resumo(msg(e)); return; }
  if (!r.guias.length) { resumo("Marque ao menos um tipo de guia."); return; }
  try {
    await core.executeAsModal(async () => {
      if ($("limpar").checked) doc.guides.removeAll();
      for (const g of r.guias) {
        doc.guides.add(g.dir === "v" ? constants.Direction.VERTICAL : constants.Direction.HORIZONTAL, g.pos);
      }
    }, { commandName: "Produceria: guias" });
    resumo(r.guias.length + " guia(s) criada(s) em " + r.w + " x " + r.h + " px a " + r.ppi + " ppi.");
    r.guias.forEach((g) => linha((g.dir === "v" ? "Vertical " : "Horizontal ") + g.pos + " px · " + g.motivo));
    if ($("gImpresso").checked && r.ppi < 150) linha("[AVISO] Resolução de " + r.ppi + " ppi: as medidas em mm dependem do ppi do documento. Confira em Imagem > Tamanho da imagem.");
  } catch (e) {
    resumo("Erro ao criar as guias: " + msg(e));
  }
});

$("btnRemover").addEventListener("click", async () => {
  const doc = app.activeDocument;
  if (!doc) { resumo("Abra um documento no Photoshop e clique de novo."); return; }
  try {
    await core.executeAsModal(async () => { doc.guides.removeAll(); }, { commandName: "Produceria: remover guias" });
    resumo("Todas as guias do documento foram removidas (Ctrl/Cmd + Z desfaz).");
  } catch (e) { resumo("Erro: " + msg(e)); }
});
