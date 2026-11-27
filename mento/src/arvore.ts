// A reação em cadeia como árvore que se abre: MENTO → equipe → casas → quem decide e quem anuncia. Tamanho fixo de
// leitura (o texto nunca encolhe), um galho por vez, caminho aceso até a MENTO e navegação completa pelo teclado
// (padrão de árvore do WAI-ARIA: setas, Enter, espaço, Home/End).
import { ZERO, caminho, type Rede, type Multiverso, type No } from './rede';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const curto = (s = '', n = 34) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const COL = 296, CARD_W = 248, CARD_H = 56, ROW = 68, PAD = 20, LIM0 = 6;

export type TipoVisual = 'zero' | 'equipe' | 'anunciante' | 'agencia' | 'veiculo' | 'decide' | 'pessoa' | 'empresa';
export const tipoVisual = (n: No): TipoVisual => n.tipo === 'zero' ? 'zero' : n.tipo === 'equipe' ? 'equipe' : n.tipo === 'contato' ? (n.nivel === 'decide' ? 'decide' : 'pessoa') : n.anunciante ? 'anunciante' : n.agencia ? 'agencia' : n.veiculo ? 'veiculo' : 'empresa';
const ROTULO: Record<TipoVisual, string> = { zero: 'Ponto zero', equipe: 'Equipe', anunciante: 'Anunciante', agencia: 'Agência', veiculo: 'Veículo', decide: 'Quem contrata', pessoa: 'Pessoa', empresa: 'Empresa' };
const ICONE: Record<TipoVisual, string> = { zero: '', equipe: 'i-pessoa', anunciante: 'i-anunciante', agencia: 'i-agencia', veiculo: 'i-veiculo', decide: 'i-pessoa', pessoa: 'i-pessoa', empresa: 'i-empresa' };

interface Lin { id: string; nivel: number; y: number; pai?: string; mais?: { pai: string; resto: number } }

export interface Arvore { desenhar(): void; abrirAte(id: string): void; melhores(): void; recolher(): void }

