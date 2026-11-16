const { app, core, constants } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { lerFormatos, calcularEscala, nomeDoc, PADRAO_FORMATOS, PACOTES } = require("./desdobra.js");
const { resolverDestino, escolherPasta } = require("./destino.js");
// Leituras seguras: algumas versões do UXP não preenchem .value de <select>, e app.activeDocument pode lançar erro sem documento aberto.
const valorDe = (el) => (el && el.value ? el.value : (el && el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex] ? el.options[el.selectedIndex].value : ""));
const docAtivo = () => { try { return app.activeDocument || null; } catch (e) { return null; } };

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
let pastaPSD = null;

// Qualquer erro do painel aparece no próprio painel (antes ficava invisível).
window.addEventListener("error", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + (e.message || e); });
window.addEventListener("unhandledrejection", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + msg(e.reason); });

// Memória do painel: a pasta escolhida volta na próxima abertura (token persistente do UXP) e os campos ficam salvos.
async function lembrarPasta(chave, pasta) { try { localStorage.setItem(chave, await localFileSystem.createPersistentToken(pasta)); } catch (e) { /* sem memória: escolhe de novo */ } }
async function pastaLembrada(chave) { try { const t = localStorage.getItem(chave); return t ? await localFileSystem.getEntryForPersistentToken(t) : null; } catch (e) { return null; } }
// Guarda e devolve os campos do painel. Devolve a função de salvar, para quem muda um campo por código.
function lembrarCampos(chave, ids) {
  const por = (el, v) => { if (el.type === "checkbox") el.checked = !!v; else if (el.tagName === "SELECT" && el.options) { const i = Array.from(el.options).findIndex((o) => o.value === v); if (i >= 0) el.selectedIndex = i; } else el.value = v; };
  try { const s = JSON.parse(localStorage.getItem(chave) || "{}"); ids.forEach((id) => { const el = document.getElementById(id); if (el && s[id] !== undefined) por(el, s[id]); }); } catch (e) { /* primeira vez */ }
  const salvar = () => { try { const s = {}; ids.forEach((id) => { const el = document.getElementById(id); if (el) s[id] = el.type === "checkbox" ? el.checked : valorDe(el); }); localStorage.setItem(chave, JSON.stringify(s)); } catch (e) { /* sem armazenamento */ } };
  ids.forEach((id) => { const el = document.getElementById(id); if (el) { el.addEventListener("change", salvar); el.addEventListener("input", salvar); } });
  return salvar;
}

// Os botões são ligados antes de tudo: se a memória do painel falhar, os cliques continuam funcionando.
let salvarCampos = () => {};
const AVISO_JANELA = "A janela de pastas não apareceu? Procure atrás da janela do Photoshop, ou cole o caminho da pasta no campo abaixo (no Mac: botão direito na pasta, segure Option, \"Copiar como nome de caminho\"). Vazio = pasta \"desdobra\" ao lado do KV.";

function linha(texto) {
  const d = document.createElement("div");
  d.className = "item";
  d.textContent = texto;
  $("resultado").appendChild(d);
}

$("btnPasta").addEventListener("click", async () => {
  $("pasta").textContent = "Abrindo a janela de escolher pasta...";
  try {
    const p = await escolherPasta(localFileSystem, () => { $("pasta").textContent = AVISO_JANELA; });
    if (p) { pastaPSD = p; $("caminho").value = p.nativePath; $("salvar").checked = true; salvarCampos(); $("pasta").textContent = "Pasta: " + p.nativePath; lembrarPasta("desdobra.pasta", p); }
    else $("pasta").textContent = "Nenhuma pasta escolhida.";
  } catch (e) { $("pasta").textContent = "Não foi possível abrir a janela de pastas: " + msg(e) + ". Cole o caminho no campo abaixo ou deixe vazio para salvar ao lado do KV."; }
});
$("caminho").addEventListener("change", () => { const c = $("caminho").value.trim(); if (pastaPSD && pastaPSD.nativePath !== c) pastaPSD = null; if (c) { $("salvar").checked = true; $("pasta").textContent = "Pasta: " + c; } else $("pasta").textContent = "Sem pasta: os PSD vão para a pasta \"desdobra\" ao lado do KV."; });

