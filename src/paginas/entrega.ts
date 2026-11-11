// Conferência e entrega: as ferramentas de fechamento do Kit Produceria dentro do Studio.
// - Checar arquivo: medidas, ppi, CMYK, perfil de cor e nome, com os mesmos alertas do núcleo do kit.
// - Nomes e pastas: nomes no padrão CLIENTE_campanha_formato_v01 e a estrutura do job (00_briefing … 05_entrega).
// - Montar entrega: confere os arquivos finais, calcula o sha256, escreve o manifesto e entrega um .zip.
// Os arquivos são lidos no navegador de quem usa; nada é enviado ao banco nem a terceiros.
import { esc, int } from '../lib/formato';
import { seletor, abaNoEndereco } from './dom';
import { navOficina, cabecalho, baixarArquivo } from './oficina';
import { alertasImagem, gerarNomes, proximaVersao, nomeNoPadrao, estruturaJob, manifestoCsv, limpar, ErroKit, MANIFESTO, type InfoImagem, type LinhaEntrega } from '../oficina/kit';
import { lerCabecalho, sha256 } from '../oficina/imagem';
import { zipar } from '../oficina/zip';
import { GRUPOS } from './desdobra';

type Aba = 'checar' | 'nomes' | 'entrega';
const ABAS: [Aba, string][] = [['checar', 'Checar arquivo'], ['nomes', 'Nomes e pastas'], ['entrega', 'Montar entrega']];
const EXTENSOES = ['psd', 'png', 'jpg', 'pdf', 'ai', 'indd', 'tif', 'mp4', 'mov', 'aep', 'blend'];
const CABECALHO_BYTES = 2 * 1024 * 1024; // EXIF, ICC e SOF ficam no começo do arquivo
const kb = (n: number) => n / 1024;
const tam = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const cm = (px: number, ppi: number) => ((px / ppi) * 2.54).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Nome do pacote: como `limpar`, mas mantém o _ do padrão (Sicredi_Natal_entrega_v01). */
export const nomePacote = (s: string) => s.replace(/\.zip$/i, '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');

