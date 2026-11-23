/**
 * Mesa comercial: a persona de business da PRODUCERIA, a lista de destinatários do multiverso com os contatos
 * publicados (e-mail com fonte, LinkedIn) e as regras de disparo. Sem DOM: a página e os testes usam daqui.
 */
import { chave, mesmaEmpresa, slug } from './nomes';
import { ehEquipe, ORIGEM, type Universo, type Reacao, type Multiverso, type PessoaInv, type NoU } from './investigacao';
import type { Alvo, Caso } from './tipos';

export type TipoEmail = 'comercial' | 'imprensa/marketing' | 'geral' | 'nominal';
export interface EmailPub { email: string; tipo: TipoEmail | string; fonte: string }
/** Contatos publicados de uma organização (coleção `contatos`, um documento por organização). */
export interface ContatoOrg { id: string; nome: string; site?: string; siteOrigem?: string; linkedin?: string; emails?: EmailPub[]; atualizadoEm?: string }
/** Registro de cada e-mail enviado ou deixado em rascunho (coleção `disparos`). */
/** O que aconteceu com o e-mail depois de sair da Mesa (lido no Gmail). */
export type Situacao = 'rascunho' | 'enviado' | 'respondeu' | 'sem interesse' | 'sair' | 'voltou';
export interface Disparo {
  id: string; para: string; nome: string; no: string; org?: string; assunto: string; corpo: string; modo: 'enviado' | 'rascunho'; gmailId?: string; em: string;
  // para medir o que abre porta: tipo do e-mail, tipo do ponto, ramificação e o objetivo escrito na Mesa
  porta?: string; tipoNo?: string; ger?: number; objetivo?: string;
  situacao?: Situacao; enviadoEm?: string; respostaEm?: string; resposta?: string; threadId?: string; link?: string; conferidoEm?: string;
}
/** Quem pediu para não receber (coleção `nao_contatar`, id = slug do e-mail). */
export interface Bloqueio { id: string; email: string; motivo?: string; em?: string }

export interface Destino {
  id: string; nome: string; tipo: 'agencia' | 'empresa' | 'pessoa'; org?: string; cargo?: string;
  forca: number; ger: number; ponte: string; emails: (EmailPub & { daEmpresa?: boolean })[]; linkedin?: string; site?: string;
  alvo?: Alvo; ultimo?: Disparo; bloqueio?: string;
}

export const LIMITE_LOTE = 25;
export const LIMITE_DIA = 80;
/** Envio desligado até a equipe definir a política dos disparos: a Mesa só escreve, revisa e cria rascunhos no Gmail. */
export const ENVIO_LIBERADO = false;
export const INTERVALO_DIAS = 30;
export const RODAPE = 'Se preferir não receber mensagens da PRODUCERIA, responda com "sair" e tiramos seu contato da nossa lista.';

const ORDEM_TIPO: Record<string, number> = { comercial: 0, nominal: 1, geral: 2, 'imprensa/marketing': 3 };
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
const idBloqueio = (e: string) => slug(e.replace('@', ' at '), 120) || 'x';
export { idBloqueio };

/** O e-mail da pessoa só vale se veio publicado, com a página de onde saiu. */
function emailDaPessoa(p: PessoaInv & { email?: string; emailFonte?: string }): EmailPub[] {
  return p.email && p.emailFonte && emailValido(p.email) ? [{ email: p.email.toLowerCase(), tipo: 'nominal', fonte: p.emailFonte }] : [];
}

/** Texto do caminho até a PRODUCERIA: "Catarina Consentino → atende a conta → PicPay". */
export function textoPonte(U: Universo, M: Multiverso, id: string): string {
  const passos: string[] = [];
  let atual = id, n = 0;
  while (atual !== ORIGEM && n++ < 8) {
    const p = M.pai.get(atual); if (!p) return '';
    const no = U.nos.get(p.id);
    passos.unshift(`${p.id === ORIGEM ? 'PRODUCERIA' : no?.nome || ''} (${p.rotulo})`);
    atual = p.id;
  }
  return passos.join(' → ');
}

