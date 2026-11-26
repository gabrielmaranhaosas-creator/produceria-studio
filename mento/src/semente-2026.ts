// Varredura de mercado de novembro de 2026 (web aberta, cada item com fonte): trocas de conta mês a mês, verbas de
// bets, retail media, CMOs e diretores novos, comerciais de TV e plataformas. As agências que ganharam contas entram
// sozinhas no Big Data, ligadas ao anunciante (ver `agenciasDasContas`).
import type { Registro, Leitura } from './crm';

const MM = 'https://www.meioemensagem.com.br/comunicacao/';
const DC = {
  jan: MM + 'danca-das-contas-mapfre-flora-e-heineken', abr1: MM + 'danca-das-contas-motorola-le-creuset-e-outros', mai1: MM + 'danca-das-contas-jcdecaux-samsung-e-outras',
  mai2: MM + 'danca-das-contas-heineken-omoda-e-outros', mai3: MM + 'danca-das-contas-kopenhagen-coty-e-outros', jun: MM + 'danca-das-contas-cinemark-msd-e-outras',
  jul1: MM + 'danca-das-contas-espacolaser-kontik-e-outras', jul2: MM + 'danca-das-contas-ibm-pepsico-e-outros', out1: MM + 'danca-das-contas-byd-bling-e-outras',
  out2: MM + 'danca-das-contas-sebrae-alelo-e-outras', out3: MM + 'danca-das-contas-localiza-graal-e-outros', nov: MM + 'danca-das-contas-amstel-wild-fork-e-outros',
};
const TUNAD = 'https://www.yogonet.com/brasil/noticias/2026/04/23/8788-bets-destinaram-r-327-milhoes-para-publicidade-em-tv-no-primeiro-trimestre';
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const r = (x: Omit<Registro, 'id'>): Registro => ({ id: `${x.tipo.slice(0, 2)}-${slug(x.nome + (x.empresa ? '-' + x.empresa : ''))}`, ...x });
/** Anunciante que trocou de agência: a conta, a agência nova e a fonte. */
const conta = (nome: string, setor: string, agencias: string[], sinal: string, data: string, fonte: string) => r({ tipo: 'anunciante', nome, setor, agencias, sinal, data, fonte });

