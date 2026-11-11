// Desdobra de KV: a peça-mãe vira todos os formatos da campanha no navegador, com o ponto de foco escolhido pela
// pessoa e os nomes do Kit Produceria. É o rascunho que acelera a aprovação de layout; a arte-final é feita à mão.
// Nada sai da máquina: a imagem é lida e desenhada aqui e só vai para o download que a pessoa confirmar.
import { esc, int } from '../lib/formato';
import { seletor } from './dom';
import { navOficina, cabecalho, baixarArquivo } from './oficina';
import { FORMATOS_PADRAO, FORMATOS_EXTRAS, interpretarFormatos, nomeArquivo, recorteCobrir, encaixeConter, ampliacao, manifestoCsv, limpar, ErroKit, MANIFESTO, type Formato, type LinhaEntrega } from '../oficina/kit';
import { zipar, type EntradaZip } from '../oficina/zip';
import { lerCabecalho, sha256 } from '../oficina/imagem';

export type Modo = 'cobrir' | 'conter';
export interface Foco { x: number; y: number }
const MAX_LADO = 8000;
const PADRAO_ESCOLHA = ['stories', 'feed-retrato', 'feed-quadrado', 'paisagem-1200x628'];
export const GRUPOS: { titulo: string; formatos: Formato[] }[] = [
  { titulo: 'Digital', formatos: Object.entries(FORMATOS_PADRAO).map(([nome, [largura, altura]]) => ({ nome, largura, altura })) },
  ...[...new Set(FORMATOS_EXTRAS.map((f) => f.grupo || 'Outros'))].map((g) => ({ titulo: g, formatos: FORMATOS_EXTRAS.filter((f) => (f.grupo || 'Outros') === g) })),
];

/** Pinta um formato no canvas. Cobrir: recorte no foco. Conter: imagem inteira sobre fundo desfocado (ou cor). */
export function pintar(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, W: number, H: number,
  modo: Modo, foco: Foco, fundo: 'desfoque' | 'cor', cor: string, escala = 1) {
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, W, H);
  if (modo === 'cobrir') { const r = recorteCobrir(iw, ih, W, H, foco.x, foco.y); ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, W, H); return; }
  if (fundo === 'cor') { ctx.fillStyle = cor; ctx.fillRect(0, 0, W, H); }
  else {
    const r = recorteCobrir(iw, ih, W, H, foco.x, foco.y), b = Math.max(1, Math.round(24 * escala)); // 24 px como no núcleo
    ctx.save(); ctx.filter = `blur(${b}px)`; ctx.drawImage(img, r.x, r.y, r.w, r.h, -b * 2, -b * 2, W + b * 4, H + b * 4); ctx.restore();
  }
  const e = encaixeConter(iw, ih, W, H); ctx.drawImage(img, e.x, e.y, e.w, e.h);
}

