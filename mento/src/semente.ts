// Base inicial do Big Data da MENTO: pesquisa na web aberta de 26/11/2026, cada registro com a fonte. No artefato
// publicado ela é gravada uma vez no banco compartilhado (a equipe edita e soma a partir daí); no arquivo aberto
// direto, sem banco, a página usa esta mesma base. Cargos de notícias antigas podem ter mudado: a data vai junto.
import type { Registro } from './crm';
import { PISTAS } from './publico';

const MM_ANUNC = 'https://www.meioemensagem.com.br/dropsaea/ranking-dos-20-maiores-anunciantes-brasil';
const CENP = 'https://www.meioemensagem.com.br/comunicacao/cenp-africa-lidera-ranking-de-compra-de-midia-em-2025';
const DANCA = 'https://www.meioemensagem.com.br/comunicacao/danca-das-contas-midea-carrier-natura-e-outros';
const COPA_BAND = 'https://www.meioemensagem.com.br/midia/radio-bandeirantes-e-bandnews-fm-confirmam-copa-2026';
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const r = (x: Omit<Registro, 'id'> & { id?: string }): Registro => ({ id: x.id || `${x.tipo.slice(0, 2)}-${slug(x.nome + (x.empresa ? '-' + x.empresa : ''))}`, ...x });

