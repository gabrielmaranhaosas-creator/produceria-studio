// Rotinas do Claude: o que roda sozinho (lista, rodar agora, pausar, ver instrução) e o último resultado de cada uma.
// Fala com as rotinas pelo conector "Claude Code Remote" (capability `mcp` do claude.ai).
import { esc, int } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { seletor, comId } from './dom';

interface Mcp { callTool(servidor: string, ferramenta: string, args: object, o?: object): Promise<{ payload?: unknown } | undefined> }
export interface Rotina {
  id: string; name: string; enabled: boolean; cron_expression?: string; run_once_at?: string; next_run_at?: string; last_fired_at?: string;
  last_run?: { status?: string; fired_at?: string }; derived_state?: { prompt?: string };
}

/** O que cada rotina faz, pelo nome (rotinas/README.md). */
export const DESCRICOES: Record<string, string> = {
  'Central de notícias · coleta diária': 'Nos dias úteis de manhã, recolhe notícias de mercado (contas, licitações, in-house, negócios) para a Central de notícias e registra as trocas de conta em Contas e agências.',
  'Captação · radar semanal de alvos': 'Toda sexta, transforma os sinais da semana em até 10 alvos da Captação, com fonte e próximo toque.',
  'Captação · triagem semanal B2B': 'Toda segunda, recalcula a nota dos alvos e aponta quem abordar na semana.',
  'Cérebro de licitações · varredura diária': 'Varre o PNCP toda madrugada, pontua pelo escopo do hub, coloca as novas no radar e arquiva as vencidas há mais de 60 dias.',
  'Licitações · triagem semanal': 'Toda segunda, separa as candidatas da semana e registra o retorno da equipe sobre o radar.',
  'Vencedores · atualização mensal': 'Todo dia 2, busca no PNCP os contratos novos do mês e soma ao mapa de Vencedores.',
  'Produção · rotina diária do estúdio': 'Distribuía tarefas da produção. Pausada: a produção saiu do escopo do Studio.',
  'Aprovações e prazos · alerta da tarde': 'Vigiava peças paradas com o cliente e prazos. Pausada.',
  'Relatório de craft · mensal': 'Relatório de rodadas e aprovação na primeira por cliente. Pausada.',
};
export const POSSIVEIS = [
  { n: 'Fomento e editais culturais', d: 'Toda semana, procura editais de audiovisual (ProAC, Spcine, FSA) e coloca no funil público.' },
  { n: 'Concentração de receita', d: 'Todo mês, recalcula quanto da receita vem do maior cliente e avisa se passar de 30%.' },
];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const ERROS: Record<string, string> = {
  server_not_connected: 'O conector das rotinas do Claude não está ativo na sua conta.', server_not_found: 'O conector das rotinas do Claude não está ativo na sua conta.',
  not_granted: 'O acesso às rotinas não foi permitido. Clique em Atualizar para permitir.', consent_required: 'Permita o acesso no aviso do Claude.', approval_required: 'Permita o acesso no aviso do Claude.',
  needs_reauth: 'A conexão expirou. Reconecte nas configurações do Claude.', rate_limited: 'Muitas chamadas seguidas. Espere alguns segundos.',
};
export const erroRotina = (e: unknown) => ERROS[(e as { code?: string })?.code || ''] || 'Não foi possível falar com as rotinas agora. Tente de novo.';
export const quando = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Agenda legível: "Dias úteis às 07:12", "Toda sexta às 08:35", "Dia 2 às 05:47". */
export function agenda(cron?: string, umaVez?: string): string {
  if (umaVez) return 'Uma vez · ' + quando(umaVez);
  if (!cron) return 'Só quando acionada';
  const p = cron.replace(/^CRON_TZ=\S+\s+/, '').trim().split(/\s+/);
  if (p.length !== 5) return cron;
  const [min, h, dia, mes, sem] = p;
  if (!/^\d+$/.test(min) || !/^\d+$/.test(h) || mes !== '*') return cron;
  const hora = `${h.padStart(2, '0')}:${min.padStart(2, '0')}`, fuso = cron.startsWith('CRON_TZ=') ? '' : ' (UTC)';
  if (dia !== '*') return /^\d+$/.test(dia) && sem === '*' ? `Dia ${dia} às ${hora}${fuso}` : cron;
  const q = sem === '*' ? 'Todo dia' : sem === '1-5' ? 'Dias úteis' : /^\d$/.test(sem) ? `Toda ${DIAS[Number(sem)]}` : `Dias ${sem}`;
  return `${q} às ${hora}${fuso}`;
}
export function estado(r: Rotina): { t: string; tag: string } {
  if (!r.enabled) return { t: 'Pausada', tag: 'w' };
  const s = r.last_run?.status;
  if (!s) return { t: 'Ainda não rodou', tag: 'w' };
  if (s.includes('SUCCEEDED')) return { t: 'Última: deu certo', tag: 'ok' };
  if (s.includes('FAILED')) return { t: 'Última: falhou', tag: 'erro' };
  if (s.includes('RUNNING') || s.includes('PENDING')) return { t: 'Rodando agora', tag: 'aviso' };
  return { t: s.replace('ROUTINE_RUN_STATUS_', '').toLowerCase(), tag: 'w' };
}

