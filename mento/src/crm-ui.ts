// Telas do comercial: Painel, Big Data, Funil e Agenda. Leem e gravam pela Loja (banco compartilhado do artefato ou
// navegador) e avisam a rede quando o Big Data muda.
import { TIPOS, ETAPAS, ABERTAS, CANAIS, nota, nivelDe, oportunidadeDe, proximaPelaCadencia, agenda, numeros, csv, janelas, contasGanhas, foraDoRadar, type Registro, type Oportunidade, type Atividade, type Etapa, type Canal, type TipoRegistro, type Leitura } from './crm';
import { mensagemErro, type Loja } from './dados';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => n.toLocaleString('pt-BR');
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const curto = (s = '', n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d || '');
const valorDe = (s: string) => { const n = Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n) : 0; };
const link = (u?: string, t = 'fonte') => (u && /^https:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t === 'fonte' ? u.replace(/^https:\/\/(www\.)?/, '').split('/')[0] : t)} ↗</a>` : '');
const ETQ = Object.fromEntries(ETAPAS.map(([e, t]) => [e, t])) as Record<Etapa, string>;
const TIP = Object.fromEntries(TIPOS) as Record<TipoRegistro, string>;
const CAN = Object.fromEntries(CANAIS) as Record<Canal, string>;
const novoId = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export interface Contexto {
  raiz: HTMLElement; loja: Loja;
  equipe(): string[];
  trajetoria(): Set<string>;
  aoMudarBd(regs: Registro[]): void;
  verNaRede(nome: string): void;
  /** chamado depois de cada atualização das telas (ex.: primeiros passos) */
  aoAtualizar?(): void;
}

export function montarCrm(c: Contexto) {
  const $ = <T extends Element = HTMLElement>(s: string) => c.raiz.querySelector(s) as T;
  let bOrd = 'nota', dragOp = '';
  let bd: Registro[] = [], ops: Oportunidade[] = [], ats: Atividade[] = [], leituras: Leitura[] = [], jLim = 8, selOp = '', bq = '', bt = '', bDecide = false, bSinal = false, bLim = 40, confirmar = '';
  const carregado = { bd: false, funil: false };
  let desfazer: (() => void) | null = null;
  /** Aviso no topo (lido por leitores de tela); com ação, mostra um botão (ex.: Desfazer) por 8 segundos. */
  const aviso = (t: string, acao?: { rotulo: string; fazer: () => void }) => {
    const el = $('#crmMsg'); desfazer = acao ? acao.fazer : null;
    el.innerHTML = t ? `<span>${esc(t)}</span>${acao ? ` <button type="button" class="lnk" id="crmDesf">${esc(acao.rotulo)}</button>` : ''}` : '';
    el.hidden = !t; const marca = t; if (t) setTimeout(() => { if (el.textContent?.startsWith(marca)) { el.hidden = true; desfazer = null; } }, acao ? 8000 : 6000);
  };
  const grava = async (col: 'bd' | 'funil' | 'atividades' | 'leituras', d: { id: string }) => { try { await c.loja.salvar(col, d); return true; } catch (e) { aviso(mensagemErro(e)); return false; } };
  const apaga = async (col: 'bd' | 'funil' | 'atividades', id: string) => { try { await c.loja.apagar(col, id); } catch (e) { aviso(mensagemErro(e)); } };

  const novo = (r: Registro) => { const q = r.atualizadoEm || r.criadoEm || ''; return !!q && Date.now() - Date.parse(q) < 48 * 3600e3; };
  const porNome = () => new Map(bd.filter((r) => r.tipo !== 'pessoa').map((r) => [r.nome.toLowerCase().trim(), r]));
  const notas = () => { const pn = porNome(), tr = c.trajetoria(), h = hojeISO(); return new Map(bd.map((r) => [r.id, nota(r, { hoje: h, porNome: pn, trajetoria: tr })])); };
  const noFunil = (r: Registro) => ops.find((o) => o.registroId === r.id || (o.nome.toLowerCase() === (r.tipo === 'pessoa' ? (r.empresa || '').toLowerCase() : r.nome.toLowerCase()) && (r.tipo !== 'pessoa' || (o.contato || '').toLowerCase() === r.nome.toLowerCase())));

  /** Leva qualquer ponto (Big Data ou rede) ao funil; devolve a oportunidade existente se já estiver lá. */
  async function levarAoFunil(r: Pick<Registro, 'nome' | 'tipo' | 'cargo' | 'empresa' | 'fonte' | 'id'>, origem: string) {
    const ja = noFunil(r as Registro); if (ja) { abrirOp(ja.id); return; }
    const o = oportunidadeDe(r, { agora: new Date().toISOString(), responsavel: c.equipe()[0] || '', origem });
    if (await grava('funil', o)) { aviso(`${o.nome} entrou no funil como Alvo.`, { rotulo: 'Desfazer', fazer: () => { if (selOp === o.id) selOp = ''; void apaga('funil', o.id); aviso(`${o.nome} saiu do funil.`); } }); selOp = o.id; }
  }
  function abrirOp(id: string) { selOp = id; location.hash = '#funil'; funil(); }

  /* ── Painel ── */
  function painel() {
    const N = numeros(ops), A = agenda(ops, hojeISO()), ns = notas();
    const dec = bd.filter((r) => r.tipo === 'pessoa' && nivelDe(r) === 'decide').length;
    $('#pnK').innerHTML = [[N.abertas, 'no funil', `${fmt(N.por.reuniao.n)} em reunião · ${fmt(N.por.proposta.n)} em proposta`], [N.pipeline, 'em negociação', `${brl(N.ponderado)} ponderado pela etapa`, true], [A.atrasadas.length + A.hoje.length, 'para hoje', `${fmt(A.atrasadas.length)} atrasado(s)`], [bd.length, 'no Big Data', `${fmt(dec)} pessoas que decidem`]]
      .map(([v, t, d, m], i) => `<li${i === 2 && A.atrasadas.length ? ' class="alerta"' : i ? '' : ' class="on"'}><a class="kpi" href="#${['funil', 'funil', 'agenda', 'bigdata'][i]}"><b>${m ? brl(Number(v)) : fmt(Number(v))}</b><span>${esc(t)}</span><small>${esc(d)}</small></a></li>`).join('');
    const hoje = [...A.atrasadas, ...A.hoje].slice(0, 8);
    $('#pnH').innerHTML = hoje.length ? `<ul class="li">${hoje.map(linhaOp).join('')}</ul>` : `<p class="nota">Nada vencido. ${ops.length ? 'Veja a agenda da semana.' : 'Leve os primeiros alvos ao funil pelo Big Data.'}</p>`;
    const alvos = bd.filter((r) => !noFunil(r)).sort((a, b) => ns.get(b.id)!.nota - ns.get(a.id)!.nota).slice(0, 8);
    $('#pnA').innerHTML = alvos.length ? `<ul class="li">${alvos.map((r) => linhaBd(r, ns.get(r.id)!, true)).join('')}</ul>` : '<p class="nota">O Big Data ainda está vazio.</p>';
    const sinais = bd.filter((r) => r.sinal && r.data).sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 8);
    // inteligência: janelas de oportunidade, agências em alta e leituras de mercado
    const J = janelas(bd, hojeISO());
    $('#pnJ').innerHTML = J.length ? `<ol class="jan">${J.slice(0, jLim).map((j) => { const r = bd.find((x) => x.id === j.regId)!, f = r && noFunil(r); return `<li><div><b>${esc(j.titulo)}</b><p class="nota">${esc(j.porque)}${j.data ? ` · ${esc(j.data)}` : ''}</p><p class="ac">${esc(j.acao)}</p></div><div class="bd-a">${f ? `<button type="button" class="acao on" data-op="${esc(f.id)}">No funil · ${esc(ETQ[f.etapa])}</button>` : `<button type="button" class="acao" data-funil="${esc(j.regId)}">Levar ao funil</button>`}<button type="button" class="acao" data-rede="${esc(r?.nome || '')}">Na rede</button></div></li>`; }).join('')}</ol>${J.length > jLim ? `<button type="button" class="lnk" id="jMais">Mostrar mais ${Math.min(8, J.length - jLim)} (${fmt(J.length - jLim)} restantes)</button>` : ''}` : '<p class="nota">Nenhuma janela aberta agora.</p>';
    const G = [...contasGanhas(bd, String(new Date().getFullYear()) + '-01').values()].sort((a, b) => b.contas.length - a.contas.length).slice(0, 10);
    $('#pnG').innerHTML = G.length ? `<ul class="li">${G.map((g) => `<li><button type="button" data-busca="${esc(g.agencia)}"><b>${esc(g.agencia)}</b><span>${esc(g.contas.map((c) => c.nome).join(', '))}</span></button><em class="dt">${g.contas.length}</em></li>`).join('')}</ul>` : '<p class="nota">Sem trocas de conta registradas neste ano.</p>';
    $('#pnL').innerHTML = leituras.length ? leituras.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).map((l) => `<article class="leit"><h4>${esc(l.titulo)}</h4><p>${esc(l.dado)}</p><p class="imp"><b>Para a MENTO:</b> ${esc(l.implicacao)}</p>${l.fonte ? `<p class="fo">Fonte: ${link(l.fonte)}</p>` : ''}</article>`).join('') : '<p class="nota">Sem leituras de mercado ainda.</p>';
    $('#pnS').innerHTML = sinais.length ? `<ul class="li">${sinais.map((r) => `<li><button type="button" data-bd="${esc(r.id)}"><b>${esc(r.tipo === 'pessoa' ? `${r.nome} · ${r.empresa}` : r.nome)}</b><span>${esc(curto(r.sinal, 90))}</span></button><em class="dt">${esc(r.data!.length > 7 ? dataBR(r.data) : r.data)}</em></li>`).join('')}</ul>` : '<p class="nota">Sem sinais com data.</p>';
  }
  const linhaOp = (o: Oportunidade) => { const h = hojeISO(), at = (o.proximaData || '') < h; return `<li><button type="button" data-op="${esc(o.id)}"><b>${esc(o.nome)}${o.contato ? ` · ${esc(o.contato)}` : ''}</b><span>${esc(ETQ[o.etapa])} · ${esc(o.proximoPasso || 'sem próximo passo')}${o.responsavel ? ` · ${esc(o.responsavel)}` : ''}</span></button><em class="dt${at ? ' atr' : ''}">${esc(dataBR(o.proximaData) || '—')}</em></li>`; };
  const linhaBd = (r: Registro, n: { nota: number; motivos: string[] }, curta = false) => {
    const f = noFunil(r);
    return `<li class="bd-l"><b class="f">${n.nota}</b><div class="bd-c"><div class="bd-t"><button type="button" class="nm" data-bd="${esc(r.id)}">${esc(r.nome)}</button><span class="tag t-${r.tipo}">${esc(TIP[r.tipo])}</span>${novo(r) ? '<span class="tag novo">novo</span>' : ''}${r.tipo === 'pessoa' && nivelDe(r) === 'decide' ? '<span class="tag dec">decide</span>' : ''}</div>
    <span class="m">${esc(r.tipo === 'pessoa' ? [r.cargo, r.empresa].filter(Boolean).join(' · ') : r.tipo === 'anunciante' && r.agencias?.length ? [r.setor, 'agência: ' + r.agencias.join(', ')].filter(Boolean).join(' · ') : r.setor || '')}</span>${r.tipo === 'agencia' ? (() => { const cs = bd.filter((x) => x.tipo === 'anunciante' && (x.agencias || []).some((a) => a.toLowerCase() === r.nome.toLowerCase())); return cs.length ? `<span class="m">Contas: ${esc(cs.map((x) => x.nome).join(', '))}</span>` : ''; })() : ''}${curta ? '' : `<span class="mot">${esc(n.motivos.join(' · '))}</span>`}${!curta && r.fonte ? `<span class="fo">Fonte: ${link(r.fonte)}${r.data ? ` · ${esc(r.data)}` : ''}</span>` : ''}</div>
    <div class="bd-a">${f ? `<button type="button" class="acao on" data-op="${esc(f.id)}">No funil · ${esc(ETQ[f.etapa])}</button>` : `<button type="button" class="acao" data-funil="${esc(r.id)}">Levar ao funil</button>`}${curta ? '' : `<button type="button" class="acao" data-rede="${esc(r.tipo === 'pessoa' ? r.nome : r.nome)}">Na rede</button><button type="button" class="acao perigo" data-apagar-bd="${esc(r.id)}">${confirmar === r.id ? 'Confirmar' : 'Apagar'}</button>`}</div></li>`;
  };

  /* ── Big Data ── */
  function bigdata() {
    const ns = notas(), t = bq.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(), h = hojeISO(), seis = new Date(Date.parse(h) - 180 * 864e5).toISOString().slice(0, 10);
    let L = bd.filter((r) => (!bt || r.tipo === bt) && (!bDecide || nivelDe(r) === 'decide') && (!bSinal || (r.sinal && (r.data || '') >= seis.slice(0, (r.data || '').length || 10))));
    if (t) L = L.filter((r) => [r.nome, r.cargo, r.empresa, r.setor, r.sinal].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t));
    const quando = (r: Registro) => r.atualizadoEm || r.criadoEm || r.data || '';
    L.sort(bOrd === 'nome' ? (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') : bOrd === 'recentes' ? (a, b) => quando(b).localeCompare(quando(a)) || ns.get(b.id)!.nota - ns.get(a.id)!.nota : (a, b) => ns.get(b.id)!.nota - ns.get(a.id)!.nota || a.nome.localeCompare(b.nome, 'pt-BR'));
    const conta = (tp: string) => bd.filter((r) => r.tipo === tp).length;
    $('#bdTipos').innerHTML = [['', `Tudo ${fmt(bd.length)}`], ...TIPOS.map(([k, v]) => [k, `${v}s ${fmt(conta(k))}`])].map(([k, v]) => `<button type="button" data-bt="${k}" aria-pressed="${bt === k}">${esc(v.replace('Agências', 'Agências').replace('Pessoas', 'Pessoas'))}</button>`).join('');
    $('#bdN').textContent = `${fmt(L.length)} de ${fmt(bd.length)}`;
    $('#bdL').innerHTML = carregado.bd ? (L.slice(0, bLim).map((r) => linhaBd(r, ns.get(r.id)!)).join('') || '<li class="nota">Nada com esses filtros.</li>') : '<li class="nota">Carregando o Big Data…</li>';
    const m = $('#bdMais'); m.hidden = L.length <= bLim; m.textContent = `Mostrar mais ${Math.min(40, L.length - bLim)} (${fmt(L.length - bLim)} restantes)`;
  }
  async function novoRegistro(f: HTMLFormElement) {
    const v = (n: string) => ((f.elements.namedItem(n) as HTMLInputElement | null)?.value || '').trim();
    if (!v('nome')) { aviso('Dê um nome ao registro.'); return; }
    const fonte = v('fonte');
    const r: Registro = { id: novoId('rg'), tipo: v('tipo') as TipoRegistro, nome: v('nome'), cargo: v('cargo'), empresa: v('empresa'), setor: v('setor'), sinal: v('sinal'), data: v('data'), fonte: /^https:\/\//.test(fonte) ? fonte : '', linkedin: /^https:\/\/([a-z]+\.)?linkedin\.com\//.test(v('linkedin')) ? v('linkedin') : '', criadoEm: new Date().toISOString() };
    if (await grava('bd', r)) { f.reset(); aviso(`${r.nome} entrou no Big Data.`); }
  }

  /* ── Funil ── */
  function funil() {
    const N = numeros(ops), h = hojeISO(), eq = c.equipe();
    $('#fnK').innerHTML = `<li class="on"><b>${brl(N.pipeline)}</b><span>em negociação</span><small>${fmt(N.abertas)} oportunidades abertas</small></li><li><b>${brl(N.ponderado)}</b><span>ponderado</span><small>valor × chance da etapa</small></li><li><b>${brl(N.ganho)}</b><span>ganho</span><small>${fmt(N.por.ganho.n)} negócio(s)</small></li><li><b>${N.conversao == null ? '—' : N.conversao + '%'}</b><span>conversão</span><small>ganhos sobre fechados</small></li>`;
    $('#fnQ').innerHTML = ETAPAS.map(([e, t]) => {
      const L = ops.filter((o) => o.etapa === e).sort((a, b) => (a.proximaData || '9').localeCompare(b.proximaData || '9'));
      return `<div class="col fn-col" data-etapa="${e}" aria-label="${esc(t)}: ${L.length} oportunidade(s)"><h3 class="ct">${esc(t)}<span>${fmt(L.length)}${N.por[e].valor ? ' · ' + brl(N.por[e].valor) : ''}</span></h3>${L.map((o) => `<button type="button" class="card fn-c${o.id === selOp ? ' sel' : ''}" data-op="${esc(o.id)}" draggable="true" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" aria-describedby="fnDica"><span class="k">${esc(o.responsavel || 'sem dono')}</span><b>${esc(o.nome)}</b>${o.contato ? `<span class="m">${esc(o.contato)}${o.cargo ? ' · ' + esc(curto(o.cargo, 40)) : ''}</span>` : ''}${o.valor ? `<span class="v">${brl(o.valor)}</span>` : ''}${ABERTAS.includes(o.etapa) ? `<span class="de${(o.proximaData || '') < h ? ' atr' : ''}">${esc(dataBR(o.proximaData) || 'sem data')} · ${esc(curto(o.proximoPasso || '', 40))}</span>` : o.motivo ? `<span class="de">${esc(curto(o.motivo, 50))}</span>` : ''}</button>`).join('') || '<p class="nota vazio">—</p>'}</div>`;
    }).join('');
    const o = ops.find((x) => x.id === selOp), el = $('#fnD');
    if (!o) { el.innerHTML = `<span class="lab">Oportunidade</span><p class="nota">Clique num card para editar, registrar contatos e ver o histórico. Novos alvos entram pelo Big Data, pela rede ou pelo formulário acima.</p>`; return; }
    const hist = ats.filter((a) => a.opId === o.id).sort((a, b) => b.quando.localeCompare(a.quando));
    const resp = [...new Set([...eq, o.responsavel || ''].filter(Boolean))];
    el.innerHTML = `<span class="lab">${esc(ETQ[o.etapa])}${o.origem ? ' · veio de ' + esc(o.origem) : ''}</span><h3>${esc(o.nome)}</h3>
  <form class="fm" id="fnF"><label>Empresa ou alvo<input name="nome" value="${esc(o.nome)}" required></label>
  <div class="g2"><label>Contato<input name="contato" value="${esc(o.contato || '')}"></label><label>Cargo<input name="cargo" value="${esc(o.cargo || '')}"></label></div>
  <div class="g2"><label>Etapa<select name="etapa">${ETAPAS.map(([e, t]) => `<option value="${e}"${e === o.etapa ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label>Responsável<select name="responsavel">${resp.map((p) => `<option${p === o.responsavel ? ' selected' : ''}>${esc(p)}</option>`).join('')}<option value=""${o.responsavel ? '' : ' selected'}>sem dono</option></select></label></div>
  <div class="g2"><label>Valor estimado (R$)<input name="valor" inputmode="numeric" value="${o.valor ? esc(fmt(o.valor)) : ''}" placeholder="0"></label><label>Próximo contato<input name="proximaData" type="date" value="${esc(o.proximaData || '')}"></label></div>
  <label>Próximo passo<input name="proximoPasso" value="${esc(o.proximoPasso || '')}"></label>
  ${o.etapa === 'perdido' ? `<label>Motivo da perda<input name="motivo" value="${esc(o.motivo || '')}"></label>` : ''}
  <div class="acoes"><button type="submit" class="btn">Salvar</button><button type="button" class="lnk perigo" data-apagar-op="${esc(o.id)}">${confirmar === o.id ? 'Confirmar: apagar de vez' : 'Apagar oportunidade'}</button></div></form>
  <span class="lab">Registrar contato</span><form class="fm" id="fnA"><div class="g2"><label>Canal<select name="canal">${CANAIS.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label><label>Quem fez<select name="quem">${resp.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label></div>
  <label>O que aconteceu<textarea name="nota" rows="2" placeholder="Ex.: liguei, pediu proposta de mídia regional até sexta"></textarea></label><div class="acoes"><button type="submit" class="btn sec">Registrar e agendar o próximo</button></div></form>
  ${o.fonte ? `<p class="nota">Fonte: ${link(o.fonte)}</p>` : ''}
  <span class="lab">Histórico · ${fmt(hist.length)}</span>${hist.length ? `<ol class="hist">${hist.map((a) => `<li><b>${esc(CAN[a.canal])}</b> · ${esc(dataBR(a.quando.slice(0, 10)))}${a.quem ? ' · ' + esc(a.quem) : ''}<p>${esc(a.nota)}</p></li>`).join('')}</ol>` : '<p class="nota">Nenhum contato registrado.</p>'}`;
  }
  async function salvarOp(f: HTMLFormElement) {
    const o = ops.find((x) => x.id === selOp); if (!o) return;
    const v = (n: string) => ((f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim();
    const novo: Oportunidade = { ...o, nome: v('nome') || o.nome, contato: v('contato'), cargo: v('cargo'), etapa: (v('etapa') || o.etapa) as Etapa, responsavel: v('responsavel'), valor: valorDe(v('valor')) || undefined, proximaData: v('proximaData'), proximoPasso: v('proximoPasso'), motivo: f.elements.namedItem('motivo') ? v('motivo') : o.motivo, atualizadoEm: new Date().toISOString() };
    if (await grava('funil', novo)) aviso('Oportunidade salva.');
  }
  async function registrar(f: HTMLFormElement) {
    const o = ops.find((x) => x.id === selOp); if (!o) return;
    const v = (n: string) => ((f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim();
    if (!v('nota')) { aviso('Escreva o que aconteceu no contato.'); return; }
    const agora = new Date().toISOString(), canal = v('canal') as Canal;
    const a: Atividade = { id: novoId('at'), opId: o.id, quando: agora, quem: v('quem'), canal, nota: v('nota') };
    if (!(await grava('atividades', a))) return;
    const etapa: Etapa = o.etapa === 'alvo' && canal !== 'nota' ? 'abordado' : o.etapa;
    const nova: Oportunidade = { ...o, etapa, proximaData: proximaPelaCadencia(etapa, hojeISO()), atualizadoEm: agora };
    await grava('funil', nova);
    f.reset(); aviso(`Contato registrado. Próximo contato em ${dataBR(proximaPelaCadencia(etapa, hojeISO()))}.`);
  }
  async function novoAlvo(f: HTMLFormElement) {
    const v = (n: string) => ((f.elements.namedItem(n) as HTMLInputElement | null)?.value || '').trim();
    if (!v('nome')) { aviso('Diga qual empresa ou alvo.'); return; }
    const agora = new Date().toISOString();
    const o = oportunidadeDe({ id: '', nome: v('contato') || v('nome'), tipo: v('contato') ? 'pessoa' : 'anunciante', empresa: v('nome'), cargo: v('cargo') }, { agora, responsavel: v('responsavel') || c.equipe()[0], origem: 'cadastro manual' });
    if (!v('contato')) { o.nome = v('nome'); o.contato = ''; }
    if (await grava('funil', o)) { f.reset(); selOp = o.id; aviso(`${o.nome} entrou no funil.`); }
  }

  /* ── Agenda ── */
  function agendaV() {
    const A = agenda(ops, hojeISO());
    const bloco = (t: string, L: Oportunidade[], vazio: string) => `<section class="ag-b"><h3 class="st">${esc(t)} <span class="n">${fmt(L.length)}</span></h3>${L.length ? `<ul class="li">${L.map(linhaOp).join('')}</ul>` : `<p class="nota">${esc(vazio)}</p>`}</section>`;
    $('#agL').innerHTML = bloco('Atrasados', A.atrasadas, 'Nada atrasado.') + bloco('Hoje', A.hoje, 'Nada para hoje.') + bloco('Próximos 7 dias', A.semana, 'Nada na semana.') + (A.semData.length ? bloco('Sem data', A.semData, '') : '');
  }

  function tudo() { painel(); bigdata(); funil(); agendaV(); c.aoAtualizar?.(); const n = $('#navFn'); if (n) n.dataset.n = String(agenda(ops, hojeISO()).atrasadas.length || ''); }

  /* ── eventos ── */
  c.raiz.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>('button'); if (!b || !c.raiz.contains(b)) return;
    if (b.dataset.op) { abrirOp(b.dataset.op); $('#fnD').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    if (b.dataset.funil) { const r = bd.find((x) => x.id === b.dataset.funil); if (r) void levarAoFunil(r, 'Big Data'); return; }
    if (b.dataset.rede) { c.verNaRede(b.dataset.rede); return; }
    if (b.dataset.bd) { bq = (bd.find((x) => x.id === b.dataset.bd)?.nome) || ''; ($('#bdQ') as HTMLInputElement).value = bq; bt = ''; location.hash = '#bigdata'; bigdata(); return; }
    if (b.dataset.apagarBd) { if (confirmar === b.dataset.apagarBd) { confirmar = ''; void apaga('bd', b.dataset.apagarBd); } else { confirmar = b.dataset.apagarBd; bigdata(); } return; }
    if (b.dataset.apagarOp) { if (confirmar === b.dataset.apagarOp) { confirmar = ''; const id = b.dataset.apagarOp; selOp = ''; void apaga('funil', id); for (const a of ats.filter((x) => x.opId === id)) void apaga('atividades', a.id); } else { confirmar = b.dataset.apagarOp; funil(); } return; }
    if (b.dataset.bt != null) { bt = b.dataset.bt; bLim = 40; bigdata(); return; }
    if (b.id === 'bdMais') { bLim += 40; bigdata(); return; }
    if (b.id === 'crmDesf') { const f = desfazer; desfazer = null; f?.(); return; }
    if (b.id === 'jMais') { jLim += 8; painel(); return; }
    if (b.dataset.busca) { bq = b.dataset.busca; ($('#bdQ') as HTMLInputElement).value = bq; bt = ''; location.hash = '#bigdata'; bigdata(); return; }
    if (b.id === 'bdCsv') { void baixar(`mento-big-data-${hojeISO()}.csv`, csv([['Nota', 'Tipo', 'Nome', 'Cargo', 'Empresa', 'Setor', 'Sinal', 'Data', 'Motivos', 'LinkedIn', 'Fonte'], ...bd.map((r) => { const n = notas().get(r.id)!; return [n.nota, TIP[r.tipo], r.nome, r.cargo, r.empresa, r.setor, r.sinal, r.data, n.motivos.join(' · '), r.linkedin, r.fonte]; }).sort((a, b) => Number(b[0]) - Number(a[0]))])); return; }
    if (b.id === 'fnCsv') { void baixar(`mento-funil-${hojeISO()}.csv`, csv([['Empresa', 'Contato', 'Cargo', 'Etapa', 'Responsável', 'Valor', 'Próximo passo', 'Próximo contato', 'Origem', 'Criado em'], ...ops.map((o) => [o.nome, o.contato, o.cargo, ETQ[o.etapa], o.responsavel, o.valor || '', o.proximoPasso, o.proximaData, o.origem, o.criadoEm.slice(0, 10)])])); }
  });
  c.raiz.addEventListener('submit', (ev) => {
    const f = ev.target as HTMLFormElement; ev.preventDefault();
    if (f.id === 'fnF') void salvarOp(f); else if (f.id === 'fnA') void registrar(f); else if (f.id === 'fnN') void novoAlvo(f); else if (f.id === 'bdF') void novoRegistro(f);
  });
  c.raiz.addEventListener('input', (ev) => { const t = ev.target as HTMLInputElement; if (t.id === 'bdQ') { bq = t.value; bLim = 40; bigdata(); } });
  c.raiz.addEventListener('change', (ev) => { const t = ev.target as HTMLInputElement; if (t.id === 'bdOrd') { bOrd = t.value; bigdata(); } if (t.id === 'bdDec') { bDecide = t.checked; bigdata(); } if (t.id === 'bdSin') { bSinal = t.checked; bigdata(); } });

  let baixar: (nome: string, dados: string) => Promise<void> = async () => {};
  const offs = [
    c.loja.ouvir<Registro>('bd', (l) => { bd = l.filter((r) => !foraDoRadar(r)); carregado.bd = true; c.aoMudarBd(bd); tudo(); }, aviso),
    c.loja.ouvir<Oportunidade>('funil', (l) => { ops = l; carregado.funil = true; tudo(); }, aviso),
    c.loja.ouvir<Atividade>('atividades', (l) => { ats = l; funil(); }, aviso),
    c.loja.ouvir<Leitura>('leituras', (l) => { leituras = l; painel(); }, aviso),
  ];
  setTimeout(() => { if (!carregado.bd) aviso('O banco ainda não respondeu. Os dados aparecem assim que ele responder.'); }, 10000);
  tudo();
  /** Muda a etapa de uma oportunidade (arrastando o card ou com Alt + seta) e avisa, com Desfazer. */
  async function moverEtapa(id: string, etapa: Etapa) {
    const o = ops.find((x) => x.id === id); if (!o || o.etapa === etapa) return;
    const antes = o.etapa, agora = new Date().toISOString();
    if (await grava('funil', { ...o, etapa, atualizadoEm: agora } as Oportunidade)) {
      aviso(`${o.nome}: ${ETQ[antes]} → ${ETQ[etapa]}.`, { rotulo: 'Desfazer', fazer: () => { const x = ops.find((y) => y.id === id); if (x) void grava('funil', { ...x, etapa: antes, atualizadoEm: new Date().toISOString() } as Oportunidade); } });
      selOp = id;
    }
  }
  c.raiz.addEventListener('dragstart', (ev) => { const b = (ev.target as Element).closest<HTMLElement>('.fn-c'); if (!b) return; dragOp = b.dataset.op || ''; ev.dataTransfer?.setData('text/plain', dragOp); b.classList.add('arrasta'); });
  c.raiz.addEventListener('dragend', () => { dragOp = ''; c.raiz.querySelectorAll('.arrasta,.alvo-drop').forEach((x) => x.classList.remove('arrasta', 'alvo-drop')); });
  c.raiz.addEventListener('dragover', (ev) => { const col = (ev.target as Element).closest<HTMLElement>('.fn-col'); if (!col || !dragOp) return; ev.preventDefault(); c.raiz.querySelectorAll('.alvo-drop').forEach((x) => x !== col && x.classList.remove('alvo-drop')); col.classList.add('alvo-drop'); });
  c.raiz.addEventListener('drop', (ev) => { const col = (ev.target as Element).closest<HTMLElement>('.fn-col'); if (!col || !dragOp) return; ev.preventDefault(); void moverEtapa(dragOp, col.dataset.etapa as Etapa); });
  c.raiz.addEventListener('keydown', (ev) => {
    const b = (ev.target as Element).closest?.('.fn-c') as HTMLElement | null; if (!b || !ev.altKey || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
    ev.preventDefault(); const o = ops.find((x) => x.id === b.dataset.op); if (!o) return;
    const i = ETAPAS.findIndex(([e]) => e === o.etapa), j = Math.max(0, Math.min(ETAPAS.length - 1, i + (ev.key === 'ArrowRight' ? 1 : -1)));
    void moverEtapa(o.id, ETAPAS[j][0]).then(() => setTimeout(() => c.raiz.querySelector<HTMLElement>(`.fn-c[data-op="${CSS.escape(o.id)}"]`)?.focus(), 50));
  });

  return { levarAoFunil, tudo, ops: () => ops, abrirOp, buscarBd: (q: string) => { bq = q; ($('#bdQ') as HTMLInputElement).value = q; bt = ''; location.hash = '#bigdata'; bigdata(); }, definirBaixar: (f: typeof baixar) => { baixar = f; }, parar: () => offs.forEach((o) => o()), bd: () => bd };
}

/** O HTML das telas do comercial (as views ficam dentro do app, alternadas pelo menu). */
export const HTML_CRM = (equipe: string[]) => `
<section class="vista" data-vista="painel" aria-labelledby="vPn"><h2 class="t" id="vPn">Painel</h2><section class="passos" id="pnP" aria-label="Primeiros passos"></section><ul class="kpis" id="pnK"></ul>
 <div><h3 class="st">Janelas de oportunidade</h3><p class="nota">Calculadas do Big Data: conta que acabou de trocar de agência, decisor que acabou de chegar, veículo em movimento. Cada uma com a ação da semana.</p><div id="pnJ"></div></div>
 <div class="dois"><div><h3 class="st">Leituras do mercado</h3><div class="leits" id="pnL"></div></div><div><h3 class="st">Agências que mais ganharam contas no ano</h3><div id="pnG"></div></div></div>
 <div class="dois"><div><h3 class="st">Para hoje</h3><div id="pnH"></div></div><div><h3 class="st">Melhores alvos fora do funil</h3><div id="pnA"></div></div></div>
 <div><h3 class="st">Sinais recentes do mercado</h3><div id="pnS"></div></div></section>
<section class="vista" data-vista="bigdata" aria-labelledby="vBd" hidden><h2 class="t" id="vBd">Big Data</h2>
 <p class="nota">Anunciantes, agências, veículos e quem decide, cada um com a fonte. A nota soma quem decide, ranking de compra de mídia, sinal recente (conta nova, CMO novo, cota comprada) e onde a equipe já trabalhou.</p>
 <div class="ferr2"><input type="search" id="bdQ" placeholder="Buscar nome, empresa, cargo, setor ou sinal" autocomplete="off"><div class="seg" id="bdTipos" role="group" aria-label="Tipo"></div><label class="chk"><input type="checkbox" id="bdDec"> Só quem decide</label><label class="chk"><input type="checkbox" id="bdSin"> Sinal nos últimos 6 meses</label><label class="chk">Ordenar <select id="bdOrd"><option value="nota">pela nota</option><option value="recentes">mais recentes</option><option value="nome">pelo nome</option></select></label><span class="nota" id="bdN" aria-live="polite"></span></div>
 <ol class="radar bd" id="bdL"></ol><div class="acoes"><button type="button" class="lnk" id="bdMais" hidden></button><button type="button" class="btn sec" id="bdCsv">Baixar o Big Data (planilha)</button></div>
 <details class="como"><summary>Cadastrar no Big Data</summary><form class="fm" id="bdF">
  <div class="g3"><label>Tipo<select name="tipo">${TIPOS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label><label>Nome<input name="nome" required></label><label>Setor<input name="setor"></label></div>
  <div class="g3"><label>Cargo (pessoa)<input name="cargo"></label><label>Empresa (pessoa)<input name="empresa"></label><label>LinkedIn<input name="linkedin" type="url" placeholder="https://www.linkedin.com/in/…"></label></div>
  <div class="g3"><label>Sinal<input name="sinal" placeholder="Ex.: trocou de agência de mídia"></label><label>Data do sinal<input name="data" placeholder="AAAA-MM-DD"></label><label>Fonte (link)<input name="fonte" type="url" placeholder="https://…"></label></div>
  <div class="acoes"><button type="submit" class="btn">Cadastrar</button></div></form></details></section>
<section class="vista" data-vista="funil" aria-labelledby="vFn" hidden><h2 class="t" id="vFn">Funil</h2><ul class="kpis" id="fnK"></ul>
 <details class="como"><summary>Novo alvo</summary><form class="fm" id="fnN"><div class="g3"><label>Empresa ou alvo<input name="nome" required></label><label>Contato<input name="contato"></label><label>Cargo<input name="cargo"></label></div>
  <div class="g3"><label>Responsável<select name="responsavel">${equipe.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label></div><div class="acoes"><button type="submit" class="btn">Pôr no funil</button></div></form></details>
 <p class="nota" id="fnDica">Arraste um card para outra etapa, ou selecione o card e use Alt + ← / →.</p>
 <div class="fn"><div class="rc fn-q" id="fnQ" tabindex="0" role="region" aria-label="Etapas do funil, rola de lado"></div><aside class="dossie fn-d" id="fnD" aria-live="polite"></aside></div>
 <div class="acoes"><button type="button" class="btn sec" id="fnCsv">Baixar o funil (planilha)</button></div></section>
<section class="vista" data-vista="agenda" aria-labelledby="vAg" hidden><h2 class="t" id="vAg">Agenda</h2><p class="nota">Os próximos contatos de cada oportunidade aberta. Registrar um contato no funil agenda o seguinte pela cadência da etapa.</p><div class="ag" id="agL"></div></section>`;