export const SEMENTE: Registro[] = [
  // veículos por onde o Pet passou
  r({ tipo: 'veiculo', nome: 'Band', setor: 'TV aberta, rádio e digital (Grupo Bandeirantes)', fonte: 'https://www.meioemensagem.com.br/gente/grupo-bandeirantes-tem-novo-lider-comercial' }),
  r({ tipo: 'veiculo', nome: 'A+E Networks', setor: 'TV paga (A&E, History, Lifetime)', sinal: 'Passa a vender a publicidade da AMC na América Latina', data: '2026-03', fonte: 'https://senalnews.com/es/tv/ae-networks-representara-las-ventas-publicitarias-de-amc-networks-en-america-latina' }),
  r({ tipo: 'veiculo', nome: 'AMC Networks International', setor: 'TV paga (AMC, Film&Arts)', fonte: 'https://www.meioemensagem.com.br/gente/acontece-no-meio/amc-networks-international-fortalece-equipe' }),
  r({ tipo: 'veiculo', nome: 'Omega Mídia', setor: 'Mídia', fonte: 'https://www.meioemensagem.com.br/gente/acontece-no-meio/amc-networks-international-fortalece-equipe' }),
  r({ tipo: 'veiculo', nome: 'Jornal Destak', setor: 'Jornal', fonte: 'https://www.meioemensagem.com.br/gente/acontece-no-meio/amc-networks-international-fortalece-equipe' }),
  // quem decide nesses veículos
  ...PISTAS.map((p) => r({ tipo: 'pessoa', nome: p.nome, cargo: p.cargo, empresa: p.empresa, fonte: p.fonte, data: p.data, linkedin: p.url })),
  // maiores anunciantes (ranking 2025, Ibope / Meio & Mensagem) e quem comprou mídia na Band
  r({ tipo: 'anunciante', nome: 'Genomma Lab', setor: 'Farmacêutico e higiene', ranking: '1º em compra de mídia em 2025 (Ibope/M&M)', fonte: MM_ANUNC, data: '2025' }),
  r({ tipo: 'anunciante', nome: 'Mercado Livre', setor: 'Varejo digital', ranking: '2º em compra de mídia em 2025 (Ibope/M&M)', fonte: MM_ANUNC, data: '2025' }),
  r({ tipo: 'anunciante', nome: 'EMS', setor: 'Farmacêutico', ranking: '3º em compra de mídia em 2025; 1º em 2024 com R$ 1,4 bi (Kantar Ibope)', fonte: MM_ANUNC, data: '2025' }),
  r({ tipo: 'anunciante', nome: 'Amazon', setor: 'Varejo digital', ranking: 'Top 5 em compra de mídia em 2025 (Ibope/M&M)', fonte: MM_ANUNC, data: '2025' }),
  r({ tipo: 'anunciante', nome: 'Via Capitalização', setor: 'Capitalização', ranking: 'Top 5 em compra de mídia em 2025 (Ibope/M&M)', fonte: MM_ANUNC, data: '2025' }),
  r({ tipo: 'anunciante', nome: 'Unilever', setor: 'Bens de consumo', ranking: 'Top 5 em compra de mídia em 2024 (Kantar Ibope)', fonte: 'https://www.meioemensagem.com.br/dropsaea/ems-lidera-ranking-de-maiores-anunciantes', data: '2025-05' }),
  r({ tipo: 'anunciante', nome: 'Ambev', setor: 'Bebidas', ranking: 'Heptacampeã do Ranking M&M de anunciantes', fonte: 'https://www.meioemensagem.com.br/comunicacao/ranking-mm-ambev-e-heptacampea-entre-os-anunciantes' }),
  r({ tipo: 'anunciante', nome: 'BETesporte', setor: 'Apostas esportivas', sinal: 'Cota da Copa 2026 na Rádio Bandeirantes e BandNews FM', anunciaEm: ['Band'], fonte: COPA_BAND, data: '2025-11' }),
  r({ tipo: 'anunciante', nome: 'Grupo Euro17', setor: 'Varejo', sinal: 'Cota da Copa 2026 na Rádio Bandeirantes e BandNews FM', anunciaEm: ['Band'], fonte: COPA_BAND, data: '2025-11' }),
  r({ tipo: 'anunciante', nome: 'Mobil', setor: 'Lubrificantes', sinal: 'Cota da Copa 2026 na Rádio Bandeirantes e BandNews FM', anunciaEm: ['Band'], fonte: COPA_BAND, data: '2025-11' }),
  // trocas de conta (Dança das Contas, abril de 2026)
  r({ tipo: 'anunciante', nome: 'Midea', setor: 'Eletrodomésticos', sinal: 'Conta foi para a Jotacom', agencias: ['Jotacom'], fonte: DANCA, data: '2026-04' }),
  r({ tipo: 'anunciante', nome: 'Natura', setor: 'Beleza', sinal: 'WPP venceu a conta Latam de beleza citada na Dança das Contas', agencias: ['WPP'], fonte: DANCA, data: '2026-04' }),
  r({ tipo: 'anunciante', nome: 'Nestlé Health Science', setor: 'Alimentos e saúde', sinal: 'Conta de CRM foi para a Jüssi', agencias: ['Jüssi'], fonte: DANCA, data: '2026-04' }),
  r({ tipo: 'anunciante', nome: 'Roku', setor: 'Tecnologia e streaming', sinal: 'Conta foi para a Ágora', agencias: ['Ágora'], fonte: DANCA, data: '2026-04' }),
  r({ tipo: 'anunciante', nome: 'Skeelo', setor: 'Streaming de livros', sinal: 'Conta foi para a Ágora', agencias: ['Ágora'], fonte: DANCA, data: '2026-04' }),
  r({ tipo: 'anunciante', nome: 'SportyGroup', setor: 'Apostas esportivas', sinal: 'Conta foi para a Ágora', agencias: ['Ágora'], fonte: DANCA, data: '2026-04' }),
  r({ tipo: 'anunciante', nome: 'Effect Sport', setor: 'Esporte', sinal: 'Conta foi para a Ágora', agencias: ['Ágora'], fonte: DANCA, data: '2026-04' }),
  // quem decide marketing nos anunciantes (CMOs novos em 2026)
  r({ tipo: 'pessoa', nome: 'Rafael Dias', cargo: 'Diretor de Marketing', empresa: 'Smart Fit', sinal: 'Chegou como diretor de Marketing no Brasil', data: '2026', fonte: 'https://abramark.com.br/destaques/smart-fit-rafael-dias-diretor-marketing-brasil-2026/' }),
  r({ tipo: 'pessoa', nome: 'Thiago Lopes', cargo: 'CMO Brasil', empresa: 'Kraft Heinz', sinal: 'Novo CMO, veio da Netflix', data: '2026', fonte: 'https://www.supervarejo.com.br/gestao/kraft-heinz-anuncia-novo-cmo-brasil' }),
  r({ tipo: 'pessoa', nome: 'Leonardo Rocha', cargo: 'Chief Marketing Officer', empresa: 'Neon', sinal: 'Novo CMO, veio da Gran', data: '2026', fonte: 'https://www.meioemensagem.com.br/gente/acontece-no-meio/neon-apresenta-seu-novo-chief-marketing-officer' }),
  r({ tipo: 'pessoa', nome: 'Camila Sousa', cargo: 'Chief Marketing Officer', empresa: 'P&G Brasil', sinal: 'Nova CMO na reestruturação do marketing', data: '2026', fonte: 'https://revistalivemarketing.com.br/pg-brasil-reestrutura-lideranca-de-marketing-e-nomeia-camila-sousa-como-nova-cmo/' }),
  r({ tipo: 'pessoa', nome: 'Marília Zanoli', cargo: 'Diretora de Marketing (CMO)', empresa: 'Kimberly-Clark', sinal: 'Nova CMO no Brasil', data: '2026', fonte: 'https://revistalivemarketing.com.br/kimberly-clark-anuncia-nova-diretora-de-marketing/' }),
  r({ tipo: 'pessoa', nome: 'Bruno Érnica', cargo: 'Diretor de Marketing', empresa: 'Perdomo', sinal: 'Primeiro diretor de marketing da história da empresa', fonte: 'https://www.meioemensagem.com.br/sem-categoria/perdomo-apresenta-diretor-de-marketing' }),
  r({ tipo: 'pessoa', nome: 'Lucas Leung', cargo: 'Diretor de Marketing', empresa: 'Oracle', sinal: 'Novo diretor de Marketing no Brasil', data: '2026' }),
  r({ tipo: 'pessoa', nome: 'Erica Migales', cargo: 'Diretora de Marketing Amstel', empresa: 'Grupo Heineken', sinal: 'Nova diretora de marketing da família Amstel' }),
  r({ tipo: 'pessoa', nome: 'Rafael Torres', cargo: 'Diretor Comercial e de Marketing', empresa: 'SBA Edge', fonte: 'https://tibahia.com/novo-executivo/rafael-torres-assume-diretoria-comercial-e-de-marketing-da-sba-edge-no-brasil/' }),
  r({ tipo: 'pessoa', nome: 'Aline Velha', cargo: 'Diretora de Mídia', empresa: 'Nubank', sinal: 'Eleita vice-presidente do Grupo de Mídia de São Paulo (2026/27)', data: '2026', fonte: 'https://propmark.com.br/grupo-de-midia-define-nova-diretoria-para-2026-27-e-apresenta-estudo-que-midia-sou-eu/amp/' }),
  // agências que mais compraram mídia em 2025 (ranking Cenp-Meios, divulgado em abril de 2026)
  ...['Africa Creative', 'AlmapBBDO', 'Galeria', 'BETC Havas', 'Publicis Brasil', 'Mediabrands', 'Artplan', 'WMcCann', 'Talent Marcel', 'GUT', 'Suno United Creators', 'Ogilvy', 'DPZ', 'EssenceMediacom', 'VML', 'Wieden+Kennedy Brasil', "Lew'Lara\\TBWA", 'Agência We', 'Agência Nacional', 'Leo']
    .map((nome, i) => r({ tipo: 'agencia', nome, ranking: `${i + 1}º no ranking Cenp-Meios 2025 de compra de mídia`, fonte: CENP, data: '2026-04' })),
  r({ tipo: 'agencia', nome: 'Innocean Brasil', sinal: 'Contratou Daniela Moura como diretora de mídia', data: '2026-08', fonte: 'https://propmark.com.br/agencias/innocean-brasil-contrata-daniela-moura-como-diretora-de-midia/' }),
  // quem decide mídia nas agências (movimentações de 2026)
  r({ tipo: 'pessoa', nome: 'Daniela Moura', cargo: 'Diretora de Mídia', empresa: 'Innocean Brasil', sinal: 'Contratada em agosto de 2026', data: '2026-08', fonte: 'https://propmark.com.br/agencias/innocean-brasil-contrata-daniela-moura-como-diretora-de-midia/' }),
  r({ tipo: 'pessoa', nome: 'Victor Berto', cargo: 'Diretor-geral de Mídia', empresa: 'Africa Creative', sinal: 'Promovido a diretor-geral de mídia', data: '2026-07', fonte: 'https://propmark.com.br/agencias/africa-creative-amplia-operacao-de-midia-com-mudancas-na-lideranca/' }),
  r({ tipo: 'pessoa', nome: 'Isis Baptista', cargo: 'Diretora de Mídia', empresa: 'Africa Creative', sinal: 'Assumiu a diretoria de mídia', data: '2026-07', fonte: 'https://propmark.com.br/agencias/africa-creative-amplia-operacao-de-midia-com-mudancas-na-lideranca/' }),
  r({ tipo: 'pessoa', nome: 'Gabriela Loureiro', cargo: 'Diretora de Mídia', empresa: 'Galeria', sinal: 'Assumiu a diretoria de mídia', data: '2026-07', fonte: 'https://propmark.com.br/agencias/area-de-midia-da-galeria-ag-ganha-novas-liderancas/' }),
  r({ tipo: 'pessoa', nome: 'Marta Ariboni', cargo: 'Diretora de Mídia', empresa: 'Galeria', sinal: 'Assumiu a diretoria de mídia', data: '2026-07', fonte: 'https://propmark.com.br/agencias/area-de-midia-da-galeria-ag-ganha-novas-liderancas/' }),
  r({ tipo: 'pessoa', nome: 'Juliana Roque', cargo: 'Diretora-executiva de Mídia', empresa: 'Leo', sinal: 'Promovida a diretora-executiva de mídia', data: '2026-06', fonte: 'https://propmark.com.br/agencias/leo-promove-juliana-roque-a-diretora-executiva-de-midia/' }),
  r({ tipo: 'pessoa', nome: 'Ana Sanchez', cargo: 'Vice-presidente de Mídia', empresa: 'Publicis Brasil', sinal: 'Ganhou quatro novos diretores de mídia na equipe', data: '2026-02', fonte: 'https://propmark.com.br/agencias/publicis-brasil-reforca-area-de-midia-com-quatro-novos-diretores/' }),
];
