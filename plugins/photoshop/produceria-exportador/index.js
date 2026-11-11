const { app, core } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { nomeSaida, seguePadrao, limitarQualidade } = require("./nomes.js");

let pastaSaida = null;

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
    }
  } catch (e) {
    mensagem("Não foi possível escolher a pasta: " + (e && e.message ? e.message : e));
  }
});

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
      else if (f.ext === "pdf") await doc.saveAs.pdf(arquivo, {}, true);
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
    docs = $("todos").checked ? Array.from(app.documents) : (app.activeDocument ? [app.activeDocument] : []);
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
