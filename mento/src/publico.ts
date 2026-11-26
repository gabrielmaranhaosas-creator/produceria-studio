// Rede pública da MENTO: o que a pesquisa na web aberta (sem login) achou sobre a equipe e as casas da trajetória,
// cada item com a fonte. Mesmo método da coleta do PRODUCERia Studio. Pesquisa de 26/11/2026; cargos de notícias
// antigas podem ter mudado (a data vai junto). As conexões de cada pessoa entram pelo arquivo de dados do LinkedIn.
import type { Pessoa } from './exportacao';

export interface Pista { nome: string; cargo: string; empresa: string; url?: string; fonte: string; data?: string }
export interface LigacaoPublica { a: string; b: string; rotulo: string; fonte: string; data?: string; tipoB?: 'anunciante' | 'veiculo' }

const MM = 'https://www.meioemensagem.com.br/gente/acontece-no-meio/amc-networks-international-fortalece-equipe';

/** Pet e Thiago, como a web aberta e o próprio perfil os mostram. */
export const EQUIPE_PUBLICA: Pessoa[] = [
  { id: '1', nome: 'Pet Fernandes', titulo: 'Fundador da Mento Publicidade', url: 'https://www.linkedin.com/in/pet-fernandes-14102b31/', arquivos: ['pesquisa pública'], conexoes: [],
    posicoes: [
      { empresa: 'Mento Publicidade', cargo: 'Fundador', inicio: '', fim: '', atual: true },
      { empresa: 'AMC Networks International', cargo: 'Gerente de contas de Ad Sales América Latina', inicio: '2018-10', fim: '', atual: false },
      { empresa: 'A+E Networks', cargo: 'Vendas publicitárias', inicio: '', fim: '2018', atual: false },
      { empresa: 'Band', cargo: 'Comercial', inicio: '', fim: '', atual: false },
      { empresa: 'Omega Mídia', cargo: '', inicio: '', fim: '', atual: false },
      { empresa: 'Jornal Destak', cargo: '', inicio: '', fim: '', atual: false },
    ] },
  { id: '2', nome: 'Thiago Fortuna', titulo: 'Business Leader na Mento Publicidade | Revenue | Data | Innovation', url: '', arquivos: ['perfil (arquivo do LinkedIn)'], conexoes: [],
    posicoes: [{ empresa: 'Mento Publicidade', cargo: 'Business Leader', inicio: '', fim: '', atual: true }] },
];

