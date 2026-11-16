const { app, constants } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { lerFormatos, nomeDoc, PADRAO_FORMATOS, PACOTES } = require("./desdobra.js");
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

const A = require("./adaptacao.js");
const PS = require("./photoshop.js");
let mestres = [], controle = null, ultimoResultado = null;
const CHAVE_MAPA = "desdobra.mapas.v1";
const camposNovos = ["topoSeguro", "baseSegura", "lateralSegura", "saidaJpg", "saidaPng"];
const papeisManuais = new Map();
function mapasSalvos() { try { return JSON.parse(localStorage.getItem(CHAVE_MAPA) || "{}"); } catch (_) { return {}; } }
function salvarMapas() {
  try {
    const mapas = {};
    mestres.forEach((m) => { mapas[m.assinatura] = papeisManuais.get(m.id) || {}; });
    localStorage.setItem(CHAVE_MAPA, JSON.stringify(mapas));
  } catch (_) { $("resumo").textContent = "Mapa mantido nesta sessão; não foi possível guardar a memória local."; }
}
function adicionar(doc) {
  if (!doc) throw new Error("Abra um KV e deixe-o ativo no Photoshop.");
  const lido = PS.lerMestre(doc);
  const anterior = mestres.find((m) => m.id === doc.id);
  const manual = anterior && anterior.assinatura === lido.assinatura ? papeisManuais.get(doc.id) || {} : mapasSalvos()[lido.assinatura] || {};
  papeisManuais.set(doc.id, manual);
  const m = PS.lerMestre(doc, manual);
  mestres = mestres.filter((x) => x.id !== doc.id).concat(m);
  mostrarMapas(); salvarMapas();
}
function mostrarMapas() {
  const caixa = $("mapa"); caixa.innerHTML = "";
  for (const m of mestres) {
    const bloco = document.createElement("fieldset");
    const titulo = document.createElement("legend"); titulo.textContent = m.nome + " · " + m.largura + "×" + m.altura;
    bloco.appendChild(titulo);
    const remover = document.createElement("button"); remover.textContent = "Remover este KV da seleção";
    remover.addEventListener("click", () => { mestres = mestres.filter((x) => x.id !== m.id); mostrarMapas(); salvarMapas(); });
    bloco.appendChild(remover);
    m.camadas.forEach((c) => {
      const label = document.createElement("label"); label.textContent = c.nome + (c.visivel ? "" : " (oculta; não transforma)");
      const select = document.createElement("select"); select.setAttribute("aria-label", "Papel de " + c.nome + " em " + m.nome);
      for (const [valor, nome] of Object.entries(A.PAPEIS)) { const op = document.createElement("option"); op.value = valor; op.textContent = nome; select.appendChild(op); }
      select.selectedIndex = Object.keys(A.PAPEIS).indexOf(c.papel);
      select.addEventListener("change", () => {
        const manual = papeisManuais.get(m.id) || {}, valor = valorDe(select);
        if (valor === "desconhecido") delete manual[c.chave]; else manual[c.chave] = valor;
        papeisManuais.set(m.id, manual);
        try { adicionar(PS.documento(m.id)); } catch (e) { $("resumo").textContent = msg(e); }
      });
      label.appendChild(select); bloco.appendChild(label);
      const nota = document.createElement("div"); nota.className = "nota";
      nota.textContent = c.risco || c.motivo; bloco.appendChild(nota);
    });
    caixa.appendChild(bloco);
  }
  $("quantidadeKvs").textContent = mestres.length + " KV(s) selecionado(s). Grupos são tratados como unidades, sem desmontar máscaras.";
}
function atualizarMestres() {
  mestres = mestres.map((m) => {
    const doc = PS.documento(m.id), atual = PS.lerMestre(doc);
    // Um índice pode passar a representar outra camada após inserção, remoção ou reordenação.
    const manual = atual.assinatura === m.assinatura ? papeisManuais.get(m.id) || {} : mapasSalvos()[atual.assinatura] || {};
    papeisManuais.set(m.id, manual);
    return PS.lerMestre(doc, manual);
  });
  mostrarMapas(); salvarMapas();
}
function dadosDoPlano() {
  const doc = docAtivo();
  if (!doc && !mestres.length) throw new Error("Abra um KV no Photoshop.");
  const cliente = $("cliente").value.trim(), campanha = $("campanha").value.trim();
  if (!cliente || !campanha) throw new Error("Preencha cliente e campanha.");
  const modo = valorDe($("modo")) || "cobrir";
  const referencia = modo === "camadas" && mestres.length ? PS.documento(mestres[0].id) : doc;
  const { formatos, erros } = lerFormatos($("formatos").value, Number(referencia.resolution) || 72);
  if (erros.length) throw new Error(erros.join("\n"));
  if (!formatos.length || formatos.length > 100) throw new Error("Informe de 1 a 100 formatos por lote.");
  const margens = { topo: $("topoSeguro").value, base: $("baseSegura").value, esquerda: $("lateralSegura").value, direita: $("lateralSegura").value };
  let planos;
  if (modo === "camadas") {
    if (!mestres.length) throw new Error("Adicione um KV aberto e confirme os papéis das camadas.");
    atualizarMestres();
    planos = formatos.map((f) => {
      const m = A.escolherMestre(mestres, f), p = A.planejar(m, f, margens), cruzamento = A.compararMestres(mestres, m);
      p.avisos.push(...cruzamento);
      if (!p.bloqueios.length) p.escore = Math.max(0, p.escore - Math.min(30, cruzamento.length * 10));
      return p;
    });
  } else {
    const m = PS.lerMestre(doc);
    planos = formatos.map((f) => ({ alvo: f, mestreId: doc.id, mestreNome: doc.name, assinatura: m.assinatura, historico: m.historico,
      bloqueios: [], avisos: ["Encaixe global: revise cortes, textos, logo e margens."], escore: 0, elementos: [] }));
  }
  return { planos, cliente, campanha, versao: $("versao").value, modo,
    ancora: constants.AnchorPosition[valorDe($("ancora"))] || constants.AnchorPosition.MIDDLECENTER };
}
function diagnosticar() {
  $("resultado").innerHTML = "";
  const d = dadosDoPlano();
  for (const p of d.planos) {
    linha(p.alvo.nome + " · " + p.alvo.largura + "×" + p.alvo.altura + " ← " + p.mestreNome +
      (d.modo === "camadas" ? " · escore geométrico " + p.escore + "/100" : " · encaixe global"));
    p.bloqueios.forEach((a) => linha("[CORRIGIR] " + a));
    p.avisos.forEach((a) => linha("[REVISAR] " + a));
  }
  $("resumo").textContent = "Diagnóstico de " + d.planos.length + " formatos. Revisão visual obrigatória; escore não aprova a peça.";
  return d;
}
$("btnAdicionarKv").addEventListener("click", () => {
  try { adicionar(docAtivo()); $("resumo").textContent = "KV lido. Confira os papéis antes de diagnosticar."; }
  catch (e) { $("resumo").textContent = msg(e); }
});
$("btnDiagnosticar").addEventListener("click", () => { try { diagnosticar(); } catch (e) { $("resumo").textContent = msg(e); } });
$("btnCancelar").addEventListener("click", () => {
  if (controle) { controle.cancelado = true; $("resumo").textContent = "Cancelamento solicitado. O formato em andamento será encerrado antes do próximo."; }
});
$("btnRelatorio").addEventListener("click", async () => {
  if (!ultimoResultado) return;
  try {
    const f = await localFileSystem.getFileForSaving("relatorio-desdobra.json", { types: ["json"] });
    if (f) await f.write(JSON.stringify(ultimoResultado, null, 2));
  } catch (e) { $("resumo").textContent = "Não foi possível salvar o relatório: " + msg(e); }
});
function ocupada(sim) {
  // Desabilita edição e duplo clique durante a fila. Cancelamento fica disponível.
  for (const e of document.querySelectorAll("input,select,textarea,button")) e.disabled = sim;
  $("btnCancelar").disabled = !sim;
  if (!sim) $("btnRelatorio").disabled = !ultimoResultado;
}
async function pastaDeRodada(base) {
  const prefixo = "rodada-" + new Date().toISOString().replace(/[:.]/g, "-");
  const nomes = new Set((await base.getEntries()).map((e) => e.name));
  let nome = prefixo, n = 2;
  while (nomes.has(nome)) nome = prefixo + "-" + n++;
  return base.createFolder(nome);
}
$("btnDesdobrar").addEventListener("click", async () => {
  if (controle) return;
  let dados, destino = null, checkpoint = null;
  try {
    dados = diagnosticar();
    if (dados.planos.some((p) => p.bloqueios.length)) throw new Error("Resolva os itens [CORRIGIR] do diagnóstico antes de gerar.");
    if (!$("salvar").checked && dados.planos.length > 12) throw new Error("Sem salvar, limite de 12 documentos abertos por lote. Marque Salvar para lotes maiores.");
    const extensoes = ["psd"];
    if ($("saidaJpg").checked) extensoes.push("jpg");
    if ($("saidaPng").checked) extensoes.push("png");
    if (!$("salvar").checked && extensoes.length > 1) throw new Error("Marque Salvar para exportar JPG/PNG.");
    if ($("salvar").checked) {
      dados.planos.forEach((p) => PS.conferirWeb(PS.documento(p.mestreId), extensoes));
    }
    controle = { cancelado: false }; ocupada(true);
    if ($("salvar").checked) {
      const base = await resolverDestino(localFileSystem, { caminho: $("caminho").value, escolhida: pastaPSD,
        doc: PS.documento(dados.planos[0].mestreId), subpasta: "desdobra" });
      destino = await pastaDeRodada(base);
      checkpoint = await destino.createFile("relatorio.json", { overwrite: false });
      $("pasta").textContent = "Rodada: " + destino.nativePath;
    }
    const inicio = new Date().toISOString();
    const registrar = async (estado) => {
      ultimoResultado = { schema: 1, plugin: "produceria-desdobra", versao: "1.3.0", cliente: dados.cliente,
        campanha: dados.campanha, inicio, modo: dados.modo, revisao: "pendente", ...estado };
      if (checkpoint) await checkpoint.write(JSON.stringify(ultimoResultado, null, 2));
    };
    await registrar({ itens: [], total: dados.planos.length, cancelado: false });
    const r = await A.executarLote(dados.planos, {
      gerar: (p, ctl) => PS.gerar(p, { nome: nomeDoc(dados.cliente, dados.campanha, p.alvo.nome, dados.versao),
        modo: dados.modo, ancora: dados.ancora, pasta: destino, extensoes }, ctl),
      registrar,
      progresso: (item, n, total) => {
        $("resumo").textContent = n + "/" + total + " formatos processados.";
        linha((item.status === "falhou" ? "[FALHOU] " + item.erro + " · " : "[GERADO PARA REVISÃO] ") + item.formato.nome);
      },
    }, controle);
    await registrar(r);
    $("resumo").textContent = r.itens.filter((x) => x.status !== "falhou").length + " formato(s) gerado(s) para revisão, " +
      r.itens.filter((x) => x.status === "falhou").length + " falha(s), " + r.pendentes + " pendente(s).";
  } catch (e) { $("resumo").textContent = msg(e); }
  finally { controle = null; ocupada(false); }
});

