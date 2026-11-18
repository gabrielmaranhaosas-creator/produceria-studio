// Alertas comerciais: o que mudou no mercado (B2B) e o que a Produceria faz a respeito. Cada alerta traz o fato,
// as empresas e as pessoas envolvidas, a ação comercial proposta e as fontes. A rotina diária grava; a equipe decide.
import { esc, int, dt } from '../lib/formato';
import { chave, slug, nomeLegivel, mesmaEmpresa } from '../lib/nomes';
import { hoje as hojeISO } from '../lib/datas';
import { banco, type Colecao } from '../lib/db';
import type { Alvo } from '../lib/tipos';
import { seletor, elDe, mensagem, comId } from './dom';
import { kpis, numero, vazio, barras, porMes, contar, painel, sugerir, irPara, itensDe } from '../componentes';

export type Prioridade = 'alta' | 'media' | 'baixa';
export type Status = 'novo' | 'andamento' | 'feito' | 'descartado';
export interface PessoaAlerta { nome: string; cargo?: string; organizacao?: string; linkedin?: string; fonte?: string; nivel?: string }
export interface Alerta {
  id: string; data: string; tipo: string; prioridade?: Prioridade; titulo: string; fato?: string;
  empresas?: string[]; agencias?: string[]; pessoas?: PessoaAlerta[];
  acao?: { oferta?: string; abordagem?: string; primeiroPasso?: string; prazo?: string; alvo?: string; perfil?: string };
  fontes?: { veiculo?: string; url: string }[]; status?: Status; para?: string; nota?: string; em?: string; criadoEm?: string;
}

const TIPOS: Record<string, string> = { conta: 'Conta', pessoa: 'Pessoa', verba: 'Verba', negocio: 'Negócio', licitacao: 'Licitação', inhouse: 'Estrutura interna' };
const PRIO: Record<Prioridade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const SITUACAO: [Status | 'abertos' | '', string][] = [['abertos', 'Novos e em andamento'], ['novo', 'Só novos'], ['andamento', 'Em andamento'], ['feito', 'Feitos'], ['descartado', 'Descartados'], ['', 'Todos']];

