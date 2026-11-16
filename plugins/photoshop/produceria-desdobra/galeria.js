// Visualização local: esquema geométrico antes da renderização, pixels reais depois.
// Molduras e guias pertencem à apresentação; nunca entram no PSD/JPG/PNG da campanha.
const { calcularEscala } = require("./desdobra.js");
const CONTEXTOS = { google: "Google Display", meta: "Meta · feed / stories", mac: "Mac / computador", celular: "Celular", video: "Vídeo / DOOH", personalizado: "Formato próprio" };
const STATUS = { planejado: "Planejado · sem pixels", processando: "Processando este formato", bloqueado: "Corrigir antes de gerar", previa: "Prévia real · revisar", gerado: "Gerado · revisão pendente", falhou: "Falhou", cancelado: "Não processado · cancelado" };
const CORES = { produto: "#277f9b", titulo: "#d8b455", marca: "#8ac58f", chamada: "#c77b67", selo: "#ad8ace", legal: "#b6bec7", fundo: "#263c4c", decoracao: "#3a5361", outro: "#7796a6" };
const GOOGLE = new Set(["200x200", "240x400", "250x250", "250x360", "300x250", "336x280", "580x400", "120x600", "160x600", "300x600", "300x1050", "468x60", "728x90", "930x180", "970x90", "970x250", "980x120", "300x50", "320x50", "320x100"]);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pos = (b, w, h) => "left:" + b.left / w * 100 + "%;top:" + b.top / h * 100 + "%;width:" + (b.right - b.left) / w * 100 + "%;height:" + (b.bottom - b.top) / h * 100 + "%;";

function contexto(f) {
  const n = String(f.nome).toLowerCase();
  if (/mac|desktop|computador|notebook/.test(n)) return "mac";
  if (/meta|feed|stories|story|instagram|facebook|reels/.test(n)) return "meta";
  if (/google|display|banner/.test(n) || GOOGLE.has(f.largura + "x" + f.altura)) return "google";
  if (/celular|mobile/.test(n)) return "celular";
  if (/youtube|video|dooh|full-hd|4k/.test(n)) return "video";
  if (["1080x1920", "1080x1350", "1080x1080", "1200x628"].includes(f.largura + "x" + f.altura)) return "meta";
  return "personalizado";
}

function encaixar(w, h, maxW, maxH) {
  const s = Math.min(maxW / w, maxH / h);
  return { largura: Math.max(1, Math.round(w * s)), altura: Math.max(1, Math.round(h * s)) };
}

function elementosGlobais(m, f, modo, ancora) {
  const d = calcularEscala(m.largura, m.altura, f.largura, f.altura, modo);
  const fx = /LEFT/.test(ancora) ? 0 : /RIGHT/.test(ancora) ? 1 : 0.5;
  const fy = /TOP/.test(ancora) ? 0 : /BOTTOM/.test(ancora) ? 1 : 0.5;
  const dx = (f.largura - d.largura) * fx, dy = (f.altura - d.altura) * fy;
  return m.camadas.filter((c) => c.visivel && c.bounds).map((c) => ({ nome: c.nome, papel: c.papel,
    bounds: { left: c.bounds.left * d.largura / m.largura + dx, right: c.bounds.right * d.largura / m.largura + dx,
      top: c.bounds.top * d.altura / m.altura + dy, bottom: c.bounds.bottom * d.altura / m.altura + dy } }));
}

function novoItem(plano) {
  return { plano, contexto: contexto(plano.alvo), status: plano.bloqueios.length ? "bloqueado" : "planejado", previa: null, erro: "" };
}

