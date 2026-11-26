// Navegação e acessibilidade: busca geral (Ctrl/⌘+K), atalhos de teclado, ajuda (?), foco ao trocar de tela,
// "pular para o conteúdo" e o roteiro de primeiros passos do Painel.
import type { Registro, Oportunidade } from './crm';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PASSOS = 'mento.passos.ocultos';

export interface UxCtx {
  raiz: HTMLElement;
  vistas: [string, string][];
  bd(): Registro[];
  ops(): Oportunidade[];
  temConexoes(): boolean;
  abrirOp(id: string): void;
  buscarBd(q: string): void;
  verNaRede(nome: string): void;
}
interface Item { tipo: string; titulo: string; sub?: string; ir(): void }

export function montarUx(c: UxCtx) {
  const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T;
  document.body.insertAdjacentHTML('afterbegin', `<a class="pular" href="#conteudo">Pular para o conteúdo</a>`);
  document.body.insertAdjacentHTML('beforeend', `
<dialog class="dlg" id="pal" aria-labelledby="palT"><form method="dialog" class="pal">
 <h2 class="sr" id="palT">Buscar em tudo</h2>
 <input id="palQ" type="search" placeholder="Buscar empresa, pessoa, oportunidade ou tela" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palL" aria-autocomplete="list">
 <ul id="palL" role="listbox" aria-label="Resultados"></ul>
 <p class="nota">↑ ↓ para escolher · Enter para abrir · Esc para fechar</p></form></dialog>
<dialog class="dlg" id="ajuda" aria-labelledby="ajT"><div class="aj"><h2 id="ajT">Atalhos</h2>
 <dl><dt><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> ou <kbd>/</kbd></dt><dd>Buscar em tudo</dd>
 <dt><kbd>1</kbd> a <kbd>7</kbd></dt><dd>Ir para Painel, Dashboard, Big Data, Rede, Funil, Agenda, Equipe</dd>
 <dt><kbd>Backspace</kbd></dt><dd>Voltar à tela anterior</dd>
 <dt><kbd>[</kbd> / <kbd>]</kbd></dt><dd>Recolher tudo / expandir tudo na tela</dd>
 <dt><kbd>N</kbd></dt><dd>Novo alvo no funil</dd>
 <dt><kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd></dt><dd>Mover o card selecionado de etapa no funil</dd>
 <dt><kbd>?</kbd></dt><dd>Esta ajuda</dd><dt><kbd>Esc</kbd></dt><dd>Fechar</dd></dl>
 <form method="dialog"><button class="btn">Entendi</button></form></div></dialog>`);
  $('main.mt, .mt')?.setAttribute('id', 'conteudo');
  $('.topo')?.insertAdjacentHTML('afterbegin', `<button type="button" class="acao voltar" id="voltar" aria-label="Voltar à tela anterior" aria-keyshortcuts="Backspace" hidden>← Voltar</button>`);
  document.body.insertAdjacentHTML('beforeend', `<button type="button" class="topo-btn" id="aoTopo" aria-label="Voltar ao topo" hidden>↑</button>`);
  $('.topo')?.insertAdjacentHTML('beforeend', `<button type="button" class="acao busca-g" id="abrePal" aria-keyshortcuts="Control+K Meta+K /">Buscar <kbd>Ctrl K</kbd></button><button type="button" class="acao" id="abreAj" aria-label="Atalhos de teclado" aria-keyshortcuts="?">?</button>`);

  /* ── busca geral ── */
  const pal = $<HTMLDialogElement>('#pal'), q = $<HTMLInputElement>('#palQ'), lista = $('#palL');
  let itens: Item[] = [], ativo = 0;
  function resultados() {
    const t = norm(q.value.trim()), V: Item[] = c.vistas.map(([k, v]) => ({ tipo: 'Tela', titulo: v, ir: () => { location.hash = '#' + k; } }));
    const B: Item[] = c.bd().map((r) => ({ tipo: r.tipo === 'pessoa' ? 'Pessoa' : r.tipo === 'anunciante' ? 'Anunciante' : r.tipo === 'agencia' ? 'Agência' : 'Veículo', titulo: r.nome, sub: r.tipo === 'pessoa' ? [r.cargo, r.empresa].filter(Boolean).join(' · ') : r.sinal || r.setor, ir: () => c.buscarBd(r.nome) }));
    const O: Item[] = c.ops().map((o) => ({ tipo: 'Funil', titulo: o.nome, sub: [o.contato, o.etapa].filter(Boolean).join(' · '), ir: () => c.abrirOp(o.id) }));
    const todos = [...V, ...O, ...B];
    itens = (t ? todos.filter((i) => norm(`${i.titulo} ${i.sub || ''}`).includes(t)).sort((a, b) => Number(!norm(a.titulo).startsWith(t)) - Number(!norm(b.titulo).startsWith(t))) : [...V, ...O.slice(0, 5)]).slice(0, 12);
    ativo = 0; desenhar();
  }
  function desenhar() {
    lista.innerHTML = itens.map((i, k) => `<li role="option" id="pal-${k}" aria-selected="${k === ativo}" data-k="${k}"><span class="tag">${esc(i.tipo)}</span><b>${esc(i.titulo)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</li>`).join('') || '<li class="nota">Nada encontrado.</li>';
    q.setAttribute('aria-activedescendant', itens.length ? `pal-${ativo}` : '');
    lista.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  const abrirPal = () => { if (pal.open) return; q.value = ''; resultados(); pal.showModal(); q.focus(); };
  const escolher = (k: number) => { const i = itens[k]; if (!i) return; pal.close(); i.ir(); };
  q.addEventListener('input', resultados);
  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); ativo = (ativo + (ev.key === 'ArrowDown' ? 1 : -1) + itens.length) % Math.max(1, itens.length); desenhar(); }
    if (ev.key === 'Enter') { ev.preventDefault(); escolher(ativo); }
  });
  lista.addEventListener('click', (ev) => { const li = (ev.target as Element).closest<HTMLElement>('[data-k]'); if (li) escolher(Number(li.dataset.k)); });
  pal.addEventListener('click', (ev) => { if (ev.target === pal) pal.close(); });
  $('#abrePal').addEventListener('click', abrirPal);
  const aj = $<HTMLDialogElement>('#ajuda');
  $('#abreAj').addEventListener('click', () => aj.showModal());
  aj.addEventListener('click', (ev) => { if (ev.target === aj) aj.close(); });

  /* ── atalhos ── */
  document.addEventListener('keydown', (ev) => {
    const alvo = ev.target as HTMLElement, digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); abrirPal(); return; }
    if (digitando || ev.ctrlKey || ev.metaKey || ev.altKey || pal.open || aj.open) return;
    if (ev.key === '/') { ev.preventDefault(); abrirPal(); }
    else if (ev.key === '?') { ev.preventDefault(); aj.showModal(); }
    else if (ev.key === 'Backspace') { ev.preventDefault(); voltar(); }
    else if (ev.key === '[' || ev.key === ']') { ev.preventDefault(); todas(ev.key === '['); }
    else if (/^[1-7]$/.test(ev.key)) { const v = c.vistas[Number(ev.key) - 1]; if (v) location.hash = '#' + v[0]; }
    else if (ev.key.toLowerCase() === 'n') { location.hash = '#funil'; setTimeout(() => { const d = document.querySelector<HTMLDetailsElement>('[data-vista="funil"] details.como'); if (d) { d.open = true; d.querySelector<HTMLInputElement>('input')?.focus(); } }, 30); }
  });

  /* ── voltar: a pilha das telas visitadas nesta visita ── */
  const pilha: string[] = [];
  function voltar() { if (pilha.length > 1) { pilha.pop(); const v = pilha.pop()!; location.hash = '#' + v; } else location.hash = '#painel'; }
  $('#voltar').addEventListener('click', voltar);
  const topo = $('#aoTopo');
  window.addEventListener('scroll', () => { topo.hidden = window.scrollY < 700; }, { passive: true });
  topo.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); document.querySelector<HTMLElement>('.vista:not([hidden]) h2')?.focus({ preventScroll: true }); });

  /* ── recolher e expandir seções (a escolha fica guardada neste navegador) ── */
  const DOBRA = 'mento.dobras';
  const lerD = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(DOBRA) || '{}'); } catch { return {}; } };
  const gravarD = (d: Record<string, boolean>) => { try { localStorage.setItem(DOBRA, JSON.stringify(d)); } catch { /* */ } };
  const chaveD = (el: Element) => (el.closest('.vista') as HTMLElement | null)?.dataset.vista + ':' + (el.querySelector(':scope > h2, :scope > h3')?.textContent || '').replace(/\s+\d.*$/, '').trim();
  function dobras() {
    const D = lerD();
    document.querySelectorAll<HTMLElement>('.vista').forEach((v) => {
      if (!v.querySelector(':scope > .dobra-acoes')) v.querySelector(':scope > h2')?.insertAdjacentHTML('afterend', '<div class="dobra-acoes"><button type="button" class="lnk" data-dobra-todas="1">Recolher tudo</button><button type="button" class="lnk" data-dobra-todas="0">Expandir tudo</button></div>');
      v.querySelectorAll<HTMLElement>(':scope > div:not(.dobra-acoes), :scope > section, .dois > div, .dash > .gr, :scope > #res > section').forEach((sec) => {
        const h = sec.querySelector<HTMLElement>(':scope > h2, :scope > h3'); if (!h || sec.classList.contains('passos')) return;
        let b = h.querySelector<HTMLButtonElement>('.dobra-b');
        if (!b) { h.insertAdjacentHTML('beforeend', '<button type="button" class="dobra-b" aria-expanded="true"><span class="sr">Recolher ou expandir</span></button>'); b = h.querySelector('.dobra-b')!; sec.classList.add('dobra'); }
        const fechado = !!D[chaveD(sec)]; sec.classList.toggle('recolhido', fechado); b.setAttribute('aria-expanded', String(!fechado));
      });
    });
  }
  function todas(fechar: boolean) { const v = document.querySelector('.vista:not([hidden])'); if (!v) return; const D = lerD(); v.querySelectorAll('.dobra').forEach((s) => { D[chaveD(s)] = fechar; }); gravarD(D); dobras(); }
  document.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest?.('.dobra-b, [data-dobra-todas]') as HTMLElement | null; if (!b) return;
    if (b.dataset.dobraTodas) { todas(b.dataset.dobraTodas === '1'); return; }
    const sec = b.closest('.dobra')!, D = lerD(), k = chaveD(sec); D[k] = !D[k]; gravarD(D); dobras();
  });

  /* ── foco e título ao trocar de tela ── */
  let primeira = true;
  function aoTrocar(vista: string) {
    if (pilha[pilha.length - 1] !== vista) pilha.push(vista);
    const vb = document.getElementById('voltar'); if (vb) vb.hidden = pilha.length < 2;
    const nome = c.vistas.find(([k]) => k === vista)?.[1] || 'Painel';
    document.title = `${nome} · MENTO`;
    if (primeira) { primeira = false; return; }
    const h = document.querySelector<HTMLElement>(`[data-vista="${vista}"] h2`); if (!h) return;
    h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /* ── primeiros passos ── */
  function passos() {
    const el = document.getElementById('pnP'); if (!el) return;
    let ocultos = false; try { ocultos = localStorage.getItem(PASSOS) === '1'; } catch { /* sem armazenamento */ }
    const P: [boolean, string, string][] = [
      [c.ops().length > 0, 'Leve o primeiro alvo ao funil', 'Em Janelas de oportunidade ou no Big Data, clique em "Levar ao funil".'],
      [c.ops().some((o) => o.etapa !== 'alvo'), 'Registre o primeiro contato', 'No Funil, abra o card e use "Registrar e agendar o próximo".'],
      [c.temConexoes(), 'Suba o LinkedIn do Pet e do Thiago', 'Em Equipe, arraste o .zip de cada um: as conexões viram pontes na rede.'],
      [false, 'Compartilhe com a equipe', 'Menu Compartilhar do artefato: Pet e Thiago como Editor ou Colaborador para gravar juntos.'],
    ];
    const feitos = P.filter((p) => p[0]).length;
    el.hidden = ocultos;
    el.innerHTML = `<div class="ps-t"><h3 class="st">Primeiros passos <span class="n">${feitos} de ${P.length}</span></h3><button type="button" class="lnk" id="psX">Esconder</button></div>
  <div class="barra-p" role="progressbar" aria-valuemin="0" aria-valuemax="${P.length}" aria-valuenow="${feitos}" aria-label="Primeiros passos concluídos"><i style="width:${(feitos / P.length) * 100}%"></i></div>
  <ol class="ps">${P.map(([ok, t, d]) => `<li class="${ok ? 'ok' : ''}"><span class="ck" aria-hidden="true">${ok ? '✓' : ''}</span><div><b>${esc(t)}</b><span class="sr">${ok ? ' (feito)' : ' (a fazer)'}</span><p class="nota">${esc(d)}</p></div></li>`).join('')}</ol>`;
  }
  document.addEventListener('click', (ev) => { if ((ev.target as Element).closest?.('#psX')) { try { localStorage.setItem(PASSOS, '1'); } catch { /* */ } passos(); } });

  return { aoTrocar, passos, abrirPal, dobras };
}
