// Alerta do Sid: a versão curta dos Alertas comerciais, só B2B (sem governo, estatais e licitações). Cada alerta
// diz o fato, o que fazer hoje e com quem falar, e sai daqui direto por e-mail ou WhatsApp. O e-mail diário aponta
// para esta tela (#sid). Lê e grava a mesma coleção "alertas": marcar aqui marca nos Alertas comerciais.
import { esc, dt } from '../lib/formato';
import { chave, nomeLegivel } from '../lib/nomes';
import { hoje as hojeISO } from '../lib/datas';
import { banco, type Colecao } from '../lib/db';
import { seletor, elDe, mensagem, comId } from './dom';
import type { Alerta, Status } from './alertas';

const PUBLICO = /\b(governo|prefeitura|assembleia|camara municipal|camara dos deputados|senado|ministerio|secretaria|tribunal|estatal|autarquia|petrobras|caixa economica|banco do brasil|correios|bndes|sabesp|sebrae|eletrobras|municipio|estado de)\b/;
/** Setor público fica de fora: licitações, perfil público e órgãos ou estatais citados. */
export function ehPublico(a: Alerta): boolean {
  if (a.tipo === 'licitacao' || a.acao?.perfil === 'publica') return true;
  return PUBLICO.test(chave([a.titulo, ...(a.empresas || [])].join(' ')));
}

/** Alertas B2B abertos, dos últimos `dias` dias, por data e prioridade. */
export function doSid(lista: Alerta[], hoje: string, dias = 7): Alerta[] {
  const desde = new Date(new Date(hoje + 'T12:00:00Z').getTime() - (dias - 1) * 864e5).toISOString().slice(0, 10);
  const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  return lista.filter((a) => !ehPublico(a) && (a.data || '') >= desde && a.status !== 'descartado')
    .sort((x, y) => (y.data || '').localeCompare(x.data || '') || ordem[x.prioridade || 'media'] - ordem[y.prioridade || 'media']);
}

/** Primeira frase de um texto, para manter tudo curto. */
export const frase = (t?: string) => { const s = String(t || '').trim(); const i = s.search(/[.!?](\s|$)/); return i > 0 ? s.slice(0, i + 1) : s; };

/** Texto pronto para mandar a alguém: fato, o que fazer, com quem falar e a fonte. */
export function textoAlerta(a: Alerta): string {
  const ac = a.acao || {}, p = (a.pessoas || []).filter((x) => x.nivel !== 'lidera').concat((a.pessoas || []).filter((x) => x.nivel === 'lidera')).slice(0, 2);
  return [
    a.titulo,
    frase(a.fato),
    ac.primeiroPasso ? `Fazer${ac.prazo ? ' até ' + dt(ac.prazo) : ''}: ${ac.primeiroPasso}` : '',
    ac.oferta ? `Oferta: ${frase(ac.oferta)}` : '',
    p.length ? `Falar com: ${p.map((x) => `${x.nome}${x.cargo ? ' (' + x.cargo + (x.organizacao ? ', ' + x.organizacao : '') + ')' : ''}`).join('; ')}` : '',
    (a.fontes || [])[0]?.url ? `Fonte: ${(a.fontes || [])[0].url}` : '',
  ].filter(Boolean).join('\n');
}
export const linkEmail = (a: Alerta) => `mailto:?subject=${encodeURIComponent('Produceria · ' + a.titulo)}&body=${encodeURIComponent(textoAlerta(a))}`;
export const linkWhats = (a: Alerta) => `https://wa.me/?text=${encodeURIComponent(textoAlerta(a))}`;

