const { app, core, constants } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { lerFormatos, calcularEscala, nomeDoc, PADRAO_FORMATOS } = require("./desdobra.js");

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
let pastaPSD = null;

// Qualquer erro do painel aparece no próprio painel (antes ficava invisível).
window.addEventListener("error", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + (e.message || e); });
window.addEventListener("unhandledrejection", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + msg(e.reason); });

if (!$("formatos").value.trim()) $("formatos").value = PADRAO_FORMATOS;


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
    if (p) { pastaPSD = p; $("pasta").textContent = "Pasta: " + p.nativePath; }
    else $("pasta").textContent = "Nenhuma pasta escolhida.";
  } catch (e) { $("pasta").textContent = "Não foi possível abrir a janela de pastas: " + msg(e) + "."; }
});

$("btnDesdobrar").addEventListener("click", async () => {
  $("resultado").innerHTML = "";
  const doc = app.activeDocument;
  if (!doc) { $("resumo").textContent = "Abra o KV no Photoshop e clique de novo."; return; }
  const cliente = $("cliente").value.trim(), campanha = $("campanha").value.trim();
  if (!cliente || !campanha) { $("resumo").textContent = "Preencha cliente e campanha."; return; }
  const { formatos, erros } = lerFormatos($("formatos").value, Number(doc.resolution) || 72);
  if (erros.length) { $("resumo").textContent = "Corrija a lista de formatos."; erros.forEach((e) => linha("[ERRO] " + e)); return; }
  if (formatos.length === 0) { $("resumo").textContent = "Nenhum formato informado."; return; }
  if ($("salvar").checked && !pastaPSD) { $("resumo").textContent = "Escolha a pasta para os PSD ou desmarque a opção de salvar."; return; }

  const modo = $("modo").value;
  const ancora = constants.AnchorPosition[$("ancora").value] || constants.AnchorPosition.MIDDLECENTER;
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
