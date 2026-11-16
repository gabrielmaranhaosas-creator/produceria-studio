const { app, core, constants, action } = require("photoshop");
const A = require("./adaptacao.js");
const { calcularEscala } = require("./desdobra.js");
const { capturar } = require("./previa.js");
const imaging = require("photoshop").imaging;
const seguro = (fn, padrao) => { try { const v = fn(); return v === undefined ? padrao : v; } catch (_) { return padrao; } };
const numero = (v) => Number(v && v._value !== undefined ? v._value : v);

function medir(camada) {
  const b = camada.boundsNoEffects || camada.bounds;
  return { left: numero(b.left), top: numero(b.top), right: numero(b.right), bottom: numero(b.bottom) };
}

function estrutura(camada) {
  return [camada.name, String(camada.kind), seguro(() => camada.visible, true),
    seguro(() => camada.textItem.contents, ""), seguro(() => medir(camada), null),
    Array.from(seguro(() => camada.layers, []) || []).map(estrutura)];
}

// O Plano de fundo (Background) é tratado na cópia: vira camada comum antes de qualquer transformação.
// Máscaras de recorte acompanham a camada base. Só travas de mover/pixels e vínculos bloqueiam.
function riscos(camada) {
  const fundoEspecial = seguro(() => camada.isBackgroundLayer, false);
  if (!fundoEspecial && (seguro(() => camada.allLocked, false) || seguro(() => camada.positionLocked, false) || seguro(() => camada.pixelsLocked, false))) {
    return "camada com cadeado (mover ou pixels); destrave no painel Camadas e leia o KV de novo";
  }
  if (Array.from(seguro(() => camada.linkedLayers, []) || []).some((l) => l.id !== camada.id)) return "camadas vinculadas; remova vínculos ou agrupe antes de adaptar";
  for (const filha of Array.from(seguro(() => camada.layers, []) || [])) {
    if (Array.from(seguro(() => filha.linkedLayers, []) || []).some((l) => l.id !== filha.id)) return "grupo contém camadas vinculadas; confira a estrutura antes de adaptar";
    if (seguro(() => filha.layers && filha.layers.length, false)) {
      const r = riscos(filha);
      if (r) return r;
    }
  }
  return "";
}

function lerMestre(doc, papeis) {
  const m = { id: doc.id, nome: doc.name, largura: numero(doc.width), altura: numero(doc.height),
    ppi: numero(doc.resolution), modo: String(seguro(() => doc.mode, "")), bits: String(seguro(() => doc.bitsPerChannel, "")),
    pranchetas: seguro(() => doc.artboards.length > 0, false), historico: seguro(() => doc.activeHistoryState.id, null), camadas: [] };
  const lista = Array.from(doc.layers);
  const recortada = (l) => !!seguro(() => l.isClippingMask, false);
  m.camadas = lista.map((l, i) => {
    const chave = String(i), filhas = Array.from(seguro(() => l.layers, []) || []);
    const c = { chave, nome: l.name, tipo: String(l.kind), bounds: seguro(() => medir(l), null),
      visivel: seguro(() => l.visible, true) && numero(seguro(() => l.opacity, 100)) > 0,
      conteudo: seguro(() => l.textItem.contents, ""), fontePx: seguro(() => numero(l.textItem.characterStyle.size) * m.ppi / 72, null),
      estrutura: estrutura(l), risco: riscos(l), fundoEspecial: !!seguro(() => l.isBackgroundLayer, false),
      // Camada recortada (máscara de recorte): segue a primeira camada abaixo que não é recortada.
      base: recortada(l) ? (() => { for (let j = i + 1; j < lista.length; j++) if (!recortada(lista[j])) return String(j); return null; })() : null,
      grupoMisto: new Set(filhas.filter((f) => seguro(() => f.visible, true)).map((f) => A.identificar({ nome: f.name, tipo: f.kind }).papel)).size > 1 };
    return Object.assign(c, A.identificar(c, papeis && papeis[chave]));
  });
  // Recortada sem papel próprio herda o papel da base.
  m.camadas.forEach((c) => { if (c.base != null && c.papel === "desconhecido") { const b = m.camadas[Number(c.base)]; if (b && b.papel !== "desconhecido") Object.assign(c, { papel: b.papel, sinal: 0.8, motivo: "Máscara de recorte: segue “" + b.nome + "”." }); } });
  m.assinatura = A.assinatura(m);
  return m;
}

