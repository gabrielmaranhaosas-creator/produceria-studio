const { app, core } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const P = require("./prova.js");
// Leituras seguras: algumas versões do UXP não preenchem .value de <select>, e app.activeDocument pode lançar erro sem documento aberto.
const valorDe = (el) => (el && el.value ? el.value : (el && el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex] ? el.options[el.selectedIndex].value : ""));
const docAtivo = () => { try { return app.activeDocument || null; } catch (e) { return null; } };
// Qualquer erro inesperado aparece no próprio painel, em vez de sumir.
window.addEventListener("error", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + (e.message || e); });
window.addEventListener("unhandledrejection", (e) => { const r = document.getElementById("resumo"); if (r) r.textContent = "Erro no painel: " + (e.reason && e.reason.message ? e.reason.message : String(e.reason)); });

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
let pasta = null;
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
function resumo(t) { $("resumo").textContent = t; $("resultado").innerHTML = ""; }
function linha(t) { const d = document.createElement("div"); d.className = "item"; d.textContent = t; $("resultado").appendChild(d); }

function cinza(v) { const c = new app.SolidColor(); c.rgb.red = v; c.rgb.green = v; c.rgb.blue = v; return c; }

async function centralizar(camada, w, h) {
  const b = camada.bounds;
  await camada.translate(Math.round(w / 2 - (b.left + b.right) / 2), Math.round(h / 2 - (b.top + b.bottom) / 2));
}

async function gerarProva(doc, o) {
  const nome = P.nomeProva(doc.name);
  const copia = await doc.duplicate(nome.replace(/\.jpg$/, ""));
  try {
    await copia.flatten();
    const r = P.reduzir(Math.round(copia.width), Math.round(copia.height), o.maxLado);
    if (r) await copia.resizeImage(r.largura, r.altura);
    const w = Math.round(copia.width), h = Math.round(copia.height), ppi = Number(copia.resolution) || 72;

    if (o.marca) {
      const marca = await copia.createTextLayer({ name: "Marca d'água", contents: o.marca, fontSize: P.pontos(w, h, ppi, 0.09), textColor: cinza(128), position: { x: Math.round(w * 0.1), y: Math.round(h / 2) } });
      marca.opacity = o.opacidade;
      await centralizar(marca, w, h);
      if (o.diagonal) await marca.rotate(-30);
    }
    const info = P.rodape({ cliente: o.cliente, campanha: o.campanha, versao: P.versaoDoNome(doc.name), data: P.dataBr(new Date()) });
    const tam = P.pontos(w, h, ppi, 0.025);
    const rod = await copia.createTextLayer({ name: "Identificação", contents: info, fontSize: tam, textColor: cinza(40), position: { x: Math.round(w * 0.02), y: Math.round(h - w * 0.02) } });
    rod.opacity = 90;

    await copia.flatten();
    const arq = await pasta.createFile(nome, { overwrite: true });
    await copia.saveAs.jpg(arq, { quality: o.qualidade, embedColorProfile: true }, true);
    return nome + " (" + w + " x " + h + " px)";
  } finally {
    await copia.closeWithoutSaving();
  }
}

$("btnPasta").addEventListener("click", async () => {
  try { const p = await localFileSystem.getFolder(); if (p) { pasta = p; $("pasta").textContent = "Pasta: " + p.nativePath; lembrarPasta("prova.pasta", p); } }
  catch (e) { $("pasta").textContent = "Não foi possível escolher a pasta: " + msg(e); }
});

$("btnProva").addEventListener("click", async () => {
  if (!pasta) { resumo("Escolha a pasta das provas primeiro."); return; }
  const docs = $("todos").checked ? Array.from(app.documents) : (docAtivo() ? [docAtivo()] : []);
  if (!docs.length) { resumo("Abra um documento no Photoshop e clique de novo."); return; }
  const o = {
    cliente: $("cliente").value.trim(), campanha: $("campanha").value.trim(), marca: $("marca").value.trim(),
    opacidade: Math.max(5, Math.min(100, Number($("opacidade").value) || 25)), diagonal: $("diagonal").checked,
    maxLado: Number($("maxLado").value) || 0, qualidade: Math.max(1, Math.min(12, Number($("qualidade").value) || 10)),
  };
  const feitos = [], erros = [];
  resumo("Gerando prova(s)...");
  try {
    await core.executeAsModal(async () => {
      for (const d of docs) {
        try { feitos.push(await gerarProva(d, o)); } catch (e) { erros.push(d.name + ": " + msg(e)); }
      }
    }, { commandName: "Produceria: prova" });
  } catch (e) { erros.push("Falha geral: " + msg(e)); }
  resumo(feitos.length + " prova(s) gerada(s), " + erros.length + " erro(s). Os arquivos abertos não mudaram.");
  erros.forEach((t) => linha("[ERRO] " + t));
  feitos.forEach((t) => linha("[OK] " + t));
});

lembrarCampos("prova.campos", ["cliente", "campanha", "marca", "opacidade", "diagonal", "maxLado", "qualidade", "todos"]);
pastaLembrada("prova.pasta").then((p) => { if (p) { pasta = p; $("pasta").textContent = "Pasta (lembrada): " + p.nativePath; } });