export const CONTAS_2026: Registro[] = [
  conta('Mapfre', 'Seguros', ['Milá'], 'Conta foi para a Milá', '2026-01', DC.jan),
  conta('Heineken', 'Bebidas', ['Lema', 'Dentsu'], 'Lema assumiu o portfólio de cervejas; mídia global renovada com a Dentsu', '2026-05', DC.mai2),
  conta('Flora', 'Higiene e limpeza', ['Marqueterie'], 'RP foi para a Marqueterie', '2026-01', DC.jan),
  conta('Motorola', 'Tecnologia', ['Dojo'], 'Conta foi para a Dojo', '2026-04', DC.abr1),
  conta('Le Creuset', 'Casa', ['Magenta'], 'Marketing foi para a Magenta', '2026-04', DC.abr1),
  conta('GCB Investimentos', 'Financeiro', ['MRM Brasil'], 'MRM Brasil venceu a concorrência (redes e canais próprios)', '2026-04', DC.abr1),
  conta('Midea Carrier', 'Eletrodomésticos', ['Jotacom'], 'Comunicação foi para a Jotacom', '2026-04', MM + 'danca-das-contas-midea-carrier-natura-e-outros'),
  conta('Avon', 'Beleza', ['WPP'], 'WPP venceu a conta Latam de Natura e Avon, com hub dedicado', '2026-04', MM + 'danca-das-contas-midea-carrier-natura-e-outros'),
  conta('JCDecaux', 'Mídia exterior', ['Crispin'], 'Conta foi da Euphoria Creative para a Crispin', '2026-05', DC.mai1),
  conta('Samsung', 'Tecnologia', ['Oliver'], 'Social e digital Latam foram para a Oliver', '2026-05', DC.mai1),
  conta('Copagaz e Liquigás', 'Energia', ['Purpple'], 'Comunicação integrada foi para a Purpple', '2026-05', DC.mai2),
  conta('Kopenhagen', 'Alimentos', ['WMcCann'], 'WMcCann venceu a concorrência (comunicação 360°)', '2026-05', DC.mai3),
  conta('Coty', 'Beleza', ['Fbiz'], 'Monange e Paixão foram para a Fbiz', '2026-05', DC.mai3),
  conta('Cinemark', 'Entretenimento', ['We Group'], 'Comunicação foi para a We Group', '2026-06', DC.jun),
  conta('MSD', 'Farmacêutico', ['Drum'], 'Posicionamento no Brasil foi para a Drum', '2026-06', DC.jun),
  conta('TCL', 'Eletroeletrônicos', ['YBY'], 'Conta foi para a YBY', '2026-06', DC.jun),
  conta('Espaçolaser', 'Beleza', ['VML'], 'Conta foi para a VML', '2026-07', DC.jul1),
  conta('Cogna Educação', 'Educação', ['Ogilvy'], 'Conta foi para a Ogilvy', '2026-07', DC.jul1),
  conta('IBM', 'Tecnologia', ['Omnicom Media'], 'Mídia global foi para a Omnicom Media (verba de cerca de R$ 330 mi por ano)', '2026-07', DC.jul2),
  conta('Pepsi', 'Bebidas', ['BETC Havas'], 'BETC Havas venceu a concorrência pela criação', '2026-07', DC.jul2),
  conta('Denza', 'Automotivo (BYD)', ['Samy', 'Index'], 'Operação foi para a Samy; comunicação e RP para a Index', '2026-10', DC.out1),
  conta('Bling', 'Tecnologia', ['Artplan'], 'Conta foi para a Artplan', '2026-10', DC.out1),
  conta('Unidas', 'Mobilidade', ['Rosh'], 'Conta foi para a Rosh', '2026-10', DC.out1),
  conta('Sebrae Nacional', 'Governo e entidades', ['Nova', 'Artplan', 'DeBrito'], 'Licitação renovada: verba de R$ 250 mi por ano dividida entre três agências', '2026-10', DC.out2),
  conta('Alelo', 'Financeiro', ['Sotaq'], 'Marketing de influência foi para a Sotaq', '2026-10', DC.out2),
  conta('Localiza', 'Mobilidade', ['AlmapBBDO'], 'AlmapBBDO venceu a concorrência (disputada com Galeria e GUT)', '2026-10', DC.out3),
  conta('Sanofi', 'Farmacêutico', ['A Máquina'], 'A Máquina assumiu estratégia, mídia de performance e conteúdo', '2026-10', DC.out3),
  conta('PicPay', 'Financeiro', ['Omnicom Media'], 'Omnicom Media venceu a concorrência pela conta de mídia (saiu da BETC Havas)', '2026-10', MM + 'drum-vence-concorrencia-pelo-picpay'),
  conta('Amstel', 'Bebidas', ['VML'], 'Criação saiu da AlmapBBDO para a VML no novo modelo global da Heineken', '2026-11', DC.nov),
  conta('Brasilprev', 'Previdência', ['GMD'], 'GMD venceu a concorrência (redes sociais e digital)', '2026-11', DC.nov),
  conta('Alares', 'Telecom', ['Made'], 'Made venceu a concorrência', '2026-08', 'https://janela.com.br/2026/08/04/made-vence-concorrencia-e-e-a-nova-agencia-da-operadora-alares/'),
  conta('Grupo JHSF', 'Imobiliário e varejo de luxo', ['Galeria'], 'Galeria venceu a concorrência', '2026-02', 'https://janela.com.br/2026/02/12/galeria-vence-concorrencia-e-e-a-nova-agencia-do-grupo-jhsf/'),
  conta('iFood', 'Delivery', ['SoWhat'], 'SoWhat venceu a concorrência', '2026-02', 'https://janela.com.br/2026/02/19/sowhat-vence-concorrencia-e-ifood-e-a-nova-conta-da-agencia/'),
];

