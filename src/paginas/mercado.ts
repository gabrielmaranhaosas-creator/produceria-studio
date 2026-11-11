// Contas e agências: quem atende quem no mercado privado (movimentações de conta, agências, maiores anunciantes).
// Base publicada em mercado.json; a Captação semanal grava movimentações novas na coleção `movimentos`.
import { esc, int, brk, dt } from '../lib/formato';
import { banco, lerArquivo, type Banco } from '../lib/db';
import { chave } from '../lib/nomes';
import { seletor, comId, abaNoEndereco, type Dialogo } from './dom';
import { kpis, vazio, abrirDialogo, devolverFoco } from '../componentes';

export interface Conta { data: string; anunciante: string; escopo: string; fonte: string; tipo: string; anterior: string }
export interface Perda { data: string; anunciante: string; para: string; fonte: string }
export interface Agencia {
  nome: string; cenp: number | string | null; uf: string; fonteRanking: string; contas: Conta[]; perdeu: Perda[]; ultima: string;
  tipo: string; rede: boolean; prioridade: number; publica?: { cnpj: string; orgaos: string[]; valorVigente: number };
}
export interface Movimento { data: string; anunciante: string; agencia: string; anterior?: string; escopo?: string; fonte: string; tipo?: string }
export interface Anunciante { pos: number; pos2024: number; nome: string; valor2025: number; valor2024: number | null; variacao: number; agencias: { agencia: string; anunciante: string; data: string; fonte: string }[]; fonte: string }
export interface Mercado {
  meta: { atualizado: string; movimentos: number; agencias: number; mudancas2025: number; fonteMudancas2025: string; fontes: Record<string, string> };
  agencias: Agencia[]; movimentos: Movimento[]; anunciantes: Anunciante[];
}

/** Como abordar cada situação de agência. Ofertas no escopo da casa (sem eventos). */
export const SITUACOES = {
  ganhou: { quando: 'Agência que acabou de ganhar uma conta (até 90 dias)', porque: 'Hipótese da casa: conta nova chega com primeira campanha, prazo curto e muito desdobramento. É quando a agência mais precisa de capacidade de finalização e produção sem contratar time fixo.',
    passos: ['Escreva para a produção ou RTV da agência citando a conta e a data da notícia (está no link da fonte).', 'Ofereça uma frente específica da primeira campanha: arte-final e desdobramento, retoque, motion, HTML, produção gráfica, comunicação visual ou mídia exterior.', 'Proponha um job-teste com prazo e preço fechados, usando a tabela da casa.', 'Leve um case de craft parecido com o setor do anunciante.'] },
  ranking: { quando: 'Agência grande do ranking, sem movimento recente', porque: 'Volume de produção alto e constante. A porta de entrada é a lista de fornecedores da produção, não a criação.',
    passos: ['Peça para entrar no cadastro de fornecedores (produção, RTV, compras ou compliance da agência).', 'Mande a tabela de serviços e o prazo-padrão de cada entrega.', 'Volte quando ela ganhar a próxima conta: a aba Movimentações mostra quando.'] },
  perdeu: { quando: 'Agência que perdeu conta', porque: 'Hipótese da casa: depois de perder receita, a agência tende a trocar custo fixo por custo variável. Estúdio sob demanda entra aí.',
    passos: ['Espere algumas semanas depois da notícia.', 'Ofereça a Produceria como estúdio sob demanda: paga só o que usar, sem time parado.'] },
  house: { quando: 'Anunciante com agência interna (house)', porque: 'House agency cria dentro de casa, mas raramente tem estúdio completo de finalização, retoque, motion e produção gráfica.',
    passos: ['Procure quem lidera a house (marketing do anunciante).', 'Ofereça a finalização e a produção das peças que a house cria, inclusive comunicação visual e PDV.'] },
} as const;
type Situacao = keyof typeof SITUACOES;

/** "2025" (só o ano) aparece como "em 2025"; datas completas como DD/MM/AAAA. */
export const quando = (d: string) => (d.length === 4 ? `em ${d}` : dt(d));
/** A data está nos últimos `dias` dias? Datas só com o ano nunca contam como recentes. */
export const recente = (d: string, dias: number, agora = Date.now()) => d.length > 4 && (agora - new Date(d + 'T12:00:00').getTime()) / 864e5 <= dias;