const PRIO: Record<string, string> = { alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa' };

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap sid">
 <header class="sid-topo"><span class="eyebrow">PRODUCERIA · Alerta B2B do dia</span>
  <h1 class="d d-title" id="sidT">Bom dia, Sid.</h1>
  <p class="lead measure muted" id="sidR">Carregando os alertas…</p>
  <div class="pills" role="group" aria-label="Período"><button type="button" data-p="1" aria-pressed="true">Hoje</button><button type="button" data-p="7" aria-pressed="false">7 dias</button></div>
 </header>
 <p class="sr" id="sidLive" aria-live="polite"></p>
 <div id="sidL" class="sid-lista"></div>
 <p class="note sid-pe">Só mercado privado: governo, estatais e licitações ficam nos <a class="cn-f" href="#alertas">Alertas comerciais</a>. Marcar aqui marca lá também.</p></div>`;
  const $ = seletor(root), hoje = hojeISO();
  let A: Alerta[] = [], col: Colecao<Alerta> | null = null, carregando = true, dias = 1;
  try { const v = Number(localStorage.getItem('sid.dias')); if (v === 1 || v === 7) dias = v; } catch { /* sem armazenamento */ }
  const offs: (() => void)[] = [];

  function card(a: Alerta): string {
    const ac = a.acao || {}, st = a.status || 'novo', p = a.prioridade || 'media';
    const gente = (a.pessoas || []).slice(0, 3);
    return `<article class="sid-it sid-${p}${st === 'feito' ? ' sid-feito' : ''}" data-id="${esc(a.id)}" aria-labelledby="s-${esc(a.id)}">
  <div class="sid-meta"><span class="sid-prio">${PRIO[p]}</span>${a.data !== hoje ? `<span class="note">${esc(dt(a.data))}</span>` : ''}${st === 'andamento' ? '<span class="tag w">em andamento</span>' : st === 'feito' ? '<span class="tag ok">feito</span>' : ''}</div>
  <h2 class="sid-t" id="s-${esc(a.id)}">${esc(a.titulo)}</h2>
  ${a.fato ? `<p class="sid-f">${esc(frase(a.fato))}</p>` : ''}
  ${ac.primeiroPasso ? `<p class="sid-faca"><b>Faça${ac.prazo ? ' até ' + esc(dt(ac.prazo)) : ' hoje'}:</b> ${esc(ac.primeiroPasso)}</p>` : ''}
  ${ac.oferta ? `<p class="sid-o"><b>Oferta:</b> ${esc(frase(ac.oferta))}</p>` : ''}
  ${gente.length ? `<ul class="sid-gente" aria-label="Com quem falar">${gente.map((x) => `<li><b>${esc(x.nome)}</b>${x.cargo ? ` · ${esc(x.cargo)}` : ''}${x.organizacao ? ` · ${esc(nomeLegivel(x.organizacao))}` : ''}${x.linkedin ? ` <a class="cn-f" href="${esc(x.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</li>`).join('')}</ul>` : ''}
  <div class="sid-acts">
   <a class="btn sm" href="${esc(linkEmail(a))}">E-mail</a>
   <a class="btn sm" href="${esc(linkWhats(a))}" target="_blank" rel="noopener">WhatsApp<span class="sr"> (abre em nova aba)</span></a>
   <button type="button" class="ghost sm" data-x="copiar">Copiar</button>
   ${st === 'novo' ? '<button type="button" class="ghost sm" data-x="andamento">Estou nisso</button>' : ''}
   ${st !== 'feito' ? '<button type="button" class="ghost sm" data-x="feito">Feito</button>' : '<button type="button" class="ghost sm" data-x="novo">Reabrir</button>'}
   ${(a.fontes || []).slice(0, 1).map((f) => `<a class="cn-f" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.veiculo || 'Fonte')} ↗<span class="sr"> (abre em nova aba)</span></a>`).join('')}
  </div></article>`;
  }

  function render() {
    root.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === dias)));
    const L = doSid(A, hoje, dias), altas = L.filter((a) => a.prioridade === 'alta').length;
    $('#sidR').textContent = carregando && !A.length ? 'Carregando os alertas…'
      : L.length ? `${L.length} ${L.length === 1 ? 'oportunidade' : 'oportunidades'} no mercado privado${dias === 1 ? ' hoje' : ' em 7 dias'}${altas ? `, ${altas} de prioridade alta` : ''}. Comece pela primeira.`
      : dias === 1 ? 'Nenhum alerta B2B novo hoje. Veja os últimos 7 dias.' : 'Nenhum alerta B2B nos últimos 7 dias.';
    $('#sidL').innerHTML = L.map(card).join('');
    $('#sidLive').textContent = `${L.length} alertas.`;
  }

  async function marcar(id: string, status: Status) {
    const a = A.find((x) => x.id === id); if (!a) return;
    const em = new Date().toISOString();
    if (!col) { a.status = status; a.em = em; render(); return; }
    try { await col.doc(id).update({ status, em }); $('#sidLive').textContent = status === 'feito' ? 'Marcado como feito.' : 'Alerta atualizado.'; } catch (e) { $('#sidLive').textContent = 'Não foi possível atualizar: ' + mensagem(e); }
  }

  root.addEventListener('click', async (e) => {
    const el = elDe(e);
    const p = el.closest<HTMLElement>('[data-p]');
    if (p) { dias = Number(p.dataset.p) || 1; try { localStorage.setItem('sid.dias', String(dias)); } catch { /* sem armazenamento */ } render(); return; }
    const b = el.closest<HTMLButtonElement>('[data-x]'); if (!b) return;
    const id = b.closest<HTMLElement>('.sid-it')?.dataset.id || '', a = A.find((x) => x.id === id); if (!a) return;
    if (b.dataset.x === 'copiar') {
      try { await navigator.clipboard.writeText(textoAlerta(a)); b.textContent = 'Copiado'; $('#sidLive').textContent = 'Texto copiado.'; }
      catch { $('#sidLive').textContent = 'Não deu para copiar. Use o botão E-mail ou WhatsApp.'; }
      return;
    }
    marcar(id, b.dataset.x as Status);
  });
  render();
  (async () => {
    const db = await banco();
    if (!db) { carregando = false; render(); return; }
    col = db.collection<Alerta>('alertas');
    offs.push(col.onSnapshot((s) => {
      A = s.docs.map(comId); carregando = false;
      if (dias === 1 && !doSid(A, hoje, 1).length && doSid(A, hoje, 7).length) dias = 7;
      render();
    }, () => { carregando = false; render(); }));
  })();
  return () => { for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}
