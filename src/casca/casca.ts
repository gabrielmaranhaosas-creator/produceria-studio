// Casca própria do Studio: menu lateral (Oficina, Comercial, Gestão), rotas por hash, busca Ctrl K, avisos,
// tema e aviso de conexão. Substitui o shell React do legado; cada tela é montada pelo registro de páginas.
import logo from './logo.svg?raw';
import { esc, brl } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { buscar, rotulo } from '../lib/servicos';
import { nomeProprio } from '../lib/arquivos';
import { abrirDialogo, devolverFoco, type DialogoComRetorno } from '../componentes';
import type { Montar } from '../paginas/dom';

export interface Item { h: string; l: string; rotas: string[] }
export interface Nicho { id: string; l: string; home: string; itens: Item[] }
export const NICHOS: Nicho[] = [
  { id: 'oficina', l: 'Oficina', home: 'ferramentas', itens: [{ h: 'ferramentas', l: 'Bancada', rotas: ['ferramentas'] }, { h: 'grafica', l: 'Gráfica', rotas: ['grafica'] }, { h: 'plugins', l: 'Plugins', rotas: ['plugins'] }, { h: 'agentes', l: 'Agentes', rotas: ['agentes'] }, { h: 'biblioteca', l: 'Biblioteca', rotas: ['biblioteca'] }, { h: 'casos', l: 'Casos', rotas: ['casos'] }] },
  { id: 'comercial', l: 'Comercial', home: 'central', itens: [{ h: 'central', l: 'Central de notícias', rotas: ['central'] }, { h: 'agenda', l: 'Agenda de contatos', rotas: ['agenda'] }, { h: 'captacao', l: 'Captação', rotas: ['captacao'] }, { h: 'mercado', l: 'Contas e agências', rotas: ['mercado'] }, { h: 'b2g', l: 'Licitações', rotas: ['b2g'] }, { h: 'vencedores', l: 'Vencedores', rotas: ['vencedores'] }, { h: 'contas', l: 'Mapa de contas', rotas: ['contas'] }, { h: 'estrategia', l: 'Estratégia e funil', rotas: ['estrategia', 'funil'] }] },
  { id: 'gestao', l: 'Gestão', home: 'rotinas', itens: [{ h: 'rotinas', l: 'Rotinas do Claude', rotas: ['rotinas'] }, { h: 'tabela', l: 'Tabela de serviços', rotas: ['tabela'] }, { h: 'ajustes', l: 'Ajustes e dados', rotas: ['ajustes'] }] },
];
/** Rota → página registrada. */
export const PAGINA: Record<string, string> = {
  painel: 'inicio', central: 'central', agenda: 'agenda', casos: 'casos', captacao: 'captacao', mercado: 'mercado', b2g: 'licitacoes', vencedores: 'vencedores',
  contas: 'contas', estrategia: 'estrategia', funil: 'funil', rotinas: 'rotinas', tabela: 'tabela', ajustes: 'ajustes', ferramentas: 'bancada', grafica: 'grafica',
  plugins: 'plugins', agentes: 'agentes', biblioteca: 'biblioteca',
};
const APELIDOS: Record<string, string> = { diversificacao: 'funil', mapa: 'funil', frentes: 'estrategia', swot: 'estrategia', ia: 'estrategia', agencias: 'mercado', personas: 'agentes', receitas: 'funil' };
/** Cabeçalho das telas do Comercial que não trazem o próprio. */
export const CABECALHOS: Record<string, { e: string; t: string; d: string }> = {
  central: { e: 'Comercial · Central', t: 'Notícias e leads', d: 'Tudo o que se move no mercado publicitário num lugar só: contas que trocaram de agência, contratos públicos vencidos, licitações abertas e notícias de negócio. Cada sinal pode virar alvo da Captação com um clique.' },
  agenda: { e: 'Comercial · Agenda', t: 'Quem contatar hoje', d: 'A cadência de cada alvo em ordem de prazo e prioridade. Registre cada contato aqui: a etapa avança sozinha, o próximo toque é sugerido pela cadência e a conversão por origem passa a ser medida.' },
  casos: { e: 'Oficina · Casos', t: 'Casos da casa', d: 'O portfólio que vira argumento de venda. Cada caso diz o que a Produceria fez, para quem e com que resultado.' },
  contas: { e: 'Comercial · Mapa de contas', t: 'Quem detém cada conta', d: 'Empresas e agências que detêm contas públicas e privadas, com cliente, serviço, valor e vigência. Filtre e veja os dashboards.' },
  captacao: { e: 'Comercial · Captação', t: 'Novos negócios', d: 'Quem procurar, por que agora e o que dizer. Os sinais saem dos seus dados; os alvos, de textos reais que você cola; a abordagem, da IA com as provas da casa. Nada é enviado sem você.' },
  funil: { e: 'Comercial · Estratégia e funil', t: 'De onde vem a receita', d: 'Receita orçada por canal (privado, público, internacional), concentração por cliente e o funil de oportunidades.' },
  mercado: { e: 'Comercial · Contas e agências', t: 'Quem atende quem no mercado privado', d: 'Agências, contas e movimentações do mercado publicitário, cada linha com a fonte. Quem acabou de ganhar conta precisa de capacidade de produção: é a hora de abordar.' },
  vencedores: { e: 'Comercial · Vencedores de licitações', t: 'Quem já ganhou contrato público', d: 'Todos os contratos publicados no PNCP nos últimos 24 meses que tocam o que a Produceria faz: vencedor, valor, vigência e link. Daqui saem as empresas para abordar, os órgãos com contrato vencendo e os preços de referência.' },
  b2g: { e: 'Comercial · Licitações', t: 'Contratos públicos', d: 'Radar do PNCP filtrado pelas atividades do hub, carteira de certames e habilitação das três empresas.' },
  estrategia: { e: 'Comercial · Estratégia e funil', t: 'SWOT e frentes', d: 'Forças e fraquezas do hub, oportunidades e ameaças do mercado, cada item com evidência. Os cruzamentos viram frentes de receita.' },
};

