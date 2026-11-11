// Retoque: ajustes de base com antes e depois, ampliação clássica e a leitura dos especialistas de imagem da casa
// (diretor de arte, arte-finalista, prompts de retoque, upscale). O original nunca é alterado: a saída ganha a
// próxima versão no nome. A imagem só vai ao Claude quando a pessoa pede a leitura de um especialista.
import { esc, int } from '../lib/formato';
import { seletor } from './dom';
import { navOficina, cabecalho, baixarArquivo } from './oficina';
import { proximaVersao } from '../oficina/kit';
import { lerCabecalho } from '../oficina/imagem';
import { ZERO, CONTROLES, aplicar, neutro, medidasAmpliadas, ampliar, type Ajustes } from '../oficina/retoque';
import { PERSONAS, FERRAMENTAS_IMAGEM, imagemParaIA } from '../oficina/personas';
import { conversar, aceitaImagens, CONTEXTO, ErroIA } from '../lib/ia';

const PEDIDO_PADRAO: Record<string, string> = {
  diretor_arte: 'Critique esta imagem como peça ou foto de campanha: o que funciona, o que muda e em que ordem.',
  artefinalista: 'O que falta para levar esta imagem à arte-final, e para quais formatos ela serve sem recompor?',
  prompts_retoque: 'Liste as intervenções de retoque que esta imagem pede, cada uma com área, ferramenta e prompt.',
  upscale: 'Até que tamanho esta imagem aguenta em digital, impresso e mídia exterior, e como ampliar?',
};
const MAX_PREVIA = 1400;
const cm = (px: number, ppi: number) => ((px / ppi) * 2.54).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('retoque')}<div class="wrap vc rt">
  ${cabecalho('Oficina · ferramenta da casa', 'Retoque', 'Ajustes de base com antes e depois, ampliação e a leitura dos especialistas de imagem. O original não é alterado: a saída ganha a próxima versão.')}
  <div class="rt-grid">
    <section class="rt-mesa" aria-labelledby="rt-m"><h2 class="sr" id="rt-m">Imagem</h2>
      <label class="bi-zona rt-zona" id="rtZona"><input type="file" id="rtArq" accept="image/png,image/jpeg,image/webp" class="sr"><b>Solte a imagem aqui ou clique para escolher</b><span class="note">PNG, JPG ou WebP · fica no seu computador até você pedir a leitura de um especialista</span></label>
      <div class="rt-tela" id="rtTela" hidden>
        <canvas id="rtCv" role="img" aria-label="Imagem: antes à esquerda da linha, depois à direita"></canvas>
        <label class="rt-corte"><span class="note">Antes</span><input type="range" id="rtCorte" min="0" max="100" value="50" aria-label="Posição da comparação entre antes e depois"><span class="note">Depois</span></label>
        <p class="note" id="rtInfo"></p>
        <div class="acts"><button type="button" class="lnk" id="rtTroca">Trocar imagem</button></div>
      </div>
    </section>
    <aside class="rt-lado">
      <fieldset class="dd-campos"><legend class="lab">Ajustes</legend>
        ${CONTROLES.map(([k, min, max, passo, rot, un]) => `<label class="rt-aj"><span>${rot}</span><input type="range" data-aj="${k}" min="${min}" max="${max}" step="${passo}" value="0"><output id="rtV-${k}">0${un ? ' ' + un : ''}</output></label>`).join('')}
        <div class="acts"><button type="button" class="lnk" id="rtZero">Zerar ajustes</button></div>
        <p class="note">A nitidez da prévia é aproximada; o arquivo final recebe o ajuste no tamanho real.</p>
      </fieldset>
      <fieldset class="dd-campos"><legend class="lab">Ampliação clássica</legend>
        <div class="acts" role="group" aria-label="Ampliação">${[1, 1.5, 2, 3, 4].map((f) => `<button type="button" class="chip" data-amp="${f}" aria-pressed="${f === 1}">${f === 1 ? 'Sem' : String(f).replace('.', ',') + '×'}</button>`).join('')}</div>
        <p class="note" id="rtAmp"></p>
      </fieldset>
      <fieldset class="dd-campos"><legend class="lab">Saída</legend>
        <div class="acts" role="group" aria-label="Arquivo"><button type="button" class="chip" data-saida="png" aria-pressed="true">PNG</button><button type="button" class="chip" data-saida="jpg" aria-pressed="false">JPG (92%)</button></div>
        <p class="note" id="rtNome"></p>
        <div class="acts"><button type="button" id="rtBaixa" disabled>Baixar versão retocada</button></div>
      </fieldset>
    </aside>
  </div>
  <section class="lc-box rt-esp" aria-labelledby="rt-e"><span class="lab">Especialistas de imagem</span><h2 class="d d-sub" id="rt-e">Leitura da imagem</h2>
    <p class="measure note" id="rtIaNota">Mande a imagem como está agora para um especialista da casa. Ela vai ao Claude só quando você clicar.</p>
    <div class="acts" role="group" aria-label="Especialista">${PERSONAS.map((p, i) => `<button type="button" class="chip" data-pes="${p.id}" aria-pressed="${i === 0}">${esc(p.nome)}</button>`).join('')}</div>
    <p class="note" id="rtFoco"></p>
    <label class="rt-ped">O que você precisa (opcional)<textarea id="rtPed" rows="2"></textarea></label>
    <div class="acts"><button type="button" id="rtPerg" disabled>Pedir leitura</button><button type="button" class="lnk" id="rtPara" hidden>Parar</button><button type="button" class="lnk" id="rtCopia" hidden>Copiar resposta</button></div>
    <div class="lc-pre rt-resp" id="rtResp" aria-live="polite"></div>
  </section>
  <p class="sr" id="rtLive" aria-live="polite" aria-atomic="true"></p></div>`;

  const $ = seletor(root);
  const cv = $<HTMLCanvasElement>('#rtCv');
  const avisar = (t: string) => { $('#rtLive').textContent = t; };
  const st = {
    img: null as ImageBitmap | null, nome: '', iw: 0, ih: 0, ppi: null as number | null,
    aj: { ...ZERO } as Ajustes, corte: 0.5, fator: 1, saida: 'png' as 'png' | 'jpg', pessoa: PERSONAS[0].id,
    original: null as ImageData | null, ajustada: document.createElement('canvas'), resposta: '',
  };
  let quadro = 0, vivo = true, ctrl: AbortController | null = null, imagensOk = false;

  const nomeSaida = () => proximaVersao(st.nome.replace(/\.[^.]*$/, '')) + '.' + st.saida;
  function textos() {
    if (!st.img) return;
    const m = medidasAmpliadas(st.iw, st.ih, st.fator);
    $('#rtAmp').innerHTML = `${int(m.largura)} × ${int(m.altura)} px · imprime ${cm(m.largura, 300)} × ${cm(m.altura, 300)} cm a 300 ppi, ${cm(m.largura, 150)} × ${cm(m.altura, 150)} cm a 150 ppi`
      + (m.limitado ? ` · limitado a ${int(m.largura)} px no lado maior` : '')
      + (st.fator > 2 ? '<br><b>Acima de 2×</b> a ampliação clássica não cria detalhe: para foto com textura, use IA (Magnific, no Kit) e peça o plano ao especialista de Upscale.' : '');
    $('#rtNome').textContent = 'Arquivo: ' + nomeSaida();
  }
  function desenhar() {
    if (!st.img || !st.original) return;
    const w = st.original.width, h = st.original.height;
    const aj = new ImageData(new Uint8ClampedArray(st.original.data), w, h);
    aplicar(aj, { ...st.aj, nitidez: st.aj.nitidez * Math.min(1, w / st.iw) * 1.2 });
    st.ajustada.width = w; st.ajustada.height = h; st.ajustada.getContext('2d')!.putImageData(aj, 0, 0);
    const c = cv.getContext('2d');
    if (!c) return;
    const xs = Math.round(w * st.corte);
    c.putImageData(st.original, 0, 0);
    c.drawImage(st.ajustada, xs, 0, w - xs, h, xs, 0, w - xs, h);
    c.fillStyle = '#fff'; c.fillRect(xs - 1, 0, 2, h);
  }
  const agendar = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(() => { if (vivo) desenhar(); }); };

  async function carregar(f: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { avisar(`${f.name}: use PNG, JPG ou WebP.`); return; }
    try {
      const cab = lerCabecalho(new Uint8Array(await f.slice(0, 2 * 1024 * 1024).arrayBuffer()));
      const img = await createImageBitmap(f, { imageOrientation: 'from-image' });
      st.img?.close();
      Object.assign(st, { img, nome: f.name, iw: img.width, ih: img.height, ppi: cab?.dpi ?? null });
      const s = Math.min(1, MAX_PREVIA / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d')!; c.imageSmoothingQuality = 'high'; c.drawImage(img, 0, 0, w, h);
      st.original = c.getImageData(0, 0, w, h);
      $('#rtInfo').textContent = [f.name, `${int(img.width)} × ${int(img.height)} px`, cab?.dpi ? `${cab.dpi} ppi` : '', cab?.cmyk ? 'CMYK (o navegador converte para RGB)' : ''].filter(Boolean).join(' · ');
      $('#rtZona').hidden = true; $('#rtTela').hidden = false;
      $<HTMLButtonElement>('#rtBaixa').disabled = false;
      st.resposta = ''; $('#rtResp').textContent = '';
      botoesIA(); textos(); desenhar();
      avisar(`${f.name} aberta: ${img.width} por ${img.height} pixels.`);
    } catch { avisar(`Não consegui abrir ${f.name}.`); }
  }

  // Eventos
  const arq = $<HTMLInputElement>('#rtArq'), zona = $('#rtZona');
  arq.onchange = () => { const f = arq.files?.[0]; if (f) carregar(f); arq.value = ''; };
  zona.ondragover = (e) => { e.preventDefault(); zona.classList.add('over'); };
  zona.ondragleave = () => zona.classList.remove('over');
  zona.ondrop = (e) => { e.preventDefault(); zona.classList.remove('over'); const f = e.dataTransfer?.files?.[0]; if (f) carregar(f); };
  $('#rtTroca').onclick = () => arq.click();
  $<HTMLInputElement>('#rtCorte').oninput = (e) => { st.corte = Number((e.target as HTMLInputElement).value) / 100; agendar(); };
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); mover(e); };
  cv.onpointermove = (e) => { if (cv.hasPointerCapture(e.pointerId)) mover(e); };
  const mover = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); st.corte = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); $<HTMLInputElement>('#rtCorte').value = String(Math.round(st.corte * 100)); agendar(); };

  const mostrarValor = (k: keyof Ajustes) => { const c = CONTROLES.find((x) => x[0] === k)!; $(`#rtV-${k}`).textContent = (k === 'exposicao' ? st.aj[k].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }) : st.aj[k].toLocaleString('pt-BR', { signDisplay: 'exceptZero' })) + (c[5] ? ' ' + c[5] : ''); };
  root.querySelectorAll<HTMLInputElement>('[data-aj]').forEach((i) => {
    const k = i.dataset.aj as keyof Ajustes;
    i.oninput = () => { st.aj[k] = Number(i.value); mostrarValor(k); agendar(); };
    i.ondblclick = () => { i.value = '0'; st.aj[k] = 0; mostrarValor(k); agendar(); };
  });
  $('#rtZero').onclick = () => { st.aj = { ...ZERO }; root.querySelectorAll<HTMLInputElement>('[data-aj]').forEach((i) => { i.value = '0'; mostrarValor(i.dataset.aj as keyof Ajustes); }); agendar(); avisar('Ajustes zerados.'); };

  const grupo = (attr: string, aplicarV: (v: string) => void) => root.querySelectorAll<HTMLButtonElement>(`[data-${attr}]`).forEach((b) => {
    b.onclick = () => { root.querySelectorAll(`[data-${attr}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); aplicarV(b.dataset[attr]!); };
  });
  grupo('amp', (v) => { st.fator = Number(v); textos(); });
  grupo('saida', (v) => { st.saida = v as 'png' | 'jpg'; textos(); });
  grupo('pes', (v) => { st.pessoa = v; foco(); });
  const foco = () => { const p = PERSONAS.find((x) => x.id === st.pessoa)!; $('#rtFoco').textContent = p.foco; $<HTMLTextAreaElement>('#rtPed').placeholder = PEDIDO_PADRAO[p.id]; };

  $<HTMLButtonElement>('#rtBaixa').onclick = async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    if (!st.img) return;
    b.disabled = true; b.textContent = 'Gerando…';
    try {
      const c = document.createElement('canvas'); c.width = st.iw; c.height = st.ih;
      const x = c.getContext('2d')!; x.drawImage(st.img, 0, 0);
      if (!neutro(st.aj)) x.putImageData(aplicar(x.getImageData(0, 0, st.iw, st.ih), st.aj), 0, 0);
      const m = medidasAmpliadas(st.iw, st.ih, st.fator);
      const fim = m.fator > 1 ? ampliar(c, m.largura, m.altura) : c;
      if (st.saida === 'jpg') { const y = fim.getContext('2d')!; y.globalCompositeOperation = 'destination-over'; y.fillStyle = '#fff'; y.fillRect(0, 0, fim.width, fim.height); }
      const blob = await new Promise<Blob | null>((ok) => fim.toBlob(ok, st.saida === 'jpg' ? 'image/jpeg' : 'image/png', 0.92));
      if (!blob) throw new Error('memória');
      const msg = await baixarArquivo(nomeSaida(), blob);
      if (msg) avisar(msg);
    } catch { avisar('Não consegui gerar o arquivo: tente sem ampliação ou com uma imagem menor.'); }
    b.disabled = false; b.textContent = 'Baixar versão retocada';
  };

  function botoesIA() {
    $<HTMLButtonElement>('#rtPerg').disabled = !st.img || !imagensOk || !!ctrl;
    if (!imagensOk) $('#rtIaNota').textContent = 'A leitura dos especialistas precisa do Studio aberto no Claude, com envio de imagens liberado. Os especialistas também atendem em Agentes.';
  }
  $<HTMLButtonElement>('#rtPerg').onclick = async () => {
    if (!st.img) return;
    const p = PERSONAS.find((x) => x.id === st.pessoa)!, pedido = $<HTMLTextAreaElement>('#rtPed').value.trim() || PEDIDO_PADRAO[p.id];
    const ajustes = neutro(st.aj) ? 'nenhum' : CONTROLES.filter(([k]) => st.aj[k]).map(([k, , , , r]) => `${r} ${st.aj[k]}`).join(', ');
    const texto = `Papel: ${p.nome} da PRODUCERIA.
${CONTEXTO}
${p.guia}

Imagem anexada: ${st.nome}, ${st.iw} x ${st.ih} px${st.ppi ? `, ${st.ppi} ppi gravados no arquivo` : ', ppi não gravado'}. Ajustes já aplicados no Studio: ${ajustes}. A imagem foi reduzida só para o envio; as contas valem para o tamanho original.
Descreva em uma linha o que vê antes de opinar. Responda direto, com listas curtas.

PEDIDO
${pedido}`;
    ctrl = new AbortController(); botoesIA();
    $('#rtPara').hidden = false; $('#rtCopia').hidden = true;
    $('#rtResp').textContent = 'Lendo a imagem…';
    try {
      const blob = await imagemParaIA(neutro(st.aj) ? st.img : st.ajustada);
      st.resposta = await conversar([{ role: 'user', content: texto }], { ferramentas: FERRAMENTAS_IMAGEM, imagens: [blob], signal: ctrl.signal, aoEscrever: (t) => { $('#rtResp').textContent = t; } });
      $('#rtResp').textContent = st.resposta;
    } catch (e) {
      const x = e as ErroIA & { parcial?: string; cancelada?: boolean };
      st.resposta = x.parcial || '';
      $('#rtResp').textContent = (st.resposta ? st.resposta + '\n\n' : '') + (x.cancelada ? 'Leitura interrompida.' : e instanceof ErroIA ? e.message : 'A leitura falhou. Tente de novo.');
    } finally {
      ctrl = null; $('#rtPara').hidden = true; $('#rtCopia').hidden = !st.resposta; botoesIA();
    }
  };
  $('#rtPara').onclick = () => ctrl?.abort();
  $('#rtCopia').onclick = async () => { try { await navigator.clipboard.writeText(st.resposta); avisar('Resposta copiada.'); } catch { avisar('Não consegui copiar.'); } };

  foco();
  aceitaImagens().then((ok) => { imagensOk = ok; botoesIA(); });
  return () => { vivo = false; cancelAnimationFrame(quadro); ctrl?.abort(); st.img?.close(); st.img = null; };
}