/** O documento de contatos de uma organização, pelo nome (exato, depois a mesma empresa com outro sufixo). */
export const contatoDaOrg = (contatos: ContatoOrg[], nome?: string) => (nome ? contatos.find((c) => chave(c.nome) === chave(nome)) || contatos.find((c) => mesmaEmpresa(c.nome, nome)) : undefined);
/** Ponte entre telas: o ponto que a próxima tela deve abrir já em foco (multiverso ⇄ Mesa comercial). */
export const FOCO_MESA = 'studio.mesa.foco', FOCO_MV = 'studio.iv.foco';
export function levarPara(tela: 'disparos' | 'investigacao', id: string) {
  try { sessionStorage.setItem(tela === 'disparos' ? FOCO_MESA : FOCO_MV, id); } catch { /* sem armazenamento: abre sem foco */ }
  location.hash = tela;
}
export function focoPendente(chaveFoco: string): string {
  try { const v = sessionStorage.getItem(chaveFoco) || ''; sessionStorage.removeItem(chaveFoco); return v; } catch { return ''; }
}

/** Todos os pontos do multiverso que dá para contatar, com a força, a ponte e os contatos publicados. */
export function destinos(d: {
  U: Universo; R: Reacao; M: Multiverso; pessoas: (PessoaInv & { email?: string; emailFonte?: string })[];
  contatos: ContatoOrg[]; alvos: Alvo[]; disparos: Disparo[]; bloqueios: Bloqueio[];
}): Destino[] {
  const forca = new Map<string, number>(), ger = new Map<string, number>();
  d.R.geracoes.forEach((g, i) => g.forEach((r) => { forca.set(r.id, r.forca); ger.set(r.id, i); }));
  d.M.camadas.forEach((c) => c.ids.forEach((id) => { if (!ger.has(id)) ger.set(id, c.ger); }));
  const contatoDe = (nome?: string) => contatoDaOrg(d.contatos, nome);
  const pessoaDe = new Map(d.pessoas.map((p) => [`p:${p.id}`, p]));
  const bloq = new Set(d.bloqueios.map((b) => b.email.toLowerCase()));
  const ultimo = new Map<string, Disparo>();
  for (const x of [...d.disparos].sort((a, b) => a.em.localeCompare(b.em))) if (x.modo === 'enviado') ultimo.set(x.para.toLowerCase(), x);
  const ordenar = (l: EmailPub[]) => [...l].sort((a, b) => (ORDEM_TIPO[a.tipo] ?? 9) - (ORDEM_TIPO[b.tipo] ?? 9));
  const out: Destino[] = [];
  for (const n of d.U.nos.values()) {
    if (n.tipo === 'origem') continue;
    const p = n.tipo === 'pessoa' ? pessoaDe.get(n.id) : undefined;
    if (p && ehEquipe(p)) continue;
    const c = contatoDe(n.tipo === 'pessoa' ? n.org : n.nome);
    const proprios = p ? emailDaPessoa(p) : ordenar(c?.emails || []);
    const daEmpresa = p && !proprios.length ? ordenar(c?.emails || []).filter((e) => e.tipo !== 'imprensa/marketing').map((e) => ({ ...e, daEmpresa: true })) : [];
    const emails = [...proprios, ...daEmpresa].filter((e) => emailValido(e.email));
    const linkedin = p?.linkedin || c?.linkedin || (n.fontes || []).find((f) => /linkedin\.com\//.test(f));
    if (!emails.length && !linkedin) continue;
    const alvo = d.alvos.find((a) => mesmaEmpresa(a.nome, n.tipo === 'pessoa' ? n.org || '' : n.nome));
    const prim = emails[0]?.email;
    out.push({
      id: n.id, nome: n.nome, tipo: n.tipo as Destino['tipo'], org: n.tipo === 'pessoa' ? n.org : undefined, cargo: n.tipo === 'pessoa' ? n.sub : n.sub,
      forca: forca.get(n.id) ?? n.nota ?? 0, ger: ger.get(n.id) ?? -1, ponte: textoPonte(d.U, d.M, n.id), emails, linkedin, site: c?.site,
      alvo, ultimo: prim ? ultimo.get(prim) : undefined, bloqueio: prim && bloq.has(prim) ? 'pediu para não receber' : undefined,
    });
  }
  return out.sort((a, b) => Number(!!b.emails.length) - Number(!!a.emails.length) || (a.ger < 0 ? 1 : 0) - (b.ger < 0 ? 1 : 0) || b.forca - a.forca || a.nome.localeCompare(b.nome));
}

/** Por que não dá para enviar agora (ou null). */
export function impedimento(x: Destino, email: string, enviadosHoje: number, hoje: string): string | null {
  if (!email || !x.emails.some((e) => e.email === email)) return 'Sem e-mail publicado com fonte.';
  if (x.bloqueio) return 'Esta pessoa pediu para não receber.';
  if (x.ultimo && x.ultimo.para === email && (Date.parse(hoje) - Date.parse(x.ultimo.em.slice(0, 10))) / 864e5 < INTERVALO_DIAS) return `Já recebeu em ${x.ultimo.em.slice(0, 10).split('-').reverse().join('/')}: espere ${INTERVALO_DIAS} dias entre e-mails.`;
  if (enviadosHoje >= LIMITE_DIA) return `Limite de ${LIMITE_DIA} envios por dia atingido.`;
  return null;
}

/** A persona: diretor(a) comercial da casa, que pensa negócio e comunicação antes de escrever. */
export const PERSONA = {
  nome: 'Diretora Comercial da PRODUCERIA',
  foco: 'Estratégia de comunicação e de negócio: escolhe quem abordar, por qual porta, com que oferta e em que momento, e escreve a mensagem que abre a conversa.',
  guia: `Você é a diretora comercial da PRODUCERIA. Pensa como quem vende serviço B2B para agências e anunciantes: venda é narrativa (problema, tratamento, solução), não catálogo.
Antes de escrever, decida em silêncio:
1. Quem é o destinatário e o que ele decide (cargo, agência ou anunciante, produção interna ou não).
2. Por que agora: o gatilho real (conta nova, campanha, troca de agência, contratação). Sem gatilho, use a ponte.
3. A ponte: quem da PRODUCERIA já está no caminho dele (trabalhou junto, atende a mesma conta). Cite a ponte só se ela estiver nos dados, com o nome da pessoa da equipe.
4. A dor provável de produção (volume de desdobramento, prazo, custo de adaptação, OOH/DOOH, vídeo) e uma oferta pequena e concreta: um teste, um orçamento de uma peça, 15 minutos.
5. Uma prova, só se vier dos casos informados. Nunca invente cliente, número, prêmio ou prazo.
Regras da mensagem:
- Assunto com até 7 palavras, específico, sem caixa alta, sem emoji, sem "parceria".
- Corpo com até 110 palavras, 3 parágrafos curtos, tratamento pelo primeiro nome quando houver pessoa; se o e-mail for da empresa, comece com "Olá, equipe da <empresa>" e peça para encaminhar a quem cuida de produção.
- Um único pedido no final, fácil de responder (sim/não ou uma data).
- Tom direto e cordial, português do Brasil, sem jargão de agência, sem autopromoção, sem superlativos.
- Assine como "Equipe PRODUCERIA". Não escreva o rodapé de descadastro: o Studio acrescenta.`,
};

/** Monta o pedido à IA para um destinatário. */
export function pedidoMensagem(x: Destino, email: EmailPub & { daEmpresa?: boolean }, casos: Caso[], objetivo: string): string {
  const provas = casos.slice(0, 6).map((c) => `- ${c.titulo}${c.cliente ? ' · ' + c.cliente : ''}${c.resultado ? ' · ' + c.resultado : ''}`).join('\n');
  return `${PERSONA.guia}

DESTINATÁRIO
- Nome: ${x.nome}${x.tipo === 'pessoa' ? ` · ${x.cargo || 'cargo não informado'} · ${x.org || ''}` : ` (${x.tipo === 'agencia' ? 'agência' : 'anunciante'})`}
- E-mail: ${email.daEmpresa ? 'canal geral da empresa (não é o e-mail da pessoa)' : email.tipo}
- Ponte com a PRODUCERIA: ${x.ponte || 'nenhuma registrada'}
- Alvo da Captação: ${x.alvo ? `${x.alvo.status || ''} · gatilho: ${x.alvo.gatilho || '—'} · próximo passo: ${x.alvo.proximoPasso || '—'}` : 'não'}
- Objetivo deste envio: ${objetivo || 'abrir conversa para orçar produção, adaptação e desdobramento de peças'}

CASOS DA CASA (use no máximo um, só se encaixar)
${provas || '- nenhum caso cadastrado: não cite casos'}

Responda só com JSON: {"estrategia": "2 frases: por que esta porta, esta oferta e este momento", "assunto": "", "corpo": "texto puro, parágrafos separados por linha em branco", "linkedin": "versão de até 280 caracteres para mensagem no LinkedIn", "proximo": "o próximo toque se não houver resposta em 4 dias úteis"}`;
}

const escH = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** E-mail na identidade do Studio: monocromático, em tabelas com estilos inline (o Gmail descarta o resto). */
export function htmlEmail(corpo: string): string {
  const pars = corpo.trim().split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px;font:15px/1.55 Helvetica,Arial,sans-serif;color:#171717">${escH(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff"><tr><td align="left" style="padding:8px 0">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:0 0 4px">${pars}</td></tr>
<tr><td style="border-top:1px solid #deded8;padding:12px 0 0;font:12px/1.5 Helvetica,Arial,sans-serif;color:#57574f">PRODUCERIA · São Paulo e Miami<br>${escH(RODAPE)}</td></tr></table></td></tr></table>`;
}

/** Texto puro do e-mail, com o rodapé. */
export const textoEmail = (corpo: string) => `${corpo.trim()}\n\n--\nPRODUCERIA · São Paulo e Miami\n${RODAPE}`;

/** Destinatários com e-mail de um tipo de nó e a contagem do funil de contato. */
export function resumo(l: Destino[]) {
  return {
    total: l.length, comEmail: l.filter((x) => x.emails.length && !x.emails[0].daEmpresa).length,
    viaEmpresa: l.filter((x) => x.emails[0]?.daEmpresa).length, soLinkedin: l.filter((x) => !x.emails.length).length,
    alcance: l.filter((x) => x.ger >= 0).length, bloqueados: l.filter((x) => x.bloqueio).length,
  };
}

export type { NoU };

/* ───────────────────────── Ciclo depois do rascunho ─────────────────────────
 * A Mesa deixa o rascunho; alguém envia pelo Gmail. Ao conferir, o Studio procura no Gmail da PRODUCERIA se o
 * rascunho saiu, se a pessoa respondeu, pediu para sair ou se o e-mail voltou, e devolve o que mudou.
 */
export const situacaoDe = (d: Disparo): Situacao => d.situacao || (d.modo === 'enviado' ? 'enviado' : 'rascunho');
/** Ainda vale conferir: rascunho que pode ter saído ou enviado sem resposta há menos de 60 dias. */
export function pendente(d: Disparo, hoje: string): boolean {
  const s = situacaoDe(d);
  if (s === 'rascunho') return (Date.parse(hoje) - Date.parse(d.em.slice(0, 10))) / 864e5 <= 30;
  return s === 'enviado' && (Date.parse(hoje) - Date.parse((d.enviadoEm || d.em).slice(0, 10))) / 864e5 <= 60;
}
const dataGmail = (iso: string) => iso.slice(0, 10).replace(/-/g, '/');
/** Buscas no Gmail para um disparo: envio (pasta Enviados), resposta e devolução. */
export function consultas(d: Disparo) {
  const desde = dataGmail(d.em), env = dataGmail(d.enviadoEm || d.em);
  return {
    envio: `to:${d.para} in:sent after:${desde}`,
    resposta: `from:${d.para} after:${env}`,
    devolucao: `from:mailer-daemon ${d.para} after:${env}`,
  };
}
export interface MsgGmail { id?: string; threadId?: string; sender?: string; subject?: string; snippet?: string; date?: string; viewUrl?: string; toRecipients?: string[] }
export interface ThreadGmail { id?: string; viewUrl?: string; messages?: MsgGmail[] }
/** Mensagens de um resultado de search_threads, cada uma com o link da conversa. */
export function mensagens(payload: unknown): MsgGmail[] {
  const t = ((payload as { threads?: ThreadGmail[] })?.threads || []);
  return t.flatMap((th) => (th.messages || []).map((m) => ({ ...m, threadId: m.threadId || th.id, viewUrl: m.viewUrl || th.viewUrl })));
}
const semPrefixo = (x: string) => chave(x.replace(/^\s*((re|res|enc|fwd?|tr)\s*:\s*)+/i, ''));
/** A mensagem enviada que corresponde ao rascunho (mesmo destinatário e mesmo assunto). */
export function acharEnvio(d: Disparo, l: MsgGmail[]): MsgGmail | undefined {
  const a = semPrefixo(d.assunto);
  return l.find((m) => (m.toRecipients || []).some((t) => t.toLowerCase().includes(d.para.toLowerCase())) && (!a || semPrefixo(m.subject || '') === a))
    || l.find((m) => !!a && semPrefixo(m.subject || '').includes(a));
}
/** Lê a resposta: pediu para sair, sem interesse ou respondeu. */
export function lerResposta(texto: string): 'sair' | 'sem interesse' | 'respondeu' {
  // só o que a pessoa escreveu: corta a citação do e-mail original (que traz o rodapé com "sair")
  const proprio = texto.split(RODAPE)[0].split(/\n\s*>|\b(em|on)\s.{0,80}\s(escreveu|wrote)\s*:|-{3,}\s*(mensagem|original|forwarded)|\bde:\s|\bfrom:\s/i)[0];
  const t = ` ${proprio.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  if (/^\s*(sair|remover|descadastrar)\b/.test(t) || /\b(remov\w* (meu|o|nosso)|descadastr\w*|unsubscribe|nao (quero|desejo|queremos) (mais )?receber|tir\w* (meu|o|nosso) (e ?mail|contato|endereco))\b/.test(t)) return 'sair';
  if (/\b(sem interesse|nao temos interesse|nao tenho interesse|nao e o momento|no momento nao|nao ha demanda|ja temos (fornecedor|parceir\w*|produtora))\b/.test(t)) return 'sem interesse';
  return 'respondeu';
}
const dataMsg = (m?: MsgGmail, padrao = new Date().toISOString()) => { const t = Date.parse(m?.date || ''); return isNaN(t) ? padrao : new Date(t).toISOString(); };
/** O que muda no disparo a partir das três buscas (null se nada mudou). */
export function conferir(d: Disparo, r: { envio?: unknown; resposta?: unknown; devolucao?: unknown }, agora = new Date().toISOString()): Partial<Disparo> {
  const up: Partial<Disparo> = { conferidoEm: agora };
  let s = situacaoDe(d);
  if (s === 'rascunho' && r.envio !== undefined) {
    const m = acharEnvio(d, mensagens(r.envio));
    if (m) { s = 'enviado'; Object.assign(up, { modo: 'enviado', situacao: s, enviadoEm: dataMsg(m, agora), threadId: m.threadId || '', link: m.viewUrl || '' }); }
  }
  if (s !== 'enviado') return up;
  const volta = mensagens(r.devolucao)[0];
  if (volta) return Object.assign(up, { situacao: 'voltou' as Situacao, respostaEm: dataMsg(volta, agora), resposta: (volta.snippet || 'O e-mail não foi entregue.').slice(0, 240) });
  const resp = mensagens(r.resposta).find((m) => (m.sender || '').toLowerCase().includes(d.para.toLowerCase()));
  if (resp) return Object.assign(up, { situacao: lerResposta(resp.snippet || resp.subject || ''), respostaEm: dataMsg(resp, agora), resposta: (resp.snippet || '').slice(0, 240), link: resp.viewUrl || up.link || d.link || '' });
  return up;
}

/** Placar dos disparos: quantos saíram, quantos responderam e a taxa por porta, tipo, ramificação e objetivo. */
export const PORTAS: Record<string, string> = { comercial: 'E-mail comercial', geral: 'E-mail geral', nominal: 'E-mail da pessoa', 'imprensa/marketing': 'Imprensa e marketing', empresa: 'E-mail da empresa (para a pessoa)' };
export interface LinhaPlacar { rotulo: string; enviados: number; respostas: number; taxa: number }
export function placar(l: Disparo[]) {
  const s = (d: Disparo) => situacaoDe(d);
  const saiu = l.filter((d) => s(d) !== 'rascunho'), entregue = saiu.filter((d) => s(d) !== 'voltou');
  const resp = entregue.filter((d) => ['respondeu', 'sem interesse', 'sair'].includes(s(d)));
  const por = (f: (d: Disparo) => string): LinhaPlacar[] => {
    const g = new Map<string, Disparo[]>();
    for (const d of entregue) { const k = f(d) || 'Sem registro'; g.set(k, [...(g.get(k) || []), d]); }
    return [...g].map(([rotulo, L]) => { const r = L.filter((d) => ['respondeu', 'sem interesse', 'sair'].includes(s(d))).length; return { rotulo, enviados: L.length, respostas: r, taxa: Math.round((100 * r) / L.length) }; })
      .sort((a, b) => b.taxa - a.taxa || b.enviados - a.enviados);
  };
  const tempos = resp.map((d) => (Date.parse(d.respostaEm || '') - Date.parse(d.enviadoEm || d.em)) / 864e5).filter((x) => x >= 0);
  return {
    rascunhos: l.filter((d) => s(d) === 'rascunho').length, enviados: saiu.length, voltaram: saiu.length - entregue.length,
    respostas: resp.length, positivas: resp.filter((d) => s(d) === 'respondeu').length, semInteresse: resp.filter((d) => s(d) === 'sem interesse').length, sair: resp.filter((d) => s(d) === 'sair').length,
    taxa: entregue.length ? Math.round((100 * resp.length) / entregue.length) : 0,
    diasResposta: tempos.length ? Math.round((10 * tempos.reduce((a, b) => a + b, 0)) / tempos.length) / 10 : null,
    porPorta: por((d) => PORTAS[d.porta || ''] || d.porta || ''),
    porTipo: por((d) => ({ agencia: 'Agência', empresa: 'Anunciante', pessoa: 'Pessoa' })[d.tipoNo || ''] || ''),
    porRamo: por((d) => (d.ger == null ? '' : d.ger < 0 ? 'Fora de alcance' : d.ger === 0 ? 'Ponto de partida' : `${d.ger}ª ramificação`)),
    porObjetivo: por((d) => (d.objetivo || '').trim() || 'Sem objetivo escrito'),
  };
}