/** Hash → rota conhecida (ou o Início). */
export function rotaDe(hash: string): string {
  const h = hash.replace(/^#/, '').split(/[/?]/)[0];
  const r = APELIDOS[h] || h;
  return PAGINA[r] ? r : 'painel';
}
export const nichoDe = (rota: string) => NICHOS.find((n) => n.itens.some((i) => i.rotas.includes(rota)));

const IR = [
  ['Início · o que fazer agora', 'painel'], ['Oficina · bancada, agentes, biblioteca', 'ferramentas'], ['Central de notícias e leads', 'central'], ['Agenda · quem contatar hoje', 'agenda'],
  ['Casos da casa (portfólio)', 'casos'], ['Captação de novos negócios', 'captacao'], ['Contas e agências do mercado', 'mercado'], ['Vencedores de licitações', 'vencedores'],
  ['Funil comercial', 'funil'], ['Gráfica · ficha técnica e fechamento', 'grafica'], ['Plugins · Photoshop, Magnific, Firefly', 'plugins'], ['Licitações', 'b2g'],
  ['Estratégia · SWOT', 'estrategia'], ['Rotinas do Claude · rodar, pausar', 'rotinas'], ['Tabela de serviços', 'tabela'], ['Ajustes e dados', 'ajustes'],
].map(([titulo, h]) => ({ tipo: 'Ir', titulo, href: '#' + h }));
const sem = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const casa = (q: string, ...t: unknown[]) => { const termos = sem(q).split(/\s+/).filter(Boolean), alvo = sem(t.join(' ')); return termos.length > 0 && termos.every((x) => alvo.includes(x)); };
export interface Achado { tipo: string; titulo: string; sub?: string; href: string }
type Doc = Record<string, unknown> & { id: string };

/** Resultados da busca Ctrl K: telas, serviços da tabela, alvos, licitações, frentes e itens da SWOT. */
export function buscarTudo(q: string, d: { alvos: Doc[]; b2g: Doc[]; frentes: Doc[]; swot: Doc[] }): Achado[] {
  if (!q.trim()) return IR;
  const r: Achado[] = IR.filter((x) => casa(q, x.titulo));
  for (const s of buscar(q, 6)) r.push({ tipo: 'Serviço', titulo: rotulo(s), sub: `ID ${s.id} · ${brl(s.ref)}`, href: '#tabela' });
  for (const a of d.alvos) if (casa(q, a.nome, a.contato, a.gatilho)) r.push({ tipo: 'Alvo', titulo: String(a.nome), sub: String(a.status || ''), href: '#captacao' });
  for (const o of d.b2g) if (casa(q, o.objeto, o.orgao)) r.push({ tipo: 'Licitação', titulo: String(o.objeto || '').slice(0, 100), sub: String(o.orgao || ''), href: '#b2g' });
  for (const f of d.frentes) if (casa(q, f.nome)) r.push({ tipo: 'Frente', titulo: String(f.nome), href: '#estrategia' });
  for (const s of d.swot) if (casa(q, s.texto)) r.push({ tipo: 'SWOT', titulo: String(s.texto), href: '#estrategia' });
  return r.slice(0, 30);
}

const VISTO = 'studio.avisos.visto';
const lerVisto = () => { try { return localStorage.getItem(VISTO) || ''; } catch { return ''; } };
export const quandoAviso = (em: string, agora = Date.now()) => { const m = (agora - new Date(em).getTime()) / 6e4; return m < 1 ? 'agora' : m < 60 ? `há ${Math.floor(m)} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : new Date(em).toLocaleDateString('pt-BR'); };

export function iniciarCasca(raiz: HTMLElement, paginas: Record<string, Montar>, estilos: () => void) {
  try { const t = localStorage.getItem('studio-tema'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch { /* sem armazenamento */ }
  estilos();
  raiz.innerHTML = `<div class="topbar"><a class="mark" href="#painel" aria-label="PRODUCERIA, Início">${logo}</a><button type="button" class="btn ghost sm" id="csMenu" aria-expanded="false" aria-controls="csRail">Menu</button></div>
  <div class="shell"><aside class="rail" id="csRail" aria-label="Navegação">
    <a class="mark" href="#painel" aria-label="PRODUCERIA, Início">${logo}</a>
    <span class="caption">PRODUCERia Studio · Das ideias à produção.</span>
    <button type="button" class="rail-avisos" id="csAv" aria-haspopup="dialog"></button>
    <a class="rail-inicio" href="#painel" id="csIni">Início <span class="caption">o que fazer agora</span></a>
    <div class="nichos" role="tablist" aria-label="Nicho de trabalho" id="csN"></div>
    <nav id="csNav" aria-label="Telas"></nav>
    <button type="button" class="rail-busca" id="csBusca"><span>Buscar ou ir para…</span><span class="k">Ctrl K</span></button>
    <div class="cs-pe"><span class="caption" id="csDados">Conectando…</span><button type="button" class="btn ghost sm" id="csFechar" hidden>Fechar menu</button></div>
  </aside><main class="main" id="conteudo" tabindex="-1"></main></div>
  <div class="mc cs-camadas"><dialog id="csAvD" class="cs-avisos" aria-labelledby="csAvT"></dialog></div>
  <div class="toast" role="status" id="csToast" hidden></div><div class="aviso-fixo" role="alert" id="csOff" hidden>Sem conexão. As alterações não serão salvas até voltar.</div>
  <div class="paleta-fundo" id="csPal" hidden><div class="paleta" role="dialog" aria-modal="true" aria-label="Buscar e ir"><input class="paleta-inp" id="csPalQ" placeholder="Buscar serviço, alvo, licitação, frente… ou ir para uma tela" aria-label="Buscar" aria-controls="csPalL" role="combobox" aria-expanded="true" autocomplete="off"><div class="paleta-lista" role="listbox" id="csPalL"></div><div class="paleta-pe caption">↑↓ escolher · Enter abrir · Esc fechar</div></div></div>`;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => raiz.querySelector(s) as T;
  const main = $('#conteudo'), rail = $('#csRail'), D = $<DialogoComRetorno>('#csAvD');
  let desmontar: (() => void) | void | null = null, rotaAtual = '', nicho = (() => { try { return localStorage.getItem('studio.nicho') || 'oficina'; } catch { return 'oficina'; } })();
  let db: Banco | null = null, avisos: Doc[] = [], visto = lerVisto(), soMeus = false, meuNome = '', inicio = new Date().toISOString(), toastT: ReturnType<typeof setTimeout> | null = null;
  const vistos = new Set<string>();
  const dados = { alvos: [] as Doc[], b2g: [] as Doc[], frentes: [] as Doc[], swot: [] as Doc[] };
  let achados: Achado[] = [], sel = 0, voltarFoco: HTMLElement | null = null;
  devolverFoco(D, () => $('#csAv'));

  function toast(t: string) { const el = $('#csToast'); el.textContent = t; el.hidden = false; if (toastT) clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3600); }
  function menu(aberto: boolean) { rail.classList.toggle('open', aberto); $('#csMenu').setAttribute('aria-expanded', String(aberto)); $('#csFechar').hidden = !aberto; if (aberto) $<HTMLElement>('#csRail a, #csRail button').focus(); }

  function navegar() {
    const rota = rotaDe(location.hash), n = nichoDe(rota);
    if (n) { nicho = n.id; try { localStorage.setItem('studio.nicho', n.id); } catch { /* sem armazenamento */ } }
    const atual = NICHOS.find((x) => x.id === nicho) || NICHOS[0];
    $('#csN').innerHTML = NICHOS.map((x) => `<button type="button" role="tab" aria-selected="${x.id === atual.id}" class="${x.id === atual.id ? 'on' : ''}" data-nicho="${x.id}">${x.l}</button>`).join('');
    $('#csNav').innerHTML = atual.itens.map((i) => `<a href="#${i.h}"${i.rotas.includes(rota) ? ' aria-current="page"' : ''}><span style="flex:1">${i.l}</span></a>`).join('');
    const ini = $('#csIni'); ini.classList.toggle('on', rota === 'painel'); if (rota === 'painel') ini.setAttribute('aria-current', 'page'); else ini.removeAttribute('aria-current');
    menu(false);
    if (rota === rotaAtual) return;
    rotaAtual = rota;
    try { if (typeof desmontar === 'function') desmontar(); } catch { /* a tela já saiu */ }
    const cab = CABECALHOS[rota];
    main.innerHTML = (cab ? `<header class="page-head"><span class="eyebrow">${esc(cab.e)}</span><h1 class="d d-title">${esc(cab.t)}</h1><p class="lead measure muted">${esc(cab.d)}</p></header>` : '')
      + (rota === 'funil' || rota === 'estrategia' ? `<nav class="tabs" aria-label="Estratégia e funil"><a class="tab${rota === 'estrategia' ? ' on' : ''}" href="#estrategia"${rota === 'estrategia' ? ' aria-current="page"' : ''}>SWOT e frentes</a><a class="tab${rota === 'funil' ? ' on' : ''}" href="#funil"${rota === 'funil' ? ' aria-current="page"' : ''}>Funil e receita</a></nav>` : '')
      + '<div class="mc cn" id="csPag"></div>';
    const alvo = $('#csPag'), m = paginas[PAGINA[rota]];
    alvo.dataset.th = document.documentElement.getAttribute('data-theme') || '';
    try { desmontar = m ? m(alvo) : null; }
    catch (e) { console.error(e); alvo.innerHTML = '<div class="wrap"><div class="empty"><h2 class="d d-sub">Esta página não carregou</h2><p class="note">Recarregue o Studio. Se continuar, avise quem cuida do sistema.</p></div></div>'; }
    window.scrollTo(0, 0);
    document.title = `${cab?.t || atual.itens.find((i) => i.rotas.includes(rota))?.l || 'Início'} · PRODUCERia Studio`;
  }

  // ---------------------------------------------------------------- avisos
  const naoLidos = () => avisos.filter((a) => String(a.em) > visto && (!a.para || !meuNome || a.para === meuNome)).length;
  function botaoAvisos() {
    const n = naoLidos(), b = $('#csAv');
    b.className = 'rail-avisos' + (n ? ' novo' : '');
    b.setAttribute('aria-label', `Avisos: ${n} não lido(s)`);
    b.innerHTML = `<span>Avisos</span>${n ? `<span class="badge num">${n > 99 ? '99+' : n}</span>` : '<span class="caption">em dia</span>'}`;
  }
  function listaAvisos() {
    const L = [...avisos].sort((a, b) => String(b.em).localeCompare(String(a.em))).filter((a) => !soMeus || !a.para || a.para === meuNome).slice(0, 60);
    const corpo = D.querySelector('#csAvL'); if (!corpo) return;
    corpo.innerHTML = L.length ? `<ul class="vc-l">${L.map((a) => `<li><a class="cs-aviso${String(a.em) > visto ? ' novo' : ''}" href="${esc(a.link || '#painel')}" data-fecha="1"><span class="aviso-tipo">${a.tipo === 'rotina' ? 'Rotina' : a.tipo === 'equipe' ? 'Equipe' : 'Studio'}</span><span class="vc-c"><b>${esc(a.titulo)}</b>${a.texto ? `<span class="note cs-pre">${esc(a.texto)}</span>` : ''}<span class="note">${quandoAviso(String(a.em))}${a.de ? ' · ' + esc(a.de) : ''}${a.para ? ' · para ' + esc(a.para) : ''}</span></span></a></li>`).join('')}</ul>`
      : '<p class="note">Nenhum aviso ainda. As rotinas do Claude e as ações da equipe (proposta, novo cliente, rotina acionada) aparecem aqui.</p>';
  }
  function abrirAvisos() {
    abrirDialogo(D, `<div class="dh"><div><span class="lab">Rotinas do Claude e equipe</span><h2 class="d d-sub" id="csAvT">Avisos</h2></div><button type="button" class="x" id="csAvX" aria-label="Fechar">×</button></div>
    <div class="acts"><button type="button" class="chip" data-meus="0" aria-pressed="${!soMeus}">Todos</button>${meuNome ? `<button type="button" class="chip" data-meus="1" aria-pressed="${soMeus}">Para ${esc(meuNome)}</button>` : ''}<button type="button" class="lnk" id="csAvLido">Marcar como lidos</button></div><div id="csAvL"></div>`, $('#csAv'), '#csAvX');
    listaAvisos();
  }
  function marcarLidos() { visto = new Date().toISOString(); try { localStorage.setItem(VISTO, visto); } catch { /* sem armazenamento */ } botaoAvisos(); listaAvisos(); }
  D.addEventListener('close', marcarLidos);
  D.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('#csAvX')) { D.close(); return; }
    if (t.closest('#csAvLido')) { marcarLidos(); return; }
    const m = t.closest<HTMLElement>('[data-meus]'); if (m) { soMeus = m.dataset.meus === '1'; D.querySelectorAll('[data-meus]').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.meus === m.dataset.meus))); listaAvisos(); return; }
    if (t.closest('[data-fecha]')) D.close();
  });

  // ---------------------------------------------------------------- busca
  function paleta(aberta: boolean) {
    const p = $('#csPal');
    if (aberta) { voltarFoco = document.activeElement as HTMLElement; p.hidden = false; const q = $<HTMLInputElement>('#csPalQ'); q.value = ''; sel = 0; resultados(); q.focus(); }
    else { p.hidden = true; voltarFoco?.focus?.(); }
  }
  function resultados() {
    achados = buscarTudo($<HTMLInputElement>('#csPalQ').value, dados);
    const q = $<HTMLInputElement>('#csPalQ').value;
    $('#csPalL').innerHTML = achados.length ? achados.map((a, i) => `<button type="button" role="option" id="csOp${i}" aria-selected="${i === sel}" class="paleta-item${i === sel ? ' on' : ''}" data-i="${i}"><span class="paleta-tipo">${esc(a.tipo)}</span><span style="min-width:0"><span class="small" style="display:block;font-weight:500">${esc(a.titulo)}</span>${a.sub ? `<span class="caption">${esc(a.sub)}</span>` : ''}</span></button>`).join('') : `<p class="caption" style="padding:16px">Nada com “${esc(q)}”.</p>`;
    $('#csPalQ').setAttribute('aria-activedescendant', achados.length ? 'csOp' + sel : '');
    $(`#csOp${sel}`)?.scrollIntoView({ block: 'nearest' });
  }
  const ir = (a: Achado) => { paleta(false); location.hash = a.href.slice(1); };
  $('#csPalQ').addEventListener('input', () => { sel = 0; resultados(); });
  $('#csPalQ').addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); paleta(false); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(achados.length - 1, sel + 1); resultados(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); resultados(); }
    else if (ev.key === 'Enter' && achados[sel]) { ev.preventDefault(); ir(achados[sel]); }
  });
  $('#csPal').addEventListener('mousedown', (ev) => { if (ev.target === ev.currentTarget) paleta(false); });
  $('#csPalL').addEventListener('click', (ev) => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (b) ir(achados[Number(b.dataset.i)]); });
  $('#csPalL').addEventListener('mousemove', (ev) => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (b && Number(b.dataset.i) !== sel) { sel = Number(b.dataset.i); resultados(); } });

  // ---------------------------------------------------------------- eventos gerais
  raiz.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const n = t.closest<HTMLElement>('[data-nicho]');
    if (n) { const x = NICHOS.find((y) => y.id === n.dataset.nicho)!; nicho = x.id; location.hash = x.home; return; }
    if (rail.classList.contains('open') && !t.closest('#csRail') && !t.closest('#csMenu')) { menu(false); return; }
    if (t.closest('#csMenu')) { menu(true); return; }
    if (t.closest('#csFechar')) { menu(false); $('#csMenu').focus(); return; }
    if (t.closest('#csBusca')) { paleta(true); return; }
    if (t.closest('#csAv')) abrirAvisos();
  });
  window.addEventListener('hashchange', navegar);
  window.addEventListener('keydown', (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); paleta($('#csPal').hidden); }
    else if (ev.key === 'Escape' && rail.classList.contains('open')) { menu(false); $('#csMenu').focus(); }
  });
  const conexao = () => { $('#csOff').hidden = navigator.onLine !== false; };
  window.addEventListener('online', conexao); window.addEventListener('offline', conexao); conexao();

  botaoAvisos(); navegar();
  (async () => {
    db = await banco();
    $('#csDados').textContent = db ? 'Dados compartilhados com a equipe' : 'Dados só nesta sessão';
    meuNome = await nomeProprio();
    if (!db) return;
    db.collection<Doc>('notificacoes').onSnapshot((s) => {
      avisos = s.docs.map((d) => ({ ...d.data(), id: d.id }));
      for (const a of avisos) if (String(a.em) > inicio && !vistos.has(a.id)) { vistos.add(a.id); if (!a.para || !meuNome || a.para === meuNome) toast(`🔔 ${a.titulo}`); }
      botaoAvisos(); if (D.open) listaAvisos();
    }, () => {});
    for (const c of ['alvos', 'b2g', 'frentes', 'swot'] as const) db.collection<Doc>(c).onSnapshot((s) => { dados[c] = s.docs.map((d) => ({ ...d.data(), id: d.id })); }, () => {});
  })();
  return { navegar };
}
