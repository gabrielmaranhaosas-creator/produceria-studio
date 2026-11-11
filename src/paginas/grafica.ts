// Gráfica e acabamento: ficha técnica de impressão, aproveitamento de folha, fechamento de arquivo e pacote do job
// para o plugin Produceria Bridge. As fichas ficam na coleção `fichas`.
import { esc, int, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { seletor, comId } from './dom';
import { confirmarNoBotao } from '../componentes';
import { navOficina, cabecalho, baixarArquivo, nomeArquivo } from './oficina';

const GUIA = 'https://www.printi.com.br/assets/final/pdf/Guia-de-impressao.pdf';
export const SUBSTRATOS = [
  { id: 'couche', nome: 'Couché (brilho ou fosco)', perfil: 'PSO Coated v3 (FOGRA51); ISO Coated v2 (FOGRA39) quando a gráfica pedir', tac: '300% (PSO Coated v3)', dpi: '300 ppi no tamanho final' },
  { id: 'offset', nome: 'Offset / sulfite (sem revestimento)', perfil: 'PSO Uncoated v3 (FOGRA52) ou o indicado pela gráfica', tac: 'menor que no couché: confirmar com a gráfica', dpi: '300 ppi no tamanho final' },
  { id: 'cartao', nome: 'Cartão (triplex, duplex, supremo)', perfil: 'o indicado pela gráfica', tac: 'confirmar com a gráfica', dpi: '300 ppi no tamanho final' },
  { id: 'adesivo', nome: 'Adesivo / vinil', perfil: 'perfil da impressora da gráfica', tac: 'confirmar com a gráfica', dpi: '150 a 300 ppi conforme a distância de leitura' },
  { id: 'lona', nome: 'Lona / grande formato', perfil: 'perfil do RIP da gráfica', tac: 'confirmar com a gráfica', dpi: '100 a 150 ppi no tamanho final (prática usual)' },
  { id: 'digital', nome: 'Impressão digital (toner/jato)', perfil: 'o indicado pela gráfica', tac: 'confirmar com a gráfica', dpi: '300 ppi no tamanho final' },
];
export const PROCESSOS = ['Offset', 'Digital', 'Grande formato', 'Serigrafia', 'Flexografia'];
export const CORES = ['4x0', '4x4', '4x1', '1x0', '1x1', 'CMYK + Pantone', 'Só Pantone'];
export const ACABAMENTOS = [
  { id: 'verniz', nome: 'Verniz localizado (UV)', arquivo: 'Arquivo ou camada separada, na mesma posição da arte, com a área do verniz em 100% de uma cor especial chamada "Verniz". Evite detalhes muito finos.' },
  { id: 'lam-fosca', nome: 'Laminação fosca (BOPP)', arquivo: 'Sem arquivo próprio: indique na ficha. Prova de cor sobre o papel já laminado, se a cor for crítica.' },
  { id: 'lam-brilho', nome: 'Laminação brilho (BOPP)', arquivo: 'Sem arquivo próprio: indique na ficha.' },
  { id: 'softtouch', nome: 'Soft touch', arquivo: 'Sem arquivo próprio: indique na ficha.' },
  { id: 'hot', nome: 'Hot stamping', arquivo: 'Vetor em arquivo/camada separada, 100% de uma cor especial "HotStamping", com a cor da película na ficha. Traços finos dependem do clichê: consulte a gráfica.' },
  { id: 'relevo', nome: 'Relevo seco ou americano', arquivo: 'Vetor separado em cor especial "Relevo", alinhado à arte. A gráfica faz o clichê.' },
  { id: 'faca', nome: 'Corte especial (faca)', arquivo: 'Contorno vetorial em cor especial "Faca", traço fino, em sobreimpressão, em camada separada. Peça o gabarito à gráfica antes de diagramar.' },
  { id: 'dobra', nome: 'Dobra / vinco', arquivo: 'Linhas de dobra marcadas no gabarito (cor especial "Vinco"). Conferir o boneco.' },
  { id: 'grampo', nome: 'Grampo / lombada', arquivo: 'Margem interna maior perto do grampo ou da lombada; em lombada quadrada, peça o cálculo da espessura à gráfica.' },
];
export const CHECKLIST = [
  { t: 'Sangria de 3 mm além do formato final em todo elemento que encosta na borda', fonte: GUIA },
  { t: 'Margem de segurança de 3 mm para textos e logos (o corte varia até 3 mm)', fonte: GUIA },
  { t: 'Arquivo em CMYK; Pantone e RGB convertidos (a não ser quando o Pantone é cor especial pedida)', fonte: GUIA },
  { t: 'Textos e vetores pretos em K 100%', fonte: GUIA },
  { t: 'Grandes áreas pretas em preto chapado (C 30% + K 100%)', fonte: GUIA },
  { t: 'Nunca preto 400% (CMYK a 100%) em texto: causa erro de registro', fonte: GUIA },
  { t: 'Textos abaixo de 8 pt e linhas abaixo de 2 pt em uma cor só', fonte: GUIA },
  { t: 'Fontes em curva ou embutidas no PDF; fontes enviadas junto para a pré-impressão', fonte: GUIA },
  { t: 'PDF/X-1a com marcas de corte e sangria (ou PDF/X-4 quando a gráfica aceita transparência viva)', fonte: GUIA },
  { t: 'Imagens com resolução adequada ao substrato (abaixo de 150 ppi aparecem falhas)', fonte: GUIA },
  { t: 'Perfil de cor e limite de tinta (TAC) do substrato aplicados', fonte: 'https://print.app/resources/icc-profiles/pso-coated-v3' },
  { t: 'Arquivos de acabamento separados, na mesma posição, em cor especial nomeada', fonte: '' },
  { t: 'Boneco conferido: ordem, posição, dobras e número de páginas', fonte: GUIA },
];
export const FOLHAS = [
  { id: '660x960', nome: '66 × 96 cm (BB)', w: 660, h: 960 }, { id: '760x1120', nome: '76 × 112 cm (AA)', w: 760, h: 1120 },
  { id: '640x880', nome: '64 × 88 cm', w: 640, h: 880 }, { id: '480x660', nome: '48 × 66 cm (½ BB)', w: 480, h: 660 }, { id: '330x480', nome: '33 × 48 cm (digital)', w: 330, h: 480 },
];
const PRESETS: [string, number, number, 'px' | 'mm'][] = [['Feed 4:5', 1080, 1350, 'px'], ['Stories 9:16', 1080, 1920, 'px'], ['Quadrado', 1080, 1080, 'px'], ['Banner 300×250', 300, 250, 'px'], ['Banner 728×90', 728, 90, 'px'], ['A4', 210, 297, 'mm'], ['A3', 297, 420, 'mm'], ['Outdoor 9×3 m', 9000, 3000, 'mm'], ['Front-light 4×2 m', 4000, 2000, 'mm']];

export interface Formato { nome: string; largura: number; altura: number; unidade: 'px' | 'mm'; dpi: number }
export interface Ficha {
  id: string; job: string; cliente: string; peca: string; larguraMm: number; alturaMm: number; sangriaMm: number; margemMm: number;
  processo: string; substrato: string; gramatura: string; cores: string; acabamentos: string[]; tiragem: number; obs: string;
  formatos: Formato[]; checados: number[]; em: string; projetoId?: string;
}
export const novaFicha = (): Ficha => ({ id: 'fx-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), job: '', cliente: '', peca: '', larguraMm: 210, alturaMm: 297, sangriaMm: 3, margemMm: 3, processo: 'Offset', substrato: 'couche', gramatura: '150 g/m²', cores: '4x0', acabamentos: [], tiragem: 1000, obs: '', formatos: [], checados: [], em: new Date().toISOString() });
export const numero = (v: string) => Math.max(0, Number(String(v).replace(',', '.')) || 0);
export const px = (mm: number, ppi: number) => Math.round((mm / 25.4) * ppi);

/** Peças por folha numa grade simples (com sangria em cada peça e pinça num lado), testando a peça girada. */
export function aproveitamento(w: number, h: number, folhaW: number, folhaH: number, pinca = 10): { n: number; girado: boolean } {
  const cabe = (W: number, H: number, a: number, b: number) => Math.max(0, Math.floor(W / a)) * Math.max(0, Math.floor(H / b));
  const W = folhaW, H = folhaH - pinca, reto = cabe(W, H, w, h), girado = cabe(W, H, h, w);
  return reto >= girado ? { n: reto, girado: false } : { n: girado, girado: true };
}
export const folhasNecessarias = (tiragem: number, porFolha: number, quebra: number) => (porFolha ? Math.ceil((tiragem / porFolha) * (1 + quebra / 100)) : 0);

export function textoFicha(f: Ficha, folha: (typeof FOLHAS)[number], pinca: number, quebra: number): string {
  const s = SUBSTRATOS.find((x) => x.id === f.substrato)!, W = f.larguraMm + 2 * f.sangriaMm, H = f.alturaMm + 2 * f.sangriaMm, a = aproveitamento(W, H, folha.w, folha.h, pinca);
  return [`FICHA TÉCNICA DE IMPRESSÃO · ${f.job}`, `Peça: ${f.peca}`, `Cliente: ${f.cliente || '—'}`, '',
    `Formato final: ${f.larguraMm} × ${f.alturaMm} mm · sangria ${f.sangriaMm} mm (arquivo ${W} × ${H} mm) · margem de segurança ${f.margemMm} mm`,
    `Processo: ${f.processo} · Cores: ${f.cores}`, `Substrato: ${s.nome} · ${f.gramatura}`, `Perfil de cor: ${s.perfil} · Limite de tinta: ${s.tac}`,
    `Acabamentos: ${f.acabamentos.map((id) => ACABAMENTOS.find((x) => x.id === id)?.nome).join(', ') || 'nenhum'}`,
    `Tiragem: ${f.tiragem} · Folha: ${folha.nome} · ${a.n} por folha${a.girado ? ' (girado)' : ''} · ${folhasNecessarias(f.tiragem, a.n, quebra)} folhas com ${quebra}% de quebra`,
    f.obs ? `Observações: ${f.obs}` : '', '',
    'Arquivo: PDF/X-1a (ou X-4 se aceito), com marcas de corte e sangria. Acabamentos em arquivos separados, cor especial nomeada.',
    `Gerado no PRODUCERia Studio em ${new Date().toLocaleDateString('pt-BR')}. Conferir com a gráfica antes de fechar.`].join('\n');
}
export function pacoteJob(f: Ficha) {
  const s = SUBSTRATOS.find((x) => x.id === f.substrato)!;
  return { job: f.job || f.peca, cliente: f.cliente, peca: f.peca, ficha: { larguraMm: f.larguraMm, alturaMm: f.alturaMm, sangriaMm: f.sangriaMm, perfil: s.perfil.split(' (')[0], dpiMin: f.substrato === 'lona' ? 100 : 300, processo: f.processo.toLowerCase(), cores: f.cores }, formatos: f.formatos };
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('grafica')}<div class="wrap vc gr">
  ${cabecalho('Oficina', 'Gráfica e acabamento', 'Ficha técnica, perfil de cor, fechamento de arquivo e aproveitamento de folha. O que tem regra publicada traz a fonte; o resto é prática usual a confirmar com a gráfica.')}
  <p class="sr" id="grLive" aria-live="polite" aria-atomic="true"></p>
  <div class="gr-grid"><section class="lc-box gr-ficha" id="grF" aria-label="Ficha técnica de impressão"></section><div class="gr-lado"><section class="lc-box gr-folha" id="grA" aria-label="Aproveitamento de folha"></section><section class="lc-box" id="grC" aria-label="Fechamento de arquivo"></section></div></div>
  <section aria-labelledby="gr-p" id="grP"></section>
  <section aria-labelledby="gr-s" id="grS"></section></div>`;
  const $ = seletor(root);
  let f = novaFicha(), salvas: Ficha[] = [], db: Banco | null = null, folhaId = FOLHAS[0].id, pinca = 10, quebra = 5;
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#grLive').textContent = t; };
  const folha = () => FOLHAS.find((x) => x.id === folhaId)!;
  const sub = () => SUBSTRATOS.find((x) => x.id === f.substrato)!;
  const opts = (L: string[], v: string) => L.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const campo = (id: string, rot: string, v: string | number, extra = '') => `<div class="f"><label for="gf-${id}">${rot}</label><input id="gf-${id}" data-f="${id}" value="${esc(String(v))}" ${extra}></div>`;

  function ficha() {
    const W = f.larguraMm + 2 * f.sangriaMm, H = f.alturaMm + 2 * f.sangriaMm, s = sub(), salva = salvas.some((x) => x.id === f.id);
    $('#grF').innerHTML = `<div class="ph"><span class="lab">Ficha técnica de impressão</span><button type="button" class="lnk" id="grNova">Nova ficha</button></div>
    <div class="det fm">${campo('job', 'Job', f.job, 'placeholder="Ex.: Campanha verão 2027"')}${campo('cliente', 'Cliente', f.cliente)}${campo('peca', 'Peça *', f.peca, 'placeholder="Ex.: Folder A4 dobrado"')}
      ${campo('larguraMm', 'Largura final (mm)', f.larguraMm, 'inputmode="decimal" class="num"')}${campo('alturaMm', 'Altura final (mm)', f.alturaMm, 'inputmode="decimal" class="num"')}
      ${campo('sangriaMm', 'Sangria (mm)', f.sangriaMm, 'inputmode="decimal" class="num"')}${campo('margemMm', 'Margem de segurança (mm)', f.margemMm, 'inputmode="decimal" class="num"')}
      <div class="f"><label for="gf-processo">Processo</label><select id="gf-processo" data-f="processo">${opts(PROCESSOS, f.processo)}</select></div>
      <div class="f"><label for="gf-cores">Cores</label><select id="gf-cores" data-f="cores">${opts(CORES, f.cores)}</select></div>
      <div class="f"><label for="gf-substrato">Substrato</label><select id="gf-substrato" data-f="substrato">${SUBSTRATOS.map((x) => `<option value="${x.id}"${x.id === f.substrato ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
      ${campo('gramatura', 'Gramatura', f.gramatura)}</div>
    <div class="gr-spec" id="grSpec"><p><b>Arquivo:</b> ${W} × ${H} mm · ${px(W, 300)} × ${px(H, 300)} px a 300 ppi</p><p><b>Perfil:</b> ${esc(s.perfil)}</p><p><b>Limite de tinta:</b> ${esc(s.tac)} · <b>Resolução:</b> ${esc(s.dpi)}</p></div>
    <div><span class="lab">Acabamentos</span><div class="acts" role="group" aria-label="Acabamentos">${ACABAMENTOS.map((a) => `<button type="button" class="chip" data-acab="${a.id}" aria-pressed="${f.acabamentos.includes(a.id)}">${esc(a.nome)}</button>`).join('')}</div>
      ${f.acabamentos.length ? `<ul class="vc-l gr-acab">${f.acabamentos.map((id) => { const a = ACABAMENTOS.find((x) => x.id === id)!; return `<li><b>${esc(a.nome)}</b><span class="note">${esc(a.arquivo)}</span></li>`; }).join('')}</ul>` : ''}</div>
    <div class="f"><label for="gf-obs">Observações para a gráfica</label><textarea id="gf-obs" data-f="obs" rows="2" placeholder="Ex.: prova de cor contratual, entrega paletizada, embalagem por 100">${esc(f.obs)}</textarea></div>
    <div class="acts"><button type="button" id="grSalvar">${salva ? 'Atualizar ficha' : 'Salvar ficha'}</button><button type="button" class="ghost sm" id="grTxt">Baixar ficha (.txt)</button></div>`;
  }
  function spec() {
    const W = f.larguraMm + 2 * f.sangriaMm, H = f.alturaMm + 2 * f.sangriaMm, s = sub(), el = root.querySelector('#grSpec');
    if (el) el.innerHTML = `<p><b>Arquivo:</b> ${W} × ${H} mm · ${px(W, 300)} × ${px(H, 300)} px a 300 ppi</p><p><b>Perfil:</b> ${esc(s.perfil)}</p><p><b>Limite de tinta:</b> ${esc(s.tac)} · <b>Resolução:</b> ${esc(s.dpi)}</p>`;
  }
  function folhaHTML() {
    const W = f.larguraMm + 2 * f.sangriaMm, H = f.alturaMm + 2 * f.sangriaMm, a = aproveitamento(W, H, folha().w, folha().h, pinca), n = folhasNecessarias(f.tiragem, a.n, quebra);
    const foco = (document.activeElement as HTMLElement | null)?.id;
    $('#grA').innerHTML = `<span class="lab">Aproveitamento de folha</span><div class="det fm">
      <div class="f"><label for="ga-folha">Folha</label><select id="ga-folha">${FOLHAS.map((x) => `<option value="${x.id}"${x.id === folhaId ? ' selected' : ''}>${x.nome}</option>`).join('')}</select></div>
      <div class="f"><label for="gf-tiragem">Tiragem</label><input id="gf-tiragem" data-f="tiragem" class="num" inputmode="numeric" value="${f.tiragem}"></div>
      <div class="f"><label for="ga-pinca">Pinça (mm)</label><input id="ga-pinca" class="num" inputmode="decimal" value="${pinca}"></div>
      <div class="f"><label for="ga-quebra">Quebra (%)</label><input id="ga-quebra" class="num" inputmode="decimal" value="${quebra}"></div></div>
      <div class="gr-num" aria-live="polite"><span><b class="d num">${int(a.n)}</b><span class="note">peças por folha${a.girado ? ' (girado)' : ''}</span></span><span><b class="d num">${int(n)}</b><span class="note">folhas para ${int(f.tiragem)} un.</span></span></div>
      <p class="note">Conta simples em grade, com sangria em cada peça e pinça num lado. A imposição final (marcas, sobras, sentido da fibra) é da gráfica.</p>`;
    if (foco) root.querySelector<HTMLElement>('#' + foco)?.focus();
  }
  function checklist() {
    $('#grC').innerHTML = `<div class="ph"><span class="lab">Fechamento de arquivo</span><span class="note num">${f.checados.length}/${CHECKLIST.length}</span></div>
    <ul class="gr-check">${CHECKLIST.map((c, i) => `<li><label><input type="checkbox" data-check="${i}" ${f.checados.includes(i) ? 'checked' : ''}><span>${esc(c.t)}${c.fonte ? ` · <a class="cn-f" href="${esc(c.fonte)}" target="_blank" rel="noopener">fonte<span class="sr"> (abre em nova aba)</span></a>` : '<span class="note"> · prática usual, confirmar com a gráfica</span>'}</span></label></li>`).join('')}</ul>`;
  }
  function pacote() {
    $('#grP').innerHTML = `<div class="ph"><h2 class="d d-sub" id="gr-p">Pacote do job para o Photoshop</h2><span class="note">o plugin Produceria Bridge lê este arquivo</span></div>
    <p class="note">Liste os formatos do desdobramento. O plugin confere o documento contra a ficha acima e gera uma base de cada formato a partir do KV.</p>
    ${f.formatos.length ? `<ul class="vc-l">${f.formatos.map((x, i) => `<li class="gr-fmt"><input aria-label="Nome do formato" data-fmt="${i}" data-k="nome" value="${esc(x.nome)}"><input class="num" aria-label="Largura" inputmode="decimal" data-fmt="${i}" data-k="largura" value="${x.largura}"><span class="note">×</span><input class="num" aria-label="Altura" inputmode="decimal" data-fmt="${i}" data-k="altura" value="${x.altura}">
      <select aria-label="Unidade" data-fmt="${i}" data-k="unidade"><option value="px"${x.unidade === 'px' ? ' selected' : ''}>px</option><option value="mm"${x.unidade === 'mm' ? ' selected' : ''}>mm</option></select><button type="button" class="lnk" data-tira="${i}">Tirar</button></li>`).join('')}</ul>` : ''}
    <div class="acts">${PRESETS.map(([n], i) => `<button type="button" class="ghost sm" data-preset="${i}">+ ${esc(n)}</button>`).join('')}<button type="button" class="ghost sm" data-preset="-1">+ Outro</button></div>
    <div class="acts"><button type="button" class="sm" id="grJSON" ${f.peca.trim() ? '' : 'disabled'}>Baixar pacote do job (.json)</button></div>`;
  }
  function lista() {
    $('#grS').innerHTML = salvas.length ? `<div class="ph"><h2 class="d d-sub" id="gr-s">Fichas salvas</h2><span class="note num">${salvas.length}</span></div>
    <ul class="vc-l">${[...salvas].sort((a, b) => b.em.localeCompare(a.em)).map((x) => `<li class="gr-salva"><span class="vc-c"><b>${esc(x.peca)}</b><span class="note">${esc(x.job || 'sem job')}${x.cliente ? ' · ' + esc(x.cliente) : ''} · ${x.larguraMm}×${x.alturaMm} mm · ${esc(x.cores)} · ${x.checados.length}/${CHECKLIST.length} conferidos · ${dt(x.em)}</span></span>
      <span class="tag ${x.checados.length === CHECKLIST.length ? 'ok' : 'w'}">${x.checados.length === CHECKLIST.length ? 'Pronta' : 'Em fechamento'}</span><button type="button" class="ghost sm" data-abrir="${esc(x.id)}">Abrir</button><button type="button" class="lnk perigo" data-apaga="${esc(x.id)}">Apagar</button></li>`).join('')}</ul>` : '';
    $('#grS').querySelectorAll<HTMLButtonElement>('[data-apaga]').forEach((b) => confirmarNoBotao(b, 'Confirmar', async () => { if (db) { await db.collection('fichas').doc(b.dataset.apaga!).delete().catch(() => avisar('Não foi possível apagar.')); avisar('Ficha apagada.'); } }));
  }
  const tudo = () => { ficha(); folhaHTML(); checklist(); pacote(); lista(); };

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    const k = t.dataset.f as keyof Ficha | undefined;
    if (k) {
      const num = ['larguraMm', 'alturaMm', 'sangriaMm', 'margemMm'].includes(k), v = k === 'tiragem' ? Math.round(numero(t.value)) : num ? numero(t.value) : t.value;
      (f as unknown as Record<string, unknown>)[k] = v;
      if (num || k === 'substrato') spec();
      if (num || k === 'tiragem') folhaHTML();
      if (k === 'peca') { const b = root.querySelector<HTMLButtonElement>('#grJSON'); if (b) b.disabled = !f.peca.trim(); }
      return;
    }
    if (t.id === 'ga-pinca') { pinca = numero(t.value); folhaHTML(); }
    else if (t.id === 'ga-quebra') { quebra = numero(t.value); folhaHTML(); }
    else if (t.dataset.fmt) { const x = f.formatos[Number(t.dataset.fmt)], kk = t.dataset.k as 'nome' | 'largura' | 'altura'; if (kk === 'nome') x.nome = t.value; else x[kk] = numero(t.value); }
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.f === 'substrato' || t.dataset.f === 'processo' || t.dataset.f === 'cores') { (f as unknown as Record<string, unknown>)[t.dataset.f] = t.value; spec(); return; }
    if (t.id === 'ga-folha') { folhaId = t.value; folhaHTML(); return; }
    if (t.dataset.check) { const i = Number(t.dataset.check); f.checados = t.checked ? [...f.checados, i] : f.checados.filter((x) => x !== i); root.querySelector('#grC .ph .num')!.textContent = `${f.checados.length}/${CHECKLIST.length}`; return; }
    if (t.dataset.fmt && t.dataset.k === 'unidade') { const x = f.formatos[Number(t.dataset.fmt)]; x.unidade = t.value as 'px' | 'mm'; x.dpi = x.unidade === 'mm' ? 300 : 72; }
  });
  root.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    const d = b.dataset;
    if (d.acab) { f.acabamentos = f.acabamentos.includes(d.acab) ? f.acabamentos.filter((x) => x !== d.acab) : [...f.acabamentos, d.acab]; ficha(); root.querySelector<HTMLElement>(`[data-acab="${d.acab}"]`)?.focus(); return; }
    if (d.preset) { const p = PRESETS[Number(d.preset)]; f.formatos.push(p ? { nome: p[0], largura: p[1], altura: p[2], unidade: p[3], dpi: p[3] === 'mm' ? 300 : 72 } : { nome: 'Formato', largura: 1000, altura: 1000, unidade: 'px', dpi: 72 }); pacote(); return; }
    if (d.tira) { f.formatos.splice(Number(d.tira), 1); pacote(); return; }
    if (d.abrir) { const x = salvas.find((s) => s.id === d.abrir); if (x) { f = JSON.parse(JSON.stringify({ ...novaFicha(), ...x })); tudo(); $<HTMLElement>('#gf-peca').focus(); avisar(`Ficha ${x.peca} aberta.`); } return; }
    if (b.id === 'grNova') { f = novaFicha(); tudo(); $<HTMLElement>('#gf-job').focus(); return; }
    if (b.id === 'grTxt') { const m = await baixarArquivo(`ficha-${nomeArquivo(f.peca || 'peca', 'peca')}.txt`, textoFicha(f, folha(), pinca, quebra)); if (m) avisar(m); return; }
    if (b.id === 'grJSON') { const m = await baixarArquivo(`pacote-${nomeArquivo(f.job || f.peca)}.json`, JSON.stringify(pacoteJob(f), null, 2)); if (m) avisar(m); return; }
    if (b.id === 'grSalvar') {
      if (!f.peca.trim()) { avisar('Dê nome à peça.'); $<HTMLElement>('#gf-peca').focus(); return; }
      if (!db) { avisar('Sem o banco do Studio: a ficha não foi salva. Baixe o .txt.'); return; }
      const ja = salvas.some((x) => x.id === f.id);
      try { await db.collection('fichas').doc(f.id).set({ ...f, em: new Date().toISOString() }); avisar(ja ? 'Ficha atualizada.' : 'Ficha salva.'); b.textContent = 'Atualizar ficha'; } catch { avisar('Não foi possível salvar a ficha.'); }
    }
  });

  tudo();
  (async () => {
    db = await banco();
    if (db) offs.push(db.collection<Ficha>('fichas').onSnapshot((s) => { salvas = s.docs.map(comId).map((x) => ({ ...novaFicha(), ...x })); lista(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
