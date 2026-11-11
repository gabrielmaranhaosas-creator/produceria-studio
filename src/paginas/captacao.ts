// Captação: alvos por etapa, achar novos (sinais e texto colado), atração, abordagem e proposta comercial.
import { esc, int, brl, dt } from '../lib/formato';
import { hoje, addDias } from '../lib/datas';
import { chave } from '../lib/nomes';
import { ETAPAS } from '../lib/prioridade';
import { banco, type Colecao } from '../lib/db';
import { perguntar, ErroIA } from '../lib/ia';
import { buscar, calcular, itemDe, rotulo, SERVICOS, type ItemProposta } from '../lib/servicos';
import type { Alvo, Caso, Oportunidade } from '../lib/tipos';
import { seletor, comId, abaNoEndereco, type Dialogo } from './dom';
import { vazio, abrirDialogo, devolverFoco, confirmarNoBotao } from '../componentes';

// ---------------------------------------------------------------- perfis e atração (da tela antiga)
export const PERFIS = [
  { id: 'independente', curto: 'Independente', nome: 'Agência independente', dor: 'Picos de demanda e nenhuma vontade de internalizar produção.', gatilho: 'Conquista de conta, campanha grande no ar, troca de diretor de criação.', entrada: 'Desdobramento de um KV como teste pago; depois fee mensal de produção.', nota: 'KPMG 2024: só 12% das agências veem produtoras como foco de investimento.' },
  { id: 'publica', curto: 'Conta pública', nome: 'Agência com conta pública', dor: 'Só pode cotar produção com fornecedores cadastrados no órgão, com 3 orçamentos.', gatilho: 'Resultado de licitação de publicidade (radar de Licitações e mapa de Vencedores).', entrada: 'Cadastro como fornecedor de produção do órgão e da agência vencedora.', nota: 'Lei 12.232/2010, art. 2º §1º II e art. 14.' },
  { id: 'inhouse', curto: 'In-house', nome: 'Anunciante com in-house enxuta', dor: 'O time interno cria, mas não finaliza nem adapta em escala.', gatilho: 'Vagas abertas para estúdio interno, rebranding, expansão de varejo e retail media.', entrada: 'Finalização e adaptação como extensão do in-house, com SLA.', nota: 'Dado da OLIVER, parte interessada.' },
  { id: 'rede', curto: 'Rede', nome: 'Rede com regra de marca rígida', dor: 'Muitas adaptações locais com padrão de marca a manter.', gatilho: 'Campanha regional, novas unidades, troca de agência.', entrada: 'Templates controlados + aprovação com rodadas contadas.', nota: 'Inferência a partir do modelo de cooperativas; validar com a conta Sicredi.' },
  { id: 'eua', curto: 'EUA', nome: 'Agência ou estúdio nos EUA', dor: 'Pouca oferta de finalização com craft e custo alto.', gatilho: 'FilmBrazil Roadshow, ex-clientes americanos, câmbio favorável.', entrada: 'Finalização remota faturada em dólar pela base de Miami.', nota: 'Tese de 2020 e operação em Miami.' },
] as const;
const perfilDe = (id?: string) => PERFIS.find((p) => p.id === id);

const ATRACAO = [
  { t: 'Case Black Box (Ouro Industry Craft, Cannes 2019)', d: 'Página e post contando o making of da produção gráfica. Prova pública que nenhum concorrente local tem.', passo: 'Reunir imagens e créditos e publicar o case' },
  { t: 'Diagnóstico de desdobramento grátis', d: 'A agência manda um KV; a Produceria devolve 3 formatos e um relatório de craft (rodadas, ajustes pegos). Porta de entrada barata e mensurável.', passo: 'Definir limite (3 formatos, 48 h) e roteiro do relatório' },
  { t: 'Guia de fechamento de arquivo', d: 'O checklist da Oficina vira material educativo para agências e in-houses: gera conversa com quem fecha arquivo mal.', passo: 'Diagramar o guia e oferecer no LinkedIn' },
  { t: 'Série "craft em 60 segundos"', d: 'Antes e depois de retoque, fechamento e acabamento. Mostra o trabalho invisível.', passo: 'Escolher 6 jobs autorizados e gravar' },
  { t: 'Relatório de craft trimestral para clientes', d: 'Gerado pelo Studio: versões, rodadas, aprovação na 1ª, ajustes evitados. Sustenta renovação e reajuste.', passo: 'Enviar o primeiro relatório à conta principal' },
];

export const MOTIVOS_DESCARTE = ['Sem fit de perfil', 'Tem produção própria', 'Sem contato acessível', 'Momento errado', 'Conflito com cliente', 'Outro'];

const HUB = 'a PRODUCERIA, hub de produção e craft em São Paulo e Miami (arte-final, retoque, adaptação de campanhas, motion, edição, HTML, produção gráfica, comunicação visual, mídia exterior OOH/DOOH, produção audiovisual e fotografia; não trabalha com eventos)';
const PROVAS = 'Ouro em Industry Craft no Cannes Lions 2019 ("Black Box", com a JWT, crédito de print production); base em Miami desde 2020, com a Produceria Miami em parceria com a CHICOOH+ para OOH/DOOH no exterior desde jan/2025 (case Broto Legal em Londres, final da FIFA Women\'s Champions Cup, fev/2026); projeto e desenvolvimento da ação "Raspe Seus Dados" (GUT para Mercado Livre, mar/2026); hub de três empresas (criação, produções, digitais); núcleos de produção offline e online com arte-final, retoque, revisão, motion, edição e HTML; pré-checagem e relatório de craft com rodadas e ajustes registrados.';

export interface Abordagem { insight: string; angulo: string; mensagem: string; cadencia: { dia: string; canal: string; texto: string }[]; pergunta: string; em: string }
export interface Proposta { itens: ItemProposta[]; rodadas: number; parcelas: number; validade: number; texto: string; em: string }
type AlvoDoc = Omit<Alvo, 'abordagem' | 'proposta'> & { abordagem?: Abordagem; proposta?: Proposta };
interface Downloads { save(o: { filename: string; data: string }): Promise<{ status?: string } | void> }

/** Vencido: tem prazo no passado e ainda não virou cliente nem foi descartado. */
export const vencido = (a: Pick<Alvo, 'prazo' | 'status'>, h = hoje()) => !!a.prazo && a.prazo < h && !['Cliente', 'Descartado'].includes(a.status || '');