let mcp: Promise<Mcp | null> | null = null;
const conector = () => (mcp ??= window.claude?.use ? (window.claude.use('mcp') as Promise<Mcp>).catch(() => null) : Promise.resolve(null));
async function chamar(ferramenta: string, args: object): Promise<unknown> {
  const m = await conector();
  if (!m) throw { code: 'server_not_connected' };
  return (await m.callTool('Claude Code Remote', ferramenta, args, { cache: false }))?.payload;
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc ro">
  <header class="page-head"><span class="eyebrow">Gestão · Rotinas do Claude</span><h1 class="d d-title">O que roda sozinho</h1>
    <p class="lead measure muted">Rotinas agendadas que o Claude executa em horário fixo: varrem licitações, recolhem notícias, procuram clientes e atualizam os vencedores. Daqui você vê quando cada uma rodou, roda na hora ou pausa. O resultado chega no sino de Avisos.</p></header>
  <div id="roE"></div><p class="sr" id="roLive" aria-live="polite" aria-atomic="true"></p>
  <section aria-labelledby="ro-h"><div class="ph"><h2 class="d d-sub" id="ro-h">Rotinas</h2><button type="button" class="ghost sm" id="roAt">Atualizar</button></div><div id="roL"><p class="note">Carregando… na primeira vez o Claude pede sua permissão.</p></div></section>
  <section aria-label="Últimos resultados" class="ro-res" id="roR"></section>
  <section aria-labelledby="ro-p"><div class="ph"><h2 class="d d-sub" id="ro-p">Próximas rotinas possíveis</h2><span class="note">peça ao Claude na conversa para criar</span></div>
    <div class="mk-guias">${POSSIVEIS.map((x) => `<div class="lc-box"><b>${esc(x.n)}</b><p class="note">${esc(x.d)}</p><p class="note">Para criar: escreva ao Claude “crie a rotina ${esc(x.n.toLowerCase())} do Studio”.</p></div>`).join('')}</div></section>
</div>`;
  const $ = seletor(root);
  let lista: Rotina[] | null = null, erro = '', ocupada = '', aberta = '', db: Banco | null = null;
  let status: Record<string, Record<string, unknown>> = {};
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#roLive').textContent = t; };

  async function carregar() {
    erro = '';
    try { const r = (await chamar('list_triggers', { limit: 50 })) as { data?: Rotina[] } | undefined; lista = Array.isArray(r?.data) ? r!.data! : []; }
    catch (e) { erro = erroRotina(e); }
    render();
  }

  function render() {
    $('#roE').innerHTML = erro ? `<div class="lc-box ro-erro" role="alert"><p>${esc(erro)}</p><button type="button" class="sm" data-at="1">Tentar de novo</button></div>` : '';
    $('#roL').innerHTML = lista === null ? (erro ? '' : '<p class="note">Carregando… na primeira vez o Claude pede sua permissão.</p>') : !lista.length ? '<p class="note">Nenhuma rotina nesta conta.</p>'
      : `<ul class="vc-l">${[...lista].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)).map((r) => {
        const e = estado(r);
        return `<li class="ro-it${r.enabled ? '' : ' pausada'}"><div class="vc-c"><div class="ro-nome"><b>${esc(r.name)}</b><span class="tag ${e.tag}">${esc(e.t)}</span></div>
          ${DESCRICOES[r.name] ? `<span class="note">${esc(DESCRICOES[r.name])}</span>` : ''}
          <span class="note">${esc(agenda(r.cron_expression, r.run_once_at))} · próxima: ${r.enabled ? quando(r.next_run_at) : '—'} · última: ${quando(r.last_run?.fired_at || r.last_fired_at)}</span>
          ${aberta === r.id ? `<div class="lc-pre ro-instr">${esc(r.derived_state?.prompt || 'Instrução não disponível.')}</div>` : ''}</div>
          <div class="ro-acoes"><button type="button" class="sm" data-rodar="${esc(r.id)}" ${ocupada === r.id ? 'disabled' : ''}>${ocupada === r.id ? '…' : 'Rodar agora'}</button>
            <button type="button" class="ghost sm" data-pausa="${esc(r.id)}" ${ocupada === r.id ? 'disabled' : ''}>${r.enabled ? 'Pausar' : 'Ativar'}</button>
            <button type="button" class="lnk" data-ver="${esc(r.id)}" aria-expanded="${aberta === r.id}">${aberta === r.id ? 'Fechar instrução' : 'Ver instrução'}</button></div></li>`;
      }).join('')}</ul>`;
    const st = status.status, bk = status.backup;
    $('#roR').innerHTML = `<div class="lc-box"><span class="lab">Último resultado · licitações</span>${st ? `<p>${esc(String(st.tipo || 'varredura'))} · ${quando(String(st.ultimaVarredura || ''))}</p>
      <p><b class="num">${st.novos != null ? int(Number(st.novos)) : '—'}</b> oportunidades novas de <b class="num">${st.lidos != null ? int(Number(st.lidos)) : '—'}</b> lidas${st.perfil ? ` · perfil ${esc(String(st.perfil))}` : ''}</p>
      ${st.erro ? `<p><b>Erro:</b> ${esc(String(st.erro))}</p>` : ''}<a class="cn-f" href="#b2g">Abrir Licitações</a>` : '<p class="note">Ainda sem resultado gravado.</p>'}</div>
      <div class="lc-box"><span class="lab">Último resultado · backup semanal</span>${bk ? `<p>${quando(String(bk.em || bk.ultimo || bk.data || ''))}${bk.arquivo ? ' · ' + esc(String(bk.arquivo)) : ''}</p>
      ${bk.erro ? `<p><b>Erro:</b> ${esc(String(bk.erro))}</p>` : `<p class="note">${bk.documentos != null ? `${int(Number(bk.documentos))} documentos copiados para o Google Drive.` : 'Cópia guardada no Google Drive.'}</p>`}` : '<p class="note">Ainda sem resultado gravado.</p>'}</div>`;
  }

  async function acao(id: string, fazer: (r: Rotina) => Promise<void>) {
    const r = lista?.find((x) => x.id === id);
    if (!r || ocupada) return;
    ocupada = id; render();
    try { await fazer(r); } catch (e) { avisar(erroRotina(e)); erro = erroRotina(e); }
    finally { ocupada = ''; render(); }
  }

  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    const d = b.dataset;
    if (b.id === 'roAt' || d.at) { lista = lista && erro ? null : lista; carregar(); return; }
    if (d.ver) { aberta = aberta === d.ver ? '' : d.ver; render(); root.querySelector<HTMLElement>(`[data-ver="${CSS.escape(d.ver)}"]`)?.focus(); return; }
    if (d.rodar) acao(d.rodar, async (r) => {
      await chamar('fire_trigger', { trigger_id: r.id, text: 'Execução pedida pela equipe no PRODUCERia Studio.' });
      avisar(`${r.name}: rodando agora. O aviso chega quando terminar.`);
      if (db) { const id = 'av-' + Date.now().toString(36); db.collection('notificacoes').doc(id).set({ id, tipo: 'rotina', titulo: `${r.name} foi acionada`, texto: 'Rodando fora do horário, a pedido da equipe.', link: '#rotinas', em: new Date().toISOString() }).catch(() => {}); }
      setTimeout(carregar, 4000);
    });
    if (d.pausa) acao(d.pausa, async (r) => {
      await chamar('update_trigger', { trigger_id: r.id, enabled: !r.enabled });
      avisar(r.enabled ? `${r.name} pausada.` : `${r.name} ativada.`);
      await carregar();
    });
  });

  render();
  (async () => {
    const m = await conector();
    if (!m) { erro = 'As rotinas aparecem com o Studio aberto no Claude, na conta que as criou.'; lista = null; render(); }
    else carregar();
    db = await banco();
    if (db) offs.push(db.collection<Record<string, unknown>>('cerebro').onSnapshot((s) => { status = Object.fromEntries(s.docs.map((x) => [x.id, comId(x)])); render(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
