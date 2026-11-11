// Biblioteca: guias de marca, masters, fontes, specs e documentos do hub, guardados como arquivos do Studio.
import { esc, int, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { armazem, quemSou, nomes, tamanho, LIMITE, ERROS_ENVIO, type Armazem } from '../lib/arquivos';
import { seletor, comId } from './dom';
import { kpis, confirmarNoBotao } from '../componentes';
import { navOficina, cabecalho } from './oficina';

export const CATEGORIAS = ['Guia de marca', 'Key visual / master', 'Fontes', 'Specs de veículo e formato', 'Glossário e regras de texto', 'Contratos e cadastros', 'Certidões e habilitação', 'Outro'];
export const HUB = 'Hub Produceria';
export interface Arquivo { id: string; assetId?: string; url?: string; nome: string; tipo?: string; tamanho?: number; categoria: string; cliente?: string; em: string; autor?: string | null; nota?: string }

export function filtrar(L: Arquivo[], cliente: string, categoria: string) {
  return L.filter((a) => (!cliente || (a.cliente || HUB) === cliente) && (!categoria || a.categoria === categoria)).sort((a, b) => b.em.localeCompare(a.em));
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('biblioteca')}<div class="wrap vc bi">
  ${cabecalho('Biblioteca', 'Marcas, masters e specs', 'O acervo que faz o craft render: guias de marca, KVs e masters para reaproveitar, fontes, specs de veículos e formatos, regras de texto e os documentos do hub. Quanto mais completo, mais barato e rápido fica adaptar.')}
  <div id="biK"></div>
  <div class="lc-box bi-envio"><span class="lab">Enviar para a biblioteca</span><div id="biU"><p class="note">Conectando o armazenamento de arquivos…</p></div></div>
  <p class="sr" id="biLive" aria-live="polite" aria-atomic="true"></p>
  <div class="acts" role="group" aria-label="Filtrar por cliente" id="biC"></div>
  <div class="acts" role="group" aria-label="Filtrar por tipo" id="biT"></div>
  <div id="biL"><p class="note">Carregando…</p></div></div>`;
  const $ = seletor(root);
  let A: Arquivo[] = [], db: Banco | null = null, arm: Armazem | null = null, carregado = false;
  let cat = CATEGORIAS[0], fCli = '', fCat = '', enviando = '', autores: Record<string, string> = {};
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#biLive').textContent = t; };
  const clientes = () => [...new Set(A.map((a) => a.cliente || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  function envio() {
    const u = $('#biU');
    if (!arm) { u.innerHTML = '<p class="note">Envio de arquivos disponível para quem edita o Studio, com ele aberto no Claude. Peça acesso de edição ao responsável.</p>'; return; }
    const cli = (root.querySelector<HTMLInputElement>('#biCli')?.value) ?? '';
    u.innerHTML = `<div class="f bi-cli"><label for="biCli">Cliente <span class="note">(vazio = documento do hub)</span></label><input id="biCli" list="biCliL" value="${esc(cli)}" placeholder="Ex.: Sicredi, Vivo"><datalist id="biCliL">${clientes().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="acts" role="group" aria-label="Tipo de documento">${CATEGORIAS.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${cat === c}">${esc(c)}</button>`).join('')}</div>
    <label class="bi-zona" id="biZ"><span><b>${enviando ? `Enviando ${esc(enviando)}…` : 'Arraste arquivos aqui ou clique para escolher'}</b></span><span class="note">PDF, imagens, vídeos curtos, fontes, CSV, Markdown, JSON ou texto · até 20 MB cada · entra como “${esc(cat)}”</span><input type="file" id="biF" multiple class="sr"></label>`;
  }

  function lista() {
    $('#biK').innerHTML = `<div class="kpis">${kpis([
      { rotulo: 'Arquivos', valor: `<b>${int(A.length)}</b>` },
      { rotulo: 'Clientes com acervo', valor: `<b>${int(clientes().length)}</b>` },
      { rotulo: 'Masters e KVs', valor: `<b>${int(A.filter((a) => a.categoria === 'Key visual / master').length)}</b>`, nota: 'base para desdobramento e reaproveitamento' },
    ])}</div>`;
    $('#biC').innerHTML = [['', 'Todos'], [HUB, HUB], ...clientes().map((c) => [c, c])].map(([v, t]) => `<button type="button" class="chip" data-fcli="${esc(v)}" aria-pressed="${fCli === v}">${esc(t)}</button>`).join('');
    $('#biT').innerHTML = [['', 'Todos os tipos'], ...CATEGORIAS.map((c) => [c, c])].map(([v, t]) => `<button type="button" class="chip" data-fcat="${esc(v)}" aria-pressed="${fCat === v}">${esc(t)}</button>`).join('');
    const L = filtrar(A, fCli, fCat);
    $('#biL').innerHTML = !carregado ? '<p class="note">Carregando…</p>' : !L.length ? `<p class="note">${A.length ? 'Nada neste filtro.' : 'A biblioteca está vazia. Comece pelo guia de marca e pelos masters dos clientes recorrentes.'}</p>`
      : `<ul class="vc-l">${L.map((a) => `<li class="bi-it"><span class="vc-c"><a class="cn-f" href="${esc(a.url || '/_blob/' + a.assetId)}" target="_blank" rel="noopener">${esc(a.nome)}<span class="sr"> (abre em nova aba)</span></a>
        <span class="note">${esc(a.categoria)}${a.cliente ? ' · ' + esc(a.cliente) : ''} · ${a.tamanho ? tamanho(a.tamanho) + ' · ' : ''}${dt(a.em)}${a.autor && autores[a.autor] ? ' · ' + esc(autores[a.autor]) : ''}${a.nota ? ' · ' + esc(a.nota) : ''}</span></span>
        <button type="button" class="lnk perigo" data-apaga="${esc(a.id)}">Apagar</button></li>`).join('')}</ul>`;
    $('#biL').querySelectorAll<HTMLButtonElement>('[data-apaga]').forEach((b) => confirmarNoBotao(b, 'Apagar de vez?', () => apagar(b.dataset.apaga!)));
  }

  async function apagar(id: string) {
    const a = A.find((x) => x.id === id);
    if (!a || !db) return;
    try { if (a.assetId) await arm?.delete(a.assetId); }
    catch (e) { const c = (e as { code?: string })?.code; if (c !== 'not_found') { avisar('Não foi possível apagar o arquivo: ' + (c === 'not_uploader' ? 'só quem enviou pode apagar.' : 'tente de novo.')); return; } }
    try { await db.collection('biblioteca').doc(id).delete(); avisar(`${a.nome} apagado.`); } catch { avisar('Não foi possível apagar o registro.'); }
  }

  async function enviar(fs: FileList | File[]) {
    if (!arm || !db) return;
    const cli = root.querySelector<HTMLInputElement>('#biCli')?.value.trim() || undefined, autor = await quemSou();
    let n = 0;
    for (const f of [...fs]) {
      if (f.size > LIMITE) { avisar(`${f.name}: acima de 20 MB. Para vídeos grandes, guarde o link do Frame.io ou do Drive como nota.`); continue; }
      enviando = f.name; envio();
      try {
        const r = await arm.upload(f), id = 'arq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await db.collection('biblioteca').doc(id).set({ id, assetId: r.id, url: r.url, nome: f.name, tipo: r.contentType || f.type, tamanho: r.sizeBytes ?? f.size, categoria: cat, em: new Date().toISOString(), autor, ...(cli ? { cliente: cli } : {}) });
        n++;
      } catch (e) { avisar(`${f.name}: ${ERROS_ENVIO[(e as { code?: string })?.code || ''] || 'não foi possível enviar. Tente de novo.'}`); }
    }
    enviando = ''; envio();
    if (n) avisar(n === 1 ? 'Arquivo guardado.' : `${n} arquivos guardados.`);
  }

  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.cat) { cat = b.dataset.cat; envio(); root.querySelector<HTMLElement>(`[data-cat="${CSS.escape(cat)}"]`)?.focus(); return; }
    if (b.dataset.fcli !== undefined) { fCli = b.dataset.fcli; lista(); return; }
    if (b.dataset.fcat !== undefined) { fCat = b.dataset.fcat; lista(); }
  });
  root.addEventListener('change', (ev) => { const t = ev.target as HTMLInputElement; if (t.id === 'biF' && t.files) { enviar(t.files); t.value = ''; } });
  root.addEventListener('dragover', (ev) => { if ((ev.target as HTMLElement).closest('#biZ')) { ev.preventDefault(); $('#biZ').classList.add('over'); } });
  root.addEventListener('dragleave', (ev) => { if ((ev.target as HTMLElement).closest('#biZ')) $('#biZ').classList.remove('over'); });
  root.addEventListener('drop', (ev) => { if ((ev.target as HTMLElement).closest('#biZ')) { ev.preventDefault(); $('#biZ').classList.remove('over'); if (ev.dataTransfer?.files) enviar(ev.dataTransfer.files); } });

  lista();
  (async () => {
    [db, arm] = await Promise.all([banco(), armazem()]);
    envio();
    if (!db) { carregado = true; lista(); return; }
    offs.push(db.collection<Arquivo>('biblioteca').onSnapshot(async (s) => {
      A = s.docs.map(comId); carregado = true; lista();
      const faltam = A.map((a) => a.autor || '').filter((x) => x && !autores[x]);
      if (faltam.length) { autores = { ...autores, ...(await nomes(faltam)) }; lista(); }
    }, () => { carregado = true; lista(); }));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
