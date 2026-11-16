// Primeira coisa do painel: mostrar que o código rodou e expor qualquer erro, inclusive de carregamento.
const VERSAO = "1.4.2";
const estado = (t) => { const e = document.getElementById("estadoPainel"); if (e) e.textContent = t; };
window.addEventListener("error", (e) => estado("Erro no painel: " + (e && e.message ? e.message : e)));
window.addEventListener("unhandledrejection", (e) => estado("Erro no painel: " + (e && e.reason && e.reason.message ? e.reason.message : String(e && e.reason))));
function carregar(nome) {
  try { return require(nome); }
  catch (e) { estado("O painel não carregou " + nome + ": " + (e && e.message ? e.message : e) + ". Copie esta frase no relatório."); throw e; }
}
estado("Carregando o código do painel...");
const { app, constants } = carregar("photoshop");
const { localFileSystem } = carregar("uxp").storage;
const { lerFormatos, nomeDoc, PADRAO_FORMATOS, PACOTES } = carregar("./desdobra.js");
const { resolverDestino, escolherPasta, pastaDoArquivo, pastaDoCaminho } = carregar("./destino.js");
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
const AVISO_JANELA = "A janela de pastas não apareceu em 4 segundos. Procure atrás da janela do Photoshop (Cmd + Tab). Se não estiver lá, use \"Escolher pela janela Salvar\", \"Usar a pasta do KV aberto\" ou cole o caminho da pasta (Mac: botão direito na pasta, segure Option, \"Copiar como nome de caminho\").";

function linha(texto) {
  const d = document.createElement("div");
  d.className = "item";
  d.textContent = texto;
  $("resultado").appendChild(d);
}

// Cada clique é registrado no painel: se a frase "Clique recebido" não aparece, o botão não recebeu o clique.
let cliques = 0;
function usarPasta(p, origem) {
  pastaPSD = p; $("caminho").value = p.nativePath; $("salvar").checked = true; salvarCampos();
  $("pasta").textContent = "Pasta (" + origem + "): " + p.nativePath; lembrarPasta("desdobra.pasta", p);
}
$("btnPasta").addEventListener("click", async () => {
  cliques++;
  $("pasta").textContent = "Clique recebido (" + cliques + "). Pedindo ao Photoshop a janela de pastas...";
  try {
    if (!localFileSystem || typeof localFileSystem.getFolder !== "function") throw new Error("este Photoshop não oferece a janela de pastas aos plugins");
    const p = await escolherPasta(localFileSystem, () => { $("pasta").textContent = AVISO_JANELA; });
    if (p) usarPasta(p, "janela de pastas");
    else $("pasta").textContent = "A janela fechou sem pasta escolhida. Se ela nem apareceu, use os botões abaixo.";
  } catch (e) { $("pasta").textContent = "Não foi possível abrir a janela de pastas: " + msg(e) + ". Cole o caminho no campo abaixo ou deixe vazio para salvar ao lado do KV."; }
});
// Plano B 1: a janela Salvar do sistema (outra janela, que costuma abrir quando a de pastas falha).
$("btnPastaSalvar").addEventListener("click", async () => {
  $("pasta").textContent = "Abrindo a janela Salvar... Navegue até a pasta desejada e clique em Salvar (o arquivo não é criado).";
  try {
    const f = await localFileSystem.getFileForSaving("escolher-esta-pasta.txt");
    if (!f) { $("pasta").textContent = "Nenhuma pasta escolhida."; return; }
    const dir = pastaDoArquivo(f.nativePath);
    usarPasta(await pastaDoCaminho(localFileSystem, dir), "janela Salvar");
  } catch (e) { $("pasta").textContent = "A janela Salvar também falhou: " + msg(e) + ". Use \"Usar a pasta do KV aberto\" ou cole o caminho."; }
});
// Plano B 2: sem janela nenhuma, a pasta "desdobra" ao lado do KV.
$("btnPastaKv").addEventListener("click", () => {
  const d = fonteAtiva();
  let caminho = ""; try { caminho = String((d && d.path) || ""); } catch (_) { caminho = ""; }
  const dir = pastaDoArquivo(caminho);
  if (!d) { $("pasta").textContent = "Abra o KV no Photoshop e clique de novo."; return; }
  if (!dir) { $("pasta").textContent = "O KV ainda não foi salvo em disco. Salve uma vez (Cmd ou Ctrl + S) e clique de novo."; return; }
  pastaPSD = null; $("caminho").value = ""; $("salvar").checked = true; salvarCampos();
  $("pasta").textContent = "Pasta: " + dir + "/desdobra (criada ao gerar, ao lado do KV).";
});
$("caminho").addEventListener("change", () => { const c = $("caminho").value.trim(); if (pastaPSD && pastaPSD.nativePath !== c) pastaPSD = null; if (c) { $("salvar").checked = true; $("pasta").textContent = "Pasta: " + c; } else $("pasta").textContent = "Sem pasta: os PSD vão para a pasta \"desdobra\" ao lado do KV."; });

