const { app, core, action } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { nomeSaida, seguePadrao, limitarQualidade } = require("./nomes.js");
const { resolverDestino, escolherPasta } = require("./destino.js");
// Leituras seguras: algumas versões do UXP não preenchem .value de <select>, e app.activeDocument pode lançar erro sem documento aberto.
const valorDe = (el) => (el && el.value ? el.value : (el && el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex] ? el.options[el.selectedIndex].value : ""));
const docAtivo = () => { try { return app.activeDocument || null; } catch (e) { return null; } };
// Qualquer erro inesperado aparece no próprio painel, em vez de sumir.
window.addEventListener("error", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + (e.message || e); });
window.addEventListener("unhandledrejection", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + (e.reason && e.reason.message ? e.reason.message : String(e.reason)); });

let pastaSaida = null;
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

let salvarCampos = () => {};
const AVISO_JANELA = "A janela de pastas não apareceu? Procure atrás da janela do Photoshop, ou cole o caminho da pasta no campo abaixo (no Mac: botão direito na pasta, segure Option, \"Copiar como nome de caminho\"). Vazio = pasta \"exportados\" ao lado de cada arquivo.";
$("btnPasta").addEventListener("click", async () => {
  $("pasta").textContent = "Abrindo a janela de escolher pasta...";
  try {
    const pasta = await escolherPasta(localFileSystem, () => { $("pasta").textContent = AVISO_JANELA; });
    if (pasta) {
      pastaSaida = pasta;
      $("caminho").value = pasta.nativePath; salvarCampos();
      $("pasta").textContent = "Pasta: " + pasta.nativePath;
      lembrarPasta("exportador.pasta", pasta);
    } else $("pasta").textContent = "Nenhuma pasta escolhida.";
  } catch (e) {
    $("pasta").textContent = "Não foi possível abrir a janela de pastas: " + (e && e.message ? e.message : e) + ". Cole o caminho no campo abaixo ou deixe vazio para salvar ao lado do arquivo.";
  }
});
$("caminho").addEventListener("change", () => {
  const c = $("caminho").value.trim();
  if (pastaSaida && pastaSaida.nativePath !== c) pastaSaida = null;
  $("pasta").textContent = c ? "Pasta: " + c : "Sem pasta: os arquivos vão para \"exportados\", ao lado de cada documento.";
});

// O saveAs do Photoshop não tem PDF para plugins: o PDF sai pelo comando Salvar como (batchPlay), em cópia,
// com o mesmo resultado de Arquivo > Salvar uma cópia > Photoshop PDF.
async function salvarPdf(doc, arquivo) {
  const token = await localFileSystem.createSessionToken(arquivo);
  await action.batchPlay([{
    _obj: "save",
    as: { _obj: "photoshopPDFFormat", pdfPreserveEditing: false, pdfEmbedThumbnails: false },
    in: { _path: token, _kind: "local" },
    documentID: doc.id,
    copy: true,
    lowerCase: true,
    _options: { dialogOptions: "dontDisplay" },
  }], {});
}

// Exporta uma cópia do documento; o arquivo aberto não é alterado nem renomeado.
async function exportarDocumento(doc, formatos, qualidade, usados, relatorio) {
  let pasta;
  try { pasta = await resolverDestino(localFileSystem, { caminho: $("caminho").value, escolhida: pastaSaida, doc, subpasta: "exportados" }); }
  catch (e) { relatorio.erros.push(doc.name + ": não deu para usar a pasta: " + (e && e.message ? e.message : e)); return; }
  relatorio.pastas.add(pasta.nativePath);
  if (!seguePadrao(doc.name)) {
    relatorio.avisos.push("\"" + doc.name + "\" não segue o padrão CLIENTE_campanha_formato_v01.");
  }
  for (const f of formatos) {
    const nome = nomeSaida(doc.name, f.ext, usados);
    try {
      const arquivo = await pasta.createFile(nome, { overwrite: true });
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

  let docs;
  try {
    docs = $("todos").checked ? Array.from(app.documents) : (docAtivo() ? [docAtivo()] : []);
  } catch (e) {
    docs = [];
  }
  if (docs.length === 0) { mensagem("Abra um documento no Photoshop e clique de novo."); return; }

  const qualidade = limitarQualidade($("qualidade").value);
  const relatorio = { feitos: [], erros: [], avisos: [], pastas: new Set() };
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
  relatorio.pastas.forEach((t) => linha("Pasta: " + t));
});

// Memória por último e protegida: um erro aqui não desliga os botões.
try { salvarCampos = lembrarCampos("exportador.campos", ["fPng", "fJpg", "fPdf", "qualidade", "todos", "caminho"]); }
catch (e) { $("resumo").textContent = "O painel abriu sem a memória dos campos: " + (e && e.message ? e.message : e); }
pastaLembrada("exportador.pasta").then((p) => {
  if (!p) return;
  pastaSaida = p;
  if (!$("caminho").value.trim()) $("caminho").value = p.nativePath;
  $("pasta").textContent = "Pasta (lembrada): " + p.nativePath;
});