export function montarArvore(el: HTMLElement, fonte: () => { R: Rede; M: Multiverso } | null, o: { aoEscolher(id: string): void; sel(): string; icones: string; ocultos?(): Set<string> }): Arvore {
  const abertos = new Set<string>([ZERO]), limite = new Map<string, number>();
  let foco = ZERO, equipeAberta = false, centrado = false;

  const filhos = (R: Rede, M: Multiverso, id: string) => {
    const L: string[] = []; for (const [x, p] of M.pai) if (p.id === id) L.push(x);
    const oc = o.ocultos?.() || new Set<string>();
    return L.filter((x) => !oc.has(tipoVisual(R.nos.get(x)!))).sort((a, b) => R.nos.get(b)!.nota - R.nos.get(a)!.nota || R.nos.get(a)!.nome.localeCompare(R.nos.get(b)!.nome, 'pt-BR'));
  };

  /** As linhas visíveis, em ordem, com o nível e a posição vertical (o pai fica no meio dos filhos). */
  function linhas(R: Rede, M: Multiverso): Lin[] {
    const out: Lin[] = []; let linha = 0;
    const visita = (id: string, nivel: number, pai?: string): number => {
      const me: Lin = { id, nivel, y: 0, pai }; out.push(me);
      const fs = abertos.has(id) ? filhos(R, M, id) : [];
      if (!fs.length) { me.y = linha++ * ROW; return me.y; }
      const lim = limite.get(id) || LIM0, ys = fs.slice(0, lim).map((f) => visita(f, nivel + 1, id));
      if (fs.length > lim) { out.push({ id: id + '::mais', nivel: nivel + 1, y: linha++ * ROW, pai: id, mais: { pai: id, resto: fs.length - lim } }); }
      me.y = (ys[0] + ys[ys.length - 1]) / 2; return me.y;
    };
    visita(ZERO, 0); return out;
  }

  function desenhar() {
    const d = fonte(); if (!d) { el.innerHTML = '<p class="nota">A rede ainda está carregando.</p>'; return; }
    const { R, M } = d;
    if (!equipeAberta) { for (const id of M.voltas[1] || []) abertos.add(id); equipeAberta = true; }
    const L = linhas(R, M), sel = o.sel(), aceso = new Set(sel ? caminho(M, sel) : []);
    const prof = Math.max(...L.map((l) => l.nivel)), W = PAD * 2 + prof * COL + CARD_W + 40, H = PAD * 2 + Math.max(...L.map((l) => l.y)) + CARD_H;
    const pos = new Map(L.map((l) => [l.id, { x: PAD + l.nivel * COL, y: PAD + l.y }]));
    let fios = '', cards = '', mais = '';
    for (const l of L) {
      if (!l.pai) continue; const a = pos.get(l.pai)!, b = pos.get(l.id)!;
      const x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2, x2 = b.x, y2 = b.y + CARD_H / 2, mx = (x1 + x2) / 2;
      const on = aceso.has(l.id) && aceso.has(l.pai);
      fios += `<path d="M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" class="av-fio${on ? ' on' : ''}${l.mais ? ' mais' : ''}"/>`;
    }
    const visiveis = L.filter((l) => !l.mais);
    for (const l of L) {
      const p = pos.get(l.id)!;
      if (l.mais) { mais += `<button type="button" class="av-mais" style="left:${p.x}px;top:${p.y + 8}px" data-av-mais="${esc(l.mais.pai)}">+ ver mais ${l.mais.resto}</button>`; continue; }
      const n = R.nos.get(l.id)!, t = tipoVisual(n), fs = filhos(R, M, l.id).length, aberto = abertos.has(l.id), on = aceso.has(l.id);
      const pai = l.pai && M.pai.get(l.id)?.rotulo;
      const posI = visiveis.indexOf(l) + 1;
      cards += `<div class="av-c t-${t}${on ? ' on' : ''}${l.id === sel ? ' sel' : ''}" style="left:${p.x}px;top:${p.y}px" role="treeitem" aria-level="${l.nivel + 1}" aria-posinset="${posI}" aria-setsize="${visiveis.length}"${fs ? ` aria-expanded="${aberto}"` : ''} aria-selected="${l.id === sel}" tabindex="${l.id === foco ? 0 : -1}" data-av="${esc(l.id)}" aria-label="${esc(n.nome)}, ${ROTULO[t]}${n.nota && n.tipo !== 'zero' && n.tipo !== 'equipe' ? ', nota ' + n.nota : ''}${fs ? `, ${fs} ligações` : ''}">
  <span class="av-i" aria-hidden="true">${t === 'zero' ? '<b>M</b>' : `<svg viewBox="-12 -12 24 24"><use href="#${ICONE[t]}" x="-12" y="-12" width="24" height="24"/></svg>`}${t === 'decide' ? '<i class="av-selo">★</i>' : ''}</span>
  <span class="av-t"><b>${esc(curto(n.nome))}</b><small>${esc(curto(n.tipo === 'contato' ? [n.sub, n.empresa].filter(Boolean).join(' · ') : pai && l.nivel > 1 ? pai : ROTULO[t], 40))}</small></span>
  ${n.tipo !== 'zero' && n.tipo !== 'equipe' ? `<span class="av-n" title="Nota de oportunidade">${n.nota}</span>` : ''}
  ${fs ? `<button type="button" class="av-x" data-av-x="${esc(l.id)}" tabindex="-1" aria-hidden="true">${aberto ? '−' : fs}</button>` : ''}</div>`;
    }
    el.innerHTML = `<div class="av-palco" style="width:${W}px;height:${H}px"><svg class="av-svg" width="${W}" height="${H}" aria-hidden="true">${o.icones}${fios}</svg><div role="tree" aria-label="Reação em cadeia da MENTO" class="av-arvore">${cards}</div><div class="av-arvore av-extra">${mais}</div></div>`;
    if (!centrado && el.clientHeight) { centrado = true; const r = pos.get(ZERO)!; el.scrollTop = Math.max(0, r.y - el.clientHeight / 2 + CARD_H / 2); }
  }

  /** Abre os galhos até um ponto e o põe em foco. */
  function abrirAte(id: string) { const d = fonte(); if (!d) return; for (const x of caminho(d.M, id)) abertos.add(x); abertos.delete(id); foco = id; desenhar(); focar(id, true); }
  function focar(id: string, rolar = false) {
    const c = el.querySelector<HTMLElement>(`[data-av="${CSS.escape(id)}"]`); if (!c) return;
    el.querySelectorAll<HTMLElement>('[role=treeitem]').forEach((x) => { x.tabIndex = x === c ? 0 : -1; });
    foco = id; c.focus({ preventScroll: !rolar }); if (rolar) c.scrollIntoView({ block: 'center', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  /** Os melhores caminhos: as três casas mais fortes de cada pessoa da equipe, abertas. */
  function melhores() {
    const d = fonte(); if (!d) return;
    for (const e of d.M.voltas[1] || []) { abertos.add(e); for (const c of filhos(d.R, d.M, e).slice(0, 3)) abertos.add(c); }
    desenhar();
  }
  function recolher() { abertos.clear(); abertos.add(ZERO); equipeAberta = false; centrado = false; limite.clear(); el.scrollLeft = 0; desenhar(); }
  function alternar(id: string) { if (abertos.has(id)) abertos.delete(id); else abertos.add(id); foco = id; desenhar(); focar(id); }

  el.addEventListener('click', (ev) => {
    const t = ev.target as Element;
    const m = t.closest<HTMLElement>('[data-av-mais]'); if (m) { const p = m.dataset.avMais!; limite.set(p, (limite.get(p) || LIM0) + 6); desenhar(); return; }
    const x = t.closest<HTMLElement>('[data-av-x]'); if (x) { alternar(x.dataset.avX!); return; }
    const c = t.closest<HTMLElement>('[data-av]'); if (c) { foco = c.dataset.av!; o.aoEscolher(foco); }
  });
  el.addEventListener('dblclick', (ev) => { const c = (ev.target as Element).closest<HTMLElement>('[data-av]'); if (c) alternar(c.dataset.av!); });
  el.addEventListener('keydown', (ev) => {
    const c = (ev.target as Element).closest?.('[data-av]') as HTMLElement | null; if (!c) return;
    const d = fonte(); if (!d) return; const id = c.dataset.av!, todos = [...el.querySelectorAll<HTMLElement>('[role=treeitem]')].sort((a, b) => a.offsetTop - b.offsetTop || a.offsetLeft - b.offsetLeft), i = todos.indexOf(c);
    const fs = filhos(d.R, d.M, id), aberto = abertos.has(id);
    const ir = (k: number) => { const v = todos[Math.max(0, Math.min(todos.length - 1, k))]; if (v) focar(v.dataset.av!, true); };
    switch (ev.key) {
      case 'ArrowDown': ev.preventDefault(); ir(i + 1); break;
      case 'ArrowUp': ev.preventDefault(); ir(i - 1); break;
      case 'Home': ev.preventDefault(); ir(0); break;
      case 'End': ev.preventDefault(); ir(todos.length - 1); break;
      case 'ArrowRight': ev.preventDefault(); if (fs.length && !aberto) alternar(id); else if (fs.length) focar(fs[0], true); break;
      case 'ArrowLeft': ev.preventDefault(); if (aberto && fs.length) alternar(id); else { const p = d.M.pai.get(id); if (p) focar(p.id, true); } break;
      case 'Enter': ev.preventDefault(); o.aoEscolher(id); break;
      case ' ': ev.preventDefault(); if (fs.length) alternar(id); break;
    }
  });
  return { desenhar, abrirAte, melhores, recolher };
}