function documento(id) {
  const d = Array.from(app.documents).find((x) => x.id === id);
  if (!d) throw new Error("O KV foi fechado. Adicione-o novamente e refaça o diagnóstico.");
  return d;
}

function conferirFonte(plano) {
  const d = documento(plano.mestreId);
  const atual = lerMestre(d);
  if (atual.assinatura !== plano.assinatura || plano.historico != null && atual.historico !== plano.historico) {
    throw new Error("O KV mudou depois do diagnóstico. Leia o mapa e diagnostique novamente.");
  }
  return d;
}

// Compara com as constantes do próprio Photoshop (os valores internos não são "8" nem "RGB").
function ehRgb8(doc) {
  const C = constants || {}, modo = seguro(() => doc.mode, ""), bits = seguro(() => doc.bitsPerChannel, "");
  const rgb = (C.DocumentMode && modo === C.DocumentMode.RGB) || /rgb/i.test(String(modo));
  const oito = (C.BitsPerChannelType && bits === C.BitsPerChannelType.EIGHT) || /(^|\D)8$|eight/i.test(String(bits));
  return !!(rgb && oito);
}
function conferirWeb(doc, extensoes) {
  if (extensoes.some((e) => e !== "psd") && !ehRgb8(doc)) {
    throw new Error("JPG/PNG desta versão exigem RGB de 8 bits. Prepare uma cópia RGB/8 ou escolha só PSD. Não há conversão de cor automática.");
  }
}

async function salvar(copia, pasta, nome, extensoes, arquivos) {
  conferirWeb(copia, extensoes);
  for (const ext of extensoes) {
    let dir;
    try { dir = await pasta.getEntry(ext.toUpperCase()); } catch (_) { dir = await pasta.createFolder(ext.toUpperCase()); }
    if (!dir.isFolder) throw new Error("Destino " + ext.toUpperCase() + " não é uma pasta.");
    const arq = await dir.createFile(nome + "." + ext, { overwrite: false });
    try {
      if (ext === "psd") await copia.saveAs.psd(arq, { embedColorProfile: true }, true);
      else if (ext === "jpg") await copia.saveAs.jpg(arq, { quality: 10, embedColorProfile: true }, true);
      else if (ext === "png") await copia.saveAs.png(arq, {}, true);
      else throw new Error("Formato de saída não suportado: " + ext);
      arquivos.push({ formato: ext, caminho: arq.nativePath, status: "gravado" });
    } catch (e) {
      // Não anunciar placeholder vazio como entrega válida; conservar evidência se a remoção falhar.
      try { await arq.delete(); } catch (_) { arquivos.push({ formato: ext, caminho: arq.nativePath, status: "incompleto" }); }
      throw e;
    }
  }
}

