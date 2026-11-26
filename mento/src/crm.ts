/**
 * O comercial da MENTO: o Big Data (anunciantes, agências, veículos e quem decide, cada um com fonte), o funil de
 * prospecção (alvo → abordado → reunião → proposta → ganho/perdido), as atividades de cada conversa e a agenda dos
 * próximos passos. Regras puras, sem tela e sem banco, para testar.
 */
import { nivelDoCargo, type Nivel, type OrgPublica } from './rede';
import type { Pista, LigacaoPublica } from './publico';

export type TipoRegistro = 'anunciante' | 'agencia' | 'veiculo' | 'pessoa';
export interface Registro {
  id: string; tipo: TipoRegistro; nome: string;
  setor?: string; cargo?: string; empresa?: string; cidade?: string;
  /** o fato que torna o registro oportunidade agora (conta nova, CMO novo, cota comprada…) */
  sinal?: string; data?: string; fonte?: string; linkedin?: string;
  /** posição em ranking público (ex.: "3º maior anunciante 2025 · Ibope") */
  ranking?: string;
  /** veículos em que o anunciante comprou mídia, e agências que o atendem */
  anunciaEm?: string[]; agencias?: string[];
  /** quando entrou e quando mudou (ISO), gravados pela varredura diária e pela equipe */
  criadoEm?: string; atualizadoEm?: string;
}
export const TIPOS: [TipoRegistro, string][] = [['anunciante', 'Anunciante'], ['agencia', 'Agência'], ['veiculo', 'Veículo'], ['pessoa', 'Pessoa']];

export type Etapa = 'alvo' | 'abordado' | 'reuniao' | 'proposta' | 'ganho' | 'perdido';
export const ETAPAS: [Etapa, string, number][] = [['alvo', 'Alvo', 0.05], ['abordado', 'Abordado', 0.1], ['reuniao', 'Reunião', 0.3], ['proposta', 'Proposta', 0.6], ['ganho', 'Ganho', 1], ['perdido', 'Perdido', 0]];
export const ABERTAS: Etapa[] = ['alvo', 'abordado', 'reuniao', 'proposta'];
export interface Oportunidade {
  id: string; nome: string; tipo?: TipoRegistro; contato?: string; cargo?: string; empresa?: string;
  responsavel?: string; etapa: Etapa; valor?: number; proximoPasso?: string; proximaData?: string;
  origem?: string; registroId?: string; fonte?: string; motivo?: string; criadoEm: string; atualizadoEm: string;
}
export type Canal = 'ligacao' | 'email' | 'whatsapp' | 'linkedin' | 'reuniao' | 'nota';
export const CANAIS: [Canal, string][] = [['ligacao', 'Ligação'], ['email', 'E-mail'], ['whatsapp', 'WhatsApp'], ['linkedin', 'LinkedIn'], ['reuniao', 'Reunião'], ['nota', 'Nota']];
export interface Atividade { id: string; opId: string; quando: string; quem?: string; canal: Canal; nota: string }

