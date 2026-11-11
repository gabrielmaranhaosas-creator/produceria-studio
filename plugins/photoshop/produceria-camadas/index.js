const { app, core } = require("photoshop");
const C = require("./camadas.js");

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
const seguro = (fn, p) => { try { const v = fn(); return v === undefined ? p : v; } catch (e) { return p; } };
function resumo(t) { $("resumo").textContent = t; $("resultado").innerHTML = ""; }
function linha(t) { const d = document.createElement("div"); d.className = "item"; d.textContent = t; $("resultado").appendChild(d); }

function todas(lista, saida) {
  for (const c of lista) {
    saida.push(c);
    const f = seguro(() => c.layers, null);
    if (f && f.length) todas(f, saida);
  }
  return saida;
}
function alvo(doc) {
  if ($("escopo").value === "todas") return todas(doc.layers, []).filter((c) => !seguro(() => c.isBackgroundLayer, false));
  return Array.from(doc.activeLayers || []);
}
function docAberto() { const d = app.activeDocument; if (!d) resumo("Abra um documento no Photoshop e clique de novo."); return d; }

async function renomear(rotulo, transformar) {
  const doc = docAberto(); if (!doc) return;
  const camadas = alvo(doc);
  if (!camadas.length) { resumo($("escopo").value === "todas" ? "O documento não tem camadas para renomear." : "Selecione as camadas no painel Camadas e clique de novo."); return; }
  const mudancas = [];
  try {
    await core.executeAsModal(async () => {
      camadas.forEach((c, i) => {
        const antes = c.name, depois = transformar(c, i);
        if (depois && depois !== antes) { c.name = depois; mudancas.push(antes + "  →  " + depois); }
      });
    }, { commandName: "Produceria: " + rotulo });
    resumo(mudancas.length + " camada(s) renomeada(s). Ctrl/Cmd + Z desfaz.");
    mudancas.forEach(linha);
  } catch (e) { resumo("Erro ao renomear: " + msg(e)); }
}

$("btnPadrao").addEventListener("click", () => {
  const p = $("padrao").value || "{nome}";
  renomear("renomear em lote", (c, i) => C.novoNome(p, c.name, i, $("inicio").value, $("digitos").value));
});
$("btnSubstituir").addEventListener("click", () => {
  if (!$("de").value) { resumo("Preencha o texto a localizar."); return; }
  renomear("localizar e substituir", (c) => C.substituir(c.name, $("de").value, $("para").value, $("maiusc").checked));
});
$("btnPrefixos").addEventListener("click", () => {
  renomear("prefixos por tipo", (c) => C.comPrefixo(c.name, seguro(() => c.kind, "")));
});

$("btnRelatorio").addEventListener("click", () => {
  const doc = docAberto(); if (!doc) return;
  const lista = todas(doc.layers, []);
  const padrao = lista.filter((c) => C.ehNomePadrao(c.name));
  const ocultas = lista.filter((c) => seguro(() => c.visible, true) === false);
  const vazias = lista.filter((c) => {
    const k = String(seguro(() => c.kind, ""));
    if (!/pixel/i.test(k)) return false;
    const b = seguro(() => c.bounds, null);
    return b && (b.right - b.left <= 0 || b.bottom - b.top <= 0);
  });
  resumo(lista.length + " camada(s): " + padrao.length + " com nome padrão, " + ocultas.length + " oculta(s), " + vazias.length + " vazia(s).");
  padrao.forEach((c) => linha("[NOME PADRÃO] " + c.name));
  vazias.forEach((c) => linha("[VAZIA] " + c.name));
  ocultas.forEach((c) => linha("[OCULTA] " + c.name));
  if (!padrao.length && !vazias.length && !ocultas.length) linha("[OK] Camadas organizadas para entrega.");
});