$("btnDesdobrar").addEventListener("click", async () => {
  $("resultado").innerHTML = "";
  const doc = docAtivo();
  if (!doc) { $("resumo").textContent = "Abra o KV no Photoshop e clique de novo."; return; }
  const cliente = $("cliente").value.trim(), campanha = $("campanha").value.trim();
  if (!cliente || !campanha) { $("resumo").textContent = "Preencha cliente e campanha."; return; }
  const { formatos, erros } = lerFormatos($("formatos").value, Number(doc.resolution) || 72);
  if (erros.length) { $("resumo").textContent = "Corrija a lista de formatos."; erros.forEach((e) => linha("[ERRO] " + e)); return; }
  if (formatos.length === 0) { $("resumo").textContent = "Nenhum formato informado."; return; }
  let destino = null;
  if ($("salvar").checked) {
    try { destino = await resolverDestino(localFileSystem, { caminho: $("caminho").value, escolhida: pastaPSD, doc, subpasta: "desdobra" }); $("pasta").textContent = "Pasta: " + destino.nativePath; }
    catch (e) { $("resumo").textContent = "Não deu para usar a pasta: " + msg(e) + "."; return; }
  }

  const modo = valorDe($("modo")) || "cobrir";
  const ancora = constants.AnchorPosition[valorDe($("ancora"))] || constants.AnchorPosition.MIDDLECENTER;
  const origW = Math.round(doc.width), origH = Math.round(doc.height);
  const feitos = [], falhas = [];
  $("resumo").textContent = "Desdobrando...";

  try {
    await core.executeAsModal(async () => {
      for (const f of formatos) {
        const nome = nomeDoc(cliente, campanha, f.nome, $("versao").value);
        try {
          const dim = calcularEscala(origW, origH, f.largura, f.altura, modo);
          const aviso = dim.escala > 2 ? " (ampliação de " + dim.escala.toFixed(1) + "x: confira a nitidez)" : "";
          const copia = await doc.duplicate(nome);
          await copia.resizeImage(dim.largura, dim.altura);
          await copia.resizeCanvas(f.largura, f.altura, ancora);
          if ($("salvar").checked) {
            const arq = await destino.createFile(nome + ".psd", { overwrite: true });
            await copia.saveAs.psd(arq, {}, true);
          }
          feitos.push(nome + " (" + f.largura + "x" + f.altura + ")" + aviso);
        } catch (e) {
          falhas.push(nome + ": " + msg(e));
        }
      }
    }, { commandName: "Produceria Desdobra KV" });
  } catch (e) {
    falhas.push("Falha geral: " + msg(e));
  }

  $("resumo").textContent = feitos.length + " formato(s) criado(s), " + falhas.length + " erro(s)";
  falhas.forEach((t) => linha("[ERRO] " + t));
  feitos.forEach((t) => linha("[OK] " + t));
  if (feitos.length) linha("Isto é a base da desdobra: ajuste textos, logo e margens de cada formato.");
});

// Memória e pacotes por último, cada um protegido: um erro aqui não desliga os botões.
try {
  salvarCampos = lembrarCampos("desdobra.campos", ["cliente", "campanha", "versao", "modo", "ancora", "formatos", "salvar", "caminho"]);
  if (!$("formatos").value.trim()) $("formatos").value = PADRAO_FORMATOS;
  $("pacote").addEventListener("change", () => {
    const p = PACOTES[valorDe($("pacote"))];
    if (p) { $("formatos").value = p.lista; salvarCampos(); $("resumo").textContent = "Pacote " + p.nome + " carregado: edite a lista se quiser."; }
  });
} catch (e) { $("resumo").textContent = "O painel abriu sem a memória dos campos: " + msg(e); }
pastaLembrada("desdobra.pasta").then((p) => {
  if (!p) return;
  pastaPSD = p;
  if (!$("caminho").value.trim()) $("caminho").value = p.nativePath;
  $("pasta").textContent = "Pasta (lembrada): " + p.nativePath;
});