export const BETS_2026: Registro[] = [
  ['Betano', 57.9], ['Superbet', 40.5], ['Bet do Milhão', 38.1], ['Betnacional', 36], ['bet365', 35.2],
].map(([nome, mi]) => r({ tipo: 'anunciante', nome: String(nome), setor: 'Apostas esportivas', ranking: `R$ ${String(mi).replace('.', ',')} mi em TV no 1º tri/2026 (Tunad)`, anunciaEm: ['Globo', 'SBT', 'Band'], sinal: 'Publicidade de bets suspensa pela MP 1.394/2026 (25/09), segundo parte da imprensa: verba de TV a realocar', data: '2026-04', fonte: TUNAD }));

export const PESSOAS_2026: Registro[] = [
  r({ tipo: 'pessoa', nome: 'José Maurício Lilla', cargo: 'Head de Marketing de Varejo', empresa: 'Bradesco', sinal: 'Assumiu o marketing de varejo', data: '2026-10', fonte: 'https://abramark.com.br/inteligemcia/noticias/bradesco-promove-jose-mauricio-lilla-a-marketing-de-varejo/' }),
  r({ tipo: 'pessoa', nome: 'Larissa da Silva Novais Vieira', cargo: 'Diretora de Marketing e Comunicação', empresa: 'Banco do Brasil', sinal: 'Indicada para a diretoria de marketing', data: '2026-03', fonte: 'https://propmark.com.br/banco-do-brasil-indica-nova-diretora-de-marketing/' }),
  r({ tipo: 'pessoa', nome: 'Thompson Gomes', cargo: 'CMO', empresa: 'TIM Brasil', sinal: 'Novo CMO desde janeiro', data: '2026-01', fonte: 'https://telesintese.com.br/tim-brasil-escolhe-thompson-gomes-como-novo-cmo-apos-saida-de-paulo-sperandio/' }),
  r({ tipo: 'pessoa', nome: 'Felipe Cohen', cargo: 'CMO', empresa: 'Magalu', fonte: 'https://adnews.com.br/post/cmo-summit-2026-lideres-de-marketing-se-reunem-em-sp-sob-pressao-por-resultados-e-foco-em-ia' }),
  r({ tipo: 'pessoa', nome: 'Dani Waks', cargo: 'Vice-presidente de Marketing', empresa: 'Ambev', fonte: 'https://adnews.com.br/post/cmo-summit-2026-lideres-de-marketing-se-reunem-em-sp-sob-pressao-por-resultados-e-foco-em-ia' }),
  r({ tipo: 'pessoa', nome: 'Juliana Cury', cargo: 'Diretora de Marketing', empresa: 'Itaú', sinal: 'Voltou do Santander para liderar o marketing', data: '2026-01', fonte: 'https://braziljournal.com/bradesco-nomeia-novo-cmo-e-promove-a-atual/' }),
  r({ tipo: 'pessoa', nome: 'Carolina Braune', cargo: 'CMO', empresa: 'Leroy Merlin', sinal: 'Nova CMO', data: '2026', fonte: 'https://forbes.com.br/forbes-mkt/2026/11/pg-brasil-anuncia-nova-cmo-e-movimentacoes-de-executivos/' }),
  r({ tipo: 'pessoa', nome: 'Aly Farahat', cargo: 'Diretor-geral de Negócios', empresa: 'TikTok', fonte: 'https://marcaspelomundo.com.br/veiculos/mercado/tiktok-ad-awards-2026-revela-finalistas-e-estreia-categorias-de-ia-e-social-commerce/' }),
  r({ tipo: 'pessoa', nome: 'Heloisa Goldman', cargo: 'Head de Agências', empresa: 'Kwai', data: '2026-01', fonte: 'https://forbes.com.br/escolhas-do-editor/2026/01/do-viral-ao-seriado-kwai-revela-4-tendencias-que-vao-dominar-os-videos-curtos-em-2026/' }),
  r({ tipo: 'pessoa', nome: 'Ari Martire', cargo: 'Diretor de Vendas', empresa: 'Kwai', fonte: 'https://forbes.com.br/escolhas-do-editor/2026/01/do-viral-ao-seriado-kwai-revela-4-tendencias-que-vao-dominar-os-videos-curtos-em-2026/' }),
  r({ tipo: 'pessoa', nome: 'Marcus Chisco', cargo: 'Diretor Comercial', empresa: 'SBT', sinal: 'Assumiu a direção comercial do SBT News (ex-VP da CNN Brasil)', data: '2026-03', fonte: 'https://www.blogdoadonis.com.br/2026/03/31/sbt-news-anuncia-diretor-comercial/76844/' }),
  r({ tipo: 'pessoa', nome: 'Ricardo Scalamandré', cargo: 'Parceiro estratégico (ex-diretor-geral comercial da Globo SP)', empresa: 'SBT', sinal: 'Parceria com o SBT para a relação com o mercado', data: '2026-06', fonte: 'https://portalleodias.com/colunas/sbt-anuncia-parceria-com-ricardo-scalamandre-ex-diretor-da-globo' }),
  r({ tipo: 'pessoa', nome: 'Guilherme Cavalcante', cargo: 'Head of Connections, Media & Data', empresa: 'Wieden+Kennedy Brasil', sinal: 'Presidente do Grupo de Mídia de São Paulo (2026/27)', data: '2026-06', fonte: 'https://www.meioemensagem.com.br/gente/grupo-de-midia-inicia-mandato-de-presidente-e-diretores' }),
];