export interface Conferido { info: InfoImagem | null; arquivo: string; tamanho: number; alertas: string[] }
/** Confere um arquivo pelo cabeçalho. Formatos sem leitura (PDF, AI, TIFF…) passam só pela conferência de nome. */
export async function conferir(f: File): Promise<Conferido> {
  const cab = lerCabecalho(new Uint8Array(await f.slice(0, CABECALHO_BYTES).arrayBuffer()));
  if (!cab) return { info: null, arquivo: f.name, tamanho: f.size, alertas: nomeNoPadrao(f.name) ? [] : ['Nome fora do padrão CLIENTE_campanha_formato_v01.'] };
  const info: InfoImagem = { arquivo: f.name, ...cab, tamanhoKb: kb(f.size) };
  return { info, arquivo: f.name, tamanho: f.size, alertas: alertasImagem(info) };
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('entrega')}<div class="wrap vc et">
  ${cabecalho('Oficina · ferramenta da casa', 'Conferência e entrega', 'O fechamento do arte-finalista: conferir o arquivo, nomear no padrão, montar a pasta do job e entregar com manifesto. Tudo lido no seu computador.')}
  <div class="pills lc-abas" role="tablist" aria-label="Conferência e entrega">${ABAS.map(([v, t]) => `<button type="button" role="tab" id="et-tab-${v}" aria-controls="etO" data-aba="${v}">${t}</button>`).join('')}</div>
  <div id="etO" role="tabpanel"></div>
  <p class="sr" id="etLive" aria-live="polite" aria-atomic="true"></p></div>`;
  const $ = seletor(root);
  const avisar = (t: string) => { $('#etLive').textContent = t; };
  let aba: Aba = 'checar', entrega: { f: File; c: Conferido }[] = [];
  const nav = abaNoEndereco<Aba>(ABAS.map((a) => a[0]), 'checar', (a) => { aba = a; render(); });
  aba = nav.inicial;
  root.querySelectorAll<HTMLButtonElement>('[data-aba]').forEach((b) => { b.onclick = () => nav.ir(b.dataset.aba as Aba); });

  const zona = (id: string, texto: string, nota: string, aceitar = '') => `<label class="bi-zona" id="${id}Z"><input type="file" id="${id}" multiple class="sr"${aceitar ? ` accept="${aceitar}"` : ''}><b>${texto}</b><span class="note">${nota}</span></label>`;
  const ligarZona = (id: string, receber: (fs: File[]) => void) => {
    const i = $<HTMLInputElement>('#' + id), z = $('#' + id + 'Z');
    i.onchange = () => { receber([...(i.files || [])]); i.value = ''; };
    z.ondragover = (e) => { e.preventDefault(); z.classList.add('over'); };
    z.ondragleave = () => z.classList.remove('over');
    z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); receber([...(e.dataTransfer?.files || [])]); };
  };

  function render() {
    root.querySelectorAll<HTMLElement>('[data-aba]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.aba === aba)); b.setAttribute('aria-pressed', String(b.dataset.aba === aba)); });
    $('#etO').setAttribute('aria-labelledby', 'et-tab-' + aba);
    if (aba === 'checar') checar(); else if (aba === 'nomes') nomes(); else montarEntrega();
  }

  // ---------- Checar arquivo
  function checar() {
    $('#etO').innerHTML = `<div class="et-sec">${zona('etC', 'Solte os arquivos para conferir', 'JPG, PNG, PSD, WebP e GIF são lidos por dentro; PDF, AI e TIFF passam pela conferência de nome')}
      <ul class="vc-l et-lista" id="etCL"></ul>
      <p class="note">Mesmos alertas do Kit Produceria (painel do Photoshop e servidor do Claude). Tamanho de impressão calculado a 300 ppi (impresso) e 150 ppi (grande formato visto de longe).</p></div>`;
    ligarZona('etC', async (fs) => {
      const l = $('#etCL');
      for (const f of fs) {
        try {
          const c = await conferir(f), i = c.info;
          const dados = i ? [i.formato, `${int(i.largura)} × ${int(i.altura)} px`, i.dpi ? `${i.dpi} ppi` : 'ppi não informado', i.cmyk ? 'CMYK' : 'RGB', i.perfilIcc ? 'com perfil ICC' : 'sem perfil', tam(c.tamanho)] : ['cabeçalho não lido', tam(c.tamanho)];
          l.insertAdjacentHTML('afterbegin', `<li class="et-it"><span class="vc-c"><b>${esc(c.arquivo)}</b><span class="note">${dados.map(esc).join(' · ')}</span>
            ${i ? `<span class="note">Impressão: ${cm(i.largura, 300)} × ${cm(i.altura, 300)} cm a 300 ppi · ${cm(i.largura, 150)} × ${cm(i.altura, 150)} cm a 150 ppi</span>` : ''}
            ${c.alertas.length ? `<ul class="et-al">${c.alertas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<span class="tag ok">sem alertas</span>'}
            ${!nomeNoPadrao(c.arquivo) ? `<span class="note">Sugestão de próxima versão: <code>${esc(proximaVersao(c.arquivo))}</code></span>` : ''}</span></li>`);
        } catch { avisar(`Não consegui ler ${f.name}.`); }
      }
      avisar(fs.length === 1 ? `${fs[0].name} conferido.` : `${fs.length} arquivos conferidos.`);
    });
  }

  // ---------- Nomes e pastas
  function nomes() {
    const mem = (() => { try { return JSON.parse(localStorage.getItem('studio.desdobra') || '{}'); } catch { return {}; } })();
    $('#etO').innerHTML = `<div class="et-sec et-duo">
      <form class="et-form" id="etN">
        <label>Cliente<input name="cliente" autocomplete="off" value="${esc(mem.cliente || '')}" placeholder="Sicredi"></label>
        <label>Campanha<input name="campanha" autocomplete="off" value="${esc(mem.campanha || '')}" placeholder="Natal Feliz 2026"></label>
        <div class="et-linha"><label>Versão<input name="versao" type="number" min="1" max="99" value="1"></label>
        <label>Extensão<select name="ext">${EXTENSOES.map((x) => `<option>${x}</option>`).join('')}</select></label></div>
        <fieldset class="dd-campos"><legend class="lab">Formatos</legend>${GRUPOS.map((g) => `<div class="dd-g" role="group" aria-label="${esc(g.titulo)}"><span class="note">${esc(g.titulo)}</span>${g.formatos.map((f) => `<label class="dd-f"><input type="checkbox" name="f" value="${esc(f.nome)}"${g.titulo === 'Digital' ? ' checked' : ''}><span>${esc(f.nome)}</span><span class="note">${f.largura}×${f.altura}</span></label>`).join('')}</div>`).join('')}
          <label>Outros (separados por vírgula)<input name="outros" placeholder="capa-face:820x312, 1200x1200" autocomplete="off"></label></fieldset>
      </form>
      <div class="et-lado">
        <section class="lc-box" aria-labelledby="et-nl"><span class="lab" id="et-nl">Nomes</span><ol class="et-nomes" id="etNL"></ol>
          <div class="acts"><button type="button" id="etCopia">Copiar nomes</button><button type="button" class="lnk" id="etTxt">Baixar .txt</button></div></section>
        <section class="lc-box" aria-labelledby="et-ej"><span class="lab" id="et-ej">Estrutura do job</span>
          <pre class="et-arvore" id="etArv"></pre>
          <div class="acts"><button type="button" id="etEst">Baixar pastas do job (.zip)</button></div>
          <p class="note">Originais nunca são editados. Trabalho em 02_trabalho. Entrega sempre de 05_entrega.</p></section>
        <section class="lc-box" aria-labelledby="et-pv"><label class="lab" id="et-pv" for="etPV">Próxima versão de um arquivo</label>
          <input id="etPV" placeholder="Sicredi_Natal_stories_v03.psd" autocomplete="off"><p class="note" id="etPVr" aria-live="polite"></p></section>
      </div></div>`;
    const form = $<HTMLFormElement>('#etN');
    let lista: string[] = [];
    const atualizar = () => {
      const d = new FormData(form), cli = String(d.get('cliente') || ''), camp = String(d.get('campanha') || '');
      const fmts = [...d.getAll('f').map(String), ...String(d.get('outros') || '').split(',').map((s) => s.trim()).filter(Boolean)];
      try {
        lista = fmts.length ? gerarNomes(cli || 'CLIENTE', camp || 'campanha', fmts, Number(d.get('versao')) || 1, String(d.get('ext'))) : [];
        $('#etNL').innerHTML = lista.length ? lista.map((n) => `<li><code>${esc(n)}</code></li>`).join('') : '<li class="note">Marque um formato.</li>';
      } catch (e) { lista = []; $('#etNL').innerHTML = `<li class="note">${esc(e instanceof ErroKit ? e.message : 'Formato inválido.')}</li>`; }
      const raiz = `${limpar(cli) || 'CLIENTE'}_${limpar(camp) || 'campanha'}`;
      $('#etArv').textContent = [raiz + '/', ...['00_briefing', '01_originais', '02_trabalho', '   psd', '   motion', '   3d', '03_revisao', '04_saidas', '   digital', '   impressao', '05_entrega'].map((p) => '  ' + p + '/'), '  LEIA-ME.txt'].join('\n');
    };
    form.oninput = atualizar; form.onsubmit = (e) => e.preventDefault(); atualizar();
    $('#etCopia').onclick = async () => { try { await navigator.clipboard.writeText(lista.join('\n')); avisar(`${lista.length} nomes copiados.`); } catch { avisar('Não consegui copiar: use Baixar .txt.'); } };
    $('#etTxt').onclick = async () => { if (!lista.length) return; const m = await baixarArquivo('nomes_' + (lista[0].split('_').slice(0, 2).join('_')) + '.txt', lista.join('\r\n') + '\r\n'); if (m) avisar(m); };
    $('#etEst').onclick = async () => {
      const d = new FormData(form);
      try {
        const e = estruturaJob(String(d.get('cliente') || ''), String(d.get('campanha') || ''));
        const m = await baixarArquivo(e[0].caminho.split('/')[0] + '.zip', zipar(e));
        if (m) avisar(m);
      } catch (er) { avisar(er instanceof ErroKit ? er.message : 'Não consegui montar a estrutura.'); }
    };
    $<HTMLInputElement>('#etPV').oninput = (e) => { const v = (e.target as HTMLInputElement).value.trim(); $('#etPVr').innerHTML = v ? `→ <code>${esc(proximaVersao(v))}</code>` : ''; };
  }

  // ---------- Montar entrega
  function montarEntrega() {
    $('#etO').innerHTML = `<div class="et-sec">${zona('etE', 'Solte os arquivos finais da entrega', 'normalmente o conteúdo de 05_entrega')}
      <div class="et-linha"><label>Nome do pacote<input id="etEN" autocomplete="off" placeholder="Sicredi_Natal-Feliz-2026_entrega_v01"></label>
        <label class="et-check"><input type="checkbox" id="etEP" checked> Exigir nome no padrão</label></div>
      <ul class="vc-l et-lista" id="etEL"></ul>
      <div class="acts"><button type="button" id="etEZ" disabled>Baixar entrega (.zip + manifesto)</button><button type="button" class="lnk" id="etEC" hidden>Baixar só o manifesto (.csv)</button><button type="button" class="lnk" id="etEX" hidden>Limpar lista</button></div>
      <p class="note" id="etES" aria-live="polite"></p></div>`;
    ligarZona('etE', async (fs) => {
      for (const f of fs) {
        if (f.name === MANIFESTO || f.name.startsWith('.')) continue;
        if (entrega.some((x) => x.f.name === f.name)) { avisar(`${f.name} já está na lista.`); continue; }
        try { entrega.push({ f, c: await conferir(f) }); } catch { avisar(`Não consegui ler ${f.name}.`); }
      }
      entrega.sort((a, b) => a.f.name.localeCompare(b.f.name));
      listar();
    });
    $<HTMLInputElement>('#etEP').onchange = listar;
    $('#etEX').onclick = () => { entrega = []; listar(); avisar('Lista limpa.'); };
    $('#etEL').onclick = (e) => { const n = (e.target as HTMLElement).closest<HTMLElement>('[data-tira]')?.dataset.tira; if (n) { entrega = entrega.filter((x) => x.f.name !== n); listar(); } };
    $('#etEC').onclick = async () => { const l = await linhas(); if (l) { const m = await baixarArquivo(MANIFESTO, manifestoCsv(l)); if (m) avisar(m); } };
    $<HTMLButtonElement>('#etEZ').onclick = async (ev) => {
      const b = ev.currentTarget as HTMLButtonElement; b.disabled = true;
      try {
        const l = await linhas(true);
        if (!l) return;
        const dados = await Promise.all(entrega.map(async (x) => ({ caminho: x.f.name, dados: new Uint8Array(await x.f.arrayBuffer()) })));
        const nome = (nomePacote($<HTMLInputElement>('#etEN').value) || `entrega_${new Date().toISOString().slice(0, 10)}`) + '.zip';
        b.textContent = 'Montando o zip…';
        const m = await baixarArquivo(nome, zipar([...dados, { caminho: MANIFESTO, dados: manifestoCsv(l) }]));
        if (m) avisar(m);
      } catch { avisar('Não consegui montar a entrega: tente com menos arquivos.'); }
      finally { b.textContent = 'Baixar entrega (.zip + manifesto)'; listar(); }
    };
    listar();
  }
  const fora = () => entrega.filter((x) => !nomeNoPadrao(x.f.name)).map((x) => x.f.name);
  async function linhas(zip = false): Promise<LinhaEntrega[] | null> {
    if (!entrega.length) return null;
    if ($<HTMLInputElement>('#etEP').checked && fora().length) { avisar('Arquivos fora do padrão de nome: ' + fora().join(', ') + '. Corrija ou desmarque "Exigir nome no padrão".'); return null; }
    $('#etES').textContent = zip ? 'Calculando sha256…' : '';
    const l: LinhaEntrega[] = [];
    for (const x of entrega) {
      const i = x.c.info;
      l.push({ arquivo: x.f.name, dimensoes: i ? `${i.largura}x${i.altura}` : '', tamanhoKb: kb(x.f.size), noPadrao: nomeNoPadrao(x.f.name), sha256: await sha256(new Uint8Array(await x.f.arrayBuffer())) });
    }
    $('#etES').textContent = '';
    return l;
  }
  function listar() {
    const el = root.querySelector('#etEL');
    if (!el) return;
    const total = entrega.reduce((s, x) => s + x.f.size, 0), exigir = $<HTMLInputElement>('#etEP').checked, f = fora();
    el.innerHTML = entrega.map(({ f: a, c }) => `<li class="et-it et-ent"><span class="vc-c"><b>${esc(a.name)}</b><span class="note">${c.info ? `${int(c.info.largura)} × ${int(c.info.altura)} px · ` : ''}${tam(a.size)}</span></span>
      <span class="tag ${nomeNoPadrao(a.name) ? 'ok' : exigir ? 'erro' : 'w'}">${nomeNoPadrao(a.name) ? 'no padrão' : 'fora do padrão'}</span><button type="button" class="lnk" data-tira="${esc(a.name)}">tirar<span class="sr"> ${esc(a.name)}</span></button></li>`).join('');
    $<HTMLButtonElement>('#etEZ').disabled = !entrega.length || (exigir && f.length > 0);
    $('#etEC').hidden = $('#etEX').hidden = !entrega.length;
    $('#etES').textContent = entrega.length ? `${entrega.length} arquivo(s) · ${tam(total)}${exigir && f.length ? ` · ${f.length} fora do padrão: renomeie antes de entregar` : ''}` : '';
  }

  render();
  return () => nav.parar();
}
