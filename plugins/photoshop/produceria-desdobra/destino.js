// Onde salvar, sem depender só da janela de pastas do Photoshop (em algumas máquinas ela não abre).
// Três caminhos, nesta ordem: o caminho escrito ou colado no campo, a pasta escolhida na janela
// e, sem nenhum dos dois, uma subpasta ao lado do arquivo aberto. Mesmo arquivo nos painéis que salvam.

// Limpa o que a pessoa colou: aspas, "file://", barra no fim. Aceita Mac (/Users/...) e Windows (C:\...).
function normalizarCaminho(txt) {
  let c = String(txt || "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (/^file:/i.test(c)) {
    c = c.replace(/^file:(\/\/)?/i, "");
    try { c = decodeURIComponent(c); } catch (e) { /* fica como veio */ }
    if (/^\/[A-Za-z]:[\\/]/.test(c)) c = c.slice(1);
  }
  if (/^[A-Za-z]:[\\/]*$/.test(c)) return c.slice(0, 2) + "\\";
  if (c.length > 1) c = c.replace(/[\\/]+$/, "");
  return c;
}

// A pasta de um arquivo: "/Users/ana/job/kv.psd" -> "/Users/ana/job".
function pastaDoArquivo(caminhoArquivo) {
  const c = normalizarCaminho(caminhoArquivo);
  const i = Math.max(c.lastIndexOf("/"), c.lastIndexOf("\\"));
  if (i < 0) return "";
  const dir = c.slice(0, i);
  if (!dir) return "/";
  return /^[A-Za-z]:$/.test(dir) ? dir + "\\" : dir;
}

// As formas de endereço que o UXP aceita conforme a versão e o sistema.
function urlsPara(caminho) {
  const c = normalizarCaminho(caminho);
  if (!c) return [];
  const f = c.replace(/\\/g, "/");
  const l = ["file:" + c];
  if (/^[A-Za-z]:/.test(f)) l.push("file:/" + f, "file:///" + f);
  else l.push("file://" + f);
  return Array.from(new Set(l));
}

// Abre a pasta de um caminho (precisa de localFileSystem: "fullAccess" no manifest).
async function pastaDoCaminho(fs, caminho) {
  const c = normalizarCaminho(caminho);
  if (!c) throw new Error("caminho vazio");
  if (!fs || typeof fs.getEntryWithUrl !== "function") throw new Error("este Photoshop não abre pasta por caminho escrito. Atualize o Photoshop ou use o botão de escolher pasta");
  let ultimo = null;
  for (const u of urlsPara(c)) {
    try {
      const e = await fs.getEntryWithUrl(u);
      if (e && e.isFolder) return e;
      if (e) throw new Error("o caminho " + c + " é de um arquivo, não de uma pasta");
    } catch (e) { if (/não de uma pasta/.test(e.message)) throw e; ultimo = e; }
  }
  throw new Error("não achei a pasta " + c + (ultimo && ultimo.message ? " (" + ultimo.message + ")" : ""));
}

async function subpasta(base, nome) {
  try { const e = await base.getEntry(nome); if (e && e.isFolder) return e; } catch (e) { /* ainda não existe */ }
  return base.createFolder(nome);
}

// Subpasta ao lado do arquivo aberto (o documento precisa estar salvo em disco).
async function pastaAoLado(fs, doc, nome) {
  let p = "";
  try { p = String((doc && doc.path) || ""); } catch (e) { p = ""; }
  const dir = pastaDoArquivo(p);
  if (!dir) throw new Error("\"" + ((doc && doc.name) || "o documento") + "\" ainda não foi salvo em disco. Salve uma vez (Cmd ou Ctrl + S), escolha uma pasta ou cole o caminho");
  return subpasta(await pastaDoCaminho(fs, dir), nome);
}

// Decide a pasta final. caminho = texto do campo; escolhida = pasta vinda da janela (ou lembrada).
async function resolverDestino(fs, opcoes) {
  const o = opcoes || {};
  const c = normalizarCaminho(o.caminho);
  if (c) {
    if (o.escolhida && normalizarCaminho(o.escolhida.nativePath) === c) return o.escolhida;
    return pastaDoCaminho(fs, c);
  }
  if (o.escolhida) return o.escolhida;
  return pastaAoLado(fs, o.doc, o.subpasta || "saida");
}

// Abre a janela de pastas e avisa se ela não aparecer em alguns segundos.
async function escolherPasta(fs, avisar, ms) {
  const t = setTimeout(() => { try { avisar(); } catch (e) { /* sem aviso */ } }, ms || 4000);
  try { return await fs.getFolder(); } finally { clearTimeout(t); }
}

module.exports = { normalizarCaminho, pastaDoArquivo, urlsPara, pastaDoCaminho, subpasta, pastaAoLado, resolverDestino, escolherPasta };