export function situacao(a: Agencia, agora = Date.now()): Situacao {
  if (a.contas[0] && recente(a.contas[0].data, 90, agora)) return 'ganhou';
  if (a.tipo === 'House agency') return 'house';
  if (a.perdeu.length && (!a.contas[0] || a.perdeu[0].data > a.contas[0].data)) return 'perdeu';
  return 'ranking';
}

/** Junta as movimentações novas do banco (com fonte) às da base publicada, sem repetir anunciante+agência. */
export function mesclar(m: Mercado, novos: Movimento[]): Mercado {
  const vistos = new Set(m.movimentos.map((x) => chave(x.anunciante) + '|' + chave(x.agencia)));
  const add = novos.filter((x) => x.anunciante && x.agencia && x.fonte && x.data && !vistos.has(chave(x.anunciante) + '|' + chave(x.agencia)));
  if (!add.length) return m;
  const agencias = m.agencias.map((a) => ({ ...a, contas: [...a.contas] }));
  const porNome = new Map(agencias.map((a) => [chave(a.nome), a]));
  for (const x of add) {
    let a = porNome.get(chave(x.agencia));
    if (!a) { a = { nome: x.agencia, cenp: null, uf: '', fonteRanking: '', contas: [], perdeu: [], ultima: '', tipo: 'Criação / full service', rede: false, prioridade: 40 }; agencias.push(a); porNome.set(chave(x.agencia), a); }
    a.contas.unshift({ data: x.data, anunciante: x.anunciante, escopo: x.escopo || '', fonte: x.fonte, tipo: x.tipo || 'conquista', anterior: x.anterior || '' });
    if (!a.ultima || x.data > a.ultima) a.ultima = x.data;
  }
  const movimentos = [...add.map((x) => ({ ...x, escopo: x.escopo || '', anterior: x.anterior || '', tipo: x.tipo || 'conquista' })), ...m.movimentos]
    .sort((a, b) => b.data.padEnd(10, '0').localeCompare(a.data.padEnd(10, '0')));
  return { ...m, agencias, movimentos, meta: { ...m.meta, movimentos: movimentos.length, agencias: agencias.length } };
}

export interface Filtros { busca: string; periodo: '90' | '180' | 'todos'; soCriacao: boolean }
export function filtrarMovimentos(m: Mercado, f: Filtros, agora = Date.now()): Movimento[] {
  const q = f.busca.trim().toLowerCase(), tipo = new Map(m.agencias.map((a) => [a.nome, a.tipo]));
  return m.movimentos.filter((x) => (f.periodo === 'todos' || recente(x.data, Number(f.periodo), agora))
    && (!f.soCriacao || ['Criação / full service', 'House agency'].includes(tipo.get(x.agencia) || ''))
    && (!q || `${x.anunciante} ${x.agencia} ${x.anterior || ''} ${x.escopo || ''}`.toLowerCase().includes(q)));
}
export function filtrarAgencias(m: Mercado, f: Filtros): Agencia[] {
  const q = f.busca.trim().toLowerCase();
  return m.agencias.filter((a) => (!f.soCriacao || a.tipo === 'Criação / full service') && (!q || `${a.nome} ${a.contas.map((c) => c.anunciante).join(' ')}`.toLowerCase().includes(q)));
}