// Memória por último: falhas de armazenamento não devem desligar os botões.
try {
  salvarCampos = lembrarCampos("desdobra.campos", ["cliente", "campanha", "versao", "modo", "ancora", "formatos", "salvar", "caminho", ...camposNovos]);
  if (!$("formatos").value.trim()) $("formatos").value = PADRAO_FORMATOS;
  $("pacote").addEventListener("change", () => {
    const p = PACOTES[valorDe($("pacote"))];
    if (p) { $("formatos").value = p.lista; salvarCampos(); $("resumo").textContent = "Pacote " + p.nome + " carregado; confirme o plano de mídia do job."; }
  });
  const salvos = mapasSalvos();
  for (const doc of Array.from(app.documents)) {
    const m = PS.lerMestre(doc);
    if (salvos[m.assinatura]) { papeisManuais.set(doc.id, salvos[m.assinatura]); mestres.push(PS.lerMestre(doc, salvos[m.assinatura])); }
  }
  mostrarMapas();
} catch (e) { $("resumo").textContent = "Painel sem memória restaurada: " + msg(e); }
pastaLembrada("desdobra.pasta").then((p) => {
  if (!p) return;
  pastaPSD = p;
  if (!$("caminho").value.trim()) $("caminho").value = p.nativePath;
  $("pasta").textContent = "Pasta (lembrada): " + p.nativePath;
});
ocupada(false);
