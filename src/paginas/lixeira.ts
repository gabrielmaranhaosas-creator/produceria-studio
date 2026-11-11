// Lixeira: tudo o que as telas apagaram (cópia feita pelo histórico, ver lib/historico.ts), com Restaurar.
import { esc, int, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { restaurar, nomeColecao, type ItemLixeira } from '../lib/historico';
import { seletor, comId } from './dom';
import { vazio, confirmarNoBotao } from '../componentes';

const hora = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc lx">
  <p class="measure">Tudo o que é apagado nas telas do Studio vem para cá, com o conteúdo completo. Restaurar devolve o item para o lugar de onde saiu, do jeito que estava. Descartes (alvos, licitações, oportunidades perdidas) não apagam nada: eles ficam nos filtros "Descartados" ou "Perdidas" de cada tela.</p>
  <div class="acts" role="group" aria-label="Filtrar por origem" id="lxF"></div>
  <p class="sr" id="lxLive" aria-live="polite" aria-atomic="true"></p>
  <div id="lxL"><p class="note">Carregando…</p></div>
  <div class="acts lx-pe"><button type="button" class="ghost sm" id="lxVelhos" hidden>Apagar de vez os itens com mais de 90 dias</button></div></div>`;
  const $ = seletor(root);
  let L: ItemLixeira[] = [], db: Banco | null = null, carregado = false, filtro = '';
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#lxLive').textContent = t; };
  const limite = () => new Date(Date.now() - 90 * 864e5).toISOString();

  function render() {
    const cols = [...new Set(L.map((x) => x.col))].sort();
    $('#lxF').innerHTML = L.length ? [['', `Tudo · ${L.length}`], ...cols.map((c) => [c, `${nomeColecao(c)} · ${L.filter((x) => x.col === c).length}`])]
      .map(([v, t]) => `<button type="button" class="chip" data-lxf="${esc(v)}" aria-pressed="${filtro === v}">${esc(t)}</button>`).join('') : '';
    const V = L.filter((x) => !filtro || x.col === filtro).sort((a, b) => b.em.localeCompare(a.em));
    $('#lxL').innerHTML = !carregado ? '<p class="note">Carregando…</p>' : !V.length
      ? vazio({ titulo: 'A lixeira está vazia', texto: 'Quando algo for apagado em qualquer tela, aparece aqui para ser restaurado.' })
      : `<ul class="vc-l">${V.map((x) => `<li class="lx-it"><span class="vc-c"><b>${esc(x.rotulo)}</b><span class="note">Apagado em ${hora(x.em)} · origem: ${esc(nomeColecao(x.col))}</span></span>
        <button type="button" class="sm" data-lxr="${esc(x.id)}">Restaurar</button></li>`).join('')}</ul>`;
    const velhos = L.filter((x) => x.em < limite()).length;
    const b = $<HTMLButtonElement>('#lxVelhos');
    b.hidden = !velhos;
    if (!b.hasAttribute('aria-live')) b.textContent = `Apagar de vez os ${int(velhos)} itens com mais de 90 dias`;
  }

  root.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.lxf !== undefined) { filtro = b.dataset.lxf; render(); return; }
    if (b.dataset.lxr) {
      const x = L.find((i) => i.id === b.dataset.lxr); if (!x) return;
      b.disabled = true;
      try { await restaurar(x); avisar(`${x.rotulo} restaurado.`); }
      catch { b.disabled = false; avisar('Não foi possível restaurar agora. Tente de novo.'); }
    }
  });
  confirmarNoBotao($<HTMLButtonElement>('#lxVelhos'), 'Confirmar: apagar de vez', async () => {
    if (!db) return;
    let n = 0;
    for (const x of L.filter((i) => i.em < limite())) { try { await db.collection('lixeira').doc(x.id).delete(); n++; } catch { /* segue */ } }
    avisar(`${n} item(ns) antigo(s) apagado(s) de vez.`);
  });

  render();
  (async () => {
    db = await banco();
    if (!db) { carregado = true; render(); return; }
    offs.push(db.collection<ItemLixeira>('lixeira').onSnapshot((s) => { L = s.docs.map(comId); carregado = true; render(); }, () => { carregado = true; render(); }));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