export const EMPRESAS_2026: Registro[] = [
  r({ tipo: 'veiculo', nome: 'Globo', setor: 'TV aberta, paga e streaming', sinal: 'Recebeu 59% da verba de TV das bets no 1º tri/2026', data: '2026-04', fonte: TUNAD }),
  r({ tipo: 'veiculo', nome: 'SBT', setor: 'TV aberta e SBT News', sinal: 'Trocou seis vezes a direção comercial em pouco mais de um ano', data: '2026-04', fonte: 'https://www.dgabc.com.br/Noticia/4315675/sbt-trocou-seis-vezes-a-direcao-comercial-em-pouco-mais-de-um-ano' }),
  r({ tipo: 'veiculo', nome: 'Record', setor: 'TV aberta', sinal: 'Ganha afiliadas regionais (TV Fronteira, Presidente Prudente)', data: '2026-10', fonte: 'https://sampi.net.br/bauru/noticias/3014912/empresas-e-negocios/2026/10/tv-fronteira-de-presidente-prudente-troca-jovem-pan-pela-record' }),
  r({ tipo: 'veiculo', nome: 'CNN Brasil', setor: 'TV paga e jornalismo', sinal: 'Negocia afiliadas para entrar na TV aberta até o fim de 2026', data: '2026', fonte: 'https://infodf.com.br/cnn-brasil-avanca-para-entrar-na-tv-aberta-ate-o-fim-de-2026/' }),
  r({ tipo: 'veiculo', nome: 'TV TEM', setor: 'TV regional (afiliada Globo, interior de SP)', sinal: '2,1 milhões de pessoas por dia (Kantar Ibope); projetos para anunciantes regionais', data: '2026', fonte: 'https://portaldatv.com.br/tv-tem-audiencia-alcance-festup/' }),
  r({ tipo: 'veiculo', nome: 'TikTok', setor: 'Plataforma digital', fonte: 'https://marcaspelomundo.com.br/veiculos/mercado/tiktok-ad-awards-2026-revela-finalistas-e-estreia-categorias-de-ia-e-social-commerce/' }),
  r({ tipo: 'veiculo', nome: 'Kwai', setor: 'Plataforma digital', fonte: 'https://forbes.com.br/escolhas-do-editor/2026/01/do-viral-ao-seriado-kwai-revela-4-tendencias-que-vao-dominar-os-videos-curtos-em-2026/' }),
  r({ tipo: 'veiculo', nome: 'Mercado Ads', setor: 'Retail media (Mercado Livre)', sinal: 'Receita +73% em dólar no 2º tri/2026; projeção de 69,1% do retail media no Brasil em 2026', data: '2026-08', fonte: 'https://brasilgeo.ai/ecommerce/mercado/retail-media-no-brasil-2025-2027/' }),
  r({ tipo: 'veiculo', nome: 'Magalu Ads', setor: 'Retail media (Magazine Luiza)', sinal: 'Receita cresceu 54% a 55% em 2025; leilão por clique', data: '2026', fonte: 'https://hunterhub.com.br/blog/retail-media-etail-media-mercado-livre-amazon-magalu/' }),
  r({ tipo: 'anunciante', nome: 'Bradesco', setor: 'Financeiro', fonte: 'https://abramark.com.br/inteligemcia/noticias/bradesco-promove-jose-mauricio-lilla-a-marketing-de-varejo/' }),
  r({ tipo: 'anunciante', nome: 'Banco do Brasil', setor: 'Financeiro', fonte: 'https://propmark.com.br/banco-do-brasil-indica-nova-diretora-de-marketing/' }),
  r({ tipo: 'anunciante', nome: 'Itaú', setor: 'Financeiro', fonte: 'https://braziljournal.com/bradesco-nomeia-novo-cmo-e-promove-a-atual/' }),
  r({ tipo: 'anunciante', nome: 'TIM Brasil', setor: 'Telecom', fonte: 'https://telesintese.com.br/tim-brasil-escolhe-thompson-gomes-como-novo-cmo-apos-saida-de-paulo-sperandio/' }),
  r({ tipo: 'anunciante', nome: 'Magalu', setor: 'Varejo', fonte: 'https://adnews.com.br/post/cmo-summit-2026-lideres-de-marketing-se-reunem-em-sp-sob-pressao-por-resultados-e-foco-em-ia' }),
  r({ tipo: 'anunciante', nome: 'Leroy Merlin', setor: 'Varejo de construção', fonte: 'https://forbes.com.br/forbes-mkt/2026/11/pg-brasil-anuncia-nova-cmo-e-movimentacoes-de-executivos/' }),
];