/** Alertas visíveis com os filtros, do mais recente para o mais antigo e, no mesmo dia, por prioridade. */
export function filtrar(lista: Alerta[], f: { s: string; t: string; q: string }): Alerta[] {
  const q = chave(f.q), ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  return lista.filter((a) => {
    const st = a.status || 'novo';
    if (f.s === 'abertos' ? (st === 'feito' || st === 'descartado') : f.s && st !== f.s) return false;
    if (f.t && a.tipo !== f.t) return false;
    if (q && !chave([a.titulo, a.fato, ...(a.empresas || []), ...(a.agencias || []), ...(a.pessoas || []).map((p) => p.nome + ' ' + (p.organizacao || ''))].join(' ')).includes(q)) return false;
    return true;
  }).sort((x, y) => (y.data || '').localeCompare(x.data || '') || (ordem[x.prioridade || 'media'] - ordem[y.prioridade || 'media']));
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap">
 <section class="kpis" id="acK" aria-label="Resumo dos alertas"></section>
 <section class="bar cnbar" aria-label="Filtros dos alertas">
  <div class="f f-wide" role="group" aria-labelledby="acLT"><span class="lab" id="acLT">Tipo</span><div class="pills" id="acT"></div></div>
  <div class="f"><label for="acQ">Buscar</label><input id="acQ" type="search" placeholder="Empresa, agência ou pessoa" autocomplete="off"></div>
  <div class="f"><label for="acS">Situação</label><select id="acS">${SITUACAO.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
 </section>
 <div id="acPn"></div>
 <p class="sr" id="acLive" aria-live="polite"></p>
 <div id="acO" class="ac-lista"></div></div>`;
  const $ = seletor(root);
  const hoje = hojeISO();
  let A: Alerta[] = [], alvos: Alvo[] = [], col: Colecao<Alerta> | null = null, colAlvos: Colecao<Alvo> | null = null, carregando = true;
  const offs: (() => void)[] = [];
  const F = { s: '', t: '', q: '', k: '' };
  try { const sv = JSON.parse(localStorage.getItem('ac.filtros.v2') || 'null'); if (sv) Object.assign(F, sv); } catch { /* sem armazenamento */ }
  const guardar = () => { try { localStorage.setItem('ac.filtros.v2', JSON.stringify(F)); } catch { /* sem armazenamento */ } };
  const ehAlvo = (nome: string) => alvos.some((a) => a.id === 'al-' + slug(nome) || mesmaEmpresa(a.nome, nome));

  function card(a: Alerta): string {
    const st = a.status || 'novo', p = a.prioridade || 'media', ac = a.acao || {};
    const alvoNome = ac.alvo || (a.agencias || [])[0] || (a.empresas || [])[0] || '';
    return `<article class="ac-it ac-${p}${st === 'feito' || st === 'descartado' ? ' ac-fechado' : ''}" data-id="${esc(a.id)}" aria-labelledby="t-${esc(a.id)}">
  <div class="cn-meta"><span class="tag">${esc(TIPOS[a.tipo] || a.tipo)}</span><span class="ac-prio" title="Prioridade">${PRIO[p]}</span>${st !== 'novo' ? `<span class="tag w">${st === 'andamento' ? 'em andamento' : st === 'feito' ? 'feito' : 'descartado'}</span>` : ''}<span class="note">${esc(dt(a.data))}</span></div>
  <h3 class="cn-t" id="t-${esc(a.id)}">${esc(a.titulo)}</h3>
  ${a.fato ? `<p class="cn-r ab">${esc(a.fato)}</p>` : ''}
  ${(a.empresas || []).length || (a.agencias || []).length ? `<div class="cn-emp">${(a.empresas || []).map((n) => `<span class="chip sm">${esc(nomeLegivel(n))}</span>`).join('')}${(a.agencias || []).map((n) => `<span class="chip sm ac-ag">${esc(nomeLegivel(n))}</span>`).join('')}</div>` : ''}
  ${(a.pessoas || []).length ? `<ul class="ac-pessoas" aria-label="Pessoas envolvidas">${(a.pessoas || []).map((x) => `<li><b>${esc(x.nome)}</b>${x.cargo ? ` · ${esc(x.cargo)}` : ''}${x.organizacao ? ` · ${esc(x.organizacao)}` : ''}${x.linkedin ? ` <a class="cn-f" href="${esc(x.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</li>`).join('')}</ul>` : ''}
  ${ac.oferta || ac.abordagem || ac.primeiroPasso ? `<div class="ac-acao"><span class="lab">Ação comercial proposta</span>
   ${ac.oferta ? `<p><b>O que oferecer:</b> ${esc(ac.oferta)}</p>` : ''}${ac.abordagem ? `<p><b>Como chegar:</b> ${esc(ac.abordagem)}</p>` : ''}${ac.primeiroPasso ? `<p><b>Primeiro passo${ac.prazo ? ' até ' + esc(dt(ac.prazo)) : ''}:</b> ${esc(ac.primeiroPasso)}</p>` : ''}</div>` : ''}
  <div class="cn-acts">
   ${alvoNome ? (ehAlvo(alvoNome) ? `<a class="tag ok" href="#captacao">${esc(nomeLegivel(alvoNome))} já é alvo</a>` : `<button type="button" class="sm" data-x="alvo" data-nome="${esc(alvoNome)}">Virar alvo: ${esc(nomeLegivel(alvoNome))}</button>`) : ''}
   ${st === 'novo' ? '<button type="button" class="ghost sm" data-x="andamento">Em andamento</button>' : ''}
   ${st !== 'feito' ? '<button type="button" class="ghost sm" data-x="feito">Feito</button>' : ''}
   ${st !== 'descartado' && st !== 'feito' ? '<button type="button" class="ghost sm" data-x="descartado">Descartar</button>' : `<button type="button" class="ghost sm" data-x="novo">Reabrir</button>`}
   ${(a.fontes || []).map((f) => `<a class="cn-f" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.veiculo || 'Fonte')} ↗<span class="sr"> (abre em nova aba)</span></a>`).join('')}
  </div></article>`;
  }

  function render() {
    guardar();
    $('#acT').innerHTML = [['', 'Todos'], ...Object.entries(TIPOS)].map(([v, t]) => `<button type="button" data-t="${v}" aria-pressed="${F.t === v}">${t}</button>`).join('');
    const qi = $<HTMLInputElement>('#acQ'); if (document.activeElement !== qi) qi.value = F.q;
    $<HTMLSelectElement>('#acS').value = F.s;
    // cada número do topo é um recorte: clicar mostra só aqueles alertas (e clicar de novo desfaz)
    const d30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const RECORTE: Record<string, (a: Alerta) => boolean> = {
      hoje: (a) => a.data === hoje && (a.status || 'novo') === 'novo',
      alta: (a) => (!a.status || a.status === 'novo' || a.status === 'andamento') && a.prioridade === 'alta',
      andamento: (a) => a.status === 'andamento',
      feitos: (a) => a.status === 'feito' && (a.em || '') >= d30,
    };
    const n = (k: string) => int(A.filter(RECORTE[k]).length), on = (k: string) => F.k === k;
    $('#acK').innerHTML = kpis([
      { rotulo: 'Novos hoje', valor: numero(n('hoje')), nota: 'alertas da rotina desta manhã', kpi: 'hoje', ativo: on('hoje'), acao: 'Ver os novos de hoje' },
      { rotulo: 'Prioridade alta', valor: numero(n('alta')), nota: 'abertos, para agir esta semana', kpi: 'alta', ativo: on('alta'), acao: 'Ver os de prioridade alta' },
      { rotulo: 'Em andamento', valor: numero(n('andamento')), nota: 'alguém da equipe já está nisso', kpi: 'andamento', ativo: on('andamento'), acao: 'Ver os em andamento' },
      { rotulo: 'Feitos em 30 dias', valor: numero(n('feitos')), nota: 'ações concluídas', kpi: 'feitos', ativo: on('feitos'), acao: 'Ver os feitos' },
    ]);
    const corte = (l: Alerta[]) => (F.k && RECORTE[F.k] ? l.filter(RECORTE[F.k]) : l);
    const L = corte(filtrar(A, F.k ? { ...F, s: '' } : F));
    const base = corte(filtrar(A, { ...F, t: '', s: F.k ? '' : F.s })), sit = (a: Alerta) => ({ novo: 'Novo', andamento: 'Em andamento', feito: 'Feito', descartado: 'Descartado' })[a.status || 'novo'];
    $('#acPn').innerHTML = A.length ? painel([
      barras('Por tipo', contar(base, (a) => a.tipo).map((b) => ({ ...b, rotulo: TIPOS[b.rotulo] || b.rotulo, ativo: b.dado === F.t })), { attr: 't', nota: 'clique para ver só o tipo' }),
      porMes('Alertas por mês', L.map((a) => a.data), 6),
      barras('Anunciantes mais citados', contar(L, (a) => [...new Set((a.empresas || []).map(nomeLegivel))]).map((b) => ({ ...b, ativo: chave(b.rotulo) === chave(F.q) })), { attr: 'q', nota: 'marcas e empresas que compram; clique para buscar' }),
      barras('Agências mais citadas', contar(L, (a) => [...new Set((a.agencias || []).map(nomeLegivel))]).map((b) => ({ ...b, ativo: chave(b.rotulo) === chave(F.q) })), { attr: 'q', nota: 'quem atende; clique para buscar' }),
      barras('Situação', contar(L, sit)),
    ], 'Resumo dos alertas') : '';
    let html = '', dia = '';
    for (const a of L) {
      if (a.data !== dia) { if (dia) html += '</div></section>'; dia = a.data; html += `<section class="cn-dia" aria-label="${esc(dt(dia))}"><h2 class="cn-dh">${dia === hoje ? 'Hoje' : esc(dt(dia))}</h2><div class="cn-lista">`; }
      html += card(a);
    }
    if (dia) html += '</div></section>';
    $('#acO').innerHTML = carregando && !A.length ? '<p class="note">Carregando os alertas…</p>' : L.length ? html
      : vazio({ titulo: A.length ? 'Nenhum alerta com esses filtros' : 'Nenhum alerta ainda', texto: A.length ? 'Mude a situação para "Todos" ou limpe a busca.' : 'A rotina "Alertas comerciais" grava aqui, todo dia de manhã, as novidades do mercado com a ação proposta para a Produceria.' });
    $('#acLive').textContent = `${L.length} alertas.`;
  }

  async function marcar(id: string, status: Status) {
    const a = A.find((x) => x.id === id); if (!a) return;
    const em = new Date().toISOString();
    if (!col) { a.status = status; a.em = em; render(); return; }
    try { await col.doc(id).update({ status, em }); $('#acLive').textContent = 'Alerta atualizado.'; } catch (e) { $('#acLive').textContent = 'Não foi possível atualizar: ' + mensagem(e); }
  }
  async function virarAlvo(nome: string, a: Alerta, btn: HTMLButtonElement) {
    if (ehAlvo(nome)) { render(); return; }
    const id = 'al-' + slug(nome);
    const doc: Alvo = { id, nome: nomeLegivel(nome), perfil: a.acao?.perfil || 'independente', contato: (a.pessoas || []).filter((p) => p.organizacao && mesmaEmpresa(p.organizacao, nome)).map((p) => `${p.nome}${p.cargo ? ' (' + p.cargo + ')' : ''}`).join('; '),
      gatilho: a.titulo, fonte: (a.fontes || [])[0]?.url || '', status: 'Mapeado', proximoPasso: a.acao?.primeiroPasso || 'Pesquisar quem decide produção e fazer o primeiro contato',
      prazo: a.acao?.prazo || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), notas: a.acao?.oferta || '', origem: 'Alertas comerciais', criadoEm: new Date().toISOString() } as Alvo;
    btn.disabled = true; btn.textContent = 'Criando…';
    if (!colAlvos) { alvos = [...alvos, doc]; render(); return; }
    try { await colAlvos.doc(id).set(doc); $('#acLive').textContent = `${doc.nome} entrou como alvo na Captação.`; } catch (e) { btn.disabled = false; btn.textContent = 'Tentar de novo'; $('#acLive').textContent = 'Não foi possível criar o alvo: ' + mensagem(e); }
  }

  root.addEventListener('click', (e) => {
    const el = elDe(e);
    const kk = el.closest<HTMLElement>('[data-kpi]'); if (kk) { F.k = F.k === kk.dataset.kpi ? '' : kk.dataset.kpi || ''; render(); irPara($('#acO')); return; }
    const q = el.closest<HTMLElement>('.pn [data-q]'); if (q) { F.q = chave(F.q) === chave(q.dataset.q || '') ? '' : q.dataset.q || ''; render(); return; }
    const t = el.closest<HTMLElement>('[data-t]'); if (t) { F.t = t.closest('.pn') && F.t === t.dataset.t ? '' : t.dataset.t || ''; render(); root.querySelector<HTMLElement>(`[data-t="${F.t}"]`)?.focus(); return; }
    const b = el.closest<HTMLButtonElement>('[data-x]'); if (!b) return;
    const id = b.closest<HTMLElement>('.ac-it')?.dataset.id; if (!id) return;
    const a = A.find((x) => x.id === id); if (!a) return;
    if (b.dataset.x === 'alvo') { virarAlvo(b.dataset.nome || '', a, b); return; }
    marcar(id, b.dataset.x as Status);
  });
  $<HTMLInputElement>('#acQ').oninput = (e) => { F.q = (e.target as HTMLInputElement).value; render(); };
  $<HTMLSelectElement>('#acS').onchange = (e) => { F.s = (e.target as HTMLSelectElement).value; render(); };
  sugerir('acQ', () => [
    { nome: 'Tipos', itens: Object.entries(TIPOS).map(([v, t]) => ({ texto: t, valor: v, sub: `${int(A.filter((a) => a.tipo === v).length)} alerta(s)`, peso: A.filter((a) => a.tipo === v).length })) },
    { nome: 'Anunciantes', itens: itensDe(A, (a) => (a.empresas || []).map(nomeLegivel)) },
    { nome: 'Agências', itens: itensDe(A, (a) => (a.agencias || []).map(nomeLegivel)) },
    { nome: 'Pessoas', itens: A.flatMap((a) => (a.pessoas || []).map((x) => ({ texto: x.nome, sub: [x.cargo, x.organizacao].filter(Boolean).join(' · ') }))) },
  ], { aoEscolher: (it, g, c) => { if (g === 'Tipos') { F.t = it.valor || ''; F.q = ''; c.value = ''; } else { F.q = it.texto; c.value = it.texto; } render(); irPara($('#acO')); } });
  render();
  (async () => {
    const db = await banco();
    if (!db) { carregando = false; render(); return; }
    col = db.collection<Alerta>('alertas'); colAlvos = db.collection<Alvo>('alvos');
    offs.push(col.onSnapshot((s) => { A = s.docs.map(comId); carregando = false; render(); }, () => { carregando = false; render(); }));
    offs.push(colAlvos.onSnapshot((s) => { alvos = s.docs.map(comId); render(); }, () => {}));
  })();
  return () => { for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}
