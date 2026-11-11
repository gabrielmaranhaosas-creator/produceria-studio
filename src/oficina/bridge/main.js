// Produceria Bridge · plugin UXP para Photoshop (v0.1)
// Ponte entre o PRODUCERia Studio e a mesa do arte-finalista:
// pré-checagem, desdobramento a partir do pacote do job, exportação de prova e upscale Magnific.
const { app, core, constants } = require('photoshop');
const { localFileSystem: lfs, formats } = require('uxp').storage;
let secure = null; try { secure = require('uxp').storage.secureStorage; } catch (e) { /* versões antigas */ }

let pacote = null; // { job, cliente, ficha: {larguraMm, alturaMm, sangriaMm, perfil, dpiMin, cores}, formatos: [{nome, largura, altura, unidade, dpi}] }
const $ = (id) => document.getElementById(id);
const log = (m) => { $('log').textContent = m; };
const MM_POR_POL = 25.4;

// ---------------------------------------------------------------- abas
const abas = { 't-check': 's-check', 't-desd': 's-desd', 't-exp': 's-exp', 't-up': 's-up' };
for (const [b, s] of Object.entries(abas)) {
  $(b).addEventListener('click', () => {
    for (const [b2, s2] of Object.entries(abas)) { $(b2).removeAttribute('selected'); $(s2).classList.remove('on'); }
    $(b).setAttribute('selected', ''); $(s).classList.add('on');
  });
}

// ---------------------------------------------------------------- pacote do job
$('carregar').addEventListener('click', async () => {
  try {
    const f = await lfs.getFileForOpening({ types: ['json'] });
    if (!f) return;
    pacote = JSON.parse(await f.read({ format: formats.utf8 }));
    $('pacote').textContent = `${pacote.job || 'Job'} · ${pacote.cliente || ''} · ${(pacote.formatos || []).length} formato(s)`;
  } catch (e) { log('Não consegui ler o pacote: ' + e.message); }
});

// ---------------------------------------------------------------- pré-checagem
function todasCamadas(layers, out = []) {
  for (const l of layers || []) { out.push(l); if (l.layers) todasCamadas(l.layers, out); }
  return out;
}
function item(nome, ok, obs) { return { nome, status: ok === null ? 'conferir' : ok ? 'ok' : 'ajustar', obs }; }

$('checar').addEventListener('click', async () => {
  const doc = app.activeDocument;
  if (!doc) { log('Abra um documento.'); return; }
  const r = [];
  const ficha = (pacote && pacote.ficha) || {};
  const res = doc.resolution;
  const mmW = (doc.width / res) * MM_POR_POL, mmH = (doc.height / res) * MM_POR_POL;
  const modo = String(doc.mode || '');
  const impresso = ficha.processo !== 'digital-tela';
  if (impresso) {
    r.push(item('Modo de cor CMYK', /CMYK/i.test(modo), modo || 'não identificado'));
    const perfil = doc.colorProfileName || '';
    r.push(item('Perfil de cor', ficha.perfil ? perfil.toLowerCase().includes(String(ficha.perfil).toLowerCase().split(' ')[0]) : null, `${perfil || 'sem perfil'}${ficha.perfil ? ' · pedido: ' + ficha.perfil : ''}`));
    const dpiMin = ficha.dpiMin || 300;
    r.push(item(`Resolução ≥ ${dpiMin} ppi no tamanho final`, res >= dpiMin, `${Math.round(res)} ppi`));
  } else {
    r.push(item('Modo de cor RGB para tela', /RGB/i.test(modo), modo));
  }
  if (ficha.larguraMm && ficha.alturaMm) {
    const s = ficha.sangriaMm ?? 3;
    const alvoW = ficha.larguraMm + 2 * s, alvoH = ficha.alturaMm + 2 * s;
    const ok = Math.abs(mmW - alvoW) <= 0.5 && Math.abs(mmH - alvoH) <= 0.5;
    r.push(item(`Formato com sangria (${alvoW} × ${alvoH} mm)`, ok, `${mmW.toFixed(1)} × ${mmH.toFixed(1)} mm`));
  } else {
    r.push(item('Formato', null, `${mmW.toFixed(1)} × ${mmH.toFixed(1)} mm · sem ficha para comparar`));
  }
  try { r.push(item('8 bits por canal', String(doc.bitsPerChannel).includes('8'), String(doc.bitsPerChannel))); } catch (e) { /* propriedade indisponível */ }
  const cams = todasCamadas(doc.layers);
  const ocultas = cams.filter((l) => l.visible === false).length;
  r.push(item('Camadas ocultas', ocultas === 0, ocultas ? `${ocultas} oculta(s): apagar ou confirmar antes de fechar` : 'nenhuma'));
  const textos = cams.filter((l) => l.kind === constants.LayerKind.TEXT);
  if (textos.length) r.push(item('Textos vivos', null, `${textos.length} camada(s) de texto: converter ou enviar as fontes`));
  const so = cams.filter((l) => l.kind === constants.LayerKind.SMARTOBJECT).length;
  if (so) r.push(item('Objetos inteligentes', null, `${so}: conferir resolução dos vínculos`));
  $('res-check').innerHTML = r.map((x) => `<div class="linha"><span class="${x.status === 'ajustar' ? 'ajustar' : ''}">${x.nome}</span><span>${x.status} · ${x.obs}</span></div>`).join('');
  log(`${r.filter((x) => x.status === 'ajustar').length} ajuste(s). Itens "conferir" dependem do arquivo final (PDF/X) e da gráfica.`);
});

