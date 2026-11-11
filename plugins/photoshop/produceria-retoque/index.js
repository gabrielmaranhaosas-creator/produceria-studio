const { app, core, constants, action } = require("photoshop");
const { localFileSystem } = require("uxp").storage;
const { proximaVersao, CAMADAS_RETOQUE, NOME_GRUPO } = require("./versao.js");

const $ = (id) => document.getElementById(id);
const msg = (e) => (e && e.message ? e.message : String(e));
function resumo(t) { $("resumo").textContent = t; $("resultado").innerHTML = ""; }
function linha(t) { const d = document.createElement("div"); d.className = "item"; d.textContent = t; $("resultado").appendChild(d); }

function docAberto() {
  const d = app.activeDocument;
  if (!d) resumo("Abra um documento no Photoshop e clique de novo.");
  return d;
}

function acharGrupo(doc) {
  return Array.from(doc.layers).find((l) => l.name === NOME_GRUPO) || null;
}

$("btnEstrutura").addEventListener("click", async () => {
  const doc = docAberto(); if (!doc) return;
  if (acharGrupo(doc)) { resumo("O documento já tem um grupo " + NOME_GRUPO + ". Nada foi criado."); return; }
  try {
    await core.executeAsModal(async () => {
      const criadas = [];
      for (const c of CAMADAS_RETOQUE) {
        const camada = await doc.createLayer({
          name: c.nome,
          blendMode: constants.BlendMode[c.modo],
          fillNeutral: c.neutra,
        });
        criadas.push(camada);
      }
      await doc.createLayerGroup({ name: NOME_GRUPO, fromLayers: criadas });
    }, { commandName: "Produceria: montar estrutura de retoque" });
    resumo("Estrutura criada: grupo " + NOME_GRUPO + " com " + CAMADAS_RETOQUE.length + " camadas.");
    CAMADAS_RETOQUE.forEach((c) => linha("[OK] " + c.nome));
  } catch (e) {
    resumo("Erro ao montar a estrutura: " + msg(e));
  }
});

$("btnAntesDepois").addEventListener("click", async () => {
  const doc = docAberto(); if (!doc) return;
  const grupo = acharGrupo(doc);
  if (!grupo) { resumo("Não há grupo " + NOME_GRUPO + ". Use o botão 1 primeiro."); return; }
  try {
    await core.executeAsModal(async () => { grupo.visible = !grupo.visible; }, { commandName: "Produceria: antes/depois" });
    resumo(grupo.visible ? "Mostrando o DEPOIS (retoque ligado)." : "Mostrando o ANTES (retoque desligado).");
  } catch (e) {
    resumo("Erro: " + msg(e));
  }
});

$("btnVersao").addEventListener("click", async () => {
  const doc = docAberto(); if (!doc) return;
  try {
    const novoNome = proximaVersao(doc.name.replace(/\.[^.]*$/, "") + ".psd");
    const arq = await localFileSystem.getFileForSaving(novoNome, { types: ["psd"] });
    if (!arq) { resumo("Cancelado."); return; }
    await core.executeAsModal(async () => { await doc.saveAs.psd(arq, {}, true); }, { commandName: "Produceria: salvar nova versão" });
    resumo("Versão salva: " + arq.name);
  } catch (e) {
    resumo("Erro ao salvar: " + msg(e));
  }
});

// Separação de frequência: Baixa = cópia desfocada (cor e tom); Alta = cópia menos a Baixa (textura), em Luz Linear.
// 8 bits: Aplicar Imagem com Subtrair, escala 2, deslocamento 128. 16 bits: Adicionar invertido, escala 2, deslocamento 0.
const GRUPO_FS = "SEPARAÇÃO DE FREQUÊNCIA";
$("btnFrequencia").addEventListener("click", async () => {
  const doc = docAberto(); if (!doc) return;
  const modo = String(doc.mode || "");
  if (!/rgb/i.test(modo)) { resumo("A separação de frequência deste painel funciona em documentos RGB. Este está em " + modo + "."); return; }
  const base = doc.activeLayers && doc.activeLayers[0];
  if (!base) { resumo("Selecione a camada da foto e clique de novo."); return; }
  if (base.kind && String(base.kind) !== "pixel") { resumo("Selecione uma camada de pixels (a foto). Camada ativa: " + base.name + "."); return; }
  const raio = Math.max(1, Math.min(60, Number($("raio").value) || 6));
  const bits16 = /16/.test(String(doc.bitsPerChannel || ""));
  try {
    await core.executeAsModal(async () => {
      const alta = await base.duplicate();
      alta.name = "Alta (textura)";
      const baixa = await base.duplicate();
      baixa.name = "Baixa (cor e tom)";
      await action.batchPlay([
        { _obj: "select", _target: [{ _ref: "layer", _id: baixa.id }], makeVisible: false },
        { _obj: "gaussianBlur", radius: { _unit: "pixelsUnit", _value: raio } },
        { _obj: "select", _target: [{ _ref: "layer", _id: alta.id }], makeVisible: false },
        { _obj: "applyImageEvent", with: { _obj: "calculation",
          to: { _ref: [{ _ref: "channel", _enum: "channel", _value: "RGB" }, { _ref: "layer", _name: baixa.name }] },
          invert: bits16,
          calculation: { _enum: "calculationType", _value: bits16 ? "add" : "subtract" },
          scale: 2, offset: bits16 ? 0 : 128 } },
      ], {});
      alta.blendMode = constants.BlendMode.LINEARLIGHT;
      await doc.createLayerGroup({ name: GRUPO_FS, fromLayers: [alta, baixa] });
    }, { commandName: "Produceria: separação de frequência" });
    resumo("Separação de frequência criada (raio " + raio + " px).");
    linha("[OK] Alta (textura): pinte com Carimbo ou Pincel de Recuperação em Amostra: camada atual.");
    linha("[OK] Baixa (cor e tom): suavize manchas com Pincel Misturador ou seleção + Desfoque Gaussiano.");
    linha("Conferência: com as duas camadas ligadas, a imagem deve ficar idêntica à original.");
  } catch (e) {
    resumo("Erro na separação de frequência: " + msg(e) + ". Anote a versão do Photoshop e mande no relatório de teste.");
  }
});
