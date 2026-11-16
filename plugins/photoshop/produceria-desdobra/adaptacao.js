// Motor independente da PRODUCERIA. Regras geométricas, sem modelo de IA.
// Os escores são sinais de triagem; não representam probabilidade de aprovação.
const PAPEIS = {
  produto: "Produto / assunto", titulo: "Título", marca: "Marca / logo",
  chamada: "Chamada / botão", selo: "Selo / preço", legal: "Texto legal",
  fundo: "Fundo", decoracao: "Decoração", ajuste: "Ajuste global (sem mover)",
  outro: "Outro elemento", desconhecido: "Revisar papel",
};
const VOCABULARIO = {
  produto: ["produto", "packshot", "hero", "assunto", "product", "modelo"],
  titulo: ["titulo", "headline", "slogan", "title"],
  marca: ["logo", "marca", "brandmark", "logotipo"],
  chamada: ["cta", "botao", "button", "chamada"],
  selo: ["selo", "badge", "preco", "oferta"],
  legal: ["legal", "rodape", "disclaimer", "regulamento"],
  fundo: ["fundo", "background", "bg", "backdrop"],
  decoracao: ["decoracao", "textura", "atmosphere", "texture"],
};
const texto = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const largura = (b) => b.right - b.left;
const altura = (b) => b.bottom - b.top;
const valido = (b) => b && [b.left, b.top, b.right, b.bottom].every(Number.isFinite) && largura(b) > 0 && altura(b) > 0;

function identificar(camada, manual) {
  if (manual && Object.prototype.hasOwnProperty.call(PAPEIS, manual) && manual !== "desconhecido") {
    return { papel: manual, sinal: 1, motivo: "Definido pela pessoa responsável.", manual: true };
  }
  const tokens = texto(camada.nome).split(/[^a-z0-9]+/).filter(Boolean);
  const encontrados = Object.keys(VOCABULARIO).filter((p) => VOCABULARIO[p].some((k) => tokens.includes(k)));
  if (encontrados.length > 1) return { papel: "desconhecido", sinal: 0, motivo: "Nome sugere mais de um papel: " + encontrados.map((p) => PAPEIS[p]).join(", ") };
  if (encontrados.length === 1) return { papel: encontrados[0], sinal: 0.85, motivo: "Sinal no nome; confirme no mapa." };
  const tipo = texto(camada.tipo);
  if (/curves|levels|brightness|hue|vibrance|exposure|colorbalance|gradientmap/.test(tipo)) {
    return { papel: "ajuste", sinal: 0.7, motivo: "Tipo de ajuste; não será transformado." };
  }
  return { papel: "desconhecido", sinal: 0, motivo: "Sem sinal suficiente. Escolha o papel manualmente." };
}