const dia = (iso?: string) => (iso || '').slice(0, 10);
export const somaDias = (d: string, n: number) => new Date(Date.parse(d.slice(0, 10) + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const recente = (data: string | undefined, hoje: string, dias: number) => { if (!data) return false; const d = data.length === 7 ? data + '-01' : data.length === 4 ? data + '-01-01' : data; return d >= somaDias(hoje, -dias); };

/** Setores fora do radar comercial (bets estão proibidas no Brasil). Valem para o que a varredura diária gravar. */
export const FORA_DO_RADAR = /apostas|\bbets?\b|bet365|betano|superbet|betnacional|cassino/i;
export const foraDoRadar = (r: Pick<Registro, 'nome' | 'setor'>) => FORA_DO_RADAR.test(`${r.setor || ''} ${r.nome}`);

/** Nível de quem decide, para pessoas do Big Data. */
export const nivelDe = (r: Registro): Nivel | undefined => (r.tipo === 'pessoa' ? nivelDoCargo(r.cargo || '') : undefined);

/** Nota de 0 a 100 do registro como oportunidade, com os motivos. */
export function nota(r: Registro, o: { hoje: string; porNome?: Map<string, Registro>; trajetoria?: Set<string> }): { nota: number; motivos: string[] } {
  const M: string[] = []; let s = 0;
  const k = (n?: string) => (n || '').toLowerCase().trim();
  if (r.tipo === 'pessoa') {
    const nv = nivelDe(r);
    s = nv === 'decide' ? 50 : nv === 'influencia' ? 30 : 10;
    M.push(nv === 'decide' ? 'Decide a contratação' : nv === 'influencia' ? 'Influencia a decisão' : 'Contato');
    const emp = o.porNome?.get(k(r.empresa));
    if (emp?.tipo === 'anunciante') { s += 10; M.push(`Trabalha num anunciante (${emp.nome})`); }
    if (o.trajetoria?.has(k(r.empresa))) { s += 15; M.push(`A equipe já trabalhou na ${r.empresa}`); }
  } else if (r.tipo === 'anunciante') {
    s = 40; M.push('Anunciante: contrata mídia');
    if (r.ranking) { s += 25; M.push(r.ranking); }
    const ve = (r.anunciaEm || []).filter((v) => o.trajetoria?.has(k(v)));
    if (ve.length) { s += 15; M.push(`Anuncia onde a equipe já trabalhou (${ve.join(', ')})`); }
  } else if (r.tipo === 'agencia') {
    s = 30; M.push('Agência: compra mídia para os clientes');
    if (r.ranking) { s += 20; M.push(r.ranking); }
  } else {
    s = 25; M.push('Veículo: parceiro de venda');
    if (o.trajetoria?.has(k(r.nome))) { s += 25; M.push('A equipe já trabalhou lá'); }
  }
  if (r.sinal && recente(r.data, o.hoje, 180)) { s += 20; M.push(`Sinal recente: ${r.sinal}`); }
  else if (r.sinal) M.push(r.sinal);
  return { nota: Math.max(0, Math.min(100, s)), motivos: M };
}

/** O Big Data vira pistas e ligações para a rede (reação em cadeia e multiverso). */
export function paraRede(regs: Registro[]): { pistas: Pista[]; ligacoes: LigacaoPublica[]; orgs: OrgPublica[] } {
  const pistas: Pista[] = regs.filter((r) => r.tipo === 'pessoa' && r.empresa).map((r) => ({ nome: r.nome, cargo: r.cargo || '', empresa: r.empresa!, url: r.linkedin, fonte: r.fonte || '', data: r.data }));
  const ligacoes: LigacaoPublica[] = [];
  for (const r of regs) if (r.tipo === 'anunciante') {
    for (const v of r.anunciaEm || []) ligacoes.push({ a: v, b: r.nome, rotulo: r.sinal || 'anuncia aqui', fonte: r.fonte || '', data: r.data, tipoB: 'anunciante' });
    for (const a of r.agencias || []) ligacoes.push({ a, b: r.nome, rotulo: 'atende a conta', fonte: r.fonte || '', data: r.data, tipoB: 'anunciante' });
  }
  const orgs: OrgPublica[] = regs.filter((r) => r.tipo !== 'pessoa').map((r) => ({ nome: r.nome, tipo: r.tipo as OrgPublica['tipo'], setor: r.setor, fonte: r.fonte, sinal: r.sinal }));
  return { pistas, ligacoes, orgs };
}

/** Um registro do Big Data (ou um ponto da rede) vira oportunidade no funil, na etapa Alvo. */
export function oportunidadeDe(r: Pick<Registro, 'nome' | 'tipo' | 'cargo' | 'empresa' | 'fonte' | 'id'>, o: { agora: string; responsavel?: string; origem: string }): Oportunidade {
  const pessoa = r.tipo === 'pessoa';
  return { id: 'op-' + o.agora.replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6), nome: pessoa ? r.empresa || r.nome : r.nome, tipo: r.tipo, contato: pessoa ? r.nome : '', cargo: pessoa ? r.cargo : '', empresa: pessoa ? r.empresa : r.nome,
    responsavel: o.responsavel || '', etapa: 'alvo', proximoPasso: pessoa ? `Primeiro contato com ${r.nome.split(' ')[0]}` : 'Achar quem decide mídia', proximaData: somaDias(o.agora, 2),
    origem: o.origem, registroId: r.id, fonte: r.fonte, criadoEm: o.agora, atualizadoEm: o.agora };
}

/** Cadência: depois de um contato, quando é o próximo, pela etapa. */
export const CADENCIA: Record<Etapa, number> = { alvo: 2, abordado: 3, reuniao: 2, proposta: 4, ganho: 30, perdido: 90 };
export const proximaPelaCadencia = (etapa: Etapa, hoje: string) => somaDias(hoje, CADENCIA[etapa]);

/** A agenda: o que está atrasado, o que é para hoje e o que vem nos próximos 7 dias (só oportunidades abertas). */
export function agenda(ops: Oportunidade[], hoje: string) {
  const ab = ops.filter((o) => ABERTAS.includes(o.etapa)), d = (o: Oportunidade) => dia(o.proximaData);
  const ord = (a: Oportunidade, b: Oportunidade) => d(a).localeCompare(d(b)) || a.nome.localeCompare(b.nome, 'pt-BR');
  return {
    atrasadas: ab.filter((o) => d(o) && d(o) < hoje).sort(ord),
    hoje: ab.filter((o) => d(o) === hoje).sort(ord),
    semana: ab.filter((o) => d(o) > hoje && d(o) <= somaDias(hoje, 7)).sort(ord),
    semData: ab.filter((o) => !d(o)).sort(ord),
  };
}

/** Os números do funil: por etapa (quantidade e valor), pipeline ponderado e conversão. */
export function numeros(ops: Oportunidade[]) {
  const por = Object.fromEntries(ETAPAS.map(([e]) => [e, { n: 0, valor: 0 }])) as Record<Etapa, { n: number; valor: number }>;
  for (const o of ops) { por[o.etapa].n++; por[o.etapa].valor += o.valor || 0; }
  const prob = Object.fromEntries(ETAPAS.map(([e, , p]) => [e, p])) as Record<Etapa, number>;
  const abertas = ops.filter((o) => ABERTAS.includes(o.etapa));
  const fechadas = por.ganho.n + por.perdido.n;
  return { por, abertas: abertas.length, pipeline: abertas.reduce((t, o) => t + (o.valor || 0), 0), ponderado: Math.round(abertas.reduce((t, o) => t + (o.valor || 0) * prob[o.etapa], 0)), ganho: por.ganho.valor, conversao: fechadas ? Math.round((por.ganho.n / fechadas) * 100) : null };
}

/* ───────────── Inteligência: o dado vira ação ───────────── */
/** Leitura de mercado: o dado, o que ele quer dizer e o que a MENTO faz com isso. */
export interface Leitura { id: string; titulo: string; dado: string; implicacao: string; fonte?: string; data?: string }
export interface Janela { id: string; titulo: string; porque: string; acao: string; regId: string; data: string; peso: number }
const chaveN = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Agências citadas nas contas que ainda não estão no Big Data entram ligadas ao anunciante (com o sinal da conta ganha). */
export function agenciasDasContas(regs: Registro[]): Registro[] {
  const tem = new Set(regs.map((r) => chaveN(r.nome))), out = new Map<string, Registro>();
  for (const r of regs) if (r.tipo === 'anunciante') for (const a of r.agencias || []) {
    const k = chaveN(a); if (tem.has(k)) continue;
    const ja = out.get(k);
    if (ja) { if ((r.data || '') > (ja.data || '')) Object.assign(ja, { sinal: `Ganhou a conta de ${r.nome}`, data: r.data, fonte: r.fonte }); continue; }
    out.set(k, { id: 'ag-' + k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), tipo: 'agencia', nome: a, sinal: `Ganhou a conta de ${r.nome}`, data: r.data, fonte: r.fonte });
  }
  return [...out.values()];
}

