/**
 * A casa dona da prospecção: quem é o ponto zero da reação em cadeia e do multiverso, quem conta como equipe, como
 * se escreve a ponte de um contato e com que identidade visual o mapa baixado sai. A PRODUCERIA é a casa padrão; a
 * MENTO é a primeira casa de fora (teste com os LinkedIns de duas pessoas, na tela "Reação · Mento").
 */
export interface Casa {
  id: string;
  /** Nome do ponto zero, como aparece no mapa (em caixa alta). */
  nome: string;
  /** Nome completo, para textos corridos. */
  nomeLongo: string;
  /** Quem trabalha na casa, pela organização que a pessoa declara. */
  equipe: RegExp;
  /** O marcador que um contato traz na conexão quando alguém da casa o conhece (ex.: "Ponte PRODUCERIA: Renato"). */
  ponte: RegExp;
  /** O que a casa vende, para as frases da narrativa do mapa. */
  oferta: string;
  /** O problema que o mapa resolve para a casa (primeiro passo da narrativa do arquivo). */
  problema: string;
  /** Linha de assinatura do arquivo baixado. */
  assinatura: string;
  /** Como o mapa chama a pessoa que contrata (nível "contrata" do Big Data). */
  contrata: string;
  /** Perfil de cliente ideal, para a narrativa do mapa. */
  icp: string;
}

export const PRODUCERIA: Casa = {
  id: 'produceria',
  nome: 'PRODUCERIA',
  nomeLongo: 'PRODUCERIA',
  equipe: /produceria/i,
  ponte: /ponte produceria/,
  oferta: 'produção',
  problema: 'A PRODUCERIA não tem um funil de vendas com receita previsível: clientes novos não entram de forma organizada, então não dá para projetar o crescimento da receita.',
  assinatura: 'PRODUCERIA · Investigação · reação em cadeia',
  contrata: 'contrata produção',
  icp: 'agência independente, conta pública, in-house enxuta, rede e EUA, cada um com dor, gatilho e porta de entrada',
};

export const MENTO: Casa = {
  id: 'mento',
  nome: 'MENTO',
  nomeLongo: 'Mento Publicidade',
  equipe: /\bmento\b/i,
  ponte: /ponte mento/,
  oferta: 'estratégia, mídia e conexões',
  problema: 'A MENTO conecta marcas a pessoas, mas cada nova conta ainda depende de quem a equipe já conhece: as conexões que existem na trajetória de cada sócio não estão mapeadas, então não dá para saber por onde o próximo movimento começa.',
  assinatura: 'MENTO · Conexões que movem marcas · reação em cadeia',
  contrata: 'contrata fornecedor',
  icp: 'anunciantes que investem em vários meios (digital, TV, áudio), marcas que acabaram de trocar de agência e as casas por onde a equipe já passou, cada uma com a porta de entrada pela trajetória de um sócio',
};

export const CASAS: Record<string, Casa> = { produceria: PRODUCERIA, mento: MENTO };

/* ───────────────────────── Identidade visual ─────────────────────────
 * A MENTO: fundo preto, tinta branca, verde de destaque (#0BCF55, medido do site) e títulos em stencil condensado.
 * A fonte de títulos é a Big Shoulders Stencil (SIL OFL 1.1, licença em src/lib/fontes), embutida em base64 para o
 * arquivo baixado abrir sem rede. Na página publicada ela fica no banco, como os arquivos dos plugins (ver
 * src/lib/mapa-arquivo.ts). Os textos corridos usam a grotesca do sistema.
 */
export const VERDE_MENTO = '#0BCF55';
/** As @font-face que a identidade da casa precisa (vazio para a PRODUCERIA, que usa as fontes da página do Studio). */
export function fontesDaCasa(casa: Casa, stencilB64: string): string {
  const b = stencilB64.trim();
  return casa.id === 'mento' && /^[A-Za-z0-9+/=]+$/.test(b) ? `@font-face{font-family:"Mento Stencil";src:url(data:font/woff2;base64,${b}) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}` : '';
}
