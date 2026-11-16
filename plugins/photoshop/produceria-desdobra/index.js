const { app, core, constants } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { lerFormatos, calcularEscala, nomeDoc, PADRAO_FORMATOS, PACOTES } = require("./desdobra.js");
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
function lembrarCampos(chave, ids) {
  try { const s = JSON.parse(localStorage.getItem(chave) || "{}"); ids.forEach((id) => { const el = document.getElementById(id); if (el && s[id] !== undefined) { if (el.type === "checkbox") el.checked = !!s[id]; else el.value = s[id]; } }); } catch (e) { /* primeira vez */ }
  const salvar = () => { try { const s = {}; ids.forEach((id) => { const el = document.getElementById(id); if (el) s[id] = el.type === "checkbox" ? el.checked : el.value; }); localStorage.setItem(chave, JSON.stringify(s)); } catch (e) { /* sem armazenamento */ } };
  ids.forEach((id) => { const el = document.getElementById(id); if (el) { el.addEventListener("change", salvar); el.addEventListener("input", salvar); } });
}

lembrarCampos("desdobra.campos", ["cliente", "campanha", "versao", "modo", "ancora", "formatos", "salvar"]);
if (!$("formatos").value.trim()) $("formatos").value = PADRAO_FORMATOS;
$("pacote").addEventListener("change", () => {
  const p = PACOTES[valorDe($("pacote"))];
  if (p) { $("formatos").value = p.lista; $("formatos").dispatchEvent(new Event("input")); $("resumo").textContent = "Pacote " + p.nome + " carregado: edite a lista se quiser."; }
});
pastaLembrada("desdobra.pasta").then((p) => { if (p) { pastaPSD = p; $("pasta").textContent = "Pasta (lembrada): " + p.nativePath; } });


function linha(texto) {
  const d = document.createElement("div");
  d.className = "item";
  d.textContent = texto;
  $("resultado").appendChild(d);
}

$("btnPasta").addEventListener("click", async () => {
  $("pasta").textContent = "Abrindo a janela de escolher pasta... (se não aparecer, procure atrás da janela do Photoshop).";
  try {
    const p = await localFileSystem.getFolder();
    if (p) { pastaPSD = p; $("pasta").textContent = "Pasta: " + p.nativePath; lembrarPasta("desdobra.pasta", p); }
    else $("pasta").textContent = "Nenhuma pasta escolhida.";
  } catch (e) { $("pasta").textContent = "Não foi possível abrir a janela de pastas: " + msg(e) + "."; }
});

$("btnDesdobrar").addEventListener("click", async () => {
  $("resultado").innerHTML = "";
  const doc = docAtivo();
  if (!doc) { $("resumo").textContent = "Abra o KV no Photoshop e clique de novo."; return; }
  const cliente = $("cliente").value.trim(), campanha = $("campanha").value.trim();
  if (!cliente || !campanha) { $("resumo").textContent = "Preencha cliente e campanha."; return; }
  const { formatos, erros } = lerFormatos($("formatos").value, Number(doc.resolution) || 72);
  if (erros.length) { $("resumo").textContent = "Corrija a lista de formatos."; erros.forEach((e) => linha("[ERRO] " + e)); return; }
  if (formatos.length === 0) { $("resumo").textContent = "Nenhum formato informado."; return; }
  if ($("salvar").checked && !pastaPSD) { $("resumo").textContent = "Escolha a pasta para os PSD ou desmarque a opção de salvar."; return; }

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
            const arq = await pastaPSD.createFile(nome + ".psd", { overwrite: true });
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
