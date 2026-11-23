// Semana comercial: meta e realizado da semana, previsão ponderada do funil, ganhos e perdas,
// sinais que esfriam, carteira em risco e o resumo de segunda-feira (entrou, avançou, travou).
import { addDias } from './datas';
import type { Alvo } from './tipos';

type Doc = Record<string, unknown> & { id: string };
const s = (v: unknown) => String(v ?? '');
const dia = (v: unknown) => s(v).slice(0, 10);

/** Segunda-feira (AAAA-MM-DD) da semana de `d`. */
export function segunda(d: string): string {
  const w = new Date(d + 'T12:00:00Z').getUTCDay();
  return addDias(d, -((w + 6) % 7));
}
/** Primeiro dia do trimestre de `d`. */
export const inicioTrimestre = (d: string) => `${d.slice(0, 4)}-${String(Math.floor((+d.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;

/** Chance de fechar por estágio do funil (usada na previsão ponderada). */
export const PESOS: Record<string, number> = { Identificada: 0.1, Contato: 0.2, Proposta: 0.4, 'Negociação': 0.6, Ganha: 1 };

export interface Metas { contatos?: number; respostas?: number; propostas?: number; clientes?: number; receitaTrimestre?: number }
export const META_PADRAO: Required<Metas> = { contatos: 25, respostas: 3, propostas: 1, clientes: 0, receitaTrimestre: 0 };

/** Receita prevista: valor de cada oportunidade aberta × chance do estágio; ganho no trimestre à parte. */
export function previsao(pipeline: Doc[], hoje: string) {
  const tri = inicioTrimestre(hoje);
  const linhas = Object.keys(PESOS).filter((e) => e !== 'Ganha').map((e) => {
    const L = pipeline.filter((o) => o.estagio === e), valor = L.reduce((t, o) => t + (Number(o.valor) || 0), 0);
    return { estagio: e, n: L.length, valor, ponderado: Math.round(valor * PESOS[e]), semValor: L.filter((o) => !Number(o.valor)).length };
  });
  const ganho = pipeline.filter((o) => o.estagio === 'Ganha' && dia(o.fechadoEm || o.movidoEm || o.criadoEm) >= tri).reduce((t, o) => t + (Number(o.valor) || 0), 0);
  return { linhas, ponderado: linhas.reduce((t, l) => t + l.ponderado, 0), ganho, desde: tri };
}

/** Realizado desde `desde`: contatos (toques e e-mails enviados), respostas, propostas e clientes novos. */
export function realizado(alvos: Alvo[], disparos: Doc[], desde: string, ate = '9999'): Required<Omit<Metas, 'receitaTrimestre'>> {
  const em = (v: unknown) => dia(v) >= desde && dia(v) < ate;
  const toques = alvos.flatMap((a) => (a.toques || []).filter((t) => em(t.em)));
  const env = disparos.filter((d) => em(d.enviadoEm));
  const etapa = (e: 'Proposta' | 'Cliente') => alvos.filter((a) => em(a.etapas?.[e])).length;
  return {
    contatos: toques.length + env.length,
    respostas: toques.filter((t) => /respondeu|reuni|proposta/i.test(t.resultado)).length + disparos.filter((d) => em(d.respostaEm) && d.situacao !== 'voltou').length,
    propostas: etapa('Proposta'),
    clientes: etapa('Cliente'),
  };
}

export const MOTIVOS = ['Preço', 'Prazo', 'Concorrente', 'Sem resposta', 'Escopo', 'Sem verba', 'Outro'];

/** Ganhos e perdas fechados desde `desde`, com taxa e motivos de perda. */
export function ganhosPerdas(pipeline: Doc[], desde: string) {
  const F = pipeline.filter((o) => (o.estagio === 'Ganha' || o.estagio === 'Perdida') && dia(o.fechadoEm || o.movidoEm || o.criadoEm) >= desde);
  const ganhas = F.filter((o) => o.estagio === 'Ganha'), perdidas = F.filter((o) => o.estagio === 'Perdida');
  const conta = new Map<string, number>();
  for (const o of perdidas) { const m = s(o.motivo) || 'Sem motivo'; conta.set(m, (conta.get(m) || 0) + 1); }
  const porEixo = [...new Set(F.map((o) => s(o.eixo) || 'Sem eixo'))].map((e) => ({ eixo: e, ganhas: ganhas.filter((o) => (s(o.eixo) || 'Sem eixo') === e).length, perdidas: perdidas.filter((o) => (s(o.eixo) || 'Sem eixo') === e).length }));
  return {
    ganhas: ganhas.length, perdidas: perdidas.length, taxa: F.length ? ganhas.length / F.length : null,
    valorGanho: ganhas.reduce((t, o) => t + (Number(o.valor) || 0), 0),
    motivos: [...conta.entries()].sort((a, b) => b[1] - a[1]), porEixo,
  };
}

/** Quantos dias um sinal vale antes de esfriar. */
export const VALIDADE_SINAL = 14;
export interface Esfriando { titulo: string; onde: string; href: string; desde: string; vence: string; resta: number }

/** Sinais ainda sem ação: alertas novos e alvos vindos de sinal que ninguém tocou. Ordem: o que vence primeiro. */
export function esfriando(alertas: Doc[], alvos: Alvo[], hoje: string): Esfriando[] {
  const item = (titulo: string, onde: string, href: string, desde: string): Esfriando => {
    const vence = addDias(desde, VALIDADE_SINAL);
    return { titulo, onde, href, desde, vence, resta: Math.round((Date.parse(vence) - Date.parse(hoje)) / 864e5) };
  };
  const L = [
    ...alertas.filter((a) => (a.status || 'novo') === 'novo' && dia(a.data || a.criadoEm)).map((a) => item(s(a.titulo), 'Alerta', '#alertas', dia(a.data || a.criadoEm))),
    ...alvos.filter((a) => ['Mapeado', 'Pesquisado'].includes(s(a.status || 'Mapeado')) && !(a.toques || []).length && a.gatilho && dia(a.criadoEm))
      .map((a) => item(s(a.nome), 'Alvo · ' + s(a.status || 'Mapeado'), '#captacao', dia(a.criadoEm))),
  ];
  return L.filter((x) => x.resta >= -VALIDADE_SINAL).sort((a, b) => a.resta - b.resta);
}

/** Clientes sem contato há `dias` ou mais (ou nunca tocados depois de virar cliente). */
export function carteiraRisco(alvos: Alvo[], hoje: string, dias = 60) {
  const limite = addDias(hoje, -dias);
  return alvos.filter((a) => a.status === 'Cliente').map((a) => ({ a, ultimo: dia(a.ultimoToque || a.etapas?.Cliente || a.criadoEm) }))
    .filter((x) => !x.ultimo || x.ultimo <= limite).sort((x, y) => x.ultimo.localeCompare(y.ultimo));
}

/** Andamento por perfil (agências independentes, redes, in-house, órgãos públicos). */
export function porPerfil(alvos: Alvo[]) {
  const P = new Map<string, { andamento: number; conversa: number; clientes: number }>();
  for (const a of alvos) {
    if (a.status === 'Descartado') continue;
    const k = s(a.perfil) || 'sem perfil', l = P.get(k) || { andamento: 0, conversa: 0, clientes: 0 };
    if (a.status === 'Cliente') l.clientes++; else l.andamento++;
    if (a.status === 'Conversa' || a.status === 'Proposta') l.conversa++;
    P.set(k, l);
  }
  return [...P.entries()].map(([perfil, l]) => ({ perfil, ...l })).sort((a, b) => b.conversa + b.clientes - (a.conversa + a.clientes) || b.andamento - a.andamento);
}

export interface Linha { titulo: string; onde: string; href: string; d?: string }

/** O resumo de segunda: o que entrou, o que avançou, o que travou e o que está sem próximo passo. */
export function resumoSemana(pipeline: Doc[], alvos: Alvo[], desde: string, hoje: string, ate = '9999') {
  const em = (v: unknown) => dia(v) >= desde && dia(v) < ate;
  const abertas = pipeline.filter((o) => o.estagio !== 'Ganha' && o.estagio !== 'Perdida');
  const vivos = alvos.filter((a) => a.status !== 'Cliente' && a.status !== 'Descartado');
  const entrou: Linha[] = [
    ...pipeline.filter((o) => em(o.criadoEm)).map((o) => ({ titulo: s(o.titulo), onde: 'Funil · ' + s(o.estagio), href: '#funil', d: dia(o.criadoEm) })),
    ...alvos.filter((a) => em(a.criadoEm)).map((a) => ({ titulo: s(a.nome), onde: 'Captação · ' + s(a.origem || a.status), href: '#captacao', d: dia(a.criadoEm) })),
  ];
  const avancou: Linha[] = [
    ...pipeline.filter((o) => em(o.movidoEm) && dia(o.criadoEm) < desde).map((o) => ({ titulo: s(o.titulo), onde: 'Funil → ' + s(o.estagio), href: '#funil', d: dia(o.movidoEm) })),
    ...alvos.flatMap((a) => {
      const e = Object.entries(a.etapas || {}).filter(([, d]) => em(d)).sort((x, y) => s(y[1]).localeCompare(s(x[1])))[0];
      return e && dia(a.criadoEm) < desde ? [{ titulo: s(a.nome), onde: 'Captação → ' + e[0], href: '#captacao', d: dia(e[1]) }] : [];
    }),
  ];
  const travou: Linha[] = [
    ...abertas.filter((o) => o.prazo && dia(o.prazo) < hoje).map((o) => ({ titulo: s(o.titulo), onde: 'Funil · prazo vencido', href: '#funil', d: dia(o.prazo) })),
    ...vivos.filter((a) => a.prazo && dia(a.prazo) < hoje).map((a) => ({ titulo: s(a.nome), onde: 'Captação · passo atrasado', href: '#agenda', d: dia(a.prazo) })),
  ];
  const semPasso: Linha[] = [
    ...abertas.filter((o) => !s(o.proximoPasso).trim()).map((o) => ({ titulo: s(o.titulo), onde: 'Funil · ' + s(o.estagio), href: '#funil' })),
    ...vivos.filter((a) => ['Abordado', 'Conversa', 'Proposta'].includes(s(a.status)) && !a.prazo && !a.proximoToque?.data).map((a) => ({ titulo: s(a.nome), onde: 'Captação · ' + s(a.status), href: '#captacao' })),
  ];
  const ord = (L: Linha[]) => L.sort((a, b) => s(b.d).localeCompare(s(a.d)));
  return { entrou: ord(entrou), avancou: ord(avancou), travou: travou.sort((a, b) => s(a.d).localeCompare(s(b.d))), semPasso };
}

/**
 * Expansão da carteira: para cada cliente, as categorias da tabela que ele já comprou (pelas propostas) e as que
 * outros clientes compram e ele ainda não. `cat` traduz o id do serviço em categoria.
 */
export function expansao(alvos: Alvo[], cat: (servico: number) => string | undefined, max = 3) {
  const comprou = (a: Alvo) => {
    const itens = ((a.proposta as { itens?: { servico?: number }[] } | undefined)?.itens) || [];
    return [...new Set(itens.map((i) => cat(Number(i.servico))).filter((c): c is string => !!c))];
  };
  const clientes = alvos.filter((a) => a.status === 'Cliente');
  const peso = new Map<string, number>();
  for (const a of alvos) if (a.status === 'Cliente' || a.status === 'Proposta') for (const c of comprou(a)) peso.set(c, (peso.get(c) || 0) + 1);
  const ranking = [...peso.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([c]) => c);
  return clientes.map((a) => { const ja = comprou(a); return { a, ja, oferecer: ja.length ? ranking.filter((c) => !ja.includes(c)).slice(0, max) : [] }; });
}

export interface AgenciaBase { nome: string; contas?: { anunciante?: string }[] }

/**
 * Agências como canal: cada agência vale pelas marcas que atende. As que já estão na Captação (com a etapa) e as
 * que ainda não estão, por alcance. `mesma` compara nomes de empresa.
 */
export function canalAgencias(agencias: AgenciaBase[], alvos: Alvo[], mesma: (a: string, b: string) => boolean, max = 6) {
  const L = agencias.map((g) => {
    const marcas = [...new Set((g.contas || []).map((c) => s(c.anunciante)).filter(Boolean))];
    const alvo = alvos.find((a) => a.status !== 'Descartado' && mesma(a.nome, g.nome));
    return { nome: g.nome, marcas: marcas.length, exemplo: marcas.slice(0, 3), alvo };
  }).filter((x) => x.marcas > 0).sort((a, b) => b.marcas - a.marcas || a.nome.localeCompare(b.nome));
  return { naCaptacao: L.filter((x) => x.alvo).slice(0, max), abrir: L.filter((x) => !x.alvo).slice(0, max) };
}