function areaSegura(w, h, margens) {
  if (![w, h].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Dimensões inválidas.");
  const m = margens || {}, n = (k) => m[k] === undefined ? 0 : Number(m[k]);
  const [t, r, b, l] = [n("topo"), n("direita"), n("base"), n("esquerda")];
  if (![t, r, b, l].every((x) => Number.isFinite(x) && x >= 0 && x < 100) || t + b >= 100 || l + r >= 100) {
    throw new Error("Margens devem ser percentuais válidos e deixar uma área útil positiva.");
  }
  return { left: w * l / 100, top: h * t / 100, right: w * (1 - r / 100), bottom: h * (1 - b / 100) };
}

function distanciaProporcao(mestre, alvo) {
  return Math.abs(Math.log((alvo.largura / alvo.altura) / (mestre.largura / mestre.altura)));
}

function escolherMestre(mestres, alvo) {
  if (!mestres.length) throw new Error("Adicione ao menos um KV aberto.");
  // Qualidade do mapeamento desempata fontes com a mesma proporção.
  return mestres.slice().sort((a, b) => distanciaProporcao(a, alvo) - distanciaProporcao(b, alvo) ||
    b.camadas.filter((c) => c.visivel && c.papel !== "desconhecido").length - a.camadas.filter((c) => c.visivel && c.papel !== "desconhecido").length)[0];
}

function compararMestres(mestres, escolhido) {
  const avisos = new Set();
  for (const outro of mestres.filter((m) => m.id !== escolhido.id)) {
    for (const c of outro.camadas.filter((x) => x.visivel && ["marca", "titulo", "legal", "chamada"].includes(x.papel))) {
      const candidatas = escolhido.camadas.filter((x) => x.visivel && x.papel === c.papel);
      const exatas = candidatas.filter((x) => texto(x.nome) === texto(c.nome));
      const equivalentes = exatas.length ? exatas : candidatas;
      if (!equivalentes.length) avisos.add("Papel " + PAPEIS[c.papel] + " existe em “" + outro.nome + "”, mas não no KV escolhido.");
      else if (equivalentes.length > 1) avisos.add("Correspondência ambígua de " + PAPEIS[c.papel] + " entre os KVs; confira os mapas.");
      else if (c.conteudo && equivalentes[0].conteudo && c.conteudo !== equivalentes[0].conteudo) {
        avisos.add("Texto de " + PAPEIS[c.papel] + " difere entre os KVs. Nenhum conteúdo foi substituído.");
      }
    }
  }
  return Array.from(avisos);
}

function sobreposicao(a, b) {
  const i = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return i / Math.min(largura(a) * altura(a), largura(b) * altura(b));
}

function planejar(mestre, alvo, margens) {
  const area = areaSegura(alvo.largura, alvo.altura, margens), avisos = [], bloqueios = [], elementos = [];
  const distancia = distanciaProporcao(mestre, alvo);
  let escore = Math.max(20, Math.round(100 - 55 * distancia));
  if (mestre.historico == null) avisos.push("Histórico da fonte indisponível: alterações só de pixels podem não ser detectadas. Releia o KV antes do lote.");
  if (distancia > Math.log(1.5)) avisos.push("Mudança acentuada de proporção: prefira outro KV e revise a composição.");
  if (mestre.pranchetas) bloqueios.push("KV com pranchetas: use um documento de canvas único nesta versão.");
  const porChave = new Map();
  // Bases antes das recortadas (que ficam acima delas na lista de camadas).
  const ordem = mestre.camadas.filter((x) => x.visivel).sort((a, b) => (a.base != null) - (b.base != null));
  for (const c of ordem) {
    // Sem papel definido, a camada acompanha a composição como "Outro elemento": revisar, mas não trava o lote.
    const papel = c.papel === "desconhecido" ? "outro" : c.papel;
    if (c.papel === "desconhecido") avisos.push("“" + c.nome + "” sem papel definido: tratada como Outro elemento. Defina o papel no mapa para um resultado melhor.");
    if (c.risco) { bloqueios.push(c.nome + ": " + c.risco); continue; }
    if (papel === "ajuste") continue;
    if (!valido(c.bounds)) { bloqueios.push("Não foi possível medir “" + c.nome + "”."); continue; }
    // Máscara de recorte: mesma escala e mesmo deslocamento da camada base, para não descolar.
    const base = c.base != null ? porChave.get(String(c.base)) : null;
    if (c.base != null && !base) {
      const b = mestre.camadas[Number(c.base)];
      if (!b || !b.visivel || (b.papel === "ajuste")) { /* base sem transformação: a recortada também fica */ continue; }
    }
    if (base) {
      const s = base.escala, bo = base.origem, bn = base.bounds;
      const cx = (bn.left + bn.right) / 2 + ((c.bounds.left + c.bounds.right) / 2 - (bo.left + bo.right) / 2) * s;
      const cy = (bn.top + bn.bottom) / 2 + ((c.bounds.top + c.bounds.bottom) / 2 - (bo.top + bo.bottom) / 2) * s;
      const w = largura(c.bounds) * s, h = altura(c.bounds) * s;
      elementos.push({ chave: c.chave, nome: c.nome, tipo: c.tipo, papel: base.papel, escala: s, segue: base.nome, fundoEspecial: false,
        bounds: { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 }, origem: c.bounds });
      continue;
    }
    const fundo = papel === "fundo" || papel === "decoracao";
    const s = fundo ? Math.max(alvo.largura / largura(c.bounds), alvo.altura / altura(c.bounds)) :
      Math.min(largura(area) / mestre.largura, altura(area) / mestre.altura);
    const w = largura(c.bounds) * s, h = altura(c.bounds) * s;
    const nx = ((c.bounds.left + c.bounds.right) / 2) / mestre.largura;
    const ny = ((c.bounds.top + c.bounds.bottom) / 2) / mestre.altura;
    let cx = fundo ? alvo.largura / 2 : area.left + nx * largura(area);
    let cy = fundo ? alvo.altura / 2 : area.top + ny * altura(area);
    if (!fundo) {
      cx = Math.max(area.left + w / 2, Math.min(area.right - w / 2, cx));
      cy = Math.max(area.top + h / 2, Math.min(area.bottom - h / 2, cy));
      if (w > largura(area) + 0.1 || h > altura(area) + 0.1) bloqueios.push(c.nome + ": conteúdo ultrapassa a área útil.");
    }
    if (s > 2) { avisos.push(c.nome + ": ampliação acima de 2x; conferir nitidez."); escore -= 10; }
    if (c.fontePx && c.fontePx * s < 12) { avisos.push(c.nome + ": texto projetado abaixo de 12 px (limiar interno de triagem, não norma do veículo)."); escore -= 15; }
    if (c.grupoMisto) { avisos.push(c.nome + ": grupo com funções diferentes será movido como uma unidade."); escore -= 10; }
    const bounds = { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 };
    const el = { chave: c.chave, nome: c.nome, tipo: c.tipo, papel, escala: s, bounds, origem: c.bounds, fundoEspecial: !!c.fundoEspecial };
    elementos.push(el); porChave.set(String(c.chave), el);
  }
  elementos.sort((a, b) => Number(a.chave) - Number(b.chave));
  const importantes = elementos.filter((e) => !["fundo", "decoracao"].includes(e.papel) && !e.segue);
  for (let i = 0; i < importantes.length; i++) for (let j = i + 1; j < importantes.length; j++) {
    const a = importantes[i], b = importantes[j];
    if (sobreposicao(a.bounds, b.bounds) > 0.15 && sobreposicao(a.origem, b.origem) <= 0.15) {
      avisos.push("Possível colisão nova: “" + a.nome + "” e “" + b.nome + "”."); escore -= 20;
    }
  }
  if (!elementos.length) bloqueios.push("Nenhum elemento visível transformável.");
  escore = bloqueios.length ? 0 : Math.max(0, Math.min(100, escore));
  return { alvo, mestreId: mestre.id, mestreNome: mestre.nome, assinatura: mestre.assinatura, historico: mestre.historico, area, elementos,
    bloqueios, avisos: Array.from(new Set(avisos)), escore, revisao: "Revisão visual obrigatória; escore geométrico não é aprovação." };
}

// Não transporta IDs da camada original para a cópia. O adaptador resolve a estrutura novamente.
function assinatura(mestre) {
  return JSON.stringify([mestre.nome, mestre.largura, mestre.altura, mestre.ppi, mestre.modo, mestre.bits,
    mestre.camadas.map(({ chave, nome, tipo, bounds, visivel, conteudo, estrutura, risco }) =>
      [chave, nome, tipo, bounds, visivel, conteudo, estrutura, risco])]);
}

async function executarLote(planos, portas, controle) {
  const itens = [], ctl = controle || {};
  for (let i = 0; i < planos.length; i++) {
    if (ctl.cancelado) break;
    const plano = planos[i];
    let item;
    try {
      if (plano.bloqueios.length) throw new Error(plano.bloqueios.join(" "));
      const saida = await portas.gerar(plano, ctl);
      item = { indice: i, formato: plano.alvo, mestre: plano.mestreNome, escore: plano.escore,
        status: "gerado_para_revisao", arquivos: saida.arquivos || [], revisao: "pendente", avisos: plano.avisos };
    } catch (e) {
      item = { indice: i, formato: plano.alvo, mestre: plano.mestreNome, status: "falhou", erro: String(e.message || e), arquivos: e.arquivos || [] };
    }
    itens.push(item);
    await portas.registrar({ itens: itens.slice(), total: planos.length, cancelado: !!ctl.cancelado });
    if (portas.progresso) portas.progresso(item, itens.length, planos.length);
  }
  return { itens, total: planos.length, cancelado: !!ctl.cancelado, pendentes: planos.length - itens.length };
}

module.exports = { PAPEIS, identificar, areaSegura, escolherMestre, compararMestres, distanciaProporcao, planejar, assinatura, executarLote, valido };
