// SWOT e frentes: matriz SWOT com evidência, sinais dos dados, revisão e cruzamento (TOWS) pela IA,
// frentes priorizadas e ofertas de IA aplicada.
import { esc, int, brl, dt } from '../lib/formato';
import { hoje } from '../lib/datas';
import { chave } from '../lib/nomes';
import { banco, type Banco } from '../lib/db';
import { perguntar, ErroIA, CONTEXTO } from '../lib/ia';
import { totalOrcamento, orcamentoVigente, type Orcamento } from '../lib/servicos';
import { EMPRESAS } from './licitacoes';
import { seletor, comId, type Dialogo } from './dom';
import { vazio, abrirDialogo, devolverFoco, confirmarNoBotao } from '../componentes';
import { numeroBR } from './funil';

// ---------------------------------------------------------------- modelo
export type Q = 'S' | 'W' | 'O' | 'T';
export interface ItemSwot { id: string; q: Q; texto: string; evidencia: string; fonte: string; certeza: string; peso: number; origem: string; em: string }
export interface Tows { id: string; tipo: 'SO' | 'WO' | 'ST' | 'WT'; titulo: string; texto: string; liga: string[]; passo: string; origem: string; em: string; frenteId?: string }
export interface Frente { id: string; nome: string; tese: string; entidade?: string; tipo: string; ativos?: string; primeiroPasso?: string; potencial: number; esforco: number; aderencia: number; status: string; origem?: string; tows?: string }
export interface Oferta { id: string; nome: string; resumo: string; publico: string; entregaveis: string[]; cobranca: string; ativos: string[]; status: string; precoAlvo: number | null; proposta?: string }
interface Projeto { id: string; cliente?: string; canal?: string; status?: string; orcamentos?: Orcamento[]; tarefas?: { status?: string; prazo?: string; rodadas?: number }[] }
interface Opp { id: string; score?: number; carteira?: boolean }

export const QUADRANTES = [
  { q: 'S' as Q, nome: 'Forças', eixo: 'Interno · ajuda', pergunta: 'O que o hub faz melhor e pode provar?' },
  { q: 'W' as Q, nome: 'Fraquezas', eixo: 'Interno · atrapalha', pergunta: 'O que limita margem, escala ou venda?' },
  { q: 'O' as Q, nome: 'Oportunidades', eixo: 'Externo · ajuda', pergunta: 'O que no mercado puxa demanda para o craft?' },
  { q: 'T' as Q, nome: 'Ameaças', eixo: 'Externo · atrapalha', pergunta: 'O que no mercado tira trabalho ou preço?' },
];
export const CRUZAMENTOS = [
  { t: 'SO', nome: 'Atacar', regra: 'Usar forças para capturar oportunidades' },
  { t: 'WO', nome: 'Corrigir', regra: 'Usar oportunidades para superar fraquezas' },
  { t: 'ST', nome: 'Defender', regra: 'Usar forças para neutralizar ameaças' },
  { t: 'WT', nome: 'Proteger', regra: 'Reduzir fraquezas expostas a ameaças' },
] as const;
export const CERTEZAS = ['Fonte pública', 'Dado do Studio', 'Informação interna', 'Hipótese'];
export const TIPOS_FRENTE = ['Recorrente', 'Projeto', 'Licitação', 'Produto'];
const STATUS_FRENTE = ['Hipótese', 'Em validação', 'Aprovada', 'Descartada'];
const STATUS_OFERTA = ['Hipótese', 'Em validação', 'Ativa', 'Pausada'];
const COBRANCAS = ['A definir', 'Projeto fechado', 'Assinatura mensal', 'Retainer mensal', 'Licença + implantação', 'Por diária / workshop'];

/** Ordem do quadrante: peso maior primeiro, depois o mais antigo. */
export const ordenar = <T extends { peso: number; em: string; id: string }>(L: T[]) => [...L].sort((a, b) => b.peso - a.peso || a.em.localeCompare(b.em) || a.id.localeCompare(b.id));
/** Códigos S1, W2… por quadrante, na ordem acima. */
export function codigos(itens: ItemSwot[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const q of ['S', 'W', 'O', 'T'] as Q[]) ordenar(itens.filter((i) => i.q === q)).forEach((i, k) => m.set(i.id, q + (k + 1)));
  return m;
}
/** Nota da frente, de 0 a 100: potencial (peso 2) + aderência (1,5) + facilidade (1). */
export const nota = (f: Pick<Frente, 'potencial' | 'aderencia' | 'esforco'>) => Math.round(((2 * f.potencial + 1.5 * f.aderencia + (6 - f.esforco)) / 22.5) * 100);
const semMarcas = (s?: string) => (s || '').replace(/\s*\[(CONFIRMADO|HIPÓTESE|FALTA EVIDÊNCIA|AGUARDA APROVAÇÃO)\]/gi, '').trim();

/** Sinais calculados agora a partir dos dados do Studio (orçamentos, tarefas e radar de licitações). */
export function sinais(projetos: Projeto[], opps: Opp[], h = hoje()) {
  const out: { q: Q; texto: string; evidencia: string }[] = [];
  const porCliente = new Map<string, number>(), porCanal: Record<string, number> = {};
  let total = 0;
  for (const p of projetos) {
    const o = orcamentoVigente(p.orcamentos);
    if (!o) continue;
    const v = totalOrcamento(o) / 100, cli = p.cliente || 'Sem cliente';
    total += v; porCliente.set(cli, (porCliente.get(cli) || 0) + v); porCanal[p.canal || 'Privado'] = (porCanal[p.canal || 'Privado'] || 0) + v;
  }
  if (total > 0) {
    const [cli, v] = [...porCliente.entries()].sort((a, b) => b[1] - a[1])[0], p = Math.round((v / total) * 100);
    out.push({ q: p > 30 ? 'W' : 'S', texto: `${cli} concentra ${p}% da receita orçada no Studio`, evidencia: `Soma das versões de orçamento de ${projetos.length} projeto(s); limite de gestão sugerido: 30%.` });
    if (!porCanal.Internacional) out.push({ q: 'W', texto: 'Nenhum orçamento internacional registrado no Studio', evidencia: 'Canal "Internacional" sem valor nos projetos.' });
    if (!porCanal['Público']) out.push({ q: 'W', texto: 'Nenhum orçamento público registrado no Studio', evidencia: 'Canal "Público" sem valor nos projetos.' });
  }
  const abertas = projetos.filter((p) => p.status === 'Ativo').flatMap((p) => p.tarefas || []).filter((t) => t.status !== 'Concluída');
  const atrasadas = abertas.filter((t) => t.prazo && t.prazo < h).length;
  if (atrasadas) out.push({ q: 'W', texto: `${atrasadas} de ${abertas.length} tarefas abertas estão atrasadas`, evidencia: 'Tarefas de projetos ativos com prazo vencido.' });
  const rodadas = abertas.reduce((s, t) => s + (t.rodadas || 0), 0);
  if (rodadas) out.push({ q: 'W', texto: `${rodadas} rodadas de refação registradas em tarefas abertas`, evidencia: 'Campo "rodadas" das tarefas; verificar se viraram aditivo cobrável.' });
  const boas = opps.filter((o) => (o.score ?? 0) >= 60);
  if (boas.length) out.push({ q: 'O', texto: `${boas.length} oportunidades públicas com nota 60+ no radar de licitações`, evidencia: `Radar do PNCP; ${opps.filter((o) => o.carteira).length} na carteira.` });
  return out;
}