/** Quem ganhou conta desde uma data: agência → anunciantes. */
export function contasGanhas(regs: Registro[], desde: string): Map<string, { agencia: string; contas: Registro[] }> {
  const m = new Map<string, { agencia: string; contas: Registro[] }>();
  for (const r of regs) if (r.tipo === 'anunciante' && r.agencias?.length && (r.data || '') >= desde.slice(0, (r.data || '').length || 10)) for (const a of r.agencias) {
    const k = chaveN(a), x = m.get(k) || { agencia: a, contas: [] }; x.contas.push(r); m.set(k, x);
  }
  return m;
}

/** As janelas de oportunidade do momento: conta que acabou de trocar, decisor que acabou de chegar, veículo em movimento. */
export function janelas(todos: Registro[], hoje: string): Janela[] {
  const regs = todos.filter((r) => !foraDoRadar(r)), out: Janela[] = [], pessoasEm = (emp: string) => regs.filter((p) => p.tipo === 'pessoa' && chaveN(p.empresa) === chaveN(emp) && nivelDe(p) === 'decide');
  for (const r of regs) {
    if (r.tipo === 'anunciante' && r.agencias?.length && recente(r.data, hoje, 150)) {
      const ag = r.agencias.length > 1 ? r.agencias.slice(0, -1).join(', ') + ' e ' + r.agencias[r.agencias.length - 1] : r.agencias[0], gente = r.agencias.flatMap(pessoasEm);
      out.push({ id: 'j-' + r.id, regId: r.id, data: r.data || '', peso: 80 + (r.ranking ? 10 : 0), titulo: `${r.nome}: conta nova na ${ag}`, porque: r.sinal || 'Troca de agência recente',
        acao: gente.length ? `Falar com ${gente.map((p) => `${p.nome} (${p.cargo})`).join(', ')} enquanto o plano de mídia de ${r.nome} é revisado.` : `Apresentar a MENTO à ${ag} e ao marketing de ${r.nome} enquanto o plano de mídia é revisado.` });
    } else if (r.tipo === 'pessoa' && nivelDe(r) === 'decide' && r.sinal && recente(r.data, hoje, 240)) {
      out.push({ id: 'j-' + r.id, regId: r.id, data: r.data || '', peso: 70, titulo: `${r.nome} chegou: ${r.cargo} na ${r.empresa}`, porque: r.sinal, acao: 'Os primeiros meses no cargo são quando se revisam agências e fornecedores. Pedir 20 minutos para apresentar a MENTO.' });
    } else if (r.tipo === 'veiculo' && r.sinal && recente(r.data, hoje, 240)) {
      out.push({ id: 'j-' + r.id, regId: r.id, data: r.data || '', peso: 50, titulo: `${r.nome}: ${r.sinal}`, porque: r.setor || 'Veículo em movimento', acao: 'Veículo em mudança negocia projetos e representação. Abrir conversa de parceria.' });
    }
  }
  return out.sort((a, b) => b.peso - a.peso || b.data.localeCompare(a.data));
}

const celula = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (linhas: unknown[][]) => '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