/** Quem decide ou vende mídia nas casas por onde o Pet passou (portas pelo ex-colega), com a fonte pública. */
export const PISTAS: Pista[] = [
  { nome: 'Bruno Wellichan Ramos', cargo: 'Ad Sales Director', empresa: 'AMC Networks International', url: 'https://www.linkedin.com/in/brunowellichan/', fonte: 'https://www.linkedin.com/in/brunowellichan/' },
  { nome: 'Edgar Rosa', cargo: 'Diretor de Ad Sales & Affiliate Sales', empresa: 'AMC Networks International', fonte: 'https://www.meioemensagem.com.br/effie/jurados/edgar-rosa' },
  { nome: 'Pedro Fonseca', cargo: 'Executivo de Marketing', empresa: 'AMC Networks International', fonte: MM, data: '2018-10' },
  { nome: 'Analia Scovacricchi', cargo: 'Diretora de Marketing América Latina', empresa: 'AMC Networks International', fonte: 'https://marcaspelomundo.com.br/anunciantes/amc-networks-international-nomeia-analia-scovacricchi-como-nova-diretora-de-marketing-a-america-latinapara/' },
  { nome: 'Daniela Martínez', cargo: 'EVP de Programação e Ad Sales América Latina', empresa: 'A+E Networks', fonte: 'https://telaviva.com.br/14/01/2026/ae-networks-latin-america-promova-victor-hernandez-e-daniela-martinez/', data: '2026-01' },
  { nome: 'Lilian Akyama', cargo: 'Diretora Comercial Brasil', empresa: 'A+E Networks', fonte: 'https://senalnews.com/es/contenidos/ae-networks-brasil-designo-a-lilian-akyama-como-su-nueva-directora-comercial', data: '2022-07' },
  { nome: 'Júlio Tortorello', cargo: 'Diretor Comercial (vendas publicitárias)', empresa: 'A+E Networks', fonte: 'https://telaviva.com.br/14/05/2020/ae-networks-brasil-contrata-julio-tortorello-como-diretor-comercial/', data: '2020-05' },
  { nome: 'Rogério Domingues', cargo: 'Diretor-geral Comercial', empresa: 'Band', fonte: 'https://www.meioemensagem.com.br/gente/grupo-bandeirantes-tem-novo-lider-comercial', data: '2026-08' },
  { nome: 'Roberto Oliveira', cargo: 'Diretor Comercial Band Rio', empresa: 'Band', fonte: 'https://janela.com.br/2026/04/30/band-rio-contrata-novas-executivas-para-o-time-comercial-e-amplia-atuacao-integrada/', data: '2026-04' },
  { nome: 'Lucas Braga', cargo: 'Head Comercial Band TV Rio', empresa: 'Band', fonte: 'https://janela.com.br/2026/03/05/band-rio-tem-dois-novos-heads-comerciais/', data: '2026-03' },
  { nome: 'Juliana Branco', cargo: 'Head Comercial BandNews FM e Band FM Rio', empresa: 'Band', fonte: 'https://janela.com.br/2026/03/05/band-rio-tem-dois-novos-heads-comerciais/', data: '2026-03' },
  { nome: 'Thereza França', cargo: 'Executiva Comercial Band TV Rio', empresa: 'Band', fonte: 'https://janela.com.br/2026/04/30/band-rio-contrata-novas-executivas-para-o-time-comercial-e-amplia-atuacao-integrada/', data: '2026-04' },
  { nome: 'Ludimila Pontes', cargo: 'Executiva Comercial de Projetos Rio', empresa: 'Band', fonte: 'https://janela.com.br/2026/04/30/band-rio-contrata-novas-executivas-para-o-time-comercial-e-amplia-atuacao-integrada/', data: '2026-04' },
  { nome: 'Rodrigo Simch', cargo: 'Diretor Comercial Band RS', empresa: 'Band', fonte: 'https://rduirapuru.com.br/radio-uirapuru-anuncia-parceria-com-a-rede-bandeirantes-do-grupo-band-rs-para-integracao-entre-redacoes-e-jornada-esportiva/' },
];

/** Ligações entre as casas: quem anuncia onde e quem vende por quem. */
export const LIGACOES_PUBLICAS: LigacaoPublica[] = [
  { a: 'A+E Networks', b: 'AMC Networks International', rotulo: 'A+E passa a vender a publicidade da AMC na América Latina', fonte: 'https://senalnews.com/es/tv/ae-networks-representara-las-ventas-publicitarias-de-amc-networks-en-america-latina', data: '2026-03' },
  { a: 'Band', b: 'BETesporte', rotulo: 'cota da Copa 2026 na Rádio Bandeirantes e BandNews FM', fonte: 'https://www.meioemensagem.com.br/midia/radio-bandeirantes-e-bandnews-fm-confirmam-copa-2026', tipoB: 'anunciante' },
  { a: 'Band', b: 'Grupo Euro17', rotulo: 'cota da Copa 2026 na Rádio Bandeirantes e BandNews FM', fonte: 'https://www.meioemensagem.com.br/midia/radio-bandeirantes-e-bandnews-fm-confirmam-copa-2026', tipoB: 'anunciante' },
  { a: 'Band', b: 'Mobil', rotulo: 'cota da Copa 2026 na Rádio Bandeirantes e BandNews FM', fonte: 'https://www.meioemensagem.com.br/midia/radio-bandeirantes-e-bandnews-fm-confirmam-copa-2026', tipoB: 'anunciante' },
];