// ---------------------------------------------------------------- base da pesquisa (escopo atual: três empresas, sem eventos)
const EM = '2026-11-04T12:00:00.000Z';
const it = (id: string, q: Q, peso: number, certeza: string, texto: string, evidencia: string, fonte = ''): ItemSwot => ({ id, q, peso, certeza, texto, evidencia, fonte, origem: 'Pesquisa', em: EM });
export const BASE_SWOT: ItemSwot[] = [
  it('sw-s1', 'S', 3, 'Fonte pública', 'Ouro em Industry Craft, Cannes Lions 2019 ("Black Box", JWT): prova pública de craft gráfico', 'Sid Fernandes creditado como Print Production no diretório do Cannes.', 'https://www.lovethework.com/en/directory/individuals/sid-fernandes-produceria-11966019'),
  it('sw-s2', 'S', 3, 'Fonte pública', 'Base em Miami desde 2020 e histórico com agências americanas (Arnold, Nobox)', 'Matéria de abertura da operação nos EUA.', 'https://www.meioemensagem.com.br/home/comunicacao/2020/03/13/produceria-abre-operacao-nos-estados-unidos.html'),
  it('sw-s3', 'S', 2, 'Fonte pública', 'Hub de três empresas (criação, produções, digitais) cujos CNAEs cobrem audiovisual, gráfica, comunicação visual e digital', 'Habilita cadastro como fornecedor e participação em licitação por vocação.', 'https://www.econodata.com.br/consulta-empresa/15152102000108-produceria-cria-ltda'),
  it('sw-s7', 'S', 3, 'Fonte pública', 'Produceria Miami em parceria com a CHICOOH+, primeira trading desk de OOH/DOOH do Brasil, para campanhas em todos os continentes', 'Parceria anunciada em 29/01/2025: planejamento, criação, inteligência, execução e pós-venda de OOH/DOOH no exterior.', 'https://janela.com.br/2025/01/29/chicooh-expande-para-o-exterior-em-parceria-com-a-produceria-miami/'),
  it('sw-s8', 'S', 2, 'Fonte pública', "Case Broto Legal em Londres: OOH com caminhão de LED no entorno do Emirates na final da FIFA Women's Champions Cup 2026 (Corinthians x Arsenal)", 'Executado por Produceria Miami e CHICOOH+ em 01/02/2026.', 'https://soesporte.com.br/broto-legal-celebra-o-patrocinio-ao-time-feminino-do-corinthians-com-acao-de-ooh-durante-a-final-da-fifa-womens-champions-cup-2026-em-londres/'),
  it('sw-s9', 'S', 2, 'Fonte pública', 'Case "Raspe Seus Dados" (GUT para Mercado Livre): Produceria creditada em projeto e desenvolvimento', 'Ficha técnica de 11/03/2026; impressão Leograf, vídeo Vision, áudio Cabaret.', 'https://nossomeio.com.br/gut-assina-campanha-raspe-seus-dados-do-mercado-livre-sobre-protecao-de-dados-em-embalagens/'),
  it('sw-s4', 'S', 2, 'Informação interna', 'Dois núcleos especializados (offline e online) com arte-final, retoque, revisão, motion e HTML', 'Organograma interno: especialização flexível no sentido de Piore & Sabel.'),
  it('sw-s5', 'S', 2, 'Informação interna', 'Ferramentas proprietárias de IA: Studio, Atlas B2G, agentes por função', 'Usadas na operação; o LinkedIn da empresa afirma que cria ferramentas próprias de IA.'),
  it('sw-s6', 'S', 1, 'Informação interna', 'Contas recorrentes de volume (Sicredi, Vivo) com regras de marca rígidas', 'Não há registro público dessas contas; tratar como confidencial.'),
  it('sw-w1', 'W', 3, 'Hipótese', 'O valor do acabamento é invisível ao cliente: rodadas, horas e erros evitados não são mostrados', 'Sennett: "o bom artífice é um mau vendedor". O Studio começa a medir rodadas e horas por tarefa.'),
  it('sw-w2', 'W', 3, 'Hipótese', 'Receita possivelmente concentrada em poucas contas recorrentes', 'Confirmar com o mapa de receitas (Funil e receita) assim que houver valores informados.'),
  it('sw-w3', 'W', 2, 'Fonte pública', 'Sem site institucional com portfólio indexável', 'A pesquisa pública não encontrou portfólio nem prêmios além de 2019.'),
  it('sw-w4', 'W', 2, 'Hipótese', 'Porte de 10 a 50 pessoas: não compete em escala com holdings', 'Estimativa de agregadores, sem auditoria.', 'https://www.signalhire.com/companies/produceria'),
  it('sw-o1', 'O', 3, 'Fonte pública', 'Digital cresce em formatos: R$ 42,7 bi em 2025, retail media +37%, DOOH R$ 4,4 bi', 'Mais formatos, specs e SKUs por campanha = mais adaptação e finalização.', 'https://www.conversion.com.br/blog/iab-brasil-publicidade-digital-42-bilhoes-2025'),
  it('sw-o2', 'O', 3, 'Fonte pública', 'Agências preferem terceirizar produção: só 12% veem produtoras como foco de investimento', 'Pesquisa KPMG com 51 agências (2024).', 'https://kpmg.com/br/pt/home/insights/2024/07/pesquisa-futuro-agencias-2-edicao.html'),
  it('sw-o3', 'O', 3, 'Fonte pública', 'Lei 12.232/2010: agências de contas públicas só cotam produção com fornecedores cadastrados', 'Art. 2º §1º II (produção como atividade complementar) e art. 14 (cadastro e 3 orçamentos).', 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12232.htm'),
  it('sw-o4', 'O', 2, 'Fonte pública', 'Na crise a verba muda de lugar: em 2016 o bolo caiu 1,6%, mas OOH cresceu 17% e entraram 30 mil anunciantes novos', 'Mais anunciantes menores pedindo mais peças de menor custo.', 'https://www.meioemensagem.com.br/midia/compra-de-midia-cai-16-diz-monitor'),
  it('sw-o5', 'O', 2, 'Fonte pública', 'FilmBrazil (Apex/Apro) renovado para 2025/2026 com roadshow nos EUA', 'R$ 10,6 milhões no biênio.', 'https://www.meioemensagem.com.br/comunicacao/apexbrasil-e-apro-r-10-milhoes-para-promover-exportacao-do-audiovisual'),
  it('sw-o6', 'O', 2, 'Fonte pública', '"Repertório, autoria e craft ganham valor à medida que a IA se populariza"', 'Executivos de produtoras ao Meio & Mensagem.', 'https://www.meioemensagem.com.br/comunicacao/ia-modifica-a-producao-audiovisual-e-eleva-o-valor-do-craft'),
  it('sw-t1', 'T', 3, 'Fonte pública', 'WPP Production (ex-Hogarth): quase 10 mil pessoas, IA para versionamento, hub em São Paulo', 'Comunicado do WPP de 22/01/2026 e hub SP com cerca de 60 profissionais.', 'https://www.meioemensagem.com.br/comunicacao/wpp-production-inaugura-hub-em-sao-paulo'),
  it('sw-t2', 'T', 3, 'Fonte pública', 'Creative automation comoditiza redimensionamento, localização e variações', 'Celtra define o pacote como "layout, resizing, localization, and variant generation".', 'https://celtra.com/blog/creative-automation-the-time-saving-hack-for-design-teams/'),
  it('sw-t3', 'T', 2, 'Fonte pública', 'In-housing: anunciantes montam agências internas (OLIVER opera várias no Brasil)', 'Estudo da própria OLIVER, parte interessada: 5 dos 10 maiores anunciantes usam in-house.', 'https://oliverlatinamerica.agency/50-dos-maiores-anunciantes-no-brasil-possuem-agencia-inhouse/'),
  it('sw-t4', 'T', 2, 'Fonte pública', 'Anunciantes consolidam e reduzem o número de parceiros', 'Guia ABA sobre o futuro modelo das agências (2024).', 'https://aba.com.br/wp-content/uploads/2024/08/Guia-ABA-sobre-O-futuro-modelo-das-ag%C3%AAncias_FINAL.pdf'),
  it('sw-t5', 'T', 1, 'Fonte pública', 'Pressão de preço de freelancers e estúdios de arte-final', 'Vagas de arte-finalista em SP pagam de R$ 2.500 a R$ 3.500.', 'https://www.glassdoor.com/Job/brazil-arte-finalista-jobs-SRCH_IL.0,6_IN36_KO7,21.htm'),
];
const tw = (id: string, tipo: Tows['tipo'], titulo: string, texto: string, liga: string[], passo: string): Tows => ({ id, tipo, titulo, texto, liga, passo, origem: 'Pesquisa', em: EM });
export const BASE_TOWS: Tows[] = [
  tw('tw-so1', 'SO', 'Finalização com craft vendida em dólar', 'O Ouro em Industry Craft e a base em Miami sustentam uma oferta de finalização para agências americanas via FilmBrazil.', ['sw-s1', 'sw-s2', 'sw-o5'], 'Verificar adesão à Apro e montar o reel de finalização'),
  tw('tw-so2', 'SO', 'Fornecedor de produção das agências de contas públicas', 'As três empresas e os núcleos especializados entram pelo cadastro de fornecedores exigido pela Lei 12.232.', ['sw-s3', 'sw-s4', 'sw-o3'], 'Listar as agências vencedoras das maiores contas públicas de SP'),
  tw('tw-wo1', 'WO', 'Relatório de craft por job', 'Mostrar ao cliente rodadas, horas, erros evitados na pré-checagem e padrão de entrega: o valor que hoje é invisível vira argumento.', ['sw-w1', 'sw-o6'], 'Gerar o relatório a partir das tarefas de um job real'),
  tw('tw-wo2', 'WO', 'Agências independentes como segunda base de receita', 'Diluir a concentração indo atrás das agências que não querem internalizar produção.', ['sw-w2', 'sw-o2'], 'Mapear 15 agências independentes do ranking Cenp'),
  tw('tw-st1', 'ST', 'Pacote Reuse/Remaster com finalização humana', 'Contra a automação das holdings: preço por derivada a partir da etapa ADAPTAÇÃO da tabela, com IA no mecânico e acabamento humano garantido.', ['sw-s4', 'sw-s5', 'sw-t1', 'sw-t2'], 'Definir 3 faixas de volume e apresentar às contas recorrentes'),
  tw('tw-wt1', 'WT', 'Fee mensal e meta de receita fora das duas maiores contas', 'Contratos de volume dão previsibilidade; a meta de concentração evita depender de quem está consolidando fornecedores.', ['sw-w2', 'sw-t4'], 'Levantar volume dos últimos 6 meses por conta'),
];

const novoId = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const agora = () => new Date().toISOString();
const fonteLink = (u?: string, t = 'fonte') => (u ? `<a class="cn-f" href="${esc(u)}" target="_blank" rel="noopener">${t} ↗<span class="sr"> (abre em nova aba)</span></a>` : '');
const opts = (L: readonly string[], v: string) => L.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
interface Downloads { save(o: { filename: string; data: string }): Promise<{ status?: string } | void> }

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc es">
  <section class="es-bar" id="esB"></section>
  <p class="sr" id="esLive" aria-live="polite" aria-atomic="true"></p>
  <section aria-label="Matriz SWOT" class="es-matriz"><div class="es-eixos" aria-hidden="true"><span></span><span class="note">Ajuda</span><span class="note">Atrapalha</span></div><div class="es-wrap" id="esM"></div></section>
  <section class="es-duo"><div><div class="ph"><h2 class="d d-sub">Sinais dos dados</h2><span class="note">calculados agora, do Studio</span></div><div id="esS"></div></div>
    <div class="lc-box es-ia"><span class="lab">Claude como crítico</span><h2 class="d d-sub">Revisar e cruzar</h2>
      <p class="note">Revisar procura lacunas na matriz e propõe itens com evidência. Cruzar gera estratégias TOWS citando os códigos. Tudo entra como hipótese, com origem marcada.</p>
      <div class="f"><label for="esFoco">Foco (opcional)</label><input id="esFoco" placeholder="Ex.: Sicredi, EUA, comunicação visual"></div>
      <div class="acts"><button type="button" id="esRev">Revisar matriz</button><button type="button" id="esCruz">Cruzar (TOWS)</button></div>
      <p class="erro" id="esIAe" role="alert"></p><p class="note" id="esIAo" aria-live="polite"></p></div></section>
  <section><div class="ph"><h2 class="d d-sub">Estratégias cruzadas</h2><span class="note">passe o mouse ou o foco para destacar os itens cruzados</span></div><div class="es-tows" id="esT"></div></section>
  <section><div class="ph"><h2 class="d d-sub">Frentes priorizadas</h2><div class="acts" id="esFF"></div></div><div id="esF"></div>
    <p class="note">Nota = potencial (peso 2) + aderência ao hub (1,5) + facilidade (1), de 0 a 100. Abra a frente para ver tese, primeiro passo e ajustar.</p></section>
  <section><div class="ph"><h2 class="d d-sub">Ofertas de IA aplicada</h2><span class="note">o que o hub já construiu, empacotado como produto</span></div>
    <div class="acts es-of-topo"><p class="note">Ofertas montadas a partir do que já existe na casa. Preço e modelo de cobrança são decisão da equipe: a IA escreve a proposta sem inventar valores.</p><button type="button" class="sm" id="esOfN">Nova oferta</button></div><div id="esO"></div></section>
</div><dialog id="esD" aria-labelledby="esDT"></dialog>`;
  const $ = seletor(root);
  const D = $<Dialogo>('#esD');
  let I: ItemSwot[] = [], T: Tows[] = [], F: Frente[] = [], O: Oferta[] = [], projetos: Projeto[] = [], opps: Opp[] = [];
  let db: Banco | null = null, carregado = false, aberto = '', frAberta = '', tipo = '', luz: string[] = [], pendente = false, ofAberta = '';
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#esLive').textContent = t; };
  devolverFoco(D, () => $<HTMLElement>('#esOfN'));
  D.addEventListener('close', () => { ofAberta = ''; });

  async function gravar(col: string, id: string, d: object, modo: 'set' | 'update' = 'update', aviso = '') {
    if (!db) { avisar('Sem o banco do Studio: nada foi salvo.'); return false; }
    try { await (modo === 'set' ? db.collection(col).doc(id).set(d) : db.collection(col).doc(id).update(d)); if (aviso) avisar(aviso); return true; }
    catch { avisar('Não foi possível salvar.'); return false; }
  }
  async function apagar(col: string, id: string, aviso: string) {
    if (!db) return;
    try { await db.collection(col).doc(id).delete(); avisar(aviso); } catch { avisar('Não foi possível excluir.'); }
  }
  const novoItem = (q: Q, texto: string, extra: Partial<ItemSwot> = {}) => {
    if (!texto.trim()) return Promise.resolve(false);
    const id = novoId('sw');
    return gravar('swot', id, { id, q, texto: texto.trim(), evidencia: '', fonte: '', certeza: 'Hipótese', peso: 2, origem: 'Equipe', em: agora(), ...extra }, 'set');
  };

  /** Re-renderiza, mas espera o campo em edição perder o foco para não apagar o que está sendo digitado. */
  function agendar() {
    const a = document.activeElement as HTMLElement | null;
    if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('#esFF')) { pendente = true; return; }
    render();
  }
  root.addEventListener('focusout', () => { if (pendente) setTimeout(() => { if (pendente) { const a = document.activeElement; if (!(a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) { pendente = false; render(); } } }, 0); });

  function render() {
    const cod = codigos(I), comEv = I.filter((i) => i.certeza !== 'Hipótese').length;
    $('#esB').innerHTML = `<div><p><b class="num">${int(I.length)}</b> itens · <b class="num">${int(comEv)}</b> com evidência · <b class="num">${int(I.length - comEv)}</b> hipóteses a validar</p>
      <p class="note">Abra um item para editar evidência, fonte e peso. O peso ordena o quadrante e define os códigos (S1, W2…).</p></div>
      <div class="acts">${I.length ? '<button type="button" class="ghost sm" id="esMD">Baixar .md</button>' : ''}${carregado && I.length < BASE_SWOT.length ? '<button type="button" class="ghost sm" id="esBase">Carregar base da pesquisa</button>' : ''}</div>`;
    $('#esM').innerHTML = `<span class="note es-lado">Interno</span><span class="note es-lado" style="grid-row:2">Externo</span>${QUADRANTES.map((x) => {
      const L = ordenar(I.filter((i) => i.q === x.q));
      return `<div class="es-q q-${x.q}"><header><span class="d es-letra" aria-hidden="true">${x.q}</span><div><h2 class="d d-sub">${x.nome}</h2><span class="note">${x.pergunta}</span></div></header>
      <ol class="es-lista">${L.map((i) => `<li class="${luz.includes(i.id) ? 'luz' : ''}"><button type="button" class="es-item" data-item="${esc(i.id)}" aria-expanded="${aberto === i.id}"><span class="num es-cod">${cod.get(i.id)}</span><span>${esc(i.texto)}</span><span class="es-peso" aria-label="peso ${i.peso}">${'●'.repeat(i.peso)}<span class="es-off">${'●'.repeat(3 - i.peso)}</span></span></button>
        ${aberto === i.id ? `<div class="es-edit">
          <div class="f"><label for="ie-t-${esc(i.id)}">Item</label><textarea id="ie-t-${esc(i.id)}" rows="2" data-sw="${esc(i.id)}" data-campo="texto">${esc(i.texto)}</textarea></div>
          <div class="f"><label for="ie-e-${esc(i.id)}">Evidência ou como validar</label><textarea id="ie-e-${esc(i.id)}" rows="2" data-sw="${esc(i.id)}" data-campo="evidencia">${esc(i.evidencia)}</textarea></div>
          <div class="es-row3"><div class="f"><label for="ie-f-${esc(i.id)}">Fonte (URL)</label><input id="ie-f-${esc(i.id)}" type="url" data-sw="${esc(i.id)}" data-campo="fonte" value="${esc(i.fonte)}" placeholder="https://"></div>
            <div class="f"><label for="ie-c-${esc(i.id)}">Certeza</label><select id="ie-c-${esc(i.id)}" data-sw="${esc(i.id)}" data-campo="certeza">${opts(CERTEZAS, i.certeza)}</select></div>
            <div class="f"><label for="ie-p-${esc(i.id)}">Peso</label><select id="ie-p-${esc(i.id)}" data-sw="${esc(i.id)}" data-campo="peso">${[[3, 'decisivo'], [2, 'relevante'], [1, 'menor']].map(([v, t]) => `<option value="${v}"${i.peso === v ? ' selected' : ''}>${v} · ${t}</option>`).join('')}</select></div></div>
          <div class="acts"><span class="tag${i.certeza === 'Hipótese' ? ' w' : ' ok'}">${esc(i.certeza)}</span><span class="note">${esc(i.origem)}</span>${fonteLink(i.fonte, 'Abrir fonte')}<button type="button" class="lnk perigo" data-delsw="${esc(i.id)}">Excluir</button></div></div>`
          : i.certeza === 'Hipótese' ? `<span class="note es-hip">hipótese${i.evidencia ? ' · ' + esc(i.evidencia) : ''}</span>` : ''}</li>`).join('')}</ol>
      <form class="es-add" data-q="${x.q}"><label class="sr" for="es-add-${x.q}">Novo item em ${x.nome}</label><input id="es-add-${x.q}" placeholder="Adicionar em ${x.nome.toLowerCase()}…"><button type="submit" class="ghost sm" aria-label="Adicionar em ${x.nome}">+</button></form></div>`;
    }).join('')}`;
    $('#esM').querySelectorAll<HTMLButtonElement>('[data-delsw]').forEach((b) => confirmarNoBotao(b, 'Confirmar exclusão', () => { aberto = ''; return apagar('swot', b.dataset.delsw!, 'Item excluído.'); }));

    const textos = new Set(I.map((i) => i.texto.toLowerCase())), sig = sinais(projetos, opps), novos = sig.filter((s) => !textos.has(s.texto.toLowerCase()));
    $('#esS').innerHTML = novos.length ? `<ul class="vc-l">${novos.map((s, k) => `<li class="es-sinal"><span class="d es-letra-p">${s.q}</span><span class="vc-c"><span>${esc(s.texto)}</span><span class="note">${esc(s.evidencia)}</span></span><button type="button" class="ghost sm" data-sinal="${k}">Levar</button></li>`).join('')}</ul>`
      : `<p class="note">${sig.length ? 'Todos os sinais atuais já estão na matriz.' : 'Ainda não há orçamentos, tarefas ou radar suficientes para gerar sinais. Eles aparecem conforme a equipe usa o Studio.'}</p>`;

    $('#esT').innerHTML = CRUZAMENTOS.map((c) => {
      const L = T.filter((t) => t.tipo === c.t);
      return `<div class="es-tc"><header><span class="d es-letra-p">${c.t}</span><span><b>${c.nome}</b><span class="note"> · ${c.regra}</span></span></header>
      ${L.length ? L.map((t) => `<article class="es-tw" tabindex="0" data-liga="${esc(t.liga.join(' '))}"><div class="es-tw-h"><b>${esc(t.titulo)}</b><span class="note num">${esc(t.liga.map((x) => cod.get(x)).filter(Boolean).join(' + '))}</span></div>
        <p class="note">${esc(t.texto)}</p><p class="note">Primeiro passo: ${esc(t.passo)}</p>
        <div class="acts">${t.frenteId ? '<span class="tag ok">Virou frente</span>' : `<button type="button" class="lnk" data-frente="${esc(t.id)}">Virar frente →</button>`}<button type="button" class="lnk perigo" data-deltw="${esc(t.id)}">Excluir</button></div></article>`).join('') : '<span class="note">Nenhuma ainda.</span>'}</div>`;
    }).join('');
    $('#esT').querySelectorAll<HTMLButtonElement>('[data-deltw]').forEach((b) => confirmarNoBotao(b, 'Confirmar exclusão', () => apagar('tows', b.dataset.deltw!, 'Estratégia excluída.')));

    frentes();
    ofertas();
  }

  function frentes() {
    $('#esFF').innerHTML = `<button type="button" class="chip" data-tipo="" aria-pressed="${!tipo}">Todas · ${F.length}</button>${TIPOS_FRENTE.map((t) => `<button type="button" class="chip" data-tipo="${t}" aria-pressed="${tipo === t}">${t}</button>`).join('')}`;
    const L = F.filter((f) => !tipo || f.tipo === tipo).sort((a, b) => nota(b) - nota(a));
    $('#esF').innerHTML = !carregado ? '<p class="note">Carregando…</p>' : L.length ? `<ul class="vc-l es-fr">${L.map((f, k) => `<li><button type="button" class="es-fr-h" data-fr="${esc(f.id)}" aria-expanded="${frAberta === f.id}">
      <span class="note num">${String(k + 1).padStart(2, '0')}</span><b>${esc(semMarcas(f.nome))}</b><span class="note">${esc(f.tipo)}</span><span class="note num">${esc(f.tows || '—')}</span><span class="tag w">${esc(f.status)}</span><span class="d num es-nota">${nota(f)}</span></button>
      ${frAberta === f.id ? `<div class="lc-box es-fr-ed"><p>${esc(semMarcas(f.tese))}</p>${f.primeiroPasso ? `<p class="note">Primeiro passo: ${esc(semMarcas(f.primeiroPasso))}</p>` : ''}
        <div class="det fm"><div class="f"><label for="fe-n">Nome</label><input id="fe-n" data-fr-ed="${esc(f.id)}" data-campo="nome" value="${esc(f.nome)}"></div>
          <div class="f"><label for="fe-t">Tipo</label><select id="fe-t" data-fr-ed="${esc(f.id)}" data-campo="tipo">${opts(TIPOS_FRENTE, f.tipo)}</select></div>
          <div class="f"><label for="fe-c">Cruzamento</label><select id="fe-c" data-fr-ed="${esc(f.id)}" data-campo="tows"><option value="">—</option>${CRUZAMENTOS.map((c) => `<option value="${c.t}"${f.tows === c.t ? ' selected' : ''}>${c.t} · ${c.nome}</option>`).join('')}</select></div>
          <div class="f"><label for="fe-s">Status</label><select id="fe-s" data-fr-ed="${esc(f.id)}" data-campo="status">${opts(STATUS_FRENTE, f.status)}</select></div>
          <div class="f full"><label for="fe-te">Tese</label><textarea id="fe-te" rows="2" data-fr-ed="${esc(f.id)}" data-campo="tese">${esc(f.tese)}</textarea></div>
          <div class="f full"><label for="fe-p">Primeiro passo (até 2 semanas)</label><input id="fe-p" data-fr-ed="${esc(f.id)}" data-campo="primeiroPasso" value="${esc(f.primeiroPasso || '')}"></div>
          ${(['potencial', 'esforco', 'aderencia'] as const).map((c) => `<div class="f"><label for="fe-${c}">${c === 'potencial' ? 'Potencial' : c === 'esforco' ? 'Esforço' : 'Aderência ao hub'} · <span class="num">${f[c]}</span></label><input id="fe-${c}" type="range" min="1" max="5" step="1" value="${f[c]}" data-fr-ed="${esc(f.id)}" data-campo="${c}"></div>`).join('')}</div>
        <div class="acts"><button type="button" class="lnk perigo" data-delfr="${esc(f.id)}">Excluir frente</button></div></div>` : ''}</li>`).join('')}</ul>`
      : vazio({ titulo: tipo ? 'Nenhuma frente deste tipo' : 'Nenhuma frente ainda', texto: 'Uma estratégia cruzada vira frente com "Virar frente →".' });
    $('#esF').querySelectorAll<HTMLButtonElement>('[data-delfr]').forEach((b) => confirmarNoBotao(b, 'Confirmar exclusão', () => { frAberta = ''; return apagar('frentes', b.dataset.delfr!, 'Frente excluída.'); }));
  }

  function ofertas() {
    const L = [...O].sort((a, b) => a.nome.localeCompare(b.nome));
    $('#esO').innerHTML = !carregado ? '<p class="note">Carregando…</p>' : L.length ? `<ul class="vc-l">${L.map((o, k) => `<li><button type="button" class="vc-linha es-of" data-of="${esc(o.id)}"><span class="note num">${String(k + 1).padStart(2, '0')}</span>
      <span class="vc-c"><b>${esc(o.nome)}</b><span class="note">${esc(o.resumo || 'Sem resumo.')}</span><span class="note">${esc(o.publico || 'público a definir')} · ${esc(o.cobranca)}${o.precoAlvo ? ' · alvo ' + brl(o.precoAlvo) : ''} · ${o.ativos.length} ativo(s) da casa</span></span>
      <span class="vc-num"><span class="tag${o.status === 'Ativa' ? ' ok' : ' w'}">${esc(o.status)}</span>${o.proposta ? '<span class="tag ok">Proposta</span>' : ''}</span></button></li>`).join('')}</ul>`
      : vazio({ titulo: 'Nenhuma oferta', texto: 'Crie a primeira oferta de IA aplicada: agentes por setor, kit de personas sociais, radar de licitações como serviço…' });
    if (ofAberta && D.open) { const o = O.find((x) => x.id === ofAberta); if (o) atualizarOferta(o); }
  }

  // ---------------------------------------------------------------- oferta (diálogo)
  const linhas = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  function abrirOferta(o: Oferta, quem: HTMLElement | null) {
    ofAberta = o.id;
    abrirDialogo(D, `<div class="dh"><div><span class="lab">Oferta de IA aplicada</span><h2 class="d d-sub" id="esDT">${esc(o.nome)}</h2></div><button type="button" class="x" id="esX" aria-label="Fechar">×</button></div>
    <div class="det fm"><div class="f"><label for="of-nome">Nome</label><input id="of-nome" data-of-ed="nome" value="${esc(o.nome)}"></div>
      <div class="f"><label for="of-status">Status</label><select id="of-status" data-of-ed="status">${opts(STATUS_OFERTA, o.status)}</select></div>
      <div class="f"><label for="of-cob">Cobrança</label><select id="of-cob" data-of-ed="cobranca">${opts(COBRANCAS, o.cobranca)}</select></div>
      <div class="f"><label for="of-preco">Preço-alvo (R$) · definido pela equipe</label><input id="of-preco" inputmode="decimal" data-of-ed="precoAlvo" value="${o.precoAlvo ?? ''}"></div>
      <div class="f full"><label for="of-resumo">Resumo</label><textarea id="of-resumo" rows="2" data-of-ed="resumo">${esc(o.resumo)}</textarea></div>
      <div class="f full"><label for="of-pub">Público</label><input id="of-pub" data-of-ed="publico" value="${esc(o.publico)}"></div>
      <div class="f"><label for="of-ent">Entregáveis (um por linha)</label><textarea id="of-ent" rows="5" data-of-ed="entregaveis">${esc(o.entregaveis.join('\n'))}</textarea></div>
      <div class="f"><label for="of-at">Ativos da casa reaproveitados (um por linha)</label><textarea id="of-at" rows="5" data-of-ed="ativos">${esc(o.ativos.join('\n'))}</textarea></div></div>
    <div class="acts"><button type="button" id="ofIA">${o.proposta ? 'Reescrever proposta' : 'Gerar proposta com IA'}</button></div><p class="erro" id="ofIAe" role="alert"></p>
    <div id="ofP"></div>
    <div class="dacts fim"><button type="button" class="ghost perigo" id="ofDel">Excluir oferta</button></div>`, quem, '#of-nome');
    $('#esX').onclick = () => D.close();
    D.querySelectorAll<HTMLInputElement>('[data-of-ed]').forEach((el) => {
      const k = el.dataset.ofEd!;
      const salvarCampo = () => {
        const atual = O.find((x) => x.id === o.id) || o;
        const v = k === 'entregaveis' || k === 'ativos' ? linhas(el.value) : k === 'precoAlvo' ? numeroBR(el.value) : el.value;
        if (JSON.stringify(v) === JSON.stringify((atual as unknown as Record<string, unknown>)[k])) return;
        gravar('ofertas', o.id, { [k]: v }, 'update', 'Salvo.');
      };
      if (el.tagName === 'SELECT') el.onchange = salvarCampo; else el.onblur = salvarCampo;
    });
    const bIA = $<HTMLButtonElement>('#ofIA');
    bIA.onclick = async () => {
      const a = O.find((x) => x.id === o.id) || o;
      bIA.disabled = true; bIA.textContent = 'Escrevendo…'; $('#ofIAe').textContent = '';
      try {
        const t = String(await perguntar(`${CONTEXTO}\n\nEscreva a proposta comercial-base de uma oferta de IA aplicada da PRODUCERIA, para ser revisada pela equipe antes de qualquer envio.\nOferta: ${a.nome}\nResumo: ${a.resumo}\nPúblico: ${a.publico}\nEntregáveis: ${a.entregaveis.join('; ')}\nAtivos que já existem: ${a.ativos.join('; ')}\nModelo de cobrança: ${a.cobranca}${a.precoAlvo ? ` · preço-alvo informado pela equipe: R$ ${a.precoAlvo.toFixed(2)}` : ' · preço a definir pela equipe (não sugira valores)'}\n\nFormato (Markdown): título · problema do cliente · o que entregamos · como funciona (etapas) · o que o cliente precisa fornecer · limites e responsabilidades (IA com direção humana, sem claims de resultado) · investimento (só o informado; senão "a definir") · próximos passos. Até 600 palavras.`,
          { aoEscrever: (x) => { $('#ofP').innerHTML = `<div class="lc-box"><div class="lc-pre">${esc(x)}</div></div>`; } }));
        await gravar('ofertas', o.id, { proposta: t }, 'update', 'Proposta salva como rascunho.');
        atualizarOferta({ ...a, proposta: t });
      } catch (e) { $('#ofIAe').textContent = e instanceof ErroIA ? e.message : 'A proposta falhou. Tente de novo.'; }
      finally { bIA.disabled = false; bIA.textContent = (O.find((x) => x.id === o.id) || o).proposta ? 'Reescrever proposta' : 'Gerar proposta com IA'; }
    };
    confirmarNoBotao($<HTMLButtonElement>('#ofDel'), 'Confirmar exclusão', async () => { await apagar('ofertas', o.id, 'Oferta excluída.'); D.close(); });
    atualizarOferta(o);
  }
  function atualizarOferta(o: Oferta) {
    const p = D.querySelector('#ofP');
    if (!p || $<HTMLButtonElement>('#ofIA').disabled) return;
    p.innerHTML = o.proposta ? `<div class="lc-box"><div class="acts es-of-ph"><span class="lab">Proposta-base · rascunho</span><button type="button" class="lnk" id="ofMD">Baixar .md</button></div><div class="lc-pre">${esc(o.proposta)}</div></div>` : '';
    const b = D.querySelector<HTMLButtonElement>('#ofMD');
    if (b) b.onclick = () => baixar(`proposta-${chave(o.nome).replace(/\s+/g, '-')}.md`, o.proposta!);
  }

  async function baixar(nome: string, data: string) {
    try {
      const d = (await window.claude?.use('downloads')) as Downloads | undefined;
      if (!d) { avisar('Download indisponível nesta visualização. Abra o Studio no Claude.'); return; }
      const r = await d.save({ filename: nome, data });
      if (r && r.status === 'saved') avisar('Arquivo salvo: ' + nome);
    } catch (e) {
      const c = (e as { code?: string })?.code;
      if (c !== 'declined') avisar(c === 'rate_limited' ? 'Já há um download aguardando confirmação.' : 'Não foi possível gerar o arquivo agora.');
    }
  }

  function markdown(): string {
    const cod = codigos(I), L = ['# Matriz SWOT · PRODUCERIA', `Gerada no PRODUCERia Studio em ${dt(hoje())}.`, ''];
    for (const x of QUADRANTES) {
      L.push(`## ${x.nome} (${x.eixo})`);
      for (const i of ordenar(I.filter((y) => y.q === x.q))) L.push(`- **${cod.get(i.id)}** ${i.texto} — _${i.certeza}_${i.evidencia ? '. ' + i.evidencia : ''}${i.fonte ? ` [fonte](${i.fonte})` : ''}`);
      L.push('');
    }
    L.push('## Estratégias (TOWS)');
    for (const c of CRUZAMENTOS) for (const t of T.filter((y) => y.tipo === c.t)) L.push(`- **${c.t} · ${t.titulo}** (${t.liga.map((x) => cod.get(x)).filter(Boolean).join(' + ')}): ${t.texto} Primeiro passo: ${t.passo}`);
    return L.join('\n');
  }

  // ---------------------------------------------------------------- IA: revisar e cruzar
  const matrizTexto = () => { const cod = codigos(I); return ordenar(I).map((i) => `${cod.get(i.id)} [${i.certeza}] ${i.texto}`).join('\n') || '—'; };
  async function revisar(b: HTMLButtonElement) {
    const foco = $<HTMLInputElement>('#esFoco').value.trim(), sig = sinais(projetos, opps);
    b.disabled = true; b.textContent = 'Revisando…'; $('#esIAe').textContent = ''; $('#esIAo').textContent = '';
    try {
      const r = await perguntar(`${CONTEXTO}\n\nVocê revisa a matriz SWOT da PRODUCERIA (hub de craft: arte-final, retoque, adaptação, motion, finalização, produção gráfica, comunicação visual e mídia exterior; três empresas: ${EMPRESAS.map((e) => e.nome).join(', ')}).
Seja crítico: aponte o que falta, não elogie. Proponha de 4 a 8 itens NOVOS (não repita os atuais), espalhados pelos quadrantes onde a matriz está mais fraca.
Regras: S e W são internos (o que o hub controla); O e T são externos (mercado, regulação, concorrência, tecnologia). Cada item precisa de evidência concreta. Se não tiver fonte, certeza = "Hipótese" e diga como validar. Nada de número de mercado sem fonte; não invente clientes nem prêmios.
${foco ? 'Foco pedido pela equipe: ' + foco : ''}

MATRIZ ATUAL
${matrizTexto()}

SINAIS DOS DADOS DO STUDIO
${sig.map((s) => `${s.q}: ${s.texto} (${s.evidencia})`).join('\n') || '—'}

Responda só com JSON: [{"q": "S"|"W"|"O"|"T", "texto": "uma frase", "evidencia": "de onde vem ou como validar", "fonte": "URL ou vazio", "certeza": "Fonte pública"|"Dado do Studio"|"Informação interna"|"Hipótese", "peso": 1-3}]`, { json: true, tier: 'complex' });
      if (!Array.isArray(r)) throw new ErroIA('A resposta não veio no formato esperado. Tente de novo.');
      const vistos = new Set(I.map((i) => i.texto.toLowerCase()));
      let n = 0;
      for (const x of r.slice(0, 8)) {
        if (!['S', 'W', 'O', 'T'].includes(x?.q) || !x.texto || vistos.has(String(x.texto).toLowerCase())) continue;
        const cz = CERTEZAS.includes(x.certeza) ? x.certeza : 'Hipótese', fonte = /^https?:\/\//.test(x.fonte || '') ? x.fonte : '';
        if (await novoItem(x.q, String(x.texto).slice(0, 200), { evidencia: String(x.evidencia || '').slice(0, 300), fonte, certeza: fonte ? cz : cz === 'Fonte pública' ? 'Hipótese' : cz, peso: Math.max(1, Math.min(3, Number(x.peso) || 2)), origem: 'Claude' })) n++;
      }
      $('#esIAo').textContent = n ? `${n} item(ns) novo(s) na matriz, marcados como proposta do Claude.` : 'O Claude não trouxe itens novos.';
    } catch (e) { $('#esIAe').textContent = e instanceof ErroIA ? e.message : 'A revisão falhou. Tente de novo.'; }
    finally { b.disabled = false; b.textContent = 'Revisar matriz'; }
  }
  async function cruzar(b: HTMLButtonElement) {
    if (I.length < 4) { $('#esIAe').textContent = 'Preencha a matriz antes de cruzar.'; return; }
    b.disabled = true; b.textContent = 'Cruzando…'; $('#esIAe').textContent = ''; $('#esIAo').textContent = '';
    try {
      const r = await perguntar(`${CONTEXTO}\n\nCruze a SWOT da PRODUCERIA em estratégias TOWS. SO = usar forças para capturar oportunidades; WO = usar oportunidades para corrigir fraquezas; ST = usar forças contra ameaças; WT = reduzir fraquezas expostas a ameaças.
Cada estratégia cita os códigos que cruza (pelo menos um interno e um externo), é concreta para um hub de craft com dois núcleos (offline e online), e termina num primeiro passo de até 2 semanas. Prefira o que gera receita recorrente ou anticíclica. Não repita as existentes.

MATRIZ
${matrizTexto()}

JÁ EXISTEM
${T.map((t) => `${t.tipo}: ${t.titulo}`).join('\n') || '—'}

Responda só com JSON, de 4 a 6 itens, ao menos um por tipo: [{"tipo": "SO"|"WO"|"ST"|"WT", "titulo": "até 8 palavras", "texto": "2 frases", "liga": ["S1","O2"], "passo": "ação de até 2 semanas"}]`, { json: true, tier: 'complex' });
      if (!Array.isArray(r)) throw new ErroIA('A resposta não veio no formato esperado. Tente de novo.');
      const porCod = new Map([...codigos(I).entries()].map(([id, c]) => [c, id]));
      let n = 0;
      for (const x of r.slice(0, 6)) {
        if (!['SO', 'WO', 'ST', 'WT'].includes(x?.tipo) || !x.titulo) continue;
        const id = novoId('tw');
        if (await gravar('tows', id, { id, tipo: x.tipo, titulo: String(x.titulo).slice(0, 90), texto: String(x.texto || '').slice(0, 400), liga: (Array.isArray(x.liga) ? x.liga : []).map((c: unknown) => porCod.get(String(c).toUpperCase())).filter(Boolean), passo: String(x.passo || '').slice(0, 200), origem: 'Claude', em: agora() }, 'set')) n++;
      }
      $('#esIAo').textContent = `${n} estratégia(s) cruzada(s), como hipótese.`;
    } catch (e) { $('#esIAe').textContent = e instanceof ErroIA ? e.message : 'O cruzamento falhou. Tente de novo.'; }
    finally { b.disabled = false; b.textContent = 'Cruzar (TOWS)'; }
  }

  // ---------------------------------------------------------------- eventos
  root.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !root.contains(b) || D.contains(b)) return;
    const d = b.dataset;
    if (d.item) { aberto = aberto === d.item ? '' : d.item; render(); root.querySelector<HTMLElement>(`[data-item="${CSS.escape(d.item)}"]`)?.focus(); return; }
    if (d.sinal) { const s = sinais(projetos, opps).filter((x) => !I.some((i) => i.texto.toLowerCase() === x.texto.toLowerCase()))[Number(d.sinal)]; if (s) await novoItem(s.q, s.texto, { evidencia: s.evidencia, certeza: 'Dado do Studio', origem: 'Studio', peso: 2 }); return; }
    if (d.frente) {
      const t = T.find((x) => x.id === d.frente); if (!t) return;
      const cod = codigos(I), id = novoId('fr');
      if (await gravar('frentes', id, { nome: t.titulo, tese: t.texto, entidade: EMPRESAS[0].nome, tipo: 'Projeto', ativos: t.liga.map((x) => cod.get(x)).filter(Boolean).join(' + '), primeiroPasso: t.passo, potencial: 3, esforco: 3, aderencia: 4, status: 'Hipótese', origem: 'SWOT', tows: t.tipo }, 'set'))
        await gravar('tows', t.id, { frenteId: id }, 'update', 'Virou frente. Ajuste potencial e esforço na lista de frentes.');
      return;
    }
    if (d.tipo !== undefined) { tipo = d.tipo; frentes(); return; }
    if (d.fr) { frAberta = frAberta === d.fr ? '' : d.fr; frentes(); root.querySelector<HTMLElement>(`[data-fr="${CSS.escape(d.fr)}"]`)?.focus(); return; }
    if (d.of) { const o = O.find((x) => x.id === d.of); if (o) abrirOferta(o, b); return; }
    if (b.id === 'esMD') { baixar('swot-produceria.md', markdown()); return; }
    if (b.id === 'esBase') {
      if (!db) { avisar('Sem o banco do Studio: nada foi salvo.'); return; }
      const ids = new Set(I.map((i) => i.id)), tids = new Set(T.map((t) => t.id));
      for (const x of BASE_SWOT) if (!ids.has(x.id)) await db.collection('swot').doc(x.id).set(x);
      for (const x of BASE_TOWS) if (!tids.has(x.id)) await db.collection('tows').doc(x.id).set(x);
      avisar('Base da pesquisa carregada, com fonte em cada item.');
      return;
    }
    if (b.id === 'esRev') { revisar(b as HTMLButtonElement); return; }
    if (b.id === 'esCruz') { cruzar(b as HTMLButtonElement); return; }
    if (b.id === 'esOfN') {
      const id = novoId('of');
      const o: Oferta = { id, nome: 'Nova oferta', resumo: '', publico: '', entregaveis: [], cobranca: 'A definir', ativos: [], status: 'Hipótese', precoAlvo: null };
      if (await gravar('ofertas', id, o, 'set', 'Oferta criada. Preencha os campos.')) abrirOferta(o, b);
    }
  });
  root.addEventListener('submit', async (ev) => {
    const f = ev.target as HTMLFormElement;
    if (!f.classList.contains('es-add')) return;
    ev.preventDefault();
    const inp = f.querySelector('input')!;
    if (await novoItem(f.dataset.q as Q, inp.value)) { inp.value = ''; avisar('Item adicionado.'); }
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement | HTMLSelectElement;
    if (t.dataset.sw) {
      const k = t.dataset.campo!, v = k === 'peso' ? Number(t.value) : k === 'fonte' ? t.value.trim() : t.value;
      gravar('swot', t.dataset.sw, { [k]: v }, 'update', 'Salvo.');
    } else if (t.dataset.frEd) {
      const k = t.dataset.campo!, v = ['potencial', 'esforco', 'aderencia'].includes(k) ? Number(t.value) : t.value;
      gravar('frentes', t.dataset.frEd, { [k]: v }, 'update', 'Salvo.');
    }
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.type === 'range' && t.dataset.frEd) { const s = root.querySelector(`label[for="${t.id}"] .num`); if (s) s.textContent = t.value; }
  });
  const destacar = (el: Element | null) => {
    const a = (el as HTMLElement | null)?.closest<HTMLElement>('.es-tw');
    luz = a ? (a.dataset.liga || '').split(' ').filter(Boolean) : [];
    root.querySelectorAll<HTMLElement>('.es-lista li').forEach((li) => { const id = li.querySelector<HTMLElement>('[data-item]')?.dataset.item || ''; li.classList.toggle('luz', luz.includes(id)); });
  };
  root.addEventListener('mouseover', (ev) => destacar(ev.target as Element));
  root.addEventListener('focusin', (ev) => destacar(ev.target as Element));

  render();
  (async () => {
    db = await banco();
    carregado = true;
    if (!db) { render(); return; }
    const ver = <X>(col: string, f: (L: X[]) => void) => offs.push(db!.collection<X>(col).onSnapshot((s) => { f(s.docs.map(comId) as X[]); agendar(); }, () => {}));
    ver<ItemSwot>('swot', (L) => { I = L; });
    ver<Tows>('tows', (L) => { T = L.map((t) => ({ ...t, liga: t.liga || [] })); });
    ver<Frente>('frentes', (L) => { F = L; });
    ver<Oferta>('ofertas', (L) => { O = L.map((o) => ({ ...o, entregaveis: o.entregaveis || [], ativos: o.ativos || [] })); });
    ver<Projeto>('projetos', (L) => { projetos = L; });
    ver<Opp>('b2g', (L) => { opps = L; });
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