const A = require("./adaptacao.js");
const PS = require("./photoshop.js");
const G = require("./galeria.js");
const galeriaCss = require("./galeria-estilo.js");
const estiloGaleria = document.createElement("style"); estiloGaleria.textContent = galeriaCss; document.head.appendChild(estiloGaleria);
let mestres = [], controle = null, ultimoResultado = null;
let galeria = [], detalhe = -1;
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
  invalidarGaleria();
  mostrarMapas(); salvarMapas();
}
function mostrarMapas() {
  const caixa = $("mapa"); caixa.innerHTML = "";
  for (const m of mestres) {
    const bloco = document.createElement("div"); bloco.className = "caixa";
    const titulo = document.createElement("div"); titulo.className = "caixa-titulo"; titulo.textContent = m.nome + " · " + m.largura + "×" + m.altura;
    bloco.appendChild(titulo);
    const remover = document.createElement("button"); remover.textContent = "Remover este KV da seleção";
    remover.addEventListener("click", () => { mestres = mestres.filter((x) => x.id !== m.id); invalidarGaleria(); mostrarMapas(); salvarMapas(); });
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
// Cópias que este painel deixou abertas: se uma delas estiver ativa, a fonte continua sendo o KV original.
const copiasGeradas = new Set();
let ultimaFonteId = null;
function fonteAtiva() {
  const d = docAtivo();
  if (d && copiasGeradas.has(d.id) && ultimaFonteId != null) { try { return PS.documento(ultimaFonteId); } catch (_) { return d; } }
  return d;
}
function dadosDoPlano() {
  const doc = fonteAtiva();
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
    if (!mestres.length && doc) adicionar(doc);
    if (!mestres.length) throw new Error("Abra o KV e clique em Adicionar ou atualizar KV aberto.");
    atualizarMestres();
    planos = formatos.map((f) => {
      const m = A.escolherMestre(mestres, f), p = A.planejar(m, f, margens), cruzamento = A.compararMestres(mestres, m);
      p.avisos.push(...cruzamento);
      if (!p.bloqueios.length) p.escore = Math.max(0, p.escore - Math.min(30, cruzamento.length * 10));
      return p;
    });
  } else {
    ultimaFonteId = doc.id;
    const m = PS.lerMestre(doc);
    planos = formatos.map((f) => ({ alvo: f, mestreId: doc.id, mestreNome: doc.name, assinatura: m.assinatura, historico: m.historico,
      bloqueios: [], avisos: ["Encaixe global: revise cortes, textos, logo e margens."], escore: 0,
      area: A.areaSegura(f.largura, f.altura, margens), elementos: G.elementosGlobais(m, f, modo, valorDe($("ancora"))) }));
  }
  return { planos, cliente, campanha, versao: $("versao").value, modo,
    ancora: constants.AnchorPosition[valorDe($("ancora"))] || constants.AnchorPosition.MIDDLECENTER };
}
function diagnosticar() {
  invalidarGaleria();
  $("resultado").innerHTML = "";
  const d = dadosDoPlano();
  for (const p of d.planos) {
    linha(p.alvo.nome + " · " + p.alvo.largura + "×" + p.alvo.altura + " ← " + p.mestreNome +
      (d.modo === "camadas" ? " · escore geométrico " + p.escore + "/100" : " · encaixe global"));
    p.bloqueios.forEach((a) => linha("[CORRIGIR] " + a));
    p.avisos.forEach((a) => linha("[REVISAR] " + a));
  }
  galeria = d.planos.map(G.novoItem); mostrarGaleria();
  $("resumo").textContent = "Diagnóstico de " + d.planos.length + " formatos. Revisão visual obrigatória; escore não aprova a peça.";
  return d;
}

function opcoesGaleria() {
  const moldura = valorDe($("moldura"));
  return { contexto: valorDe($("visualizacao")) !== "peca", guias: $("mostrarGuias").checked, maxW: (document.body.clientWidth || 360) - 64,
    forcarContexto: moldura === "auto" ? null : moldura };
}
function invalidarGaleria() {
  galeria = []; detalhe = -1; atualizarProgresso(0, 0); mostrarGaleria();
}
function atualizarProgresso(n, total) {
  const pct = total ? Math.round(n / total * 100) : 0;
  $("progresso").setAttribute("aria-valuenow", String(pct)); $("progressoBarra").style.width = pct + "%";
  $("progressoTexto").textContent = total ? n + "/" + total + " formatos processados · " + pct + "%" : "";
}
function mostrarGaleria() {
  const filtro = valorDe($("filtroContexto")), opts = opcoesGaleria();
  const visiveis = galeria.map((item, i) => ({ item, i })).filter(({ item }) => filtro === "todos" || item.contexto === filtro);
  $("galeria").innerHTML = visiveis.map(({ item, i }) => G.cartao(item, i, opts)).join("");
  $("contagemGaleria").textContent = galeria.length ? visiveis.length + "/" + galeria.length + " formatos exibidos · " + galeria.filter((x) => x.previa).length + " com pixels reais. Capturas da última execução; alterações no Photoshop pedem novas prévias." : "Diagnostique os formatos para montar a galeria.";
  $("btnFolha").disabled = !!controle || !galeria.length;
  for (const b of $("galeria").querySelectorAll("button[data-detalhe]")) b.addEventListener("click", () => { detalhe = Number(b.getAttribute("data-detalhe")); mostrarDetalhe(); });
  if (!visiveis.some(({ i }) => i === detalhe)) detalhe = -1;
  mostrarDetalhe();
}
function mostrarDetalhe() {
  const item = galeria[detalhe];
  $("detalheGaleria").innerHTML = item ? '<h3>Detalhe: ' + G.esc(item.plano.alvo.nome) + '</h3>' + G.palco(item, { ...opcoesGaleria(), grande: true }) + '<div class="nota">' + (item.previa ? 'Prévia real reduzida; confira nitidez e texto no PSD em 100%.' : 'Esquema geométrico: gere prévias reais para conferir a arte.') + '</div><button id="fecharDetalhe">Fechar detalhe</button>' : "";
  const fechar = document.getElementById("fecharDetalhe");
  if (fechar) fechar.addEventListener("click", () => { detalhe = -1; mostrarDetalhe(); });
}
for (const id of ["filtroContexto", "visualizacao", "moldura", "mostrarGuias"]) $(id).addEventListener("change", mostrarGaleria);
for (const id of ["cliente", "campanha", "versao", "modo", "ancora", "formatos", "topoSeguro", "baseSegura", "lateralSegura"]) {
  $(id).addEventListener("input", invalidarGaleria); $(id).addEventListener("change", invalidarGaleria);
}
$("btnFolha").addEventListener("click", async () => {
  if (!galeria.length || controle) return;
  try {
    const html = G.folhaHtml(galeria, $("cliente").value + " · " + $("campanha").value, galeriaCss, opcoesGaleria());
    const f = await localFileSystem.getFileForSaving("PRODUCERIA_folha_de_revisao.html", { types: ["html"] });
    if (f) { await f.write(html); $("resumo").textContent = "Folha salva com todos os formatos (inclusive os ocultos pelo filtro). Abra no navegador para revisar ou imprimir em PDF."; }
  } catch (e) { $("resumo").textContent = "Falha ao salvar folha: " + msg(e); }
});
$("btnPrevias").addEventListener("click", async () => {
  if (controle) return;
  try {
    if (!PS.previaDisponivel()) throw new Error("Prévia real indisponível: esta instalação não expõe a Imaging API. O diagnóstico continua disponível como esquema. Atualize o Photoshop e valide o painel.");
    const d = diagnosticar();
    if (d.planos.some((p) => p.bloqueios.length)) throw new Error("Resolva os itens [CORRIGIR] antes de gerar prévias reais.");
    controle = { cancelado: false }; ocupada(true);
    for (let i = 0; i < d.planos.length && !controle.cancelado; i++) {
      const p = d.planos[i], item = galeria[i];
      item.status = "processando"; mostrarGaleria(); atualizarProgresso(i, d.planos.length);
      $("resumo").textContent = "Renderizando prévia " + (i + 1) + "/" + d.planos.length + ": " + p.alvo.nome;
      try {
        const r = await PS.gerar(p, { nome: "PREVIA_" + p.alvo.nome, modo: d.modo, ancora: d.ancora, somentePrevia: true }, controle);
        item.previa = r.previa; item.status = "previa";
      } catch (e) { item.status = "falhou"; item.erro = msg(e); }
      mostrarGaleria(); atualizarProgresso(i + 1, d.planos.length);
    }
    if (controle.cancelado) galeria.filter((x) => x.status === "planejado").forEach((x) => { x.status = "cancelado"; });
    $("resumo").textContent = galeria.filter((x) => x.previa).length + " prévia(s) real(is), " + galeria.filter((x) => x.status === "falhou").length + " falha(s). Nenhuma arte foi gravada; as cópias temporárias foram fechadas quando possível. Revisão pendente.";
  } catch (e) { $("resumo").textContent = msg(e); }
  finally { controle = null; ocupada(false); mostrarGaleria(); }
});
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
  $("btnFolha").disabled = sim || !galeria.length;
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
      ultimoResultado = { schema: 1, plugin: "produceria-desdobra", versao: VERSAO, cliente: dados.cliente,
        campanha: dados.campanha, inicio, modo: dados.modo, revisao: "pendente", ...estado };
      if (checkpoint) await checkpoint.write(JSON.stringify(ultimoResultado, null, 2));
    };
    await registrar({ itens: [], total: dados.planos.length, cancelado: false });
    const r = await A.executarLote(dados.planos, {
      gerar: async (p, ctl) => {
        galeria[dados.planos.indexOf(p)].status = "processando"; mostrarGaleria();
        const r = await PS.gerar(p, { nome: nomeDoc(dados.cliente, dados.campanha, p.alvo.nome, dados.versao),
          modo: dados.modo, ancora: dados.ancora, pasta: destino, extensoes, capturarPrevia: PS.previaDisponivel() }, ctl);
        const item = galeria[dados.planos.indexOf(p)]; item.previa = r.previa; item.erro = r.avisoPrevia || "";
        if (r.documento != null && !destino) copiasGeradas.add(r.documento);
        return r;
      },
      registrar,
      progresso: (item, n, total) => {
        $("resumo").textContent = n + "/" + total + " formatos processados.";
        atualizarProgresso(n, total);
        linha((item.status === "falhou" ? "[FALHOU] " + item.erro + " · " : "[GERADO PARA REVISÃO] ") + item.formato.nome);
        galeria[item.indice].status = item.status === "falhou" ? "falhou" : "gerado";
        if (item.erro) galeria[item.indice].erro = item.erro;
        mostrarGaleria();
      },
    }, controle);
    await registrar(r);
    if (r.cancelado) galeria.filter((x) => x.status === "planejado").forEach((x) => { x.status = "cancelado"; });
    mostrarGaleria();
    $("resumo").textContent = r.itens.filter((x) => x.status !== "falhou").length + " formato(s) gerado(s) para revisão, " +
      r.itens.filter((x) => x.status === "falhou").length + " falha(s), " + r.pendentes + " pendente(s).";
  } catch (e) { $("resumo").textContent = msg(e); }
  finally { controle = null; ocupada(false); mostrarGaleria(); }
});

// Memória por último: falhas de armazenamento não devem desligar os botões.
try {
  salvarCampos = lembrarCampos("desdobra.campos", ["cliente", "campanha", "versao", "modo", "ancora", "formatos", "salvar", "caminho", ...camposNovos]);
  if (!$("formatos").value.trim()) $("formatos").value = PADRAO_FORMATOS;
  $("pacote").addEventListener("change", () => {
    const p = PACOTES[valorDe($("pacote"))];
    if (p) { $("formatos").value = p.lista; invalidarGaleria(); salvarCampos(); $("resumo").textContent = "Pacote " + p.nome + " carregado; confirme o plano de mídia do job."; }
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
mostrarGaleria();
estado("Painel pronto · Desdobra KV " + VERSAO + " · botões ligados.");
