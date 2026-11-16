const { app, core, action } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { nomeSaida, seguePadrao, limitarQualidade } = require("./nomes.js");
// Leituras seguras: algumas versões do UXP não preenchem .value de <select>, e app.activeDocument pode lançar erro sem documento aberto.
const valorDe = (el) => (el && el.value ? el.value : (el && el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex] ? el.options[el.selectedIndex].value : ""));
const docAtivo = () => { try { return app.activeDocument || null; } catch (e) { return null; } };

let pastaSaida = null;
// Memória do painel: a pasta escolhida volta na próxima abertura (token persistente do UXP) e os campos ficam salvos.
async function lembrarPasta(chave, pasta) { try { localStorage.setItem(chave, await localFileSystem.createPersistentToken(pasta)); } catch (e) { /* sem memória: escolhe de novo */ } }
async function pastaLembrada(chave) { try { const t = localStorage.getItem(chave); return t ? await localFileSystem.getEntryForPersistentToken(t) : null; } catch (e) { return null; } }
function lembrarCampos(chave, ids) {
  try { const s = JSON.parse(localStorage.getItem(chave) || "{}"); ids.forEach((id) => { const el = document.getElementById(id); if (el && s[id] !== undefined) { if (el.type === "checkbox") el.checked = !!s[id]; else el.value = s[id]; } }); } catch (e) { /* primeira vez */ }
  const salvar = () => { try { const s = {}; ids.forEach((id) => { const el = document.getElementById(id); if (el) s[id] = el.type === "checkbox" ? el.checked : el.value; }); localStorage.setItem(chave, JSON.stringify(s)); } catch (e) { /* sem armazenamento */ } };
  ids.forEach((id) => { const el = document.getElementById(id); if (el) { el.addEventListener("change", salvar); el.addEventListener("input", salvar); } });
}

const $ = (id) => document.getElementById(id);

function mensagem(texto) {
  $("resumo").textContent = texto;
  $("resultado").innerHTML = "";
}

function linha(texto) {
  const div = document.createElement("div");
  div.className = "item";
  div.textContent = texto;
  $("resultado").appendChild(div);
}

$("btnPasta").addEventListener("click", async () => {
  try {
    const pasta = await localFileSystem.getFolder();
    if (pasta) {
      pastaSaida = pasta;
      $("pasta").textContent = "Pasta: " + pasta.nativePath;
      lembrarPasta("exportador.pasta", pasta);
    }
  } catch (e) {
    mensagem("Não foi possível escolher a pasta: " + (e && e.message ? e.message : e));
  }
});

// O saveAs do Photoshop não tem PDF para plugins: o PDF sai pelo comando Salvar como (batchPlay), em cópia,
// com o mesmo resultado de Arquivo > Salvar uma cópia > Photoshop PDF.
async function salvarPdf(doc, arquivo) {
  const token = await localFileSystem.createSessionToken(arquivo);
  await action.batchPlay([{
    _obj: "save",
    as: { _obj: "photoshopPDFFormat", pdfPreserveEditing: false, pdfEmbedThumbnails: false, pdfCompatibilityLevel: { _enum: "pdfCompatibilityLevel", _value: "PDF17" } },
    in: { _path: token, _kind: "local" },
    documentID: doc.id,
    copy: true,
    lowerCase: true,
  }], {});
}

// Exporta uma cópia do documento; o arquivo aberto não é alterado nem renomeado.
async function exportarDocumento(doc, formatos, qualidade, usados, relatorio) {
  if (!seguePadrao(doc.name)) {
    relatorio.avisos.push("\"" + doc.name + "\" não segue o padrão CLIENTE_campanha_formato_v01.");
  }
  for (const f of formatos) {
    const nome = nomeSaida(doc.name, f.ext, usados);
    try {
      const arquivo = await pastaSaida.createFile(nome, { overwrite: true });
      if (f.ext === "png") await doc.saveAs.png(arquivo, { compression: 6, interlaced: false }, true);
      else if (f.ext === "jpg") await doc.saveAs.jpg(arquivo, { quality: qualidade, embedColorProfile: true }, true);
      else if (f.ext === "pdf") await salvarPdf(doc, arquivo);
      relatorio.feitos.push(nome);
    } catch (e) {
      relatorio.erros.push(nome + ": " + (e && e.message ? e.message : e));
    }
  }
}

$("btnExportar").addEventListener("click", async () => {
  const formatos = [];
  if ($("fPng").checked) formatos.push({ ext: "png" });
  if ($("fJpg").checked) formatos.push({ ext: "jpg" });
  if ($("fPdf").checked) formatos.push({ ext: "pdf" });

  if (formatos.length === 0) { mensagem("Escolha pelo menos um formato."); return; }
  if (!pastaSaida) { mensagem("Escolha a pasta de saída primeiro."); return; }

  let docs;
  try {
    docs = $("todos").checked ? Array.from(app.documents) : (docAtivo() ? [docAtivo()] : []);
  } catch (e) {
    docs = [];
  }
  if (docs.length === 0) { mensagem("Abra um documento no Photoshop e clique de novo."); return; }

  const qualidade = limitarQualidade($("qualidade").value);
  const relatorio = { feitos: [], erros: [], avisos: [] };
  const usados = new Set();
  mensagem("Exportando...");

  try {
    await core.executeAsModal(async () => {
      for (const doc of docs) {
        await exportarDocumento(doc, formatos, qualidade, usados, relatorio);
      }
    }, { commandName: "Produceria Exportador" });
  } catch (e) {
    relatorio.erros.push("Falha geral: " + (e && e.message ? e.message : e));
  }

  $("resumo").textContent =
    relatorio.feitos.length + " arquivo(s) exportado(s), " + relatorio.erros.length + " erro(s), " + relatorio.avisos.length + " aviso(s)";
  $("resultado").innerHTML = "";
  relatorio.erros.forEach((t) => linha("[ERRO] " + t));
  relatorio.avisos.forEach((t) => linha("[AVISO] " + t));
  relatorio.feitos.forEach((t) => linha("[OK] " + t));
});

lembrarCampos("exportador.campos", ["fPng", "fJpg", "fPdf", "qualidade", "todos"]);
pastaLembrada("exportador.pasta").then((p) => { if (p) { pastaSaida = p; $("pasta").textContent = "Pasta (lembrada): " + p.nativePath; } });