async function gerar(plano, opcoes, controle) {
  const arquivos = [];
  let copia = null, sucesso = false, previa = null, avisoPrevia = "";
  const verificarCancelamento = (ctx) => { if ((controle && controle.cancelado) || ctx.isCancelled) throw new Error("Cancelado antes de concluir este formato."); };
  try {
    await core.executeAsModal(async (ctx) => {
      const fonte = conferirFonte(plano);
      if (opcoes.pasta) conferirWeb(fonte, opcoes.extensoes);
      verificarCancelamento(ctx);
      copia = await fonte.duplicate(opcoes.nome);
      if (opcoes.modo === "camadas") {
        // Plano de fundo vira camada comum na cópia (o KV original não muda) e mantém o nome.
        for (const e of plano.elementos.filter((x) => x.fundoEspecial)) {
          const l = copia.layers[Number(e.chave)];
          if (l && seguro(() => l.isBackgroundLayer, false)) {
            await action.batchPlay([{ _obj: "set", _target: [{ _ref: "layer", _property: "background" }],
              to: { _obj: "layer", opacity: { _unit: "percentUnit", _value: 100 }, mode: { _enum: "blendMode", _value: "normal" } },
              _options: { dialogOptions: "dontDisplay" } }], {});
            const convertida = copia.layers[Number(e.chave)];
            if (convertida) convertida.name = e.nome;
          }
        }
        // Primeiro expandir, nunca recortar o KV antes de mover seu conteúdo.
        await copia.resizeCanvas(Math.max(plano.alvo.largura, numero(fonte.width)), Math.max(plano.alvo.altura, numero(fonte.height)), constants.AnchorPosition.TOPLEFT);
        for (const e of plano.elementos) {
          verificarCancelamento(ctx);
          const l = copia.layers[Number(e.chave)];
          if (!l || l.name !== e.nome || (!e.fundoEspecial && String(l.kind) !== e.tipo)) throw new Error("Estrutura da cópia mudou: “" + e.nome + "”.");
          await l.scale(e.escala * 100, e.escala * 100, constants.AnchorPosition.MIDDLECENTER);
          const b = medir(l);
          await l.translate((e.bounds.left + e.bounds.right - b.left - b.right) / 2, (e.bounds.top + e.bounds.bottom - b.top - b.bottom) / 2);
          if (!["fundo", "decoracao"].includes(e.papel) && !e.segue) {
            const final = medir(l), a = plano.area;
            if (final.left < a.left - 2 || final.top < a.top - 2 || final.right > a.right + 2 || final.bottom > a.bottom + 2) {
              throw new Error(e.nome + ": limites reais ficaram fora da área segura. Confira fonte, máscara e efeitos.");
            }
          }
        }
        await copia.resizeCanvas(plano.alvo.largura, plano.alvo.altura, constants.AnchorPosition.TOPLEFT);
      } else {
        const dim = calcularEscala(numero(fonte.width), numero(fonte.height), plano.alvo.largura, plano.alvo.altura, opcoes.modo);
        await copia.resizeImage(dim.largura, dim.altura);
        await copia.resizeCanvas(plano.alvo.largura, plano.alvo.altura, opcoes.ancora);
      }
      verificarCancelamento(ctx);
      if (opcoes.capturarPrevia || opcoes.somentePrevia) {
        try { previa = await capturar(imaging, copia); }
        catch (e) { if (opcoes.somentePrevia) throw e; avisoPrevia = e.message; }
      }
      verificarCancelamento(ctx);
      if (opcoes.pasta && !opcoes.somentePrevia) await salvar(copia, opcoes.pasta, opcoes.nome, opcoes.extensoes, arquivos);
      sucesso = true;
    }, { commandName: "PRODUCERIA: " + plano.alvo.nome });
    return { arquivos, documento: copia && copia.id, previa, avisoPrevia };
  } catch (e) {
    e.arquivos = arquivos;
    throw e;
  } finally {
    // Modal por formato. Descartar somente a cópia criada nesta execução.
    if (copia && (!sucesso || opcoes.pasta || opcoes.somentePrevia)) {
      try { await core.executeAsModal(async () => { await copia.closeWithoutSaving(); }, { commandName: "PRODUCERIA: fechar cópia de trabalho" }); }
      catch (e) {
        if (sucesso) {
          const falha = new Error((opcoes.somentePrevia ? "Prévia capturada, mas não foi possível fechar a cópia temporária. " : "Saídas gravadas, mas não foi possível fechar a cópia. ") + "Confira documentos abertos. " + e.message);
          falha.arquivos = arquivos;
          throw falha;
        }
      }
    }
  }
}

const previaDisponivel = () => !!(imaging && typeof imaging.getPixels === "function" && typeof imaging.encodeImageData === "function");
module.exports = { lerMestre, documento, conferirFonte, conferirWeb, ehRgb8, gerar, medir, previaDisponivel };