/** Ordem do quadro: vencidos, "abordar esta semana", maior nota, prazo mais próximo, mais novos. */
export function ordenar<T extends Alvo | AlvoDoc>(L: T[], h = hoje()): T[] {
  return [...L].sort((a, b) => Number(vencido(b, h)) - Number(vencido(a, h))
    || Number(b.triagem === 'Abordar') - Number(a.triagem === 'Abordar')
    || (b.nota ?? -1) - (a.nota ?? -1)
    || (a.prazo || '9999').localeCompare(b.prazo || '9999')
    || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
}

/** Próxima sexta-feira (o "esta semana" da triagem). */
export function proximaSexta(base = hoje()): string {
  const d = new Date(base + 'T12:00');
  d.setDate(d.getDate() + ((12 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

const novoId = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const agora = () => new Date().toISOString();

type Aba = 'alvos' | 'achar' | 'atracao';

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap cp">
  <div class="pills lc-abas" role="tablist" aria-label="Captação" id="cpA"></div>
  <p class="sr" id="cpLive" aria-live="polite" aria-atomic="true"></p>
  <div id="cpO"></div>
</div><dialog id="cpD" aria-labelledby="cpDT"></dialog>`;
  const $ = seletor(root);
  let A: AlvoDoc[] = [], B: Oportunidade[] = [], C: Caso[] = [], funil: { id: string; titulo?: string }[] = [];
  let descontos: Record<string, number> = {};
  let col: Colecao<AlvoDoc> | null = null, db: Awaited<ReturnType<typeof banco>> = null;
  let carregando = true, perfil = '', novo = false, aba: Aba = 'alvos', ultimoAberto = '';
  const expandidas = new Set<string>();
  const offs: (() => void)[] = [];
  const abas = abaNoEndereco<Aba>(['alvos', 'achar', 'atracao'], 'alvos', (a) => { aba = a; render(); });
  aba = abas.inicial;
  const avisar = (t: string) => { $('#cpLive').textContent = t; };
  const D = $<Dialogo>('#cpD');
  D.addEventListener('close', () => render());
  devolverFoco(D, () => (ultimoAberto && root.querySelector<HTMLElement>(`[data-abre="${CSS.escape(ultimoAberto)}"]`)) || $<HTMLElement>('#cpA [aria-selected=true]'));
  const existe = (nome: string) => A.some((a) => chave(a.nome) === chave(nome));

  async function atualizar(id: string, d: Partial<AlvoDoc>, aviso = '') {
    if (col) { try { await col.doc(id).update(d); } catch { avisar('Não foi possível salvar. Tente de novo.'); return false; } }
    else { A = A.map((a) => (a.id === id ? { ...a, ...d } : a)); }
    if (aviso) avisar(aviso);
    return true;
  }
  async function criar(x: Partial<AlvoDoc>, aviso = true): Promise<boolean> {
    if (!x.nome?.trim()) { avisar('Dê o nome do alvo.'); return false; }
    const id = novoId('al');
    const doc: AlvoDoc = { id, nome: x.nome.trim(), perfil: x.perfil || 'independente', contato: x.contato || '', gatilho: x.gatilho || '', fonte: x.fonte || '', status: 'Mapeado', proximoPasso: x.proximoPasso || 'Pesquisar quem decide produção', prazo: x.prazo || null, notas: x.notas || '', origem: x.origem || 'Equipe', criadoEm: agora() };
    if (col) { try { await col.doc(id).set(doc); } catch { avisar('Não foi possível salvar.'); return false; } }
    else { A = [...A, doc]; }
    if (aviso) avisar(`${doc.nome} entrou como alvo, na coluna Mapeado.`);
    return true;
  }
  function notificar(titulo: string, texto: string) {
    if (!db) return;
    const id = novoId('av');
    db.collection('notificacoes').doc(id).set({ id, tipo: 'equipe', titulo, texto, link: '#captacao', para: 'Sid', em: agora() }).catch(() => {});
  }
  async function mover(a: AlvoDoc, etapa: string) {
    if (a.status === etapa) return;
    if (etapa === 'Proposta' || etapa === 'Cliente') notificar(etapa === 'Cliente' ? `Novo cliente: ${a.nome}` : `Proposta para ${a.nome}`, a.gatilho || '');
    await atualizar(a.id, { status: etapa }, `${a.nome}: ${etapa}.`);
    if (!col) render();
  }

  // ---------------------------------------------------------------- sinais nos dados
  interface Sinal { tipo: string; texto: string; porque: string; alvo: Partial<AlvoDoc> }
  function sinais(): Sinal[] {
    const out: Sinal[] = [];
    const publicidade = B.filter((o) => (o.score ?? 0) > 0 && /publicidade|propaganda|ag[êe]ncia de|comunica[çc][ãa]o institucional/i.test(o.objeto)).slice(0, 8);
    for (const o of publicidade) {
      const nome = `${o.orgao} · agência vencedora`;
      if (existe(nome)) continue;
      out.push({ tipo: 'Conta pública', texto: o.objeto.slice(0, 120), porque: `${o.orgao} (${o.uf || ''}): a agência que vencer vai precisar de fornecedores de produção cadastrados.`,
        alvo: { nome, perfil: 'publica', gatilho: `Licitação de publicidade: ${o.objeto.slice(0, 140)}`, fonte: o.url || '', origem: 'Radar de licitações' } });
    }
    return out;
  }

  // ---------------------------------------------------------------- render
  function render() {
    try { localStorage.setItem('cp.aba', aba); } catch { /* sem armazenamento */ }
    const vivos = A.filter((a) => a.status !== 'Descartado');
    const S = sinais();
    const abas: [Aba, string][] = [['alvos', `Alvos (${int(vivos.length)})`], ['achar', `Achar novos${S.length ? ` (${int(S.length)})` : ''}`], ['atracao', `Atração (${ATRACAO.length})`]];
    $('#cpA').innerHTML = abas.map(([v, t]) => `<button type="button" role="tab" id="cp-tab-${v}" aria-selected="${aba === v}" aria-pressed="${aba === v}" aria-controls="cpO" data-aba="${v}">${t}</button>`).join('');
    const o = $('#cpO');
    o.setAttribute('role', 'tabpanel');
    o.setAttribute('aria-labelledby', 'cp-tab-' + aba);
    o.innerHTML = aba === 'alvos' ? alvos(vivos) : aba === 'achar' ? achar(S, vivos) : atracao();
  }

  function alvos(vivos: AlvoDoc[]): string {
    const desc = A.filter((a) => a.status === 'Descartado').sort((a, b) => (b.triadoEm || '').localeCompare(a.triadoEm || ''));
    const venc = vivos.filter((a) => vencido(a)).length;
    const conversa = vivos.filter((a) => ['Abordado', 'Conversa', 'Proposta'].includes(a.status || '')).length;
    const clientes = vivos.filter((a) => a.status === 'Cliente').length;
    const L = ordenar(vivos.filter((a) => !perfil || a.perfil === perfil));
    const form = novo ? `<form class="cp-novo" id="cpNovo" novalidate><div class="det fm">
      <div class="f"><label for="n_nome">Empresa *</label><input id="n_nome" required></div>
      <div class="f"><label for="n_perfil">Perfil</label><select id="n_perfil">${PERFIS.map((p) => `<option value="${p.id}"${(perfil || 'independente') === p.id ? ' selected' : ''}>${p.nome}</option>`).join('')}</select></div>
      <div class="f"><label for="n_contato">Contato e cargo</label><input id="n_contato"></div>
      <div class="f"><label for="n_gat">Por que agora</label><input id="n_gat" placeholder="Ex.: ganhou a conta X em outubro"></div>
      <div class="f"><label for="n_fonte">Fonte (link)</label><input id="n_fonte" type="url"></div>
      <div class="f"><label for="n_passo">Próximo passo</label><input id="n_passo" placeholder="Pesquisar quem decide produção"></div>
      <div class="f"><label for="n_prazo">Até</label><input id="n_prazo" type="date"></div></div>
      <p class="erro" id="n_e" role="alert"></p><div class="dacts"><button type="submit">Registrar alvo</button><button type="button" class="ghost" id="cpNovoX">Cancelar</button></div></form>` : '';
    return `<section class="cp-resumo"><p class="note"><b>${int(vivos.length)}</b> alvos · <b>${int(conversa)}</b> em abordagem ou conversa · <b>${int(clientes)}</b> viraram cliente${venc ? ` · <b>${int(venc)}</b> com próximo passo vencido` : ''}</p>
      <div class="acts"><button type="button" class="chip" data-pf="" aria-pressed="${!perfil}">Todos</button>${PERFIS.map((p) => { const n = vivos.filter((a) => a.perfil === p.id).length; return n ? `<button type="button" class="chip" data-pf="${p.id}" aria-pressed="${perfil === p.id}">${p.curto} · ${int(n)}</button>` : ''; }).join('')}
      ${desc.length ? `<button type="button" class="chip cp-desc-chip" data-pf="__descartados" aria-pressed="${perfil === '__descartados'}">Descartados · ${int(desc.length)}</button>` : ''}
      <button type="button" class="sm" id="cpN" aria-expanded="${novo}">${novo ? 'Fechar' : 'Novo alvo'}</button></div></section>
      ${form}
      ${carregando ? '<p class="note">Carregando alvos…</p>' : perfil === '__descartados' ? descartados(desc) : L.length ? quadro(L) : vazio({ titulo: perfil ? 'Nenhum alvo neste perfil' : 'Nenhum alvo ainda', texto: 'Em Achar novos, use os sinais, cole um texto ou adicione à mão.', acao: '<button type="button" class="ghost sm" data-aba="achar">Achar novos</button>' })}`;
  }

  /** Alvos descartados: ficam guardados, com o motivo, e podem voltar para o quadro. */
  function descartados(L: AlvoDoc[]): string {
    return `<p class="note">Descartar não apaga: o alvo sai do quadro e fica aqui, com o motivo. Reabrir devolve para a coluna Mapeado.</p>
    <ul class="vc-l">${L.map((a) => `<li class="cp-desc"><span class="vc-c"><b>${esc(a.nome)}</b><span class="note">${esc(perfilDe(a.perfil)?.curto || a.perfil || '')}${a.motivoDescarte ? ' · ' + esc(a.motivoDescarte) : ''}${a.triadoEm ? ' · descartado em ' + dt(a.triadoEm) : ''}</span></span>
      <button type="button" class="ghost sm" data-reabre="${esc(a.id)}">Reabrir</button></li>`).join('')}</ul>`;
  }

  function quadro(L: AlvoDoc[]): string {
    const etapas = ETAPAS as readonly string[];
    return `<p class="note">Use os botões de etapa no cartão. Clique no nome para abrir o alvo.</p><div class="lc-kanban cp-quadro">${etapas.map((et, i) => {
      const itens = L.filter((a) => (a.status || 'Mapeado') === et);
      const mostra = expandidas.has(et) ? itens : itens.slice(0, 6);
      return `<section class="lc-col${et === 'Conversa' ? ' quente' : ''}" aria-label="${et}: ${itens.length}"><div class="lc-colh"><span class="lab">${et}</span><span class="note num">${int(itens.length)}</span></div>
      ${itens.length ? '' : '<span class="note">Nada aqui ainda</span>'}
      ${mostra.map((a) => {
        const flags = [a.nota != null ? 'nota ' + a.nota : '', perfilDe(a.perfil)?.curto || a.perfil || '', a.abordagem ? 'abordagem pronta' : '', a.proposta ? 'proposta' : '', a.triagem === 'Abordar' ? 'abordar esta semana' : '', a.triagem === 'Monitorar' ? 'monitorando' : ''].filter(Boolean).join(' · ');
        const v = vencido(a);
        return `<div class="lc-card"><span class="note">${esc(flags)}</span><button type="button" class="nm" data-abre="${esc(a.id)}">${esc(a.nome)}</button>
        ${a.proximoPasso || a.prazo ? `<span class="note${v ? ' cp-venc' : ''}">${v ? 'Vencido · ' : '→ '}${esc(a.proximoPasso || 'Próximo passo')}${a.prazo ? ' · ' + dt(a.prazo) : ''}</span>` : '<span class="note">Sem próximo passo</span>'}
        <div class="lc-mv">${i > 0 ? `<button type="button" class="ghost sm" data-mv="${esc(a.id)}" data-para="${etapas[i - 1]}" aria-label="Voltar ${esc(a.nome)} para ${etapas[i - 1]}">← ${etapas[i - 1]}</button>` : '<span></span>'}${i < etapas.length - 1 ? `<button type="button" class="ghost sm" data-mv="${esc(a.id)}" data-para="${etapas[i + 1]}" aria-label="Avançar ${esc(a.nome)} para ${etapas[i + 1]}">${etapas[i + 1]} →</button>` : ''}</div></div>`;
      }).join('')}
      ${itens.length > 6 ? `<button type="button" class="lnk" data-exp="${et}">${expandidas.has(et) ? 'Mostrar menos' : `Mostrar mais ${itens.length - 6}`}</button>` : ''}</section>`;
    }).join('')}</div>`;
  }

  function achar(S: Sinal[], vivos: AlvoDoc[]): string {
    return `<div class="grid">
    <section class="p" aria-labelledby="cp-sin"><div class="ph"><h2 class="d d-sub" id="cp-sin">Sinais nos seus dados</h2><span class="note num">${int(S.length)}</span></div>
      ${S.length ? `<ul class="lc-l">${S.map((s, i) => `<li class="cp-sinal"><span class="tag">${esc(s.tipo)}</span><div class="lc-c"><b>${esc(s.texto)}</b><span class="note">${esc(s.porque)}</span></div><button type="button" class="ghost sm" data-sinal="${i}">Virar alvo</button></li>`).join('')}</ul>`
        : '<p class="note">Sem sinais agora. Eles aparecem quando o radar de licitações traz licitações de publicidade pontuadas.</p>'}
    </section>
    <section class="p" aria-labelledby="cp-col"><div class="ph"><h2 class="d d-sub" id="cp-col">Cole e o Claude acha os alvos</h2></div>
      <p class="note">Notícia de conta conquistada, ranking de agências, post de vaga de in-house, lista de expositores. O Claude separa as empresas citadas e o motivo de agora. Nada fora do texto.</p>
      <div class="f"><label for="cpTxt">Texto para extrair alvos</label><textarea id="cpTxt" rows="6" placeholder="Cole aqui o texto…"></textarea></div>
      <p class="erro" id="cpTxtE" role="alert"></p>
      <div class="acts"><button type="button" id="cpExt">Extrair alvos</button><button type="button" class="ghost" id="cpMao">Adicionar à mão</button></div>
    </section></div>
    <section aria-labelledby="cp-quem"><div class="ph"><h2 class="d d-sub" id="cp-quem">Quem procurar</h2><span class="note">cinco perfis de cliente ideal · clique para ver os alvos do perfil</span></div>
      <div class="cp-perfis">${PERFIS.map((p) => `<button type="button" class="cp-perfil" data-verpf="${p.id}"><b>${p.nome}</b><span class="note"><b>Dor:</b> ${esc(p.dor)}</span><span class="note"><b>Gatilho:</b> ${esc(p.gatilho)}</span><span class="note"><b>Entrada:</b> ${esc(p.entrada)}</span><span class="note">${esc(p.nota)}</span><span class="note num">${int(vivos.filter((a) => a.perfil === p.id).length)} alvo(s) →</span></button>`).join('')}</div>
    </section>`;
  }

  function atracao(): string {
    return `<section aria-labelledby="cp-atr"><div class="ph"><h2 class="d d-sub" id="cp-atr">Atração</h2><span class="note">ativos que fazem o cliente vir até vocês</span></div>
    <div class="lc-emp">${ATRACAO.map((x, i) => {
      const noFunil = funil.some((f) => f.titulo === x.t);
      return `<div class="p"><h3 class="d d-sub">${esc(x.t)}</h3><p class="note">${esc(x.d)}</p><p class="note">Primeiro passo: ${esc(x.passo)}</p>${noFunil ? '<span class="tag ok">No funil</span>' : `<div><button type="button" class="ghost sm" data-funil="${i}">Levar ao funil</button></div>`}</div>`;
    }).join('')}</div></section>`;
  }

  // ---------------------------------------------------------------- alvo aberto
  function abrir(id: string, quem: HTMLElement | null) {
    const a = A.find((x) => x.id === id);
    if (!a) return;
    const p = perfilDe(a.perfil);
    const triagem = ['Mapeado', 'Pesquisado'].includes(a.status || 'Mapeado');
    abrirDialogo(D, `<div class="dh"><div><span class="lab">${esc(p?.nome || '')} · ${esc(a.status || 'Mapeado')}</span><h2 class="d d-sub" id="cpDT">${esc(a.nome)}</h2></div><button type="button" class="x" id="cpX" aria-label="Fechar">×</button></div>
    ${triagem ? `<div class="lc-box"><span class="note">${a.nota != null ? `Nota ${a.nota} · ${esc(a.notaMotivo || '')}` : 'A nota aparece na triagem de segunda.'}</span>
      <div class="acts"><button type="button" class="ghost sm" id="t_ab">Abordar esta semana</button><button type="button" class="ghost sm" id="t_mon">Monitorar 30 dias</button><select id="t_desc" aria-label="Descartar alvo com motivo" class="lc-desc"><option value="">Descartar…</option>${MOTIVOS_DESCARTE.map((m) => `<option>${m}</option>`).join('')}</select></div></div>` : ''}
    <div class="seg sm cp-etapas" role="group" aria-label="Etapa do alvo">${(ETAPAS as readonly string[]).map((e) => `<button type="button" data-et="${e}" aria-pressed="${(a.status || 'Mapeado') === e}">${e}</button>`).join('')}</div>
    ${a.fonte ? `<p><a class="cn-f" href="${esc(a.fonte)}" target="_blank" rel="noopener">Fonte do alvo ↗<span class="sr"> (abre em nova aba)</span></a></p>` : ''}
    <div class="det fm">
      <div class="f"><label for="a_contato">Contato e cargo</label><input id="a_contato" data-campo="contato" value="${esc(a.contato || '')}"></div>
      <div class="f"><label for="a_gat">Por que agora</label><input id="a_gat" data-campo="gatilho" value="${esc(a.gatilho || '')}"></div>
      <div class="f"><label for="a_passo">Próximo passo</label><input id="a_passo" data-campo="proximoPasso" value="${esc(a.proximoPasso || '')}"></div>
      <div class="f"><label for="a_prazo">Até</label><input id="a_prazo" type="date" data-campo="prazo" value="${esc(a.prazo || '')}"></div>
      <div class="f full"><label for="a_notas">Notas da equipe (a IA usa)</label><textarea id="a_notas" rows="3" data-campo="notas">${esc(a.notas || '')}</textarea></div>
    </div>
    <div class="ph"><h3 class="d d-sub">Abordagem</h3><button type="button" class="sm" id="ab_ia">${a.abordagem ? 'Reescrever' : 'Gerar abordagem'}</button></div>
    <p class="erro" id="ab_e" role="alert"></p>
    <div id="ab_o">${abordagemHTML(a)}</div>
    <div class="lc-box" id="pp"></div>
    <div class="dacts fim"><button type="button" class="ghost perigo" id="a_desc">Descartar este alvo</button></div>`, quem, '#cpX');
    $('#cpX').onclick = () => D.close();
    // triagem
    if (triagem) {
      $('#t_ab').onclick = async () => { const p2 = proximaSexta(); await atualizar(a.id, { triagem: 'Abordar', triadoEm: agora(), prazo: p2 }, `${a.nome}: abordar até ${dt(p2)}.`); };
      $('#t_mon').onclick = async () => { const p2 = addDias(hoje(), 30); await atualizar(a.id, { triagem: 'Monitorar', triadoEm: agora(), prazo: p2 }, `${a.nome}: monitorar até ${dt(p2)}.`); };
      $<HTMLSelectElement>('#t_desc').onchange = async (e) => {
        const m = (e.target as HTMLSelectElement).value;
        if (!m) return;
        if (await atualizar(a.id, { status: 'Descartado', triagem: 'Descartar', motivoDescarte: m, triadoEm: agora() }, `${a.nome} descartado: ${m}.`)) D.close();
      };
    }
    D.querySelectorAll<HTMLButtonElement>('[data-et]').forEach((b) => { b.onclick = async () => {
      await mover(a, b.dataset.et!);
      a.status = b.dataset.et!;
      D.querySelectorAll<HTMLButtonElement>('[data-et]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.et === a.status)));
    }; });
    D.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-campo]').forEach((el) => { el.onblur = () => {
      const k = el.dataset.campo as 'contato' | 'gatilho' | 'proximoPasso' | 'prazo' | 'notas';
      const v = el.value.trim();
      if (v === String(a[k] || '')) return;
      (a as unknown as Record<string, unknown>)[k] = k === 'prazo' ? v || null : v;
      atualizar(a.id, { [k]: k === 'prazo' ? v || null : v }, 'Salvo.');
    }; });
    // abordagem
    const bAb = $<HTMLButtonElement>('#ab_ia');
    bAb.onclick = async () => {
      bAb.disabled = true; bAb.textContent = 'Escrevendo…'; $('#ab_e').textContent = '';
      try {
        const r = (await perguntar(`Você escreve a primeira abordagem comercial de ${HUB}. Tom: direto, específico, sem autopromoção vazia, sem "solução 360°". Português do Brasil.
ALVO: ${a.nome}${a.contato ? ' · contato: ' + a.contato : ''}
PERFIL: ${p?.nome || a.perfil} · dor típica: ${p?.dor || '—'} · oferta de entrada: ${p?.entrada || '—'}
GATILHO (por que agora): ${a.gatilho || 'não informado'}
NOTAS DA EQUIPE: ${a.notas || '—'}
PROVAS QUE PODEM SER CITADAS: ${PROVAS}
Regras: não invente fatos sobre o alvo além do que está acima; o que for suposição sobre o alvo, escreva como pergunta. A mensagem tem no máximo 90 palavras e termina com um pedido pequeno (15 minutos, ou mandar um KV para teste).
Responda só com JSON: {"insight": "1 frase: o que provavelmente dói para eles agora", "angulo": "1 frase: por que a Produceria e não outra", "mensagem": "texto pronto para LinkedIn ou e-mail", "cadencia": [{"dia": "D0", "canal": "LinkedIn|E-mail|Telefone", "texto": "resumo do toque"}, {"dia": "D+4", "canal": "", "texto": ""}, {"dia": "D+10", "canal": "", "texto": ""}], "pergunta": "1 pergunta de descoberta para a primeira conversa"}`, { json: true })) as Partial<Abordagem> | null;
        if (!r || typeof r !== 'object' || !r.mensagem) throw new ErroIA('A resposta não trouxe a mensagem. Tente de novo.');
        const ab: Abordagem = { insight: String(r.insight || ''), angulo: String(r.angulo || ''), mensagem: String(r.mensagem), pergunta: String(r.pergunta || ''),
          cadencia: Array.isArray(r.cadencia) ? r.cadencia.slice(0, 4).map((c) => ({ dia: String(c?.dia || ''), canal: String(c?.canal || ''), texto: String(c?.texto || '') })) : [], em: agora() };
        a.abordagem = ab;
        const st = a.status === 'Mapeado' ? 'Pesquisado' : a.status;
        await atualizar(a.id, { abordagem: ab, status: st }, 'Abordagem pronta.');
        a.status = st;
        $('#ab_o').innerHTML = abordagemHTML(a);
        ligarAbordagem(a);
      } catch (e) {
        $('#ab_e').textContent = e instanceof ErroIA ? e.message : 'A abordagem falhou. Tente de novo.';
      } finally { bAb.disabled = false; bAb.textContent = a.abordagem ? 'Reescrever' : 'Gerar abordagem'; }
    };
    ligarAbordagem(a);
    montarProposta(a, $('#pp'));
    confirmarNoBotao($<HTMLButtonElement>('#a_desc'), 'Confirmar descarte', async () => {
      if (await atualizar(a.id, { status: 'Descartado', triagem: 'Descartar', triadoEm: agora() }, `${a.nome} descartado.`)) D.close();
    });
  }

  function abordagemHTML(a: AlvoDoc): string {
    const ab = a.abordagem;
    if (!ab) return '<p class="note">Preencha o porquê de agora e as notas: a abordagem fica melhor com contexto real.</p>';
    return `<div class="lc-box"><p><b>Insight:</b> ${esc(ab.insight)}</p><p><b>Ângulo:</b> ${esc(ab.angulo)}</p><p><b>Pergunta de descoberta:</b> ${esc(ab.pergunta)}</p></div>
    <div class="lc-box"><p class="lc-pre" id="ab_msg">${esc(ab.mensagem)}</p><div class="acts"><button type="button" class="sm" id="ab_cp">Copiar mensagem</button>${['Mapeado', 'Pesquisado'].includes(a.status || 'Mapeado') ? '<button type="button" class="ghost sm" id="ab_env">Já enviei → Abordado</button>' : ''}</div></div>
    ${ab.cadencia.length ? `<div class="tw"><table class="cp-cad"><thead><tr><th scope="col"><span class="th">Quando</span></th><th scope="col"><span class="th">Canal</span></th><th scope="col"><span class="th">Toque</span></th></tr></thead><tbody>${ab.cadencia.map((c) => `<tr><td class="num">${esc(c.dia)}</td><td>${esc(c.canal)}</td><td>${esc(c.texto)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="note">Gerado em ${dt(ab.em)}. Revise antes de enviar: o Studio não envia mensagens.</p>`;
  }
  function ligarAbordagem(a: AlvoDoc) {
    const cp = D.querySelector<HTMLButtonElement>('#ab_cp');
    if (cp) cp.onclick = async () => {
      try { await navigator.clipboard.writeText(a.abordagem!.mensagem); avisar('Mensagem copiada. O Studio não envia: cole no LinkedIn ou no e-mail.'); cp.textContent = 'Copiada'; }
      catch { const r = document.createRange(); r.selectNodeContents($('#ab_msg')); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); avisar('Selecione o texto e copie.'); }
    };
    const env = D.querySelector<HTMLButtonElement>('#ab_env');
    if (env) env.onclick = async () => { await mover(a, 'Abordado'); a.status = 'Abordado'; env.remove(); D.querySelectorAll<HTMLButtonElement>('[data-et]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.et === 'Abordado'))); };
  }

  // ---------------------------------------------------------------- proposta
  function montarProposta(a: AlvoDoc, el: HTMLElement) {
    const pr: Proposta = a.proposta ? JSON.parse(JSON.stringify(a.proposta)) : { itens: [], rodadas: 2, parcelas: 1, validade: 15, texto: '', em: '' };
    const brlC = (c: number) => brl(c / 100);
    const totais = () => ({ todos: calcular(pr.itens), essencial: calcular(pr.itens.filter((i) => !i.opcional)), temOpc: pr.itens.some((i) => i.opcional) });
    function desenhar() {
      const t = totais();
      const parc = (v: number) => (pr.parcelas > 1 ? ` · ${pr.parcelas}x de ${brlC(Math.ceil(v / pr.parcelas))}` : '');
      el.innerHTML = `<span class="lab">Proposta comercial</span>
      <div class="f"><label for="pp_q">Adicionar serviço da tabela</label><input id="pp_q" type="search" autocomplete="off" placeholder="Ex.: adaptação, key visual, retoque, banner HTML…"></div>
      <ul class="cp-achados" id="pp_r"></ul>
      ${pr.itens.length ? `<div class="tw"><table class="cp-itens"><thead><tr><th scope="col"><span class="th">Serviço</span></th><th scope="col" class="num"><span class="th">Qtd.</span></th><th scope="col" class="num"><span class="th">Referência</span></th><th scope="col" class="num"><span class="th">Desc.</span></th><th scope="col" class="num"><span class="th">Total</span></th><th scope="col"><span class="th">Opcional</span></th><th scope="col"><span class="sr">Tirar</span></th></tr></thead><tbody>
        ${pr.itens.map((i, k) => `<tr><td>${esc(i.descricao)}<span class="sub">${esc(i.fonte)}</span></td><td class="num"><input class="cp-qtd" inputmode="decimal" data-qtd="${k}" value="${String(i.qtd).replace('.', ',')}" aria-label="Quantidade de ${esc(i.descricao)}"></td><td class="num">${brlC(i.unit)}</td><td class="num">${i.desconto ? i.desconto + '%' : '—'}</td><td class="num">${brlC(calcular([i]).total)}</td><td><input type="checkbox" data-opc="${k}" ${i.opcional ? 'checked' : ''} aria-label="Item opcional"></td><td><button type="button" class="lnk" data-tira="${k}">Tirar</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="note">Busque e adicione os serviços. Os valores vêm da tabela da casa, já com o desconto de cada serviço. Marque como opcional o que pode sair numa versão mais enxuta.</p>'}
      <div class="det fm"><div class="f"><label for="pp_rod">Rodadas incluídas por peça</label><input id="pp_rod" inputmode="numeric" value="${pr.rodadas}"></div><div class="f"><label for="pp_par">Parcelas</label><input id="pp_par" inputmode="numeric" value="${pr.parcelas}"></div><div class="f"><label for="pp_val">Validade (dias)</label><input id="pp_val" inputmode="numeric" value="${pr.validade}"></div></div>
      ${pr.itens.length ? `<div class="lc-box">${t.temOpc ? `<p><b>Essencial:</b> ${brlC(t.essencial.total)}${parc(t.essencial.total)}</p>` : ''}<p><b>${t.temOpc ? 'Completo' : 'Total'}:</b> ${brlC(t.todos.total)}${parc(t.todos.total)}</p>${t.todos.desconto ? `<p class="note">Desconto da tabela já aplicado: ${brlC(t.todos.desconto)}</p>` : ''}</div>` : ''}
      <div class="acts"><button type="button" class="ghost sm" id="pp_ia" ${pr.itens.length ? '' : 'disabled'}>${pr.texto ? 'Reescrever o texto' : 'Escrever o texto com o Claude'}</button></div>
      <p class="erro" id="pp_e" role="alert"></p>
      ${pr.texto || pr.itens.length ? `<div class="f"><label for="pp_txt">Texto da proposta (edite à vontade)</label><textarea id="pp_txt" rows="10">${esc(pr.texto)}</textarea></div>` : ''}
      <div class="acts"><button type="button" class="ghost sm" id="pp_salva" ${pr.itens.length ? '' : 'disabled'}>Salvar rascunho</button><button type="button" class="ghost sm" id="pp_md" ${pr.itens.length ? '' : 'disabled'}>Baixar proposta (.md)</button>${a.status !== 'Proposta' ? `<button type="button" class="sm" id="pp_mov" ${pr.itens.length ? '' : 'disabled'}>Salvar e mover para Proposta</button>` : ''}</div>`;
      ligar();
    }
    function ligar() {
      const q = el.querySelector<HTMLInputElement>('#pp_q')!;
      q.oninput = () => {
        const r = q.value.trim().length >= 2 ? buscar(q.value, 8) : [];
        el.querySelector('#pp_r')!.innerHTML = r.map((s) => `<li><button type="button" class="cp-achado" data-add="${s.id}"><span>${esc(rotulo(s))}</span><span class="note num">${brl(s.ref)}${descontos[String(s.id)] ? ` · −${descontos[String(s.id)]}%` : ''} · ID ${s.id}</span></button></li>`).join('');
      };
      el.querySelector('#pp_r')!.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-add]');
        const s = b && SERVICOS.find((x) => x.id === Number(b.dataset.add));
        if (!s) return;
        pr.itens.push(itemDe(s, descontos, novoId('pi')));
        desenhar(); el.querySelector<HTMLInputElement>('#pp_q')!.focus();
      });
      el.querySelectorAll<HTMLInputElement>('[data-qtd]').forEach((i) => { i.onchange = () => { pr.itens[Number(i.dataset.qtd)].qtd = Math.max(0, Number(i.value.replace(',', '.')) || 0); desenhar(); }; });
      el.querySelectorAll<HTMLInputElement>('[data-opc]').forEach((i) => { i.onchange = () => { pr.itens[Number(i.dataset.opc)].opcional = i.checked; desenhar(); }; });
      el.querySelectorAll<HTMLButtonElement>('[data-tira]').forEach((b) => { b.onclick = () => { pr.itens.splice(Number(b.dataset.tira), 1); desenhar(); }; });
      const num = (id: string, min: number, max: number, def: number) => { const v = Number(el.querySelector<HTMLInputElement>(id)!.value) || def; return Math.max(min, Math.min(max, v)); };
      el.querySelector<HTMLInputElement>('#pp_rod')!.onchange = () => { pr.rodadas = num('#pp_rod', 0, 9, 0); desenhar(); };
      el.querySelector<HTMLInputElement>('#pp_par')!.onchange = () => { pr.parcelas = num('#pp_par', 1, 12, 1); desenhar(); };
      el.querySelector<HTMLInputElement>('#pp_val')!.onchange = () => { pr.validade = num('#pp_val', 1, 365, 15); desenhar(); };
      const txt = el.querySelector<HTMLTextAreaElement>('#pp_txt');
      if (txt) txt.oninput = () => { pr.texto = txt.value; };
      const bIA = el.querySelector<HTMLButtonElement>('#pp_ia')!;
      bIA.onclick = async () => {
        bIA.disabled = true; bIA.textContent = 'Escrevendo…'; el.querySelector('#pp_e')!.textContent = '';
        try {
          const servs = pr.itens.map((i) => i.descricao).join(' ').toLowerCase();
          const casos = C.map((c) => ({ c, s: ((c.perfis || []).includes(a.perfil || '') ? 2 : 0) + (c.servicos || []).filter((x) => servs.includes(x.toLowerCase().split('/')[0].slice(0, 6))).length }))
            .filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 3)
            .map(({ c }) => `${c.titulo} (${[c.cliente, c.agencia, c.ano].filter(Boolean).join(', ')}): ${c.resumo || ''}${c.resultado ? ' Resultado: ' + c.resultado : ''}`);
          const txtIA = await perguntar(`Escreva o texto de uma proposta comercial de ${HUB}. Provas da casa: Ouro em Industry Craft no Cannes Lions 2019 com o case "Black Box"; OOH/DOOH internacional pela Produceria Miami com a CHICOOH+; projeto e desenvolvimento de "Raspe Seus Dados", GUT para Mercado Livre. Português do Brasil, tom direto e específico, sem jargão vazio.
Cliente: ${a.nome}${a.contato ? ' (' + a.contato + ')' : ''}. Por que agora: ${a.gatilho || 'não informado'}. Notas: ${a.notas || '—'}.
Casos da casa que podem ser citados (use até 3, só estes, sem inventar detalhes): ${casos.length ? casos.join(' | ') : 'nenhum caso cadastrado combina com este alvo'}.
Serviços: ${pr.itens.map((i) => `${i.qtd}× ${i.descricao}${i.opcional ? ' (opcional)' : ''}`).join('; ')}.
Escreva só três seções em markdown, sem valores (os valores entram numa tabela à parte): "## Entendimento" (2 a 3 frases sobre o desafio provável do cliente; o que for suposição, escreva como pergunta), "## Como a Produceria trabalha" (3 a 5 bullets: fluxo, pré-checagem antes do envio, rodadas contadas, relatório de craft) e "## Por que a Produceria" (2 a 3 frases com provas). Não invente clientes, números ou prêmios além dos citados.`, { aoEscrever: (t) => { const x = el.querySelector<HTMLTextAreaElement>('#pp_txt'); if (x) x.value = t; } });
          pr.texto = String(txtIA);
          desenhar();
        } catch (e) {
          el.querySelector('#pp_e')!.textContent = e instanceof ErroIA ? e.message : 'O texto falhou. Tente de novo.';
        } finally { const b = el.querySelector<HTMLButtonElement>('#pp_ia'); if (b) { b.disabled = !pr.itens.length; b.textContent = pr.texto ? 'Reescrever o texto' : 'Escrever o texto com o Claude'; } }
      };
      const salvar = async (mov: boolean) => {
        pr.em = agora();
        const t = totais();
        const ok = await atualizar(a.id, mov ? { proposta: pr, status: 'Proposta' } : { proposta: pr }, mov ? 'Proposta salva e alvo movido para Proposta.' : 'Proposta salva.');
        if (ok) { a.proposta = JSON.parse(JSON.stringify(pr)); if (mov) { notificar(`Proposta para ${a.nome}`, `${brlC(t.todos.total)}${t.temOpc ? ` (essencial: ${brlC(t.essencial.total)})` : ''}`); a.status = 'Proposta'; desenhar(); } }
      };
      el.querySelector<HTMLButtonElement>('#pp_salva')!.onclick = () => salvar(false);
      const mov = el.querySelector<HTMLButtonElement>('#pp_mov');
      if (mov) mov.onclick = () => salvar(true);
      el.querySelector<HTMLButtonElement>('#pp_md')!.onclick = () => baixar(a, pr);
    }
    desenhar();
  }

  async function baixar(a: AlvoDoc, pr: Proposta) {
    const brlC = (c: number) => brl(c / 100);
    const t = calcular(pr.itens), e = calcular(pr.itens.filter((i) => !i.opcional)), opc = pr.itens.some((i) => i.opcional);
    const linha = (x: { total: number }, r: string) => `**${r}: ${brlC(x.total)}**${pr.parcelas > 1 ? ` · em ${pr.parcelas}x de ${brlC(Math.ceil(x.total / pr.parcelas))}` : ''}`;
    const md = [`# Proposta · ${a.nome}`, `PRODUCERIA · ${new Date().toLocaleDateString('pt-BR')}`, '', pr.texto || '', '', '## Escopo e investimento',
      '| Serviço | Qtd. | Valor de referência | Desconto | Total |', '| --- | --- | --- | --- | --- |',
      ...pr.itens.map((i) => `| ${i.descricao}${i.opcional ? ' *(opcional)*' : ''} | ${String(i.qtd).replace('.', ',')} | ${brlC(i.unit)} | ${i.desconto ? i.desconto + '%' : '—'} | ${brlC(calcular([i]).total)} |`),
      '', opc ? linha(e, 'Escopo essencial') : '', linha(t, opc ? 'Escopo completo' : 'Total'), '', '## Condições',
      '- Valores com base na tabela de referência de serviços da PRODUCERIA (valores SINAPRO), com o desconto negociado de cada item.',
      `- ${pr.rodadas} rodada(s) de ajustes do cliente incluída(s) por peça. Rodadas além disso são orçadas como refação, sobre o valor do item.`,
      pr.parcelas > 1 ? `- Pagamento em ${pr.parcelas} parcelas.` : '- Condição de pagamento a combinar.', `- Proposta válida por ${pr.validade} dias.`,
      '- Ao final, a PRODUCERIA entrega o relatório de craft: versões, rodadas e ajustes resolvidos antes do envio.'].filter((x) => x !== '').join('\n');
    try {
      const d = (await window.claude?.use('downloads')) as Downloads | undefined;
      if (!d) { avisar('Download indisponível nesta visualização. Abra o Studio no Claude.'); return; }
      const nome = `proposta-${chave(a.nome).replace(/\s+/g, '-')}.md`;
      const r = await d.save({ filename: nome, data: md });
      if (r && r.status === 'saved') avisar('Arquivo salvo: ' + nome);
    } catch (e) {
      const c = (e as { code?: string })?.code;
      if (c !== 'declined') avisar(c === 'rate_limited' ? 'Já há um download aguardando confirmação.' : 'Não foi possível gerar o arquivo agora.');
    }
  }

  // ---------------------------------------------------------------- eventos
  root.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !root.contains(b) || D.contains(b)) return;
    const d = b.dataset;
    if (d.aba) { abas.ir(d.aba as Aba); $<HTMLElement>('#cp-tab-' + aba).focus(); return; }
    if (d.pf !== undefined) { perfil = d.pf; render(); return; }
    if (d.reabre) { const a = A.find((x) => x.id === d.reabre); if (a && await atualizar(a.id, { status: 'Mapeado', triagem: '', motivoDescarte: '', triadoEm: agora() }, `${a.nome} voltou para Mapeado.`)) { if (!col) render(); } return; }
    if (d.verpf) { perfil = d.verpf; aba = 'alvos'; render(); return; }
    if (b.id === 'cpN') { novo = !novo; render(); if (novo) $<HTMLInputElement>('#n_nome').focus(); return; }
    if (b.id === 'cpNovoX') { novo = false; render(); $<HTMLElement>('#cpN').focus(); return; }
    if (b.id === 'cpMao') { aba = 'alvos'; novo = true; render(); $<HTMLInputElement>('#n_nome').focus(); return; }
    if (d.exp) { if (expandidas.has(d.exp)) expandidas.delete(d.exp); else expandidas.add(d.exp); render(); return; }
    if (d.abre) { ultimoAberto = d.abre; abrir(d.abre, b); return; }
    if (d.mv && d.para) { const a = A.find((x) => x.id === d.mv); if (a) await mover(a, d.para); return; }
    if (d.sinal) { const s = sinais()[Number(d.sinal)]; if (s && await criar(s.alvo)) render(); return; }
    if (d.funil) {
      const x = ATRACAO[Number(d.funil)];
      if (!db) { avisar('O funil só funciona com o banco do Studio.'); return; }
      const id = novoId('fn');
      try { await db.collection('pipeline').doc(id).set({ eixo: 'Privado', titulo: x.t, alvo: '', valor: null, estagio: 'Identificada', proximoPasso: x.passo, fonte: '', criadoEm: agora(), origem: 'Atração' }); avisar('Entrou no funil.'); }
      catch { avisar('Não foi possível levar ao funil.'); }
      return;
    }
    if (b.id === 'cpExt') {
      const txt = $<HTMLTextAreaElement>('#cpTxt').value;
      $('#cpTxtE').textContent = '';
      if (txt.trim().length < 40) { $('#cpTxtE').textContent = 'Cole uma notícia, post ou lista com pelo menos algumas linhas.'; return; }
      const bt = b as HTMLButtonElement; bt.disabled = true; bt.textContent = 'Lendo…';
      try {
        const r = await perguntar(`Você ajuda a área comercial de ${HUB} a achar novos clientes. Leia o TEXTO e liste empresas citadas nele que poderiam contratar produção, com o motivo de agora. Só empresas que aparecem no texto: não invente nomes, pessoas nem fatos.
Perfis possíveis: independente (agência independente), publica (agência com conta pública), inhouse (anunciante com estrutura interna), rede (rede com regra de marca rígida), eua (agência ou estúdio nos EUA).
Responda só com JSON: [{"nome": "", "perfil": "independente|publica|inhouse|rede|eua", "gatilho": "o fato do texto que torna agora um bom momento", "contato": "pessoa e cargo, só se o texto citar", "proximoPasso": "uma ação concreta"}]

TEXTO
${txt.slice(0, 20000)}`, { json: true });
        let n = 0;
        if (Array.isArray(r)) for (const t of r.slice(0, 15)) {
          if (!t?.nome || existe(String(t.nome))) continue;
          if (await criar({ nome: String(t.nome).slice(0, 80), perfil: PERFIS.some((p) => p.id === t.perfil) ? t.perfil : 'independente', gatilho: String(t.gatilho || '').slice(0, 240), contato: String(t.contato || '').slice(0, 120), proximoPasso: String(t.proximoPasso || '').slice(0, 160), origem: 'Texto colado' }, false)) n++;
        }
        avisar(n ? `${n} alvo(s) novo(s) a partir do texto.` : 'Nenhuma empresa nova no texto.');
        if (n) { aba = 'alvos'; render(); }
      } catch (err) {
        $('#cpTxtE').textContent = err instanceof ErroIA ? err.message : 'A leitura falhou. Tente de novo.';
      } finally { const x = root.querySelector<HTMLButtonElement>('#cpExt'); if (x) { x.disabled = false; x.textContent = 'Extrair alvos'; } }
    }
  });
  root.addEventListener('submit', async (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id !== 'cpNovo') return;
    e.preventDefault();
    const g = (id: string) => $<HTMLInputElement>('#' + id).value.trim();
    if (!g('n_nome')) { $('#n_nome').setAttribute('aria-invalid', 'true'); $('#n_e').textContent = 'Dê o nome do alvo.'; $('#n_nome').focus(); return; }
    if (existe(g('n_nome'))) { $('#n_e').textContent = 'Já existe um alvo com esse nome.'; $('#n_nome').focus(); return; }
    if (await criar({ nome: g('n_nome'), perfil: $<HTMLSelectElement>('#n_perfil').value, contato: g('n_contato'), gatilho: g('n_gat'), fonte: g('n_fonte'), proximoPasso: g('n_passo'), prazo: g('n_prazo') || null })) {
      novo = false; render(); $<HTMLElement>('#cpN').focus();
    }
  });

  render();
  (async () => {
    db = await banco();
    if (!db) { carregando = false; render(); return; }
    col = db.collection<AlvoDoc>('alvos');
    const ver = (f: () => void) => () => { f(); if (!D.open) render(); };
    offs.push(col.onSnapshot((s) => ver(() => { A = s.docs.map(comId); carregando = false; })(), () => { carregando = false; render(); }));
    offs.push(db.collection<Oportunidade>('b2g').onSnapshot((s) => ver(() => { B = s.docs.map(comId); })(), () => {}));
    offs.push(db.collection<Caso>('casos').onSnapshot((s) => { C = s.docs.map(comId); }, () => {}));
    offs.push(db.collection<{ titulo?: string }>('pipeline').onSnapshot((s) => ver(() => { funil = s.docs.map(comId); })(), () => {}));
    offs.push(db.collection<{ valores?: Record<string, number> }>('config').onSnapshot((s) => { descontos = s.docs.find((d) => d.id === 'descontos')?.data().valores || {}; }, () => {}));
  })();
  return () => { abas.parar(); offs.forEach((f) => { try { f(); } catch { /* já cancelado */ } }); };
}