type Visao = 'movimentos' | 'agencias' | 'anunciantes' | 'abordar';
interface Downloads { save(o: { filename: string; data: string }): Promise<{ status?: string } | void> }
const novoId = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fonteLink = (u: string, t = 'fonte') => (u ? `<a class="cn-f" href="${esc(u)}" target="_blank" rel="noopener">${t} ↗<span class="sr"> (abre em nova aba)</span></a>` : '');
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc mk"><div id="mkK"><p class="note">Carregando a base de mercado…</p></div>
  <div id="mkF"></div><p class="sr" id="mkLive" aria-live="polite" aria-atomic="true"></p><div id="mkO"></div><div id="mkR"></div></div>
  <dialog id="mkD" aria-labelledby="mkDT"></dialog>`;
  const $ = seletor(root);
  const D = $<Dialogo>('#mkD');
  let base: Mercado | null = null, m: Mercado | null = null, novos: Movimento[] = [], db: Banco | null = null, alvos: { nome: string }[] = [];
  let visao: Visao = 'movimentos';
  const f: Filtros = { busca: '', periodo: '180', soCriacao: true };
  const offs: (() => void)[] = [];
  const abas = abaNoEndereco<Visao>(['movimentos', 'agencias', 'anunciantes', 'abordar'], 'movimentos', (a) => { visao = a; if (m) { filtros(); lista(); } });
  visao = abas.inicial;
  const avisar = (t: string) => { $('#mkLive').textContent = t; };
  devolverFoco(D, () => $<HTMLElement>('#mkF [aria-pressed=true]'));

  function recalcular() {
    if (!base) return;
    m = mesclar(base, novos);
    topo(); if (!$('#mkF').childElementCount) filtros(); lista(); rodape();
  }

  function topo() {
    const x = m!.meta;
    $('#mkK').innerHTML = `<div class="kpis">${kpis([
      { rotulo: 'Movimentações de conta', valor: `<b>${int(x.movimentos)}</b>`, nota: 'com fonte, de 2025 até hoje' },
      { rotulo: 'Nos últimos 90 dias', valor: `<b>${int(m!.movimentos.filter((v) => recente(v.data, 90)).length)}</b>`, nota: 'agências com conta nova' },
      { rotulo: 'Agências mapeadas', valor: `<b>${int(x.agencias)}</b>`, nota: '30 do ranking Cenp-Meios 2025' },
      { rotulo: 'Trocas de conta em 2025', valor: `<b>${int(x.mudancas2025)}</b>`, nota: fonteLink(x.fonteMudancas2025, 'balanço M&amp;M') },
    ])}</div>`;
  }

  function filtros() {
    try { localStorage.setItem('mk.visao', visao); } catch { /* sem armazenamento */ }
    const abas: [Visao, string][] = [['movimentos', 'Movimentações'], ['agencias', 'Agências'], ['anunciantes', 'Maiores anunciantes'], ['abordar', 'Como abordar']];
    const campos = visao === 'movimentos' || visao === 'agencias';
    $('#mkF').innerHTML = `<div class="vc-filtros"><div class="pills lc-abas" role="group" aria-label="Visão">${abas.map(([v, t]) => `<button type="button" data-visao="${v}" aria-pressed="${visao === v}">${t}</button>`).join('')}</div>
    ${campos ? `<div class="vc-campos"><div class="f vc-q"><label for="mkQ">Buscar</label><input id="mkQ" type="search" value="${esc(f.busca)}" placeholder="Agência, anunciante ou escopo…"></div>
      ${visao === 'movimentos' ? `<div class="f"><label for="mkP">Período</label><select id="mkP">${([['90', 'Últimos 90 dias'], ['180', 'Últimos 6 meses'], ['todos', 'Desde 2025']] as const).map(([v, t]) => `<option value="${v}"${f.periodo === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
      <label class="vc-chk"><input type="checkbox" id="mkC" ${f.soCriacao ? 'checked' : ''}> Só criação e full service</label></div>` : ''}</div>`;
  }

  const como = (s: Situacao, titulo?: string) => { const x = SITUACOES[s]; return `<section class="lc-box vc-como"><span class="lab">${esc(titulo || x.quando)}</span><p>${esc(x.porque)}</p><ol>${x.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></section>`; };

  function lista() {
    const o = $('#mkO');
    if (!m) return;
    const tipo = new Map(m.agencias.map((a) => [a.nome, a]));
    if (visao === 'movimentos') {
      const L = filtrarMovimentos(m, f);
      o.innerHTML = `<div class="acts"><span class="note">${int(L.length)} movimentação(ões), da mais nova para a mais antiga. Quem acabou de ganhar conta é o melhor momento de abordar.</span><button type="button" class="ghost sm" id="mkCSV">Baixar (.csv)</button></div>
      ${L.length ? `<ul class="vc-l">${L.map((x) => `<li class="mk-mv"><span class="note num mk-data">${quando(x.data)}</span>
        <span class="vc-c"><span><b>${esc(x.anunciante)}</b> → ${tipo.has(x.agencia) ? `<button type="button" class="lnk" data-ag="${esc(x.agencia)}">${esc(x.agencia)}</button>` : esc(x.agencia)}${x.anterior ? `<span class="note"> · antes: ${esc(x.anterior)}</span>` : ''}</span><span class="note">${esc(x.escopo || '')}</span></span>
        <span class="vc-num">${recente(x.data, 90) ? '<span class="tag ok">agora</span>' : x.tipo && x.tipo !== 'conquista' ? `<span class="note">${esc(x.tipo)}</span>` : ''}${fonteLink(x.fonte)}</span></li>`).join('')}</ul>`
        : vazio({ titulo: 'Nenhuma movimentação com esses filtros', texto: 'Aumente o período ou desmarque "Só criação e full service".' })}`;
    } else if (visao === 'agencias') {
      const L = filtrarAgencias(m, f);
      o.innerHTML = `<p class="note">${int(L.length)} agência(s), em ordem de prioridade: conquista recente, posição no ranking Cenp-Meios 2025 e sede em SP.</p>
      ${L.length ? `<ul class="vc-l">${L.map((a) => `<li><button type="button" class="vc-linha" data-ag="${esc(a.nome)}"><span class="vc-prio num" title="Prioridade (0 a 100)">${a.prioridade}</span>
        <span class="vc-c"><b>${esc(a.nome)}${a.publica ? '<span class="note"> · também tem conta pública</span>' : ''}</b><span class="note">${a.cenp ? `${a.cenp}º no Cenp-Meios 2025` : 'fora do top 30 do Cenp'}${a.uf ? ' · ' + esc(a.uf) : ''} · ${esc(a.contas.slice(0, 3).map((c) => c.anunciante).join(', ') || 'sem conta nova registrada')}</span></span>
        <span class="vc-num"><b class="num">${a.contas.length} conta(s)</b><span class="note">${a.ultima ? 'última ' + quando(a.ultima) : '—'}</span></span></button></li>`).join('')}</ul>`
        : vazio({ titulo: 'Nenhuma agência com esses filtros', texto: 'Tire a busca ou desmarque "Só criação e full service".' })}`;
    } else if (visao === 'anunciantes') {
      o.innerHTML = `<p class="note mk-aviso">Os 20 que mais investiram em mídia em 2025, pelo Ibope Advertising Intelligence, publicado pelo Meio &amp; Mensagem em 25/05/2026. Os valores estão como a fonte publicou; a fonte não informa a escala (pela ordem de grandeza, devem ser milhares de reais) e é valor de tabela de mídia, não o que foi pago. Na fonte, o valor de 2024 da Claro repete o da Adobe e não bate com a variação: por isso aparece em branco. A coluna de agências mostra só o que apareceu nas movimentações mapeadas.</p>
      <div class="tw"><table class="vc-t"><thead><tr><th scope="col" class="num"><span class="th">#</span></th><th scope="col"><span class="th">Anunciante</span></th><th scope="col" class="num"><span class="th">2025 (como publicado)</span></th><th scope="col" class="num"><span class="th">2024</span></th><th scope="col" class="num"><span class="th">Var.</span></th><th scope="col"><span class="th">Agências nas movimentações</span></th></tr></thead><tbody>
      ${m.anunciantes.map((a) => `<tr><td class="num">${a.pos}</td><th scope="row">${esc(a.nome)}</th><td class="num">${int(a.valor2025)}</td><td class="num">${a.valor2024 != null ? int(a.valor2024) : '—'}<span class="sub">${a.pos2024}º em 2024</span></td><td class="num">${a.variacao > 0 ? '+' : ''}${a.variacao}%</td>
        <td>${a.agencias.length ? a.agencias.map((g) => `<span class="mk-ag">${fonteLink(g.fonte, esc(g.agencia))} <span class="note">(${esc(g.anunciante)}, ${quando(g.data)})</span></span>`).join('') : '<span class="note">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>${fonteLink(m.anunciantes[0]?.fonte || '', 'Fonte: ranking dos 20 maiores anunciantes, M&amp;M')}`;
    } else {
      o.innerHTML = `<div class="mk-guias">${(Object.keys(SITUACOES) as Situacao[]).map((s) => como(s)).join('')}</div>`;
    }
  }

  function rodape() {
    const x = m!.meta;
    $('#mkR').innerHTML = `<section class="mk-fontes" aria-label="Fontes"><p class="note">Base montada em ${dt(x.atualizado)}${novos.length ? `, mais ${int(novos.length)} movimentação(ões) da Captação semanal` : ''}. Fontes:</p>
    <ul>${Object.entries(x.fontes).map(([t, u]) => `<li>${fonteLink(u, esc(t))}</li>`).join('')}</ul>
    <p class="note">As notícias cobrem o que agências e anunciantes divulgaram; muita troca de conta não vira notícia. A Captação semanal do Claude pode trazer as novas.</p></section>`;
  }

  function abrirAgencia(a: Agencia, quem: HTMLElement) {
    const s = situacao(a), ja = alvos.some((x) => chave(x.nome) === chave(a.nome));
    abrirDialogo(D, `<div class="dh"><div><span class="lab">${esc(a.tipo)}${a.cenp ? ` · ${a.cenp}º Cenp-Meios 2025` : ''} · prioridade ${a.prioridade}</span><h2 class="d d-sub" id="mkDT">${esc(a.nome)}</h2></div><button type="button" class="x" id="mkX" aria-label="Fechar">×</button></div>
    ${como(s, 'Como abordar · ' + SITUACOES[s].quando.toLowerCase())}
    <div class="acts">${ja ? '<span class="tag ok">Já está na Captação</span>' : '<button type="button" class="sm" id="mkAlvo">Virar alvo na Captação</button>'}${a.fonteRanking ? `<a class="btn ghost sm" href="${esc(a.fonteRanking)}" target="_blank" rel="noopener">Ranking Cenp ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</div>
    ${a.publica ? `<div class="lc-box"><p><b>Também tem conta pública (PNCP):</b> ${esc(a.publica.orgaos.join('; '))} · <span title="${esc(reais(a.publica.valorVigente))}">${brk(a.publica.valorVigente)}</span> vigente · CNPJ ${esc(a.publica.cnpj)}</p><a class="cn-f" href="#vencedores">Ver em Vencedores de licitações</a></div>` : ''}
    <h3 class="d d-sub">Contas conquistadas (${a.contas.length})</h3>
    ${a.contas.length ? `<ul class="vc-l">${a.contas.map((c) => `<li class="mk-ct"><span class="vc-c"><b>${esc(c.anunciante)}</b><span class="note">${esc(c.escopo)}${c.anterior ? ' · antes: ' + esc(c.anterior) : ''}</span></span><span class="vc-num"><span class="note num">${quando(c.data)}</span>${fonteLink(c.fonte)}</span></li>`).join('')}</ul>` : '<p class="note">Nenhuma conquista registrada nas fontes mapeadas.</p>'}
    ${a.perdeu.length ? `<h3 class="d d-sub">Contas que saíram (${a.perdeu.length})</h3><ul class="vc-l">${a.perdeu.map((c) => `<li class="mk-ct"><span class="vc-c"><span>${esc(c.anunciante)} <span class="note">foi para ${esc(c.para)}</span></span></span><span class="vc-num"><span class="note num">${quando(c.data)}</span>${fonteLink(c.fonte)}</span></li>`).join('')}</ul>` : ''}`, quem, '#mkX');
    $('#mkX').onclick = () => D.close();
    const b = D.querySelector<HTMLButtonElement>('#mkAlvo');
    if (b) b.onclick = async () => {
      if (!db) { avisar('A Captação só funciona com o banco do Studio.'); return; }
      const c = a.contas[0], id = novoId('al');
      b.disabled = true;
      try {
        await db.collection('alvos').doc(id).set({ id, nome: a.nome, perfil: a.tipo === 'House agency' ? 'inhouse' : a.rede ? 'rede' : 'independente', contato: '', status: 'Mapeado', origem: 'Contas e agências',
          gatilho: c ? `Conquistou ${c.anunciante} (${quando(c.data)}): ${c.escopo}` : a.cenp ? `${a.cenp}º no ranking Cenp-Meios 2025` : '',
          fonte: c?.fonte || a.fonteRanking,
          proximoPasso: c && recente(c.data, 90) ? 'Escrever para a produção oferecendo uma frente da primeira campanha' : 'Pedir para entrar no cadastro de fornecedores de produção',
          notas: `${a.cenp ? `Ranking Cenp-Meios 2025: ${a.cenp}º. ` : ''}Contas recentes: ${a.contas.slice(0, 5).map((x) => `${x.anunciante} (${quando(x.data)})`).join('; ') || '—'}.${a.publica ? ` Também tem conta pública: ${a.publica.orgaos.join('; ')} (${reais(a.publica.valorVigente)} vigente, PNCP).` : ''}`,
          criadoEm: new Date().toISOString() });
        alvos = [...alvos, { nome: a.nome }];
        b.outerHTML = '<span class="tag ok">Já está na Captação</span>';
        avisar(`${a.nome} entrou na Captação, coluna Mapeado.`);
      } catch { b.disabled = false; avisar('Não foi possível criar o alvo. Tente de novo.'); }
    };
  }

  async function baixar() {
    if (!m) return;
    const L = filtrarMovimentos(m, f);
    const data = '﻿' + [['Data', 'Anunciante', 'Agência', 'Agência anterior', 'Escopo', 'Tipo', 'Fonte'], ...L.map((x) => [x.data, x.anunciante, x.agencia, x.anterior, x.escopo, x.tipo, x.fonte])]
      .map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    try {
      const d = (await window.claude?.use('downloads')) as Downloads | undefined;
      if (!d) { avisar('Download indisponível nesta visualização. Abra o Studio no Claude.'); return; }
      const r = await d.save({ filename: 'movimentacoes-de-contas.csv', data });
      if (r && r.status === 'saved') avisar('Arquivo salvo: movimentacoes-de-contas.csv');
    } catch (e) {
      const c = (e as { code?: string })?.code;
      if (c !== 'declined') avisar(c === 'rate_limited' ? 'Já há um download aguardando confirmação.' : 'Não foi possível gerar o arquivo agora.');
    }
  }

  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !root.contains(b) || D.contains(b) || !m) return;
    if (b.dataset.visao) { abas.ir(b.dataset.visao as Visao); root.querySelector<HTMLElement>(`[data-visao="${visao}"]`)?.focus(); return; }
    if (b.dataset.ag) { const a = m.agencias.find((x) => x.nome === b.dataset.ag); if (a) abrirAgencia(a, b); return; }
    if (b.id === 'mkCSV') baixar();
  });
  root.addEventListener('input', (ev) => { const t = ev.target as HTMLInputElement; if (t.id === 'mkQ') { f.busca = t.value; lista(); } });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'mkP') f.periodo = t.value as Filtros['periodo'];
    else if (t.id === 'mkC') f.soCriacao = t.checked;
    else return;
    lista();
  });

  (async () => {
    try { base = await lerArquivo<Mercado>('mercado.json'); recalcular(); }
    catch (e) { $('#mkK').innerHTML = `<div class="lc-box"><p>Não consegui abrir a base de mercado (${esc(e instanceof Error ? e.message : String(e))}).</p></div>`; }
    db = await banco();
    if (!db) return;
    offs.push(db.collection<Movimento>('movimentos').onSnapshot((s) => { novos = s.docs.map(comId); recalcular(); }, () => {}));
    offs.push(db.collection<{ nome: string }>('alvos').onSnapshot((s) => { alvos = s.docs.map(comId); }, () => {}));
  })();
  return () => { abas.parar(); offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