/** Leituras de mercado: o dado, o que ele quer dizer e o que a MENTO faz com isso. */
export const LEITURAS: Leitura[] = [
  { id: 'le-bets-tv', titulo: 'R$ 2,12 bi de bets saindo da TV', dado: 'Bets investiram R$ 2,12 bi em TV aberta e paga entre jan/2025 e jun/2026; só no 1º tri/2026 foram R$ 327 mi, 59% na Globo, depois SBT e Band (Tunad). Parte da imprensa diz que a MP 1.394/2026 (25/09) suspendeu essa publicidade; outra parte diz que segue com aviso obrigatório.', implicacao: 'Se a suspensão vale, sobra inventário de TV e esporte para reocupar. A MENTO pode levar esse espaço (com o histórico do Pet em Band, A+E e AMC) a setores em alta, como eletros, viagens e financeiro.', fonte: 'https://igamingbusiness.com/br/marketing-afiliados/bets-investiram-r-212-bilhoes-em-publicidade-na-tv-nos-ultimos-18-meses-e-proibicao-cria-duvidas-sobre-quem-ocupara-esse-espaco/', data: '2026-10' },
  { id: 'le-mercado-2025', titulo: 'Mercado de R$ 95,2 bi, eletros +33% e viagens +18%', dado: 'O investimento publicitário somou R$ 95,2 bi em 2025, +8,2% (Ibope). As maiores altas entre os 15 maiores setores foram Eletros e Informática (+33%) e Viagens (+18%). Comércio e serviços concentram 24% e financeiro, 9%.', implicacao: 'Priorizar anunciantes de eletros, informática e viagens: verba crescendo é verba procurando onde rodar.', fonte: 'https://grandesnomesdapropaganda.com.br/mercado/investimento-publicitario-no-brasil-alcanca-r-952-bilhoes/', data: '2026' },
  { id: 'le-retail-media', titulo: 'Retail media passou de R$ 4,8 bi (+37%)', dado: 'Retail media digital somou R$ 4,8 bi em 2025, +37% (IAB e Kantar Ibope). O Mercado Livre deve ficar com 69,1% em 2026 (eMarketer) e cresceu 73% em dólar no 2º tri; Magalu Ads cresceu 54% a 55%.', implicacao: 'Anunciantes de varejo e indústria estão tirando verba de mídia tradicional para retail media. A MENTO ganha relevância se planejar os dois juntos (o "multimeios" do site).', fonte: 'https://brasilgeo.ai/ecommerce/mercado/retail-media-no-brasil-2025-2027/', data: '2026' },
  { id: 'le-danca', titulo: '280 trocas de conta em 2025, cerca de 23 por mês', dado: 'O Meio & Mensagem contou 280 mudanças de agência em 2025. Em 2026 já houve trocas em Heineken, Natura/Avon, Samsung, IBM, PicPay, Localiza, Sebrae, Amstel e outras.', implicacao: 'Toda troca abre uma janela de 60 a 90 dias em que a agência nova revisa o plano de mídia. Cada troca no Big Data vira uma ação para a semana.', fonte: 'https://www.meioemensagem.com.br/comunicacao/danca-das-contas-contabiliza-280-mudancas-em-2025', data: '2026' },
  { id: 'le-regional', titulo: 'Afiliadas regionais trocando de rede', dado: 'A TV Fronteira (Presidente Prudente) trocou a Jovem Pan pela Record; a CNN Brasil negocia afiliadas para entrar na TV aberta até o fim de 2026; a TV TEM alcança 2,1 milhões por dia no interior de SP.', implicacao: 'Rede regional em movimento é inventário regional em renegociação, o terreno de "estratégias regionais de mídia" do Pet.', fonte: 'https://sampi.net.br/bauru/noticias/3014912/empresas-e-negocios/2026/10/tv-fronteira-de-presidente-prudente-troca-jovem-pan-pela-record', data: '2026-10' },
  { id: 'le-sbt', titulo: 'SBT trocou o comercial seis vezes em um ano', dado: 'O SBT teve seis diretores comerciais em pouco mais de um ano, pôs Marcus Chisco no SBT News e fechou parceria com Ricardo Scalamandré, ex-diretor comercial da Globo SP.', implicacao: 'Veículo buscando relação com o mercado é porta para projetos comerciais e representação. Vale uma conversa da MENTO com o SBT.', fonte: 'https://www.dgabc.com.br/Noticia/4315675/sbt-trocou-seis-vezes-a-direcao-comercial-em-pouco-mais-de-um-ano', data: '2026-06' },
  { id: 'le-digital', titulo: 'Digital chegou a R$ 42,7 bi (+12,7%)', dado: 'A publicidade digital somou R$ 42,7 bi, +12,7% (IAB Brasil e Ibope); comércio e serviços ficam com um quarto da verba.', implicacao: 'Quase metade do mercado já é digital: a proposta da MENTO precisa mostrar TV, áudio e digital no mesmo plano.', fonte: 'https://www.tudosobrecdp.com.br/inovacao/iab-ibope-publicidade-digital-cresce-brasil/', data: '2026' },
];
