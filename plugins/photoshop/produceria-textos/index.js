const { app, core } = require("photoshop");
const { localFileSystem, formats } = require("uxp").storage;
const { serializar, interpretar, precisaAplicar } = require("./csv.js");

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
const seguro = (fn, padrao) => { try { const v = fn(); return v === undefined ? padrao : v; } catch (e) { return padrao; } };

function mensagem(texto) { $("resumo").textContent = texto; $("resultado").innerHTML = ""; }
function linha(texto) {
  const d = document.createElement("div");
  d.className = "item";
  d.textContent = texto;
  $("resultado").appendChild(d);
}

// Percorre camadas (inclusive grupos) e devolve só as de texto: {camada, id, nome, texto}
function camadasDeTexto(lista, saida) {
  for (const c of lista) {
    const tipo = String(seguro(() => c.kind, "")).toLowerCase();
    if (tipo.includes("text")) {
      const texto = seguro(() => c.textItem.contents, null);
      if (texto !== null) saida.push({ camada: c, id: seguro(() => c.id, ""), nome: seguro(() => c.name, ""), texto });
    }
    const filhas = seguro(() => c.layers, null);
    if (filhas && filhas.length) camadasDeTexto(filhas, saida);
  }
  return saida;
}

$("btnExportar").addEventListener("click", async () => {
  try {
    const docs = $("todos").checked ? Array.from(app.documents) : (app.activeDocument ? [app.activeDocument] : []);
    if (docs.length === 0) { mensagem("Abra um documento no Photoshop e clique de novo."); return; }
    const linhas = [];
    for (const doc of docs) {
      for (const t of camadasDeTexto(doc.layers, [])) {
        linhas.push({ arquivo: doc.name, id: t.id, camada: t.nome, texto: t.texto });
      }
    }
    if (linhas.length === 0) { mensagem("Nenhuma camada de texto encontrada."); return; }
    const arquivo = await localFileSystem.getFileForSaving("textos_para_revisao.csv", { types: ["csv"] });
    if (!arquivo) { mensagem("Exportação cancelada."); return; }
    await arquivo.write(serializar(linhas), { format: formats.utf8 });
    mensagem(linhas.length + " texto(s) exportado(s) de " + docs.length + " documento(s).");
    linha("Entregue o CSV para a revisão. Peça para editar só a coluna texto_revisado e manter \\n onde houver quebra de linha.");
  } catch (e) {
    mensagem("Erro ao exportar: " + msg(e));
  }
});

$("btnImportar").addEventListener("click", async () => {
  try {
    const arquivo = await localFileSystem.getFileForOpening({ types: ["csv"] });
    if (!arquivo) { mensagem("Aplicação cancelada."); return; }
    const conteudo = await arquivo.read({ format: formats.utf8 });
    const lido = interpretar(conteudo);
    if (lido.erro) { mensagem(lido.erro); return; }

    const pendentes = lido.linhas.filter(precisaAplicar);
    if (pendentes.length === 0) { mensagem("Nenhum texto revisado para aplicar."); return; }

    const abertos = Array.from(app.documents);
    const relatorio = { aplicados: [], pulados: [] };

    await core.executeAsModal(async () => {
      for (const l of pendentes) {
        const doc = abertos.find((d) => d.name === l.arquivo);
        if (!doc) { relatorio.pulados.push(l.arquivo + " / " + l.camada + ": documento não está aberto."); continue; }
        const alvo = camadasDeTexto(doc.layers, []).find((t) => String(t.id) === String(l.id));
        if (!alvo) { relatorio.pulados.push(l.arquivo + " / " + l.camada + ": camada não encontrada."); continue; }
        // Segurança: só altera se o texto atual ainda é o texto original exportado.
        if (alvo.texto !== l.original) { relatorio.pulados.push(l.arquivo + " / " + l.camada + ": o texto da camada mudou desde a exportação."); continue; }
        try {
          alvo.camada.textItem.contents = l.revisado;
          relatorio.aplicados.push(l.arquivo + " / " + l.camada);
        } catch (e) {
          relatorio.pulados.push(l.arquivo + " / " + l.camada + ": " + msg(e));
        }
      }
    }, { commandName: "Produceria Textos: aplicar revisão" });

    $("resumo").textContent = relatorio.aplicados.length + " texto(s) aplicado(s), " + relatorio.pulados.length + " pulado(s)";
    $("resultado").innerHTML = "";
    relatorio.pulados.forEach((t) => linha("[PULADO] " + t));
    relatorio.aplicados.forEach((t) => linha("[OK] " + t));
    if (relatorio.aplicados.length) linha("Confira visualmente cada texto alterado: formatação misturada dentro de uma mesma camada pode se perder.");
  } catch (e) {
    mensagem("Erro ao aplicar: " + msg(e));
  }
});
