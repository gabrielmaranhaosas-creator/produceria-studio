// Mesa comercial: a diretora comercial da casa escolhe quem abordar no multiverso, escreve cada e-mail com a ponte
// e o gatilho certos e, depois que você revisa, deixa o rascunho no Gmail da PRODUCERIA (capability `mcp`).
// Depois confere no Gmail quem foi enviado, quem respondeu, quem pediu para sair e qual e-mail voltou, avança o alvo
// na Agenda e mede a taxa de resposta por porta, tipo de contato, distância e objetivo.
// Só usa contatos publicados, com fonte; respeita quem pediu para sair e o intervalo entre e-mails.
import { esc, int, dt } from '../lib/formato';
import { hoje as hojeISO } from '../lib/datas';
import { banco, lerBase, type Colecao } from '../lib/db';
import { montarGrafo, type MercadoBase, type MovimentoBase, type EmpresaMapa, type AgenciaMapa, type PessoaMapa } from '../lib/grafo';
import { montarUniverso, reacao, multiverso, ORIGEM, type PessoaInv, type OrgInv, type LigacaoInv } from '../lib/investigacao';
import { perguntar, ErroIA } from '../lib/ia';
import { destinos, impedimento, pedidoMensagem, htmlEmail, textoEmail, resumo, idBloqueio, PERSONA, LIMITE_LOTE, LIMITE_DIA, ENVIO_LIBERADO, levarPara, focoPendente, FOCO_MESA, situacaoDe, pendente, consultas, conferir, placar, type ContatoOrg, type Disparo, type Bloqueio, type Destino, type Situacao, type LinhaPlacar } from '../lib/comercial';
import { registrarContato, sugerirProximo, type Resultado } from '../lib/cadencia';
import { mesmaEmpresa, slug } from '../lib/nomes';
import type { Alvo, Caso } from '../lib/tipos';
import { seletor, elDe, comId } from './dom';
import { kpis } from '../componentes';

interface Mcp { callTool(servidor: string, ferramenta: string, args: object, o?: object): Promise<{ payload?: unknown } | undefined> }
interface ItemFila { id: string; objetivo?: string; email: string; assunto: string; corpo: string; estrategia: string; linkedin: string; proximo: string; ok: boolean; estado: '' | 'escrevendo' | 'enviando' | 'enviado' | 'rascunho' | 'erro'; erro?: string }

const ERROS: Record<string, string> = {
  envio_desligado: 'O envio está desligado por enquanto. Crie o rascunho no Gmail.', server_not_connected: 'O Gmail não está conectado nesta conta do Claude. Conecte em Configurações › Conectores.', server_not_found: 'O Gmail não está conectado nesta conta do Claude.',
  not_granted: 'O envio pelo Gmail não foi permitido. Clique de novo para permitir.', consent_required: 'Permita o envio no aviso do Claude.', approval_required: 'Permita o envio no aviso do Claude.',
  needs_reauth: 'A conexão com o Gmail expirou. Reconecte nas configurações do Claude.', rate_limited: 'Muitos envios seguidos. Espere um minuto.', tool_error: 'O Gmail recusou a mensagem. Confira o endereço.',
};
const erroGmail = (e: unknown) => ERROS[(e as { code?: string })?.code || ''] || 'Não foi possível falar com o Gmail agora. Tente de novo.';
const FILA = 'studio.disparos.fila';
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, ''); } catch { return 'fonte'; } };
const SIT: Record<Situacao, [string, string]> = {
  rascunho: ['rascunho no Gmail', 'w'], enviado: ['enviado, sem resposta', 'aviso'], respondeu: ['respondeu', 'ok'],
  'sem interesse': ['sem interesse agora', ''], sair: ['pediu para sair', 'erro'], voltou: ['e-mail voltou', 'erro'],
};
const CONF = 'studio.disparos.conferido';
let msgConf = '';