function palco(item, opcoes) {
  const p = item.plano, f = p.alvo, opts = opcoes || {}, ctx = opts.contexto === false ? "personalizado" : (opts.forcarContexto || item.contexto);
  const d = encaixar(f.largura, f.altura, opts.grande ? Math.max(100, Math.min(440, opts.maxW || 440)) : 220, opts.grande ? 330 : 170);
  let conteudo = "";
  if (item.previa && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(item.previa.src)) {
    const b = item.previa.bounds || { left: 0, top: 0, right: f.largura, bottom: f.altura };
    conteudo = '<img alt="Prévia real de ' + esc(f.nome) + '" src="' + item.previa.src + '" style="position:absolute;' + pos(b, f.largura, f.altura) + '">';
  } else {
    conteudo = p.elementos.slice().reverse().map((e) => '<div class="gv-elemento" title="' + esc(e.nome) + '" style="' + pos(e.bounds, f.largura, f.altura) + 'background-color:' + (CORES[e.papel] || CORES.outro) + '">' + esc(e.papel) + '</div>').join("");
    if (!p.elementos.length) conteudo = '<span class="gv-sem-pixels">Sem pixels</span>';
  }
  if (opts.guias !== false && p.area) conteudo += '<div class="gv-segura" style="' + pos(p.area, f.largura, f.altura) + '"></div>';
  const arte = '<div class="gv-arte" style="width:' + d.largura + 'px;height:' + d.altura + 'px">' + conteudo + '</div>';
  let topo = "", base = "";
  if (ctx === "google") { topo = '<div class="gv-barra">Portal · Publicidade</div>'; base = '<div class="gv-editorial">Conteúdo do site · exemplo</div>'; }
  if (ctx === "mac") { topo = '<div class="gv-barra">● ● ● &nbsp; Navegador no Mac</div>'; base = '<div class="gv-base-mac"></div>'; }
  if (ctx === "meta") { topo = '<div class="gv-barra">Sua marca · Patrocinado</div>'; base = '<div class="gv-barra">♡ &nbsp; Comentar &nbsp; Compartilhar</div>'; }
  if (ctx === "celular") { topo = '<div class="gv-barra">9:41 · Celular</div>'; base = '<div class="gv-barra">Página de exemplo</div>'; }
  if (ctx === "video") { topo = '<div class="gv-barra">Tela / player</div>'; base = '<div class="gv-barra">▶ ━━━━━ 00:00 · imagem estática</div>'; }
  return '<div class="gv-palco"><div class="gv-moldura gv-' + ctx + '">' + topo + arte + base + '</div></div>';
}

function cartao(item, i, opts) {
  const p = item.plano, f = p.alvo;
  return '<div class="gv-card" data-indice="' + i + '"><div class="gv-meta">' + esc(CONTEXTOS[item.contexto]) + '</div><h3>' + esc(f.nome) + '</h3>' + palco(item, opts) +
    '<div class="gv-medida">' + f.largura + ' × ' + f.altura + ' px</div><div class="gv-status">' + esc(STATUS[item.status]) + '</div><div class="nota">' + (item.previa ? 'Pixels da cópia renderizada · JPEG sRGB sobre branco.' : 'Esquema geométrico de camadas; não é a arte renderizada.') + '</div>' +
    '<div class="nota">KV: ' + esc(p.mestreNome) + '</div>' +
    (p.bloqueios.length ? '<div class="gv-alerta">' + esc(p.bloqueios.join(" · ")) + '</div>' : '') +
    (p.avisos.length ? '<div class="nota">Revisar: ' + esc(p.avisos.join(" · ")) + '</div>' : '') +
    (item.erro ? '<div class="gv-alerta">' + esc(item.erro) + '</div>' : '') +
    (opts && opts.estatico ? '' : '<button data-detalhe="' + i + '">Ver detalhe</button>') + '</div>';
}

function folhaHtml(itens, campanha, css, opcoes) {
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PRODUCERIA · ' + esc(campanha) + '</title><style>' + css + '\nbody{font:14px Arial,sans-serif;background:#172027;color:#eef1f3;padding:24px}h1{font-size:28px}#galeria{display:flex;flex-wrap:wrap}.gv-card{width:300px;margin:8px}.nota{font-size:12px;line-height:1.5;opacity:.8} @media print{body{background:white;color:black}.gv-card{break-inside:avoid;border:1px solid #bbb;color:black;background:white}}</style></head><body><h1>PRODUCERIA · ' + esc(campanha) + '</h1><p>Folha de revisão. Molduras aproximadas, escala ajustada por cartão. Não é comprovação de veiculação ou aprovação. Guias e interfaces não compõem as artes exportadas.</p><div id="galeria">' + itens.map((x, i) => cartao(x, i, { ...opcoes, estatico: true })).join("") + '</div></body></html>';
}

module.exports = { CONTEXTOS, STATUS, contexto, encaixar, elementosGlobais, novoItem, palco, cartao, folhaHtml, esc };