// ---------------------------------------------------------------- desdobramento
const px = (v, unidade, dpi) => Math.round(unidade === 'mm' ? (v / MM_POR_POL) * (dpi || 300) : v);
const limpar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

$('desdobrar').addEventListener('click', async () => {
  if (!pacote || !(pacote.formatos || []).length) { log('Carregue um pacote do job com formatos (aba Pré-checagem).'); return; }
  const base = app.activeDocument; if (!base) { log('Abra o KV mestre.'); return; }
  const pasta = await lfs.getFolder(); if (!pasta) return;
  const feitos = [];
  try {
    await core.executeAsModal(async () => {
      for (const f of pacote.formatos) {
        const w = px(f.largura, f.unidade, f.dpi), h = px(f.altura, f.unidade, f.dpi);
        const dup = await base.duplicate(`${limpar(pacote.job)}_${limpar(f.nome)}`);
        // cobre o formato sem distorcer: escala pelo lado que falta e corta o excedente pelo centro
        const esc = Math.max(w / dup.width, h / dup.height);
        await dup.resizeImage(Math.round(dup.width * esc), Math.round(dup.height * esc), f.dpi || dup.resolution);
        await dup.resizeCanvas(w, h, constants.AnchorPosition.MIDDLECENTER);
        const arq = await pasta.createFile(`${limpar(pacote.job)}_${limpar(f.nome)}_${w}x${h}.psd`, { overwrite: true });
        await dup.saveAs.psd(arq, {}, true);
        await dup.closeWithoutSaving();
        feitos.push(`${f.nome} · ${w}×${h}px`);
      }
    }, { commandName: 'Produceria · desdobrar formatos' });
    $('res-desd').innerHTML = feitos.map((x) => `<div class="linha"><span>${x}</span><span>PSD salvo</span></div>`).join('');
    log(`${feitos.length} formato(s) salvos em ${pasta.nativePath}. Ajuste a composição de cada um antes da prova.`);
  } catch (e) { log('Parou no meio: ' + e.message); }
});

// ---------------------------------------------------------------- exportar prova
$('exportar').addEventListener('click', async () => {
  const doc = app.activeDocument; if (!doc) { log('Abra a peça.'); return; }
  const pasta = await lfs.getFolder(); if (!pasta) return;
  const nome = `${limpar(pacote?.job || 'job')}_${limpar($('peca').value || doc.title)}_v${limpar($('versao').value || '1')}.jpg`;
  try {
    await core.executeAsModal(async () => {
      const arq = await pasta.createFile(nome, { overwrite: true });
      await doc.saveAs.jpg(arq, { quality: 10 }, true);
    }, { commandName: 'Produceria · exportar prova' });
    log(`Prova salva: ${nome}. Arraste em Studio › Aprovação › a peça › Enviar nova versão.`);
  } catch (e) { log('Não consegui exportar: ' + e.message); }
});

// ---------------------------------------------------------------- upscale Magnific
const API = 'https://api.magnific.com/v1/ai/image-upscaler';
async function chave() {
  const digitada = $('chave').value.trim(); if (digitada) return digitada;
  if (!secure) return '';
  try { const v = await secure.getItem('magnific'); return v ? new TextDecoder().decode(v) : ''; } catch (e) { return ''; }
}
$('salvar-chave').addEventListener('click', async () => {
  if (!secure) { log('Este Photoshop não tem armazenamento seguro; digite a chave a cada uso.'); return; }
  await secure.setItem('magnific', $('chave').value.trim()); $('chave').value = ''; log('Chave guardada neste computador.');
});
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

$('upscale').addEventListener('click', async () => {
  const k = await chave(); if (!k) { log('Informe a chave da API Magnific.'); return; }
  const doc = app.activeDocument; if (!doc) { log('Abra a imagem.'); return; }
  try {
    log('Exportando a imagem…');
    let png;
    await core.executeAsModal(async () => {
      const tmp = await lfs.getTemporaryFolder();
      const f = await tmp.createFile('produceria-up.png', { overwrite: true });
      await doc.saveAs.png(f, { compression: 6 }, true);
      png = await f.read({ format: formats.binary });
    }, { commandName: 'Produceria · preparar upscale' });
    const corpo = { image: b64(png), scale_factor: $('fator').value || '2x', optimized_for: $('otim').value || 'standard', creativity: Math.max(-10, Math.min(10, parseInt($('criatividade').value || '0', 10) || 0)) };
    log('Enviando ao Magnific…');
    let r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-magnific-api-key': k }, body: JSON.stringify(corpo) });
    let j = await r.json();
    if (!r.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status));
    const id = j.data && j.data.task_id; let d = j.data;
    for (let i = 0; i < 90 && d && d.status !== 'COMPLETED' && d.status !== 'FAILED'; i++) {
      await espera(4000); log(`Processando… (${d.status})`);
      r = await fetch(`${API}/${id}`, { headers: { 'x-magnific-api-key': k } }); j = await r.json(); d = j.data;
    }
    if (!d || d.status !== 'COMPLETED' || !(d.generated || []).length) throw new Error('A tarefa não terminou (' + (d && d.status) + ').');
    log('Baixando o resultado…');
    const img = await (await fetch(d.generated[0])).arrayBuffer();
    await core.executeAsModal(async () => {
      const tmp = await lfs.getTemporaryFolder();
      const f = await tmp.createFile(`magnific-${Date.now()}.png`, { overwrite: true });
      await f.write(img, { format: formats.binary });
      await app.open(f);
    }, { commandName: 'Produceria · abrir upscale' });
    log('Pronto. A imagem ampliada abriu como documento novo; confira detalhes inventados antes de usar.');
  } catch (e) { log('Upscale falhou: ' + e.message); }
});