let mcp: Promise<Mcp | null> | null = null;
const conector = () => (mcp ??= window.claude?.use ? (window.claude.use('mcp') as Promise<Mcp>).catch(() => null) : Promise.resolve(null));
async function gmail(ferramenta: 'send_message' | 'create_draft' | 'search_threads', args: object): Promise<{ id?: string; threadId?: string }> {
  if (ferramenta === 'send_message' && !ENVIO_LIBERADO) throw { code: 'envio_desligado' };
  const m = await conector();
  if (!m) throw { code: 'server_not_connected' };
  return ((await m.callTool('Gmail', ferramenta, args, { cache: false }))?.payload || {}) as { id?: string };
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap dp">
 <section class="dp-persona" aria-labelledby="dpP"><span class="lab">Quem escreve</span><h2 class="d d-sub" id="dpP">${esc(PERSONA.nome)}</h2><p class="measure">${esc(PERSONA.foco)}</p>
  <details><summary class="lnk">Como ela pensa e escreve</summary><div class="lc-pre">${esc(PERSONA.guia)}</div></details></section>
 <section class="kpis" id="dpK" aria-label="Contatos do multiverso"></section>
 <p class="note measure">Só entram contatos publicados: e-mail que a própria empresa ou pessoa divulgou, sempre com a página de origem, e o perfil do LinkedIn. Nada de endereço deduzido. Cada envio leva a opção de sair da lista, fica registrado e respeita ${int(30)} dias entre e-mails para o mesmo endereço e ${int(LIMITE_DIA)} envios por dia.</p>
 <section aria-labelledby="dpLT"><div class="ph"><h2 class="d d-sub" id="dpLT">Quem abordar</h2><span class="note" id="dpN"></span></div>
  <div class="dp-ctl">
   <div class="seg sm" id="dpF" role="group" aria-label="Canal"><button type="button" data-f="email" aria-pressed="true">Com e-mail</button><button type="button" data-f="linkedin" aria-pressed="false">Só LinkedIn</button><button type="button" data-f="" aria-pressed="false">Todos</button></div>
   <div class="seg sm" id="dpA" role="group" aria-label="Alcance"><button type="button" data-a="dentro" aria-pressed="true">Ao alcance</button><button type="button" data-a="fora" aria-pressed="false">Fora de alcance</button><button type="button" data-a="" aria-pressed="false">Todos</button></div>
   <div class="f dp-q"><label for="dpQ">Buscar</label><input id="dpQ" type="search" placeholder="Empresa, agência ou pessoa" autocomplete="off"></div>
  </div>
  <div class="f"><label for="dpO">Objetivo deste disparo</label><input id="dpO" placeholder="Ex.: oferecer desdobramento de peças para a campanha de fim de ano"></div>
  <div class="acts"><button type="button" id="dpEsc" disabled>Escrever para os selecionados</button><span class="note">até ${LIMITE_LOTE} por vez; a persona escreve um e-mail diferente para cada um</span></div>
  <p class="dp-foco" id="dpFoco" role="status" hidden></p><ol class="dp-l" id="dpL"></ol><p id="dpM"></p></section>
 <section aria-labelledby="dpFT" id="dpFS"><div class="ph"><h2 class="d d-sub" id="dpFT">Fila de revisão</h2><span class="note" id="dpFN"></span></div>
  <div class="acts">${ENVIO_LIBERADO ? '<button type="button" id="dpEnv" disabled>Enviar os aprovados</button>' : ''}<button type="button" class="${ENVIO_LIBERADO ? 'ghost' : ''}" id="dpRas" disabled>Criar rascunhos no Gmail</button><button type="button" class="lnk" id="dpLimpa">Limpar a fila</button></div>
  ${ENVIO_LIBERADO ? '' : '<p class="note measure">O envio está desligado por enquanto. A Mesa escreve, você revisa e aprova, e o e-mail vira rascunho no Gmail da PRODUCERIA. Nada sai sem alguém abrir o Gmail e enviar.</p>'}
  <div id="dpFila"></div></section>
 <section aria-labelledby="dpRT" id="dpRS"><div class="ph"><h2 class="d d-sub" id="dpRT">Resultado dos disparos</h2><span class="note" id="dpRC"></span></div>
  <p class="note measure">O Studio confere no Gmail da PRODUCERIA se cada rascunho foi enviado, quem respondeu, quem pediu para sair e qual e-mail voltou. Quem responde vira alvo em Conversa, com o próximo passo na Agenda; quem pede para sair entra na lista de não contatar.</p>
  <div class="acts"><button type="button" id="dpConf">Conferir respostas no Gmail</button><span class="note" id="dpConfN"></span></div>
  <div id="dpR"></div></section>
 <section aria-labelledby="dpHT"><h2 class="d d-sub" id="dpHT">Rascunhos, envios e respostas</h2><div id="dpH"></div></section>
 <p class="sr" id="dpLive" aria-live="polite" aria-atomic="true"></p>
</div>`;
  const $ = seletor(root);
  let mercado: MercadoBase | null = null, movs: MovimentoBase[] = [], emp: (EmpresaMapa & OrgInv)[] = [], ags: (AgenciaMapa & OrgInv)[] = [], pes: PessoaInv[] = [];
  let alvos: Alvo[] = [], ligs: LigacaoInv[] = [], contatos: ContatoOrg[] = [], disparos: Disparo[] = [], bloqueios: Bloqueio[] = [], casos: Caso[] = [];
  let lista: Destino[] = [], f = 'email', a = 'dentro', q = '', lim = 40, ocupado = false, tRe = 0, pend = focoPendente(FOCO_MESA), pendAte = Date.now() + 20000, pendNos = 0;
  const sel = new Set<string>(), escolha = new Map<string, string>();
  let fila: ItemFila[] = (() => { try { const v = JSON.parse(localStorage.getItem(FILA) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } })();
  let colDisp: Colecao<Disparo> | null = null, colBloq: Colecao<Bloqueio> | null = null, colAlvos: Colecao<Alvo> | null = null;
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#dpLive').textContent = t; };
  const guardar = () => { try { localStorage.setItem(FILA, JSON.stringify(fila.slice(0, 60))); } catch { /* vale só nesta visita */ } };
  const hoje = () => hojeISO();
  const enviadosHoje = () => disparos.filter((x) => x.modo === 'enviado' && x.em.slice(0, 10) === hoje()).length;
  const porId = (id: string) => lista.find((x) => x.id === id);
  const emailDe = (x: Destino) => escolha.get(x.id) || x.emails[0]?.email || '';

  function recalcular() {
    const G = montarGrafo({ mercado, movimentos: movs, empresas: emp, agencias: ags, pessoas: pes.filter((p) => p.nome && p.organizacao) as PessoaMapa[] });
    const U = montarUniverso({ empresas: G.empresas, agencias: G.agencias, pessoas: pes, orgsInv: [...ags, ...emp], alvos, ligacoes: ligs });
    const R = reacao(U, ORIGEM, [10, 14, 18, 14]);
    lista = destinos({ U, R, M: multiverso(U, ORIGEM, R), pessoas: pes, contatos, alvos, disparos, bloqueios });
    if (pend) focar(U.nos.get(pend)?.nome || '', U.nos.size);
    render();
  }
  /** Veio do multiverso com um ponto em foco: limpa os filtros, mostra ele no topo e já seleciona se tiver e-mail. */
  function focar(nome: string, nos: number) {
    const x = porId(pend), el = $('#dpFoco');
    if (x) {
      f = ''; a = ''; q = x.nome.toLowerCase(); ($('#dpQ') as HTMLInputElement).value = x.nome;
      $('#dpF').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === '')));
      $('#dpA').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.a === '')));
      if (x.emails.length && !impedimento(x, emailDe(x), enviadosHoje(), hoje())) sel.add(x.id);
      el.hidden = false; el.innerHTML = `Do multiverso: <b>${esc(x.nome)}</b>. ${x.emails.length ? 'Já selecionado. Escreva o objetivo e clique em Escrever.' : 'Sem e-mail publicado: use "Mensagem LinkedIn".'} <button type="button" class="lnk" data-limpafoco>Ver todos</button>`;
      pend = '';
    } else if (nome && nos > 1 && (nos === pendNos || Date.now() > pendAte)) {
      el.hidden = false; el.innerHTML = `<b>${esc(nome)}</b> ainda não tem contato publicado (nem e-mail nem LinkedIn). Registre uma ligação ou o contato no multiverso. <button type="button" class="lnk" data-mv="${esc(pend)}">Voltar ao multiverso</button>`;
      pend = '';
    }
    pendNos = nos;
  }
  const agendar = () => { clearTimeout(tRe); tRe = window.setTimeout(recalcular, 80); };

  const filtrada = () => lista.filter((x) => (f === 'email' ? x.emails.length : f === 'linkedin' ? !x.emails.length : true)
    && (a === 'dentro' ? x.ger >= 0 : a === 'fora' ? x.ger < 0 : true)
    && (!q || `${x.nome} ${x.org || ''} ${x.cargo || ''}`.toLowerCase().includes(q)));

  function render() {
    const r = resumo(lista);
    $('#dpK').innerHTML = kpis([
      { rotulo: 'Contatos no multiverso', valor: int(r.total), nota: `${int(r.alcance)} ao alcance da PRODUCERIA` },
      { rotulo: 'E-mail publicado', valor: int(r.comEmail), nota: 'da própria empresa ou pessoa' },
      { rotulo: 'Via e-mail da empresa', valor: int(r.viaEmpresa), nota: 'pessoa sem e-mail próprio' },
      { rotulo: 'Só LinkedIn', valor: int(r.soLinkedin), nota: 'mensagem para copiar' },
      { rotulo: 'Enviados hoje', valor: `${int(enviadosHoje())}/${int(LIMITE_DIA)}`, nota: `${int(disparos.filter((x) => x.modo === 'enviado').length)} no total` },
    ]);
    const l = filtrada();
    $('#dpN').textContent = `${int(l.length)} de ${int(lista.length)}`;
    $('#dpL').innerHTML = !lista.length ? '<li class="note">Carregando o multiverso…</li>' : !l.length ? '<li class="note">Ninguém com este filtro.</li>' : l.slice(0, lim).map((x) => {
      const em = emailDe(x), imp = x.emails.length ? impedimento(x, em, enviadosHoje(), hoje()) : null, e = x.emails.find((y) => y.email === em);
      return `<li class="dp-it${sel.has(x.id) ? ' sel' : ''}">
       ${x.emails.length ? `<input type="checkbox" data-sel="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''} ${imp ? 'disabled' : ''} aria-label="Selecionar ${esc(x.nome)}">` : '<span aria-hidden="true"></span>'}
       <div class="dp-c"><div class="dp-nome"><b>${esc(x.nome)}</b><span class="tag">${x.tipo === 'pessoa' ? 'pessoa' : x.tipo === 'agencia' ? 'agência' : 'anunciante'}</span>${x.ger >= 0 ? `<span class="tag ok">${x.ger}ª ramificação</span>` : '<span class="tag w">fora de alcance</span>'}${x.alvo ? `<span class="tag aviso">alvo · ${esc(x.alvo.status || '')}</span>` : ''}</div>
        ${x.tipo === 'pessoa' ? `<span class="note">${esc([x.cargo, x.org].filter(Boolean).join(' · '))}</span>` : ''}
        ${x.ponte ? `<span class="note dp-ponte">Ponte: ${esc(x.ponte)}</span>` : ''}
        <span class="note">${x.emails.length ? `${x.emails.length > 1 ? `<select data-em="${esc(x.id)}" aria-label="E-mail de ${esc(x.nome)}">${x.emails.map((y) => `<option value="${esc(y.email)}" ${y.email === em ? 'selected' : ''}>${esc(y.email)} · ${esc(y.daEmpresa ? 'da empresa' : y.tipo)}</option>`).join('')}</select>` : `${esc(em)} · ${esc(e?.daEmpresa ? 'da empresa' : e?.tipo || '')}`} ${e ? `<a href="${esc(e.fonte)}" target="_blank" rel="noopener">fonte: ${esc(host(e.fonte))} ↗</a>` : ''}` : 'Sem e-mail publicado'}
        ${x.linkedin ? ` · <a href="${esc(x.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}${x.ultimo ? ` · último e-mail ${dt(x.ultimo.em)}` : ''}</span>
        ${imp ? `<span class="note dp-imp">${esc(imp)}</span>` : ''}</div>
       <span class="dp-acs"><button type="button" class="ghost sm" data-um="${esc(x.id)}" ${imp && x.emails.length ? 'disabled' : ''}>${x.emails.length ? 'Escrever' : 'Mensagem LinkedIn'}</button><button type="button" class="lnk" data-mv="${esc(x.id)}">Ver no multiverso</button></span></li>`;
    }).join('');
    $('#dpM').innerHTML = l.length > lim ? `<button type="button" class="lnk" data-mais>Mostrar mais ${int(Math.min(40, l.length - lim))}</button>` : '';
    ($('#dpEsc') as HTMLButtonElement).disabled = !sel.size || ocupado;
    $('#dpEsc').textContent = sel.size ? `Escrever para os selecionados (${sel.size})` : 'Escrever para os selecionados';
    renderFila(); renderPlacar(); renderHist();
  }

  function renderFila() {
    const ap = fila.filter((i) => i.ok && i.estado === '' && i.email);
    $('#dpFN').textContent = fila.length ? `${int(fila.length)} na fila · ${int(ap.length)} aprovados` : '';
    ($('#dpRas') as HTMLButtonElement).disabled = !ap.length || ocupado;
    if (ENVIO_LIBERADO) { ($('#dpEnv') as HTMLButtonElement).disabled = !ap.length || ocupado; $('#dpEnv').textContent = ap.length ? `Enviar os aprovados (${ap.length})` : 'Enviar os aprovados'; }
    $('#dpFila').innerHTML = !fila.length ? '<p class="note">Selecione contatos acima e clique em Escrever. Cada e-mail chega aqui para você ler, ajustar e aprovar antes de sair.</p>'
      : fila.map((i) => { const x = porId(i.id); const feito = i.estado === 'enviado' || i.estado === 'rascunho'; return `<article class="dp-msg${feito ? ' feito' : ''}" data-i="${esc(i.id)}">
        <div class="dp-mh"><b>${esc(x?.nome || i.id)}</b><span class="note">${esc(i.email || 'LinkedIn')}</span>${i.estado ? `<span class="tag ${i.estado === 'erro' ? 'erro' : feito ? 'ok' : 'aviso'}">${esc({ escrevendo: 'escrevendo…', enviando: 'enviando…', enviado: 'enviado', rascunho: 'rascunho no Gmail', erro: 'erro' }[i.estado])}</span>` : ''}</div>
        ${i.erro ? `<p class="dp-imp" role="alert">${esc(i.erro)}</p>` : ''}
        ${i.estrategia ? `<p class="note"><b>Estratégia:</b> ${esc(i.estrategia)}</p>` : ''}
        ${i.email ? `<div class="f"><label>Assunto</label><input data-campo="assunto" value="${esc(i.assunto)}" ${feito ? 'disabled' : ''}></div>
        <div class="f"><label>Mensagem</label><textarea rows="8" data-campo="corpo" ${feito ? 'disabled' : ''}>${esc(i.corpo)}</textarea></div>` : ''}
        ${i.linkedin ? `<p class="note"><b>LinkedIn:</b> ${esc(i.linkedin)} <button type="button" class="lnk" data-copia="${esc(i.id)}">Copiar</button>${x?.linkedin ? ` <a href="${esc(x.linkedin)}" target="_blank" rel="noopener">Abrir perfil ↗</a>` : ''}</p>` : ''}
        ${i.proximo ? `<p class="note"><b>Se não responder:</b> ${esc(i.proximo)}</p>` : ''}
        <div class="acts">${i.email && !feito ? `<label class="dp-ok"><input type="checkbox" data-ok="${esc(i.id)}" ${i.ok ? 'checked' : ''}> Aprovado</label>
          ${ENVIO_LIBERADO ? `<button type="button" class="sm" data-env="${esc(i.id)}" ${ocupado || !i.corpo ? 'disabled' : ''}>Enviar</button>` : ''}<button type="button" class="ghost sm" data-ras="${esc(i.id)}" ${ocupado || !i.corpo ? 'disabled' : ''}>Rascunho no Gmail</button>` : ''}
          ${i.email ? `<button type="button" class="lnk" data-bloq="${esc(i.id)}">Não contatar mais</button>` : ''}<button type="button" class="lnk" data-tira="${esc(i.id)}">Tirar da fila</button></div></article>`; }).join('');
  }

  const tabela = (titulo: string, L: LinhaPlacar[]) => !L.length ? '' : `<div class="dp-pt"><table><caption class="lab">${esc(titulo)}</caption><thead><tr><th scope="col">${esc(titulo)}</th><th scope="col" class="num">Enviados</th><th scope="col" class="num">Responderam</th><th scope="col" class="num">Taxa</th></tr></thead><tbody>${L.slice(0, 8).map((l) => `<tr><th scope="row">${esc(l.rotulo)}</th><td class="num">${int(l.enviados)}</td><td class="num">${int(l.respostas)}</td><td class="num"><b>${l.taxa}%</b></td></tr>`).join('')}</tbody></table></div>`;
  function renderPlacar() {
    const p = placar(disparos);
    let ult = ''; try { ult = localStorage.getItem(CONF) || ''; } catch { /* sem armazenamento */ }
    const abertos = disparos.filter((d) => pendente(d, hoje())).length;
    $('#dpRC').textContent = ult ? `última conferência ${new Date(ult).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : '';
    if (!ocupado) $('#dpConfN').textContent = msgConf ? msgConf + (abertos ? ` Ainda em aberto: ${int(abertos)}.` : '') : abertos ? `${int(abertos)} rascunho(s) ou envio(s) em aberto para conferir.` : disparos.length ? 'Nada em aberto.' : '';
    ($('#dpConf') as HTMLButtonElement).disabled = ocupado || !abertos;
    $('#dpR').innerHTML = !disparos.length ? '<p class="note">Quando os primeiros rascunhos forem enviados pelo Gmail, o placar aparece aqui: quem respondeu e qual porta, tipo de contato e objetivo dão mais resposta.</p>'
      : `<section class="kpis" aria-label="Placar dos disparos">${kpis([
        { rotulo: 'Esperando envio', valor: int(p.rascunhos), nota: 'rascunhos no Gmail' },
        { rotulo: 'Enviados', valor: int(p.enviados), nota: p.voltaram ? `${int(p.voltaram)} voltaram` : 'entregues' },
        { rotulo: 'Taxa de resposta', valor: `${p.taxa}%`, nota: `${int(p.respostas)} resposta(s)${p.diasResposta != null ? ` · em ${String(p.diasResposta).replace('.', ',')} dia(s) em média` : ''}` },
        { rotulo: 'Viraram conversa', valor: int(p.positivas), nota: `${int(p.semInteresse)} sem interesse · ${int(p.sair)} pediram para sair` },
      ])}</section>
      ${p.enviados - p.voltaram ? `<div class="dp-pts">${tabela('Porta de entrada', p.porPorta)}${tabela('Tipo de contato', p.porTipo)}${tabela('Distância da PRODUCERIA', p.porRamo)}${tabela('Objetivo do disparo', p.porObjetivo)}</div>
      <p class="note">Taxa = respostas ÷ e-mails entregues. Com poucos envios a taxa oscila muito: leia como tendência a partir de umas 20 mensagens por linha.</p>` : ''}`;
  }

  function renderHist() {
    const h = [...disparos].sort((x, y) => (y.respostaEm || y.enviadoEm || y.em).localeCompare(x.respostaEm || x.enviadoEm || x.em)).slice(0, 40);
    $('#dpH').innerHTML = !h.length ? '<p class="note">Nenhum rascunho criado pela mesa comercial ainda.</p>'
      : `<ul class="vc-l">${h.map((x) => { const s = situacaoDe(x), [t, c] = SIT[s], al = alvoDe(x); return `<li class="dp-hi"><div class="dp-nome"><span class="tag ${c}">${esc(t)}</span> <b>${esc(x.nome)}</b>${al ? `<a class="tag" href="#agenda" title="Abrir a Agenda">alvo · ${esc(al.status || '')}</a>` : ''}</div>
        <span class="note">${esc(x.para)} · ${esc(x.assunto)} · ${s === 'rascunho' ? 'rascunho de' : 'enviado'} ${new Date(x.enviadoEm || x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${x.respostaEm ? ` · resposta ${new Date(x.respostaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}${x.link ? ` · <a href="${esc(x.link)}" target="_blank" rel="noopener">abrir no Gmail ↗</a>` : ''}</span>
        ${x.resposta ? `<blockquote class="dp-resp">${esc(x.resposta)}</blockquote>` : ''}</li>`; }).join('')}</ul>`;
  }

  async function escrever(ids: string[]) {
    if (ocupado) return;
    ocupado = true;
    const objetivo = ($('#dpO') as HTMLInputElement).value.trim();
    for (const id of ids.slice(0, LIMITE_LOTE)) {
      const x = porId(id); if (!x) continue;
      const email = emailDe(x), e = x.emails.find((y) => y.email === email) || { email: '', tipo: 'linkedin', fonte: '' };
      let it = fila.find((i) => i.id === id);
      if (!it) { it = { id, objetivo, email, assunto: '', corpo: '', estrategia: '', linkedin: '', proximo: '', ok: false, estado: 'escrevendo' }; fila.unshift(it); } else Object.assign(it, { objetivo, email, estado: 'escrevendo', erro: '' });
      renderFila(); avisar(`Escrevendo para ${x.nome}…`);
      try {
        const r = (await perguntar(pedidoMensagem(x, e, casos, objetivo), { json: true, tier: 'complex' })) as Partial<ItemFila> | null;
        Object.assign(it, { assunto: String(r?.assunto || '').slice(0, 120), corpo: String(r?.corpo || ''), estrategia: String(r?.estrategia || ''), linkedin: String(r?.linkedin || '').slice(0, 300), proximo: String(r?.proximo || ''), estado: '' });
      } catch (err) { Object.assign(it, { estado: 'erro', erro: err instanceof ErroIA ? err.message : 'A escrita falhou. Tente de novo.' }); if (err instanceof ErroIA && /limite|autoriza|disponível/.test(err.message)) break; }
      sel.delete(id); guardar(); renderFila();
    }
    ocupado = false; avisar('Fila pronta para revisão.'); render();
    document.getElementById('dpFS')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function registrar(i: ItemFila, x: Destino, modo: 'enviado' | 'rascunho', gmailId?: string) {
    const em = new Date().toISOString();
    const e = x.emails.find((y) => y.email === i.email);
    const d: Disparo = { id: `dp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, para: i.email, nome: x.nome, no: x.id, org: x.org || (x.tipo !== 'pessoa' ? x.nome : ''), assunto: i.assunto, corpo: i.corpo, modo, gmailId: gmailId || '', em,
      porta: e?.daEmpresa ? 'empresa' : e?.tipo || '', tipoNo: x.tipo, ger: x.ger, objetivo: (i.objetivo || '').slice(0, 160), situacao: modo, ...(modo === 'enviado' ? { enviadoEm: em } : {}) };
    disparos = [...disparos, d];
    try { await colDisp?.doc(d.id).set(d); } catch { /* o envio já saiu; o registro tenta de novo na próxima ação */ }
    if (modo === 'enviado') await tocar(d, 'sem', `Mesa comercial: ${i.assunto}`, false);
  }

  /** Alvo ligado ao disparo: o do ponto no multiverso ou o da mesma empresa. */
  const alvoDe = (d: Disparo) => porId(d.no)?.alvo || alvos.find((a) => mesmaEmpresa(a.nome, d.org || d.nome));
  /** Registra o toque no alvo (a etapa avança pela mesma regra da Agenda); com `criar`, quem respondeu vira alvo. */
  async function tocar(d: Disparo, r: Resultado, nota: string, criar: boolean) {
    if (!colAlvos) return;
    let al = alvoDe(d), novo = false;
    if (!al) {
      if (!criar) return;
      const nome = d.org || d.nome, agora = new Date().toISOString();
      al = { id: 'al-' + slug(nome), nome, perfil: d.tipoNo === 'agencia' ? 'independente' : 'inhouse', contato: d.org && d.org !== d.nome ? `${d.nome} <${d.para}>` : d.para, gatilho: `Respondeu ao e-mail da Mesa comercial: ${d.assunto}`, fonte: '', status: 'Abordado', origem: 'Mesa comercial', criadoEm: agora, etapas: { Abordado: (d.enviadoEm || d.em) } } as Alvo;
      novo = true;
    }
    const sug = sugerirProximo(al, r);
    const patch = registrarContato(al, { canal: 'E-mail', resultado: r, nota, proxima: sug.data, oQueFazer: sug.texto }, r === 'sem' ? d.enviadoEm || d.em : d.respostaEm || new Date().toISOString());
    try { if (novo) await colAlvos.doc(al.id).set({ ...al, ...patch } as Alvo); else await colAlvos.doc(al.id).update(patch); } catch { /* fica só o registro do disparo */ }
  }

  /** Confere no Gmail o que aconteceu com cada rascunho ou envio ainda em aberto. */
  async function conferirGmail() {
    if (ocupado) return;
    const L = disparos.filter((d) => pendente(d, hoje())).sort((a, b) => b.em.localeCompare(a.em)).slice(0, 30);
    if (!L.length) { $('#dpConfN').textContent = 'Nada em aberto para conferir.'; return; }
    ocupado = true; ($('#dpConf') as HTMLButtonElement).disabled = true;
    const busca = async (query: string) => (await gmail('search_threads', { query, pageSize: 5, view: 'THREAD_VIEW_MINIMAL' })) as unknown;
    const conta: Record<string, number> = {};
    let n = 0, erro = '';
    for (const d of L) {
      $('#dpConfN').textContent = `Conferindo ${++n} de ${L.length}…`;
      try {
        const q = consultas(d), antes = situacaoDe(d);
        const res: { envio?: unknown; resposta?: unknown; devolucao?: unknown } = {};
        if (antes === 'rascunho') res.envio = await busca(q.envio);
        const ok = antes === 'enviado' || (res.envio !== undefined && conferir(d, res).situacao === 'enviado');
        if (ok) { const env = { ...d, ...conferir(d, res) }; const q2 = consultas(env); res.devolucao = await busca(q2.devolucao); res.resposta = await busca(q2.resposta); }
        const up = conferir(d, res), depois = up.situacao || antes;
        Object.assign(d, up);
        try { await colDisp?.doc(d.id).update(up); } catch { /* vale nesta visita */ }
        if (depois !== antes) {
          conta[depois] = (conta[depois] || 0) + 1;
          if (antes === 'rascunho') await tocar(d, 'sem', `Mesa comercial (enviado pelo Gmail): ${d.assunto}`, false);
          if (depois === 'respondeu') await tocar(d, 'resp', `Respondeu ao e-mail: ${d.resposta || ''}`.slice(0, 300), true);
          if (depois === 'sem interesse') await tocar(d, 'nao', `Respondeu sem interesse agora: ${d.resposta || ''}`.slice(0, 300), false);
          if (depois === 'sair' || depois === 'voltou') {
            const bl: Bloqueio = { id: idBloqueio(d.para), email: d.para, motivo: depois === 'sair' ? 'respondeu pedindo para sair' : 'o e-mail voltou (endereço não entregue)', em: new Date().toISOString() };
            if (!bloqueios.some((b) => b.email.toLowerCase() === d.para.toLowerCase())) { bloqueios = [...bloqueios, bl]; try { await colBloq?.doc(bl.id).set(bl); } catch { /* fica na sessão */ } }
            if (depois === 'sair') await tocar(d, 'nao', 'Pediu para não receber mais e-mails.', false);
          }
        }
      } catch (e) { erro = erroGmail(e).replace('o envio', 'a leitura').replace('Permita o envio', 'Permita a leitura'); break; }
      await pausa(250);
    }
    const agora = new Date().toISOString(); try { localStorage.setItem(CONF, agora); } catch { /* sem armazenamento */ }
    ocupado = false; ($('#dpConf') as HTMLButtonElement).disabled = false;
    const mud = Object.entries(conta).map(([k, v]) => `${v} ${SIT[k as Situacao][0]}`).join(', ');
    msgConf = erro || (mud ? `Conferido agora: ${mud}.` : `Conferido agora: ${L.length} em aberto, nada mudou.`);
    avisar(msgConf); recalcular();
  }

  async function sair(id: string, modo: 'enviado' | 'rascunho') {
    const i = fila.find((y) => y.id === id), x = porId(id);
    if (!i || !x || !i.email) return false;
    if (modo === 'enviado') { const imp = impedimento(x, i.email, enviadosHoje(), hoje()); if (imp) { Object.assign(i, { estado: 'erro', erro: imp }); renderFila(); return false; } }
    if (!i.assunto.trim() || !i.corpo.trim()) { Object.assign(i, { estado: 'erro', erro: 'Falta assunto ou mensagem.' }); renderFila(); return false; }
    i.estado = 'enviando'; i.erro = ''; renderFila();
    try {
      const r = await gmail(modo === 'enviado' ? 'send_message' : 'create_draft', { to: [i.email], subject: i.assunto.trim(), body: textoEmail(i.corpo), htmlBody: htmlEmail(i.corpo) });
      i.estado = modo; await registrar(i, x, modo, r.id); guardar(); renderFila(); return true;
    } catch (e) { Object.assign(i, { estado: 'erro', erro: erroGmail(e) }); guardar(); renderFila(); return false; }
  }

  async function lote(modo: 'enviado' | 'rascunho') {
    const ap = fila.filter((i) => i.ok && i.estado === '' && i.email);
    if (!ap.length || ocupado || (modo === 'enviado' && !ENVIO_LIBERADO)) return;
    if (modo === 'enviado' && !confirm(`Enviar ${ap.length} e-mail(s) agora pelo Gmail da PRODUCERIA?\n\n${ap.map((i) => `• ${porId(i.id)?.nome || ''} <${i.email}>`).join('\n')}`)) return;
    ocupado = true; let n = 0;
    for (const i of ap) { if (await sair(i.id, modo)) n++; else if (i.erro && /Gmail|conect|permit|expirou/.test(i.erro)) break; if (modo === 'enviado') await pausa(4000); }
    ocupado = false; render(); avisar(modo === 'enviado' ? `${n} e-mail(s) enviados.` : `${n} rascunho(s) criados no Gmail.`);
  }

  root.addEventListener('click', async (ev) => {
    const t = elDe(ev), b = t.closest<HTMLElement>('button,[data-sel],[data-ok]'); if (!b) return;
    const d = b.dataset;
    if (d.f !== undefined) { f = d.f; lim = 40; $('#dpF').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }
    else if (d.a !== undefined) { a = d.a; lim = 40; $('#dpA').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }
    else if (d.mais !== undefined) { lim += 40; render(); }
    else if (d.sel) { if ((b as HTMLInputElement).checked) { if (sel.size >= LIMITE_LOTE) { (b as HTMLInputElement).checked = false; avisar(`No máximo ${LIMITE_LOTE} por vez.`); return; } sel.add(d.sel); } else sel.delete(d.sel); render(); }
    else if (d.ok) { const i = fila.find((y) => y.id === d.ok); if (i) { i.ok = (b as HTMLInputElement).checked; guardar(); renderFila(); } }
    else if (d.um) escrever([d.um]);
    else if (d.mv) levarPara('investigacao', d.mv);
    else if (d.limpafoco !== undefined) { q = ''; ($('#dpQ') as HTMLInputElement).value = ''; $('#dpFoco').hidden = true; render(); }
    else if (b.id === 'dpEsc') escrever([...sel]);
    else if (b.id === 'dpEnv') lote('enviado');
    else if (b.id === 'dpRas') lote('rascunho');
    else if (b.id === 'dpConf') conferirGmail();
    else if (b.id === 'dpLimpa') { fila = fila.filter((i) => i.estado === 'escrevendo' || i.estado === 'enviando'); guardar(); renderFila(); }
    else if (d.env && ENVIO_LIBERADO) { const x = porId(d.env), i = fila.find((y) => y.id === d.env); if (x && i && confirm(`Enviar agora para ${x.nome} <${i.email}>?`)) { ocupado = true; await sair(d.env, 'enviado'); ocupado = false; render(); } }
    else if (d.ras) { ocupado = true; await sair(d.ras, 'rascunho'); ocupado = false; render(); }
    else if (d.tira) { fila = fila.filter((i) => i.id !== d.tira); guardar(); renderFila(); }
    else if (d.copia) { const i = fila.find((y) => y.id === d.copia); try { await navigator.clipboard.writeText(i?.linkedin || ''); avisar('Mensagem copiada. Cole no LinkedIn.'); } catch { avisar('Não foi possível copiar.'); } }
    else if (d.bloq) {
      const i = fila.find((y) => y.id === d.bloq); if (!i?.email || !confirm(`Marcar ${i.email} como "não contatar"? Nenhum e-mail sairá mais para este endereço.`)) return;
      const bl: Bloqueio = { id: idBloqueio(i.email), email: i.email, motivo: 'marcado na mesa comercial', em: new Date().toISOString() };
      bloqueios = [...bloqueios, bl]; try { await colBloq?.doc(bl.id).set(bl); } catch { /* fica na sessão */ }
      fila = fila.filter((y) => y.id !== d.bloq); guardar(); recalcular();
    }
  });
  root.addEventListener('change', (ev) => { const t = elDe(ev) as HTMLSelectElement; if (t.dataset.em) { escolha.set(t.dataset.em, t.value); render(); } });
  root.addEventListener('input', (ev) => {
    const t = elDe(ev) as HTMLInputElement;
    if (t.id === 'dpQ') { q = t.value.trim().toLowerCase(); lim = 40; render(); return; }
    const c = t.dataset.campo as 'assunto' | 'corpo' | undefined, id = t.closest<HTMLElement>('[data-i]')?.dataset.i;
    if (c && id) { const i = fila.find((y) => y.id === id); if (i) { i[c] = t.value; guardar(); } }
  });

  render();
  lerBase<MercadoBase>('mercado').then((m) => { mercado = m; agendar(); }).catch(() => {});
  (async () => {
    const db = await banco(); if (!db) { $('#dpL').innerHTML = '<li class="note">Sem acesso ao banco nesta visualização. Abra o Studio no Claude.</li>'; return; }
    const sub = <T>(nome: string, fn: (l: T[]) => void) => offs.push(db.collection<T>(nome).onSnapshot((s) => { fn(s.docs.map(comId) as T[]); agendar(); }, () => {}));
    sub<MovimentoBase & { id: string }>('movimentos', (l) => { movs = l; });
    sub<PessoaInv>('mapa_pessoas', (l) => { pes = l; });
    sub<AgenciaMapa & OrgInv>('mapa_agencias', (l) => { ags = l; });
    sub<EmpresaMapa & OrgInv>('mapa_empresas', (l) => { emp = l; });
    sub<LigacaoInv>('mapa_ligacoes', (l) => { ligs = l; });
    sub<Alvo>('alvos', (l) => { alvos = l; });
    sub<ContatoOrg>('contatos', (l) => { contatos = l; });
    sub<Disparo>('disparos', (l) => { disparos = l; });
    sub<Bloqueio>('nao_contatar', (l) => { bloqueios = l; });
    sub<Caso>('casos', (l) => { casos = l; });
    colDisp = db.collection<Disparo>('disparos'); colBloq = db.collection<Bloqueio>('nao_contatar'); colAlvos = db.collection<Alvo>('alvos');
  })();
  return () => { clearTimeout(tRe); for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}