const lerMemoria = (): { cliente?: string; campanha?: string; escolhidos?: string[]; extras?: Formato[] } => { try { return JSON.parse(localStorage.getItem('studio.desdobra') || '{}'); } catch { return {}; } };
const gravarMemoria = (m: object) => { try { localStorage.setItem('studio.desdobra', JSON.stringify(m)); } catch { /* sem memória local: tudo bem */ } };
/** Outro formato escolhido com as mesmas medidas (o arquivo sai igual, só muda o nome). */
export const gemeo = (f: Formato, fs: Formato[]) => fs.find((x) => x !== f && x.largura === f.largura && x.altura === f.altura)?.nome;
const vezes = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function montar(root: HTMLElement): () => void {
  const mem = lerMemoria();
  const st = {
    img: null as ImageBitmap | HTMLImageElement | null, iw: 0, ih: 0, arquivo: '', info: '',
    foco: { x: 0.5, y: 0.5 } as Foco, modo: 'cobrir' as Modo, saida: 'png' as 'png' | 'jpg', fundo: 'desfoque' as 'desfoque' | 'cor', cor: '#ffffff',
    cliente: mem.cliente || '', campanha: mem.campanha || '', versao: 1,
    extras: (mem.extras || []).filter((f) => f && f.nome && f.largura > 0 && f.altura > 0),
    escolhidos: new Set<string>(mem.escolhidos?.length ? mem.escolhidos : PADRAO_ESCOLHA), destaque: '' as string,
  };
  const todos = () => [...GRUPOS.flatMap((g) => g.formatos), ...st.extras];
  const selecionados = () => todos().filter((f) => st.escolhidos.has(f.nome));
  const lembrar = () => gravarMemoria({ cliente: st.cliente, campanha: st.campanha, escolhidos: [...st.escolhidos], extras: st.extras });

  root.innerHTML = `${navOficina('desdobra')}<div class="wrap vc dd">
  ${cabecalho('Oficina · ferramenta da casa', 'Desdobra de KV', 'A peça-mãe em todos os formatos da campanha, com o foco que você escolhe e os nomes do padrão Produceria. Rascunho para aprovar layout: a arte-final é feita à mão.')}
  <div class="dd-grid">
    <section class="dd-mesa" aria-labelledby="dd-m">
      <h2 class="sr" id="dd-m">Peça-mãe</h2>
      <label class="bi-zona dd-zona" id="ddZona"><input type="file" id="ddArq" accept="image/png,image/jpeg,image/webp" class="sr"><b>Solte o KV aqui ou clique para escolher</b><span class="note">PNG, JPG ou WebP · a imagem não sai do seu computador</span></label>
      <div class="dd-kvbox" id="ddKvBox" hidden>
        <canvas id="ddKv" tabindex="0" role="img" aria-label="Peça-mãe. Clique ou use as setas para mover o ponto de foco."></canvas>
        <p class="note" id="ddInfo"></p>
        <div class="acts"><button type="button" class="lnk" id="ddCentro">Foco no centro</button><button type="button" class="lnk" id="ddTroca">Trocar imagem</button></div>
      </div>
      <fieldset class="dd-campos"><legend class="lab">Nome dos arquivos</legend>
        <label>Cliente<input id="ddCli" autocomplete="off" value="${esc(st.cliente)}" placeholder="Sicredi"></label>
        <label>Campanha<input id="ddCamp" autocomplete="off" value="${esc(st.campanha)}" placeholder="Natal Feliz 2026"></label>
        <label class="dd-v">Versão<input id="ddVer" type="number" min="1" max="99" value="1" inputmode="numeric"></label>
        <p class="note dd-ex" id="ddEx" aria-live="polite"></p>
      </fieldset>
      <fieldset class="dd-campos"><legend class="lab">Encaixe</legend>
        <div class="acts" role="group" aria-label="Modo">
          <button type="button" class="chip" data-modo="cobrir" aria-pressed="true">Cobrir (recorta no foco)</button>
          <button type="button" class="chip" data-modo="conter" aria-pressed="false">Conter (imagem inteira)</button></div>
        <div class="acts dd-fundo" id="ddFundo" hidden role="group" aria-label="Fundo do conter">
          <button type="button" class="chip" data-fundo="desfoque" aria-pressed="true">Fundo desfocado</button>
          <button type="button" class="chip" data-fundo="cor" aria-pressed="false">Cor chapada</button>
          <input type="color" id="ddCor" value="#ffffff" aria-label="Cor do fundo" hidden></div>
        <div class="acts" role="group" aria-label="Arquivo de saída">
          <button type="button" class="chip" data-saida="png" aria-pressed="true">PNG</button>
          <button type="button" class="chip" data-saida="jpg" aria-pressed="false">JPG (92%)</button></div>
      </fieldset>
      <fieldset class="dd-campos"><legend class="lab">Formatos</legend><div id="ddFmts"></div>
        <form class="dd-novo" id="ddNovo"><label>Formato próprio<input id="ddNovoT" placeholder="capa-face:820x312 ou 1080x1350" autocomplete="off"></label><button type="submit">Incluir</button></form>
      </fieldset>
    </section>
    <section class="dd-saida" aria-labelledby="dd-s">
      <div class="ph"><h2 class="d d-sub" id="dd-s">Formatos</h2><span class="note" id="ddConta"></span></div>
      <p class="note dd-vazio" id="ddVazio">Escolha um KV para ver cada formato aqui. Passe o mouse num formato para ver o recorte na peça-mãe.</p>
      <ul class="dd-cards" id="ddCards"></ul>
      <div class="acts dd-baixar"><button type="button" id="ddZip" disabled>Baixar todos (.zip com manifesto)</button><span class="note">Arquivos no padrão CLIENTE_campanha_formato_v01, com manifesto_entrega.csv.</span></div>
      <p class="dd-selo"><span class="lab">Rascunho de desdobra</span> Recorte e encaixe são automáticos. Respiro, hierarquia de texto, marca e acabamento continuam sendo decisão do arte-finalista.</p>
    </section>
  </div>
  <p class="sr" id="ddLive" aria-live="polite" aria-atomic="true"></p></div>`;

  const $ = seletor(root);
  const kv = $<HTMLCanvasElement>('#ddKv'), box = $('#ddKvBox'), cards = $('#ddCards');
  const avisar = (t: string) => { $('#ddLive').textContent = t; };
  let quadro = 0, vivo = true;

  const nomeDe = (f: Formato) => {
    try { return nomeArquivo(st.cliente || 'CLIENTE', st.campanha || 'campanha', f.nome, st.versao, st.saida); } catch { return `CLIENTE_campanha_${limpar(f.nome)}_v01.${st.saida}`; }
  };
  const exemplo = () => { $('#ddEx').textContent = 'Ex.: ' + nomeDe(selecionados()[0] || GRUPOS[0].formatos[0]); };

  function listaFormatos() {
    const item = (f: Formato, proprio: boolean) => `<label class="dd-f"><input type="checkbox" data-f="${esc(f.nome)}"${st.escolhidos.has(f.nome) ? ' checked' : ''}><span>${esc(f.nome)}</span><span class="note">${f.largura}×${f.altura}</span>${proprio ? `<button type="button" class="lnk" data-tira="${esc(f.nome)}" aria-label="Remover ${esc(f.nome)}">remover</button>` : ''}</label>`;
    $('#ddFmts').innerHTML = GRUPOS.map((g) => `<div class="dd-g" role="group" aria-label="${esc(g.titulo)}"><span class="note">${esc(g.titulo)}</span>${g.formatos.map((f) => item(f, false)).join('')}</div>`).join('')
      + (st.extras.length ? `<div class="dd-g" role="group" aria-label="Próprios"><span class="note">Próprios</span>${st.extras.map((f) => item(f, true)).join('')}</div>` : '');
  }

  // Peça-mãe: imagem ajustada à largura, com a mira do foco e o recorte do formato em destaque
  function desenharKv() {
    if (!st.img) return;
    const larg = Math.max(200, Math.min(box.clientWidth || 640, 900)), alt = Math.min(larg * (st.ih / st.iw), window.innerHeight * 0.62);
    const w = Math.round(alt / (st.ih / st.iw)), h = Math.round(alt), dpr = window.devicePixelRatio || 1;
    kv.width = w * dpr; kv.height = h * dpr; kv.style.width = w + 'px'; kv.style.height = h + 'px';
    const c = kv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingQuality = 'high';
    c.drawImage(st.img, 0, 0, w, h);
    const k = w / st.iw, mostrar = st.modo === 'cobrir' ? selecionados().filter((f) => !st.destaque || f.nome === st.destaque) : [];
    if (st.destaque && mostrar[0]) { // escurece o que fica fora do recorte em destaque
      const r = recorteCobrir(st.iw, st.ih, mostrar[0].largura, mostrar[0].altura, st.foco.x, st.foco.y);
      c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.rect(0, 0, w, h); c.rect(r.x * k, r.y * k, r.w * k, r.h * k); c.fill('evenodd'); c.restore();
    }
    for (const f of mostrar) {
      const r = recorteCobrir(st.iw, st.ih, f.largura, f.altura, st.foco.x, st.foco.y);
      c.strokeStyle = st.destaque ? '#fff' : 'rgba(255,255,255,.6)'; c.lineWidth = st.destaque ? 2 : 1; c.setLineDash(st.destaque ? [] : [4, 4]);
      c.strokeRect(r.x * k + 0.5, r.y * k + 0.5, r.w * k - 1, r.h * k - 1);
    }
    c.setLineDash([]);
    const fx = st.foco.x * w, fy = st.foco.y * h;
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 3;
    c.beginPath(); c.arc(fx, fy, 9, 0, Math.PI * 2); c.moveTo(fx - 16, fy); c.lineTo(fx - 4, fy); c.moveTo(fx + 4, fy); c.lineTo(fx + 16, fy);
    c.moveTo(fx, fy - 16); c.lineTo(fx, fy - 4); c.moveTo(fx, fy + 4); c.lineTo(fx, fy + 16); c.stroke(); c.shadowBlur = 0;
    kv.setAttribute('aria-label', `Peça-mãe ${st.arquivo}. Foco em ${Math.round(st.foco.x * 100)}% da largura e ${Math.round(st.foco.y * 100)}% da altura. Clique ou use as setas para mover.`);
  }

  function desenharCards() {
    const fs = selecionados();
    $('#ddConta').textContent = fs.length === 1 ? '1 formato' : `${fs.length} formatos`;
    $<HTMLButtonElement>('#ddZip').disabled = !st.img || !fs.length;
    $('#ddVazio').hidden = !!st.img && fs.length > 0;
    if (!st.img) { cards.innerHTML = ''; return; }
    if (!fs.length) $('#ddVazio').textContent = 'Marque ao menos um formato.';
    cards.innerHTML = fs.map((f) => {
      const amp = ampliacao(st.iw, st.ih, f.largura, f.altura, st.modo);
      return `<li class="dd-card" data-card="${esc(f.nome)}"><div class="dd-tela"><canvas data-prev="${esc(f.nome)}" aria-hidden="true"></canvas></div>
        <span class="dd-nome">${esc(nomeDe(f))}</span><span class="note">${int(f.largura)} × ${int(f.altura)} px${amp > 2 ? '' : ` · ${vezes(amp)}×`}${gemeo(f, fs) ? ` · mesmas medidas de ${esc(gemeo(f, fs)!)}` : ''}</span>
        ${amp > 2 ? `<span class="tag w">ampliado ${vezes(amp)}×: perde nitidez</span>` : ''}
        <button type="button" class="lnk" data-baixa="${esc(f.nome)}">Baixar ${st.saida.toUpperCase()}<span class="sr"> de ${esc(f.nome)}</span></button></li>`;
    }).join('');
    pintarPrevias();
  }

  function pintarPrevias() {
    if (!st.img) return;
    const dpr = window.devicePixelRatio || 1;
    cards.querySelectorAll<HTMLCanvasElement>('canvas[data-prev]').forEach((cv) => {
      const f = todos().find((x) => x.nome === cv.dataset.prev);
      if (!f) return;
      const s = Math.min(220 / f.largura, 180 / f.altura), w = Math.max(8, Math.round(f.largura * s)), h = Math.max(8, Math.round(f.altura * s));
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const c = cv.getContext('2d');
      if (c) pintar(c, st.img!, st.iw, st.ih, cv.width, cv.height, st.modo, st.foco, st.fundo, st.cor, cv.width / f.largura);
    });
  }

  const agendar = (cartoes = false) => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => { if (!vivo) return; desenharKv(); if (cartoes) pintarPrevias(); });
  };

  async function renderizar(f: Formato): Promise<Uint8Array> {
    const cv = document.createElement('canvas'); cv.width = f.largura; cv.height = f.altura;
    const c = cv.getContext('2d');
    if (!c || !st.img) throw new Error('canvas');
    if (st.saida === 'jpg') { c.fillStyle = '#fff'; c.fillRect(0, 0, f.largura, f.altura); }
    pintar(c, st.img, st.iw, st.ih, f.largura, f.altura, st.modo, st.foco, st.fundo, st.cor, 1);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, st.saida === 'jpg' ? 'image/jpeg' : 'image/png', 0.92));
    cv.width = cv.height = 0;
    if (!blob) throw new Error('memória');
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function carregar(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { avisar(`${file.name}: use PNG, JPG ou WebP. PSD e PDF passam pelo Checar arquivo.`); return; }
    avisar('Abrindo ' + file.name + '…');
    try {
      const cab = lerCabecalho(new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()));
      let img: ImageBitmap | HTMLImageElement;
      try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      catch {
        img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = URL.createObjectURL(file); });
      }
      if (st.img && 'close' in st.img) st.img.close();
      st.img = img; st.iw = 'naturalWidth' in img ? img.naturalWidth : img.width; st.ih = 'naturalHeight' in img ? img.naturalHeight : img.height;
      st.arquivo = file.name; st.foco = { x: 0.5, y: 0.5 };
      const partes = [esc(file.name), `${int(st.iw)} × ${int(st.ih)} px`];
      if (cab?.dpi) partes.push(`${cab.dpi} ppi`);
      if (cab?.cmyk) partes.push('<b>CMYK</b>: o navegador converte para tela; a desdobra sai em RGB');
      const prop = st.iw / st.ih;
      if (prop < 0.4 || prop > 3.2) partes.push('<b>Proporção de prancha</b> (' + vezes(prop) + ':1): se este arquivo junta várias peças, recorte a peça-mãe antes; a desdobra corta a imagem inteira');
      if (Math.max(st.iw, st.ih) < 2000) partes.push('<b>Imagem pequena</b>: formatos grandes vão sair ampliados');
      $('#ddInfo').innerHTML = partes.join(' · ');
      $('#ddZona').hidden = true; box.hidden = false;
      desenharKv(); desenharCards(); exemplo();
      avisar(`KV carregado: ${st.iw} por ${st.ih} pixels. Clique na imagem para escolher o foco.`);
    } catch { avisar(`Não consegui abrir ${file.name} como imagem.`); }
  }

  // Eventos
  const arq = $<HTMLInputElement>('#ddArq'), zona = $('#ddZona');
  arq.onchange = () => { const f = arq.files?.[0]; if (f) carregar(f); arq.value = ''; };
  zona.ondragover = (e) => { e.preventDefault(); zona.classList.add('over'); };
  zona.ondragleave = () => zona.classList.remove('over');
  zona.ondrop = (e) => { e.preventDefault(); zona.classList.remove('over'); const f = e.dataTransfer?.files?.[0]; if (f) carregar(f); };
  $('#ddTroca').onclick = () => arq.click();
  $('#ddCentro').onclick = () => { st.foco = { x: 0.5, y: 0.5 }; agendar(true); };

  const mover = (e: PointerEvent) => {
    const r = kv.getBoundingClientRect();
    st.foco = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    agendar(true);
  };
  kv.onpointerdown = (e) => { kv.setPointerCapture(e.pointerId); mover(e); };
  kv.onpointermove = (e) => { if (kv.hasPointerCapture(e.pointerId)) mover(e); };
  kv.onkeydown = (e) => {
    const p = e.shiftKey ? 0.05 : 0.01, d: Record<string, [number, number]> = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] };
    if (!d[e.key]) return;
    e.preventDefault();
    st.foco = { x: Math.min(1, Math.max(0, st.foco.x + d[e.key][0])), y: Math.min(1, Math.max(0, st.foco.y + d[e.key][1])) };
    agendar(true);
  };

  const texto = (sel: string, k: 'cliente' | 'campanha') => { const i = $<HTMLInputElement>(sel); i.oninput = () => { st[k] = i.value; lembrar(); exemplo(); cards.querySelectorAll<HTMLElement>('[data-card]').forEach((li) => { const f = todos().find((x) => x.nome === li.dataset.card); if (f) li.querySelector('.dd-nome')!.textContent = nomeDe(f); }); }; };
  texto('#ddCli', 'cliente'); texto('#ddCamp', 'campanha');
  $<HTMLInputElement>('#ddVer').oninput = (e) => { st.versao = Math.max(1, Math.min(99, Number((e.target as HTMLInputElement).value) || 1)); exemplo(); desenharCards(); };

  const grupo = (attr: string, aplicar: (v: string) => void) => root.querySelectorAll<HTMLButtonElement>(`[data-${attr}]`).forEach((b) => {
    b.onclick = () => { root.querySelectorAll(`[data-${attr}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); aplicar(b.dataset[attr]!); };
  });
  grupo('modo', (v) => { st.modo = v as Modo; $('#ddFundo').hidden = st.modo !== 'conter'; desenharKv(); desenharCards(); });
  grupo('fundo', (v) => { st.fundo = v as 'desfoque' | 'cor'; $('#ddCor').hidden = st.fundo !== 'cor'; pintarPrevias(); });
  grupo('saida', (v) => { st.saida = v as 'png' | 'jpg'; exemplo(); desenharCards(); });
  $<HTMLInputElement>('#ddCor').oninput = (e) => { st.cor = (e.target as HTMLInputElement).value; pintarPrevias(); };

  $('#ddFmts').onchange = (e) => {
    const c = e.target as HTMLInputElement;
    if (!c.dataset.f) return;
    if (c.checked) st.escolhidos.add(c.dataset.f); else st.escolhidos.delete(c.dataset.f);
    lembrar(); exemplo(); desenharKv(); desenharCards();
  };
  $('#ddFmts').onclick = (e) => {
    const n = (e.target as HTMLElement).closest<HTMLElement>('[data-tira]')?.dataset.tira;
    if (!n) return;
    st.extras = st.extras.filter((f) => f.nome !== n); st.escolhidos.delete(n);
    lembrar(); listaFormatos(); desenharKv(); desenharCards(); avisar(`${n} removido.`);
  };
  $<HTMLFormElement>('#ddNovo').onsubmit = (e) => {
    e.preventDefault();
    const i = $<HTMLInputElement>('#ddNovoT');
    try {
      const [f] = interpretarFormatos([i.value]);
      if (f.largura > MAX_LADO || f.altura > MAX_LADO) throw new ErroKit(`Até ${MAX_LADO} px por lado. Para grande formato, use a Gráfica (milímetros e ppi).`);
      if (todos().some((x) => x.nome === f.nome)) throw new ErroKit(`Já existe um formato chamado ${f.nome}.`);
      st.extras.push({ nome: f.nome, largura: f.largura, altura: f.altura }); st.escolhidos.add(f.nome);
      i.value = ''; lembrar(); listaFormatos(); desenharKv(); desenharCards(); avisar(`${f.nome} incluído.`);
    } catch (er) { avisar(er instanceof ErroKit ? er.message : 'Formato inválido.'); }
  };

  cards.onpointerover = (e) => { const n = (e.target as HTMLElement).closest<HTMLElement>('[data-card]')?.dataset.card || ''; if (n !== st.destaque) { st.destaque = n; agendar(); } };
  cards.onpointerleave = () => { st.destaque = ''; agendar(); };
  cards.addEventListener('focusin', (e) => { st.destaque = (e.target as HTMLElement).closest<HTMLElement>('[data-card]')?.dataset.card || ''; agendar(); });
  cards.onclick = async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-baixa]');
    const f = b && todos().find((x) => x.nome === b.dataset.baixa);
    if (!b || !f) return;
    b.disabled = true;
    try { const m = await baixarArquivo(nomeDe(f), await renderizar(f)); if (m) avisar(m); }
    catch { avisar(`Não consegui gerar ${f.nome}: memória insuficiente para ${f.largura} × ${f.altura} px.`); }
    b.disabled = false;
  };

  $<HTMLButtonElement>('#ddZip').onclick = async (e) => {
    const b = e.currentTarget as HTMLButtonElement, fs = selecionados();
    if (!st.cliente.trim() || !st.campanha.trim()) { avisar('Preencha cliente e campanha: os arquivos saem com o nome do job.'); $<HTMLInputElement>(st.cliente.trim() ? '#ddCamp' : '#ddCli').focus(); return; }
    b.disabled = true;
    const entradas: EntradaZip[] = [], linhas: LinhaEntrega[] = [];
    try {
      for (const [n, f] of fs.entries()) {
        b.textContent = `Gerando ${n + 1} de ${fs.length}…`;
        const dados = await renderizar(f), nome = nomeDe(f);
        entradas.push({ caminho: nome, dados });
        linhas.push({ arquivo: nome, dimensoes: `${f.largura}x${f.altura}`, tamanhoKb: dados.length / 1024, noPadrao: true, sha256: await sha256(dados) });
      }
      entradas.push({ caminho: MANIFESTO, dados: manifestoCsv(linhas) });
      entradas.push({ caminho: 'LEIA-ME.txt', dados: `Desdobra de KV gerada no PRODUCERia Studio em ${new Date().toISOString().slice(0, 10)}.\nPeça-mãe: ${st.arquivo} (${st.iw}x${st.ih})\nModo: ${st.modo}; foco em ${Math.round(st.foco.x * 100)}% x ${Math.round(st.foco.y * 100)}%.\n\nRascunho para aprovação de layout. A arte-final (respiros, textos, marca) é ajustada à mão em 02_trabalho.\n` });
      const nomeZip = `${limpar(st.cliente)}_${limpar(st.campanha)}_desdobra_v${String(st.versao).padStart(2, '0')}.zip`;
      b.textContent = 'Montando o zip…';
      const m = await baixarArquivo(nomeZip, zipar(entradas));
      if (m) avisar(m);
    } catch { avisar('Não consegui gerar todos os formatos: tente menos formatos de uma vez.'); }
    b.textContent = 'Baixar todos (.zip com manifesto)'; b.disabled = false;
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => agendar()) : null;
  ro?.observe(box);
  listaFormatos(); exemplo(); desenharCards();
  return () => { vivo = false; cancelAnimationFrame(quadro); ro?.disconnect(); if (st.img && 'close' in st.img) st.img.close(); st.img = null; };
}
