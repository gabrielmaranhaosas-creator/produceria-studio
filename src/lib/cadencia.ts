import { addDias, addUteis, hoje } from './datas';
import { ETAPAS } from './prioridade';
import type { Alvo, Etapa, PassoCadencia, Toque } from './tipos';

export type Resultado = 'sem' | 'resp' | 'reun' | 'prop' | 'nao';

export const RESULTADOS: [Resultado, string][] = [
  ['sem', 'Sem resposta'], ['resp', 'Respondeu'], ['reun', 'Reunião marcada'],
  ['prop', 'Pediu proposta'], ['nao', 'Sem interesse agora'],
];

export const CANAIS = ['LinkedIn', 'E-mail', 'Telefone', 'WhatsApp', 'Reunião', 'Outro'];

/** Passos da cadência com o deslocamento em dias ("D+4" → 4). */
export function passos(a: Alvo): (PassoCadencia & { off: number })[] {
  const cad = a.abordagem && Array.isArray(a.abordagem.cadencia) ? a.abordagem.cadencia : [];
  return cad.map((p) => ({ ...p, off: +(String(p.dia || '').match(/\d+/) || [0])[0] }));
}

export const passoAtual = (a: Alvo) => passos(a)[(a.toques || []).length] || null;

/** Próximo toque sugerido depois de registrar um contato com o resultado dado. */
export function sugerirProximo(a: Alvo, r: Resultado, referencia = hoje()): { data: string; texto: string } {
  const n = (a.toques || []).length + 1;
  const cad = passos(a);
  const primeiro = (a.toques && a.toques[0] && String(a.toques[0].em).slice(0, 10)) || referencia;
  if (r === 'sem' && cad[n]) {
    let d = addDias(primeiro, cad[n].off);
    if (d <= referencia) d = addUteis(referencia, 1);
    return { data: d, texto: cad[n].texto || '' };
  }
  if (r === 'sem') return { data: addUteis(referencia, 5), texto: 'Novo toque: relembrar a proposta de 15 minutos' };
  if (r === 'resp') return { data: addUteis(referencia, 2), texto: 'Dar sequência à conversa' };
  if (r === 'reun') return { data: addUteis(referencia, 2), texto: 'Preparar a reunião: casos e tabela' };
  if (r === 'prop') return { data: addUteis(referencia, 1), texto: 'Montar e enviar a proposta (Captação › Proposta)' };
  return { data: addDias(referencia, 90), texto: 'Retomar contato com novidade ou caso novo' };
}

/** Etapa depois do contato. Nunca regride. */
export function etapaDepois(atual: string | undefined, r: Resultado): Etapa {
  const idx = (ETAPAS as readonly string[]).indexOf(atual || 'Mapeado');
  let alvo = Math.max(idx, 2);
  if (r === 'resp' || r === 'reun') alvo = Math.max(idx, 3);
  if (r === 'prop') alvo = Math.max(idx, 4);
  return ETAPAS[alvo] as Etapa;
}

/** Campos a gravar no alvo ao registrar um contato. */
export function registrarContato(
  a: Alvo,
  dados: { canal: string; resultado: Resultado; nota?: string; proxima?: string; oQueFazer?: string },
  agora = new Date().toISOString(),
): Partial<Alvo> {
  const rotulo = RESULTADOS.find((x) => x[0] === dados.resultado)![1];
  const t: Toque = { em: agora, canal: dados.canal, resultado: rotulo, nota: (dados.nota || '').trim() };
  const atual = (a.status || 'Mapeado') as Etapa;
  const nova = etapaDepois(atual, dados.resultado);
  const etapas = { ...(a.etapas || {}) };
  if (!etapas[atual]) etapas[atual] = a.criadoEm || agora;
  if (nova !== atual) etapas[nova] = agora;
  return {
    toques: [...(a.toques || []), t],
    ultimoToque: agora,
    proximoToque: { data: dados.proxima || null, texto: (dados.oQueFazer || '').trim(), canal: '' },
    status: nova,
    etapas,
    prazo: dados.proxima || a.prazo || null,
  };
}
