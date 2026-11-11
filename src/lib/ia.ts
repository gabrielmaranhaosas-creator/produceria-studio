/**
 * Pedido de texto ao Claude dentro do Studio (capability `sample` do claude.ai).
 * Fora do claude.ai, ou sem autorização, devolve um erro legível em vez de travar a página.
 */
export interface OpcoesIA { json?: boolean; tier?: 'default' | 'complex'; aoEscrever?: (texto: string) => void; signal?: AbortSignal }
type Amostra = ((p: string, o: object) => Promise<{ text: string }>) & { json?: (p: string, o: object) => Promise<unknown> };

let promessa: Promise<Amostra | null> | null = null;
function amostra(): Promise<Amostra | null> {
  if (!promessa) promessa = (async () => { try { return ((await window.claude?.use('sample')) as Amostra) || null; } catch { return null; } })();
  return promessa;
}

const MENSAGENS: Record<string, string> = {
  rate_limited: 'Muitas consultas seguidas ou limite de uso atingido. Tente de novo em alguns minutos.',
  prompt_too_large: 'O texto é grande demais para uma consulta. Encurte o trecho colado.',
  refused: 'O Claude recusou este pedido. Reformule o que está sendo pedido.',
  invalid_json: 'A resposta não veio no formato esperado. Tente de novo.',
  session_expired: 'Sua sessão expirou. Entre de novo no Claude.',
  empty_completion: 'A resposta veio vazia. Simplifique o pedido.',
  not_granted: 'A consulta ao Claude não foi autorizada nesta visualização.',
  sampling_disabled: 'A consulta ao Claude não foi autorizada nesta visualização.',
};

export class ErroIA extends Error {}

/** Texto (ou objeto, com `json`) devolvido pelo Claude. Lança ErroIA com mensagem para a pessoa. */
export async function perguntar(prompt: string, o: OpcoesIA = {}): Promise<string | unknown> {
  const s = await amostra();
  if (!s) throw new ErroIA('A IA não está disponível nesta visualização. Abra o Studio no Claude para usar.');
  const opts = { signal: o.signal, modelTier: o.tier ?? 'default', onText: ({ text }: { text: string }) => o.aoEscrever?.(text) };
  try {
    if (o.json) {
      if (!s.json) throw new ErroIA(MENSAGENS.invalid_json);
      return await s.json(prompt, opts);
    }
    return (await s(prompt, opts)).text;
  } catch (e) {
    if (e instanceof ErroIA) throw e;
    const code = (e as { code?: string })?.code || '';
    throw new ErroIA(MENSAGENS[code] || 'A consulta foi interrompida por uma falha temporária. Tente de novo.');
  }
}

/** Contexto fixo dos pedidos do Studio (tom e regras de não inventar). */
export const CONTEXTO = `Você atua dentro do PRODUCERia Studio, a mesa interna da PRODUCERIA: um hub de produção e craft em São Paulo e Miami (arte-final, retoque, adaptação, motion, edição, HTML, produção gráfica, comunicação visual, mídia exterior OOH/DOOH, produção audiovisual e fotografia). A PRODUCERIA não trabalha com produção e organização de eventos.
Tom: direto, preciso, sem autopromoção. Escreva em português do Brasil.
Regras:
- Nunca invente resultados, clientes, prêmios, métricas, valores, autorizações ou prazos.
- Marque cada afirmação relevante como [CONFIRMADO], [HIPÓTESE], [FALTA EVIDÊNCIA] ou [AGUARDA APROVAÇÃO].
- Normas, tributos e regras de licitação precisam de verificação da fonte vigente antes de uso.
- O Studio não envia e-mails, não compra mídia e não aprova despesas: suas respostas são propostas para revisão humana.`;

/** A IA está disponível nesta visualização? (não consome consulta) */
export async function iaDisponivel(): Promise<boolean> { return !!(await amostra()); }
