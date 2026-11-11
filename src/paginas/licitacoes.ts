// Licitações: radar do cérebro (PNCP), carteira de certames, habilitação das empresas do hub e vias de contratação.
import { esc, int, brl, dt } from '../lib/formato';
import { hoje, addDias } from '../lib/datas';
import { banco, type Colecao } from '../lib/db';
import { perguntar, CONTEXTO, ErroIA } from '../lib/ia';
import type { Oportunidade, Habilitacao, Requisito } from '../lib/tipos';
import { seletor, comId, abaNoEndereco, type Dialogo } from './dom';
import { kpis, numero, vazio, abrirDialogo, devolverFoco } from '../componentes';
import { montarPca } from './pca';

// ---------------------------------------------------------------- dados fixos do hub
export const EMPRESAS = [
  { id: 'cria', nome: 'Produceria Cria', cnpj: '15.152.102/0001-08', porte: 'ME', cnaes: ['59.11-1-02', '18.21-1-00', '18.22-9-99'],
    vocacao: 'Núcleo criativo: filmes publicitários, campanhas institucionais, comunicação corporativa, credenciamentos em TVs públicas. Desde 2012.' },
  { id: 'producoes', nome: 'Produceria Produções', cnpj: '27.899.245/0001-59', porte: 'ME', cnaes: ['59.11-1-02', '59.11-1-01', '59.20-1-00', '74.20-0-04', '18.21-1-00', '58.12-3-02', '82.11-3-00', '82.19-9-99'],
    vocacao: 'Braço executor de craft: estúdio cinematográfico, gravação de som e edição de música, filmagem, materiais gráficos. Desde 2017.' },
  { id: 'digitais', nome: 'Produceria Produções Digitais', cnpj: '34.896.941/0001-77', porte: 'ME', cnaes: ['63.19-4-00', '59.11-1-02', '74.20-0-01', '58.22-1-02'],
    vocacao: 'Portais e provedores de conteúdo, DOOH, conteúdo digital, fotografia. Desde 2019.' },
] as const;
const nomeEmpresa = (id: string) => EMPRESAS.find((e) => e.id === id)?.nome.replace('Produceria ', '') ?? id;

export const REQUISITOS = [
  { id: 'cnae', nome: 'Cartão CNPJ ativo e CNAE compatível', nota: 'Divergência entre CNAE e objeto leva à inabilitação.' },
  { id: 'rfb', nome: 'Certidão federal RFB/PGFN', nota: 'Tributos federais e Dívida Ativa da União. Validade de 180 dias.' },
  { id: 'fgts', nome: 'CRF · FGTS', nota: 'Validade de 30 dias: o documento que vence primeiro.' },
  { id: 'cndt', nome: 'CNDT · trabalhista', nota: 'Validade de 180 dias.' },
  { id: 'municipal', nome: 'Certidão municipal (tributos mobiliários)', nota: 'São Paulo: ISS e taxas, por CCM.' },
  { id: 'estadual', nome: 'Certidão estadual', nota: 'SP: débitos não inscritos; validade de 6 meses.' },
  { id: 'balanco', nome: 'Balanço e demonstrações contábeis', nota: 'Exigido em pregões de maior valor.' },
  { id: 'atestados', nome: 'Atestados de capacidade técnica', nota: 'Em papel timbrado do contratante, com volumes e escopo quantificados.' },
  { id: 'cenp', nome: 'Certificado CENP', nota: 'Só para agenciamento de publicidade (Lei 12.232/2010).' },
  { id: 'ancine', nome: 'Registro na ANCINE', nota: 'Credenciamentos audiovisuais de autarquias federais.' },
  { id: 'sicaf', nome: 'Cadastro SICAF / portal de compras', nota: '' },
] as const;

const VIAS = [
  { nome: 'Via direta · Pregão eletrônico + Registro de Preços', texto: 'Grande massa de serviços gráficos, comunicação visual e sinalização (Lei 14.133/2021). A ata congela preços por doze meses e a entrega é sob demanda: exige caixa e mobilização contínua. Documentos só são pedidos de quem termina em primeiro; a intenção de recurso tem janela curtíssima após a habilitação do concorrente.' },
  { nome: 'Via expressa · Dispensas', texto: 'Contratações de menor valor e rito rápido: fotografia, transmissões, banners, placas. Bom para gerar atestados.' },
  { nome: 'Via indireta · Agências (Lei 12.232/2010)', texto: 'Agências de publicidade contratadas pelo governo subcontratam produção. Entrar no cadastro de fornecedores das agências vencedoras de contas públicas (veja o mapa de Vencedores).' },
  { nome: 'Benefícios ME/EPP (LC 123/2006)', texto: 'Cotas reservadas e preferência no desempate para micro e pequenas empresas. As empresas do hub estão enquadradas como ME: confirmar a situação atual.' },
];

export const ETAPAS = ['Triagem', 'Go / No-go', 'Proposta', 'Sessão', 'Resultado'] as const;
export const MOTIVOS_DESCARTE = ['Fora do escopo', 'Valor baixo', 'Prazo curto', 'Não habilita', 'Preço ou concorrência', 'Outro'];
const FRENTES_MANUAIS = ['Produção audiovisual e filmes', 'Mixagem sonora para audiovisual', 'Fotografia e cobertura de imagem', 'Arte-finalização e produção gráfica',
  'Comunicação visual e sinalização', 'Conteúdo digital, portais e publicação', 'Mídia exterior OOH/DOOH', 'Campanhas públicas e fornecimento para agências'];

/** Situação de um requisito considerando a validade: pendente, em dia, vence em 30 dias, vencida ou não se aplica. */
export function situacao(r?: Requisito): 'pendente' | 'ok' | 'vence' | 'vencida' | 'na' {
  if (!r || r.status === 'pendente') return 'pendente';
  if (r.status === 'na') return 'na';
  if (r.validade && r.validade < hoje()) return 'vencida';
  if (r.validade && r.validade <= addDias(hoje(), 30)) return 'vence';
  return 'ok';
}
/** Certidões e cadastros vencidos ou que vencem em 30 dias, por empresa do hub (para o Início e avisos). */
export function alertasHabilitacao(hab: Habilitacao[], h = hoje()): { empresa: string; requisito: string; situacao: 'vencida' | 'vence'; validade: string }[] {
  const out: { empresa: string; requisito: string; situacao: 'vencida' | 'vence'; validade: string }[] = [];
  for (const e of EMPRESAS) {
    const doc = hab.find((x) => x.id === e.id);
    for (const r of REQUISITOS) {
      const q = doc?.req?.[r.id];
      if (!q || q.status !== 'ok' || !q.validade) continue;
      const s = q.validade < h ? 'vencida' : q.validade <= addDias(h, 30) ? 'vence' : null;
      if (s) out.push({ empresa: e.nome, requisito: r.nome, situacao: s, validade: q.validade });
    }
  }
  return out.sort((a, b) => a.validade.localeCompare(b.validade));
}

const SIT_TXT = { pendente: 'Pendente', ok: 'Em dia', vence: 'Vence em 30 dias', vencida: 'Vencida', na: 'Não se aplica' } as const;
const SIT_CLS = { pendente: 'erro', ok: 'ok', vence: 'aviso', vencida: 'erro', na: '' } as const;
const PROX_STATUS = { pendente: 'ok', ok: 'na', na: 'pendente' } as const;

const frenteDe = (o: Oportunidade) => o.frenteCerebro || o.frente || 'Sem frente';
const aberta = (o: Oportunidade) => !o.prazo || o.prazo.slice(0, 10) >= hoje();
const vencida = (o: Oportunidade) => !!o.prazo && o.prazo.slice(0, 10) < hoje();
const valorTxt = (v?: number | null) => (v ? brl(v) : 'Sem valor');

/** Filtro do radar, exportado para teste. */
export interface FiltroRadar { frente: string; aderencia: '' | 'direta' | 'condicionada'; nota60: boolean; abertas: boolean; estudio: boolean; descartadas: boolean; q: string; ordem: 'nota' | 'prazo' | 'recentes' }
export function filtrarRadar(L: Oportunidade[], f: FiltroRadar): Oportunidade[] {
  const q = f.q.trim().toLowerCase();
  return L.filter((o) => (f.descartadas ? o.triagem === 'Descartar' : o.triagem !== 'Descartar'))
    .filter((o) => !f.frente || frenteDe(o) === f.frente)
    .filter((o) => !f.aderencia || o.aderencia === f.aderencia)
    .filter((o) => !f.abertas || aberta(o))
    .filter((o) => !f.nota60 || o.carteira || (o.score ?? 100) >= 60)
    .filter((o) => !f.estudio || (o.craft ?? 0) >= 0.6)
    .filter((o) => !q || `${o.objeto} ${o.orgao} ${o.uf} ${o.municipio || ''}`.toLowerCase().includes(q))
    .sort((a, b) => f.ordem === 'nota' ? (b.score ?? -1) - (a.score ?? -1)
      : f.ordem === 'prazo' ? (a.prazo || '9999').localeCompare(b.prazo || '9999')
      : (b.publicado || '').localeCompare(a.publicado || ''));
}

type Aba = 'radar' | 'carteira' | 'habilitacao' | 'pca' | 'vias';
interface Status { ultimaVarredura?: string; lidos?: number; novos?: number; erro?: string; perfil?: string }

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap lc">
  <div class="pills lc-abas" role="tablist" aria-label="Licitações" id="lcA"></div>
  <p class="sr" id="lcLive" aria-live="polite" aria-atomic="true"></p>
  <div id="lcO"></div>
</div><dialog id="lcD" aria-labelledby="lcDT"></dialog>`;
  const $ = seletor(root);
  let O: Oportunidade[] = [], H: Habilitacao[] = [], st: Status = {};
  let col: Colecao<Oportunidade> | null = null, colH: Colecao<Habilitacao> | null = null;
  const offs: (() => void)[] = [];
  let carregando = true, limite = 60;
  let desPca: (() => void) | null = null;
  let aba: Aba = 'radar';
  const abas = abaNoEndereco<Aba>(['radar', 'carteira', 'habilitacao', 'pca', 'vias'], 'radar', (a) => { aba = a; render(); });
  aba = abas.inicial;
  const F: FiltroRadar = { frente: '', aderencia: '', nota60: true, abertas: true, estudio: false, descartadas: false, q: '', ordem: 'nota' };
  const avisar = (t: string) => { $('#lcLive').textContent = t; };
  const D = $<Dialogo>('#lcD');
  D.addEventListener('close', () => render()); // o radar pode ter mudado enquanto o diálogo estava aberto
  let ultimoAberto = '';
  devolverFoco(D, () => (ultimoAberto && root.querySelector<HTMLElement>(`[data-abre="${CSS.escape(ultimoAberto)}"]`)) || $<HTMLElement>('#lcA [aria-selected=true]'));

  async function gravar(id: string, d: Partial<Oportunidade>, aviso: string) {
    if (col) {
      try { await col.doc(id).update(d); } catch { avisar('Não foi possível salvar. Tente de novo.'); return; }
    } else {
      O = O.map((o) => (o.id === id ? { ...o, ...d } : o));
      render();
    }
    avisar(aviso);
  }

  // ---------------------------------------------------------------- abas
  function render() {
    try { localStorage.setItem('lc.aba', aba); } catch { /* sem armazenamento */ }
    const cart = O.filter((o) => o.carteira).length;
    const abas: [Aba, string][] = [['radar', `Radar (${int(O.filter((o) => o.triagem !== 'Descartar').length)})`], ['carteira', `Carteira (${int(cart)})`], ['habilitacao', 'Habilitação do hub'], ['pca', 'PCA dos órgãos'], ['vias', 'Vias de contratação']];
    $('#lcA').innerHTML = abas.map(([v, t]) => `<button type="button" role="tab" id="lc-tab-${v}" aria-selected="${aba === v}" aria-pressed="${aba === v}" aria-controls="lcO" data-aba="${v}">${t}</button>`).join('');
    const o = $('#lcO');
    o.setAttribute('role', 'tabpanel');
    o.setAttribute('aria-labelledby', 'lc-tab-' + aba);
    // a aba do PCA é um módulo com estado próprio: monta uma vez e não é refeita quando o radar muda
    if (aba === 'pca') { if (!desPca) { o.innerHTML = '<div class="lc-pca"></div>'; desPca = montarPca(o.firstElementChild as HTMLElement, avisar); } return; }
    if (desPca) { desPca(); desPca = null; }
    o.innerHTML = aba === 'radar' ? radar() : aba === 'carteira' ? carteira() : aba === 'habilitacao' ? habilitacao() : vias();
  }

  // ---------------------------------------------------------------- radar
  function radar(): string {
    const vivos = O.filter((o) => o.triagem !== 'Descartar');
    const estudio = vivos.filter((o) => (o.craft ?? 0) >= 0.6);
    const comValor = vivos.filter((o) => o.valor);
    const ticket = comValor.length ? comValor.reduce((s, o) => s + (o.valor || 0), 0) / comValor.length : 0;
    const abertas = vivos.filter((o) => o.prazo && aberta(o));
    const fora60 = vivos.filter((o) => (o.score ?? 100) < 60 && !o.carteira).length;
    const descartadas = O.filter((o) => o.triagem === 'Descartar').length;
    const porFrente = [...new Set(vivos.filter((o) => (o.score ?? 0) > 0).map(frenteDe))]
      .map((f) => ({ f, n: vivos.filter((o) => frenteDe(o) === f && (o.score ?? 0) > 0).length }))
      .sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...porFrente.map((x) => x.n));
    const L = filtrarRadar(O, F);
    const mostra = L.slice(0, limite);
    const varredura = st.ultimaVarredura
      ? `Última varredura no PNCP: ${dt(st.ultimaVarredura)} ${st.ultimaVarredura.slice(11, 16)} · ${int(st.lidos ?? 0)} lidos · ${int(st.novos ?? 0)} novos${st.perfil ? ' · perfil ' + esc(st.perfil) : ''}${st.erro ? ' · ' + esc(st.erro) : ''}`
      : 'Varredura diária no PNCP ainda não registrada.';
    const chip = (id: string, txt: string, on: boolean, dica = '') => `<button type="button" class="chip" data-tg="${id}" aria-pressed="${on}"${dica ? ` title="${esc(dica)}"` : ''}>${txt}</button>`;
    return `<section class="kpis" aria-label="Resumo do radar">${kpis([
      { rotulo: 'Oportunidades no radar', valor: numero(int(vivos.length)), nota: `${int(descartadas)} descartadas pela equipe` },
      { rotulo: 'Trabalho de estúdio', valor: numero(int(estudio.length)), nota: 'craft 60 ou mais: filme, foto, transmissão, arte, som, conteúdo' },
      { rotulo: 'Ticket médio estimado', valor: ticket ? numero(brl(ticket)) : '<b class="nd">—</b>', nota: `${int(comValor.length)} com valor divulgado` },
      { rotulo: 'Abertas hoje', valor: numero(int(abertas.length)), nota: 'com prazo de recebimento futuro' },
    ])}</section>
  <div class="grid">
    <section class="p" aria-labelledby="lc-dem"><div class="ph"><h2 class="d d-sub" id="lc-dem">Onde está a demanda</h2><span class="note">por frente · com nota acima de zero</span></div>
      <ul class="bars">${porFrente.length ? porFrente.map((x) => `<li><button type="button" class="row" data-fr="${esc(x.f)}" aria-pressed="${F.frente === x.f}"><span class="n">${esc(x.f)}</span><span class="t"><i style="width:${(x.n / max * 100).toFixed(1)}%"></i></span><em>${int(x.n)}</em></button></li>`).join('') : '<li class="vazio">Sem oportunidades pontuadas.</li>'}</ul></section>
    <section class="p lc-cerebro" aria-labelledby="lc-cb"><div class="ph"><h2 class="d d-sub" id="lc-cb">Cérebro de licitações</h2></div>
      <p>Entra no radar o que o próprio objeto pede e uma empresa do hub pode atender: audiovisual, fotografia, transmissão, conteúdo, som, direção de arte, comunicação visual e mídia exterior. Eventos, gráfica em massa, agência de publicidade, cursos, software e obras ficam fora.</p>
      <p class="note">Nota de 0 a 100: craft da frente (45), aderência pelo CNAE das empresas (20), valor (15), prazo para propor (10) e recorrência (10). Perdem pontos o objeto misto, o serviço pequeno longe de SP e os valores abaixo de R$ 5 mil ou acima de R$ 10 mi.</p>
      <p class="note lc-varr">${varredura}</p>
      <div class="acts"><button type="button" id="lcEd">Ler edital ou aviso</button></div></section>
  </div>
  <section aria-label="Oportunidades">
    <div class="lc-filtros">
      <div class="seg sm" role="group" aria-label="Aderência">${(['', 'direta', 'condicionada'] as const).map((v) => `<button type="button" data-ad="${v}" aria-pressed="${F.aderencia === v}">${v === '' ? 'Todas' : v === 'direta' ? 'Aderência direta' : 'Condicionada'}</button>`).join('')}</div>
      ${chip('nota60', `Nota 60 ou mais · ${int(fora60)} fora`, F.nota60, 'Esconde o que tem nota abaixo de 60 (as da carteira sempre aparecem)')}
      ${chip('abertas', 'Só com prazo aberto', F.abertas)}
      ${chip('estudio', 'Só estúdio', F.estudio)}
      ${chip('descartadas', `Descartadas (${int(descartadas)})`, F.descartadas, 'Mostra só o que a equipe descartou, para revisar ou desfazer')}
      <div class="f lc-ord"><label for="lcOrd">Ordenar</label><select id="lcOrd"><option value="nota"${F.ordem === 'nota' ? ' selected' : ''}>Maior nota</option><option value="prazo"${F.ordem === 'prazo' ? ' selected' : ''}>Prazo mais próximo</option><option value="recentes"${F.ordem === 'recentes' ? ' selected' : ''}>Mais recentes</option></select></div>
      <div class="f lc-q"><label for="lcQ">Buscar órgão, objeto ou UF</label><input id="lcQ" type="search" value="${esc(F.q)}" autocomplete="off"></div>
    </div>
    ${F.frente ? `<p class="note">Filtrando por <b>${esc(F.frente)}</b> · <button type="button" class="lnk" data-fr="">limpar</button></p>` : ''}
    ${carregando ? '<p class="note">Carregando o radar…</p>' : L.length ? `<ul class="lc-l">${mostra.map(item).join('')}</ul>${L.length > limite ? `<p class="mais"><button type="button" class="ghost" id="lcMais">Mostrar mais ${int(Math.min(60, L.length - limite))} de ${int(L.length - limite)}</button></p>` : ''}`
      : vazio({ titulo: O.length ? 'Nada com esses filtros' : 'Radar vazio', texto: O.length ? 'Afrouxe os filtros acima ou busque por outro termo.' : 'A varredura diária do PNCP grava aqui. Para registrar uma oportunidade à mão, cole o texto do aviso.', acao: '<button type="button" class="ghost sm" id="lcEd2">Ler edital ou aviso</button>' })}
  </section>`;
  }

  function item(o: Oportunidade): string {
    const tags = [
      `<span class="tag ${o.aderencia === 'direta' ? 'ok' : 'aviso'}">${o.aderencia === 'direta' ? 'Aderência direta' : 'Aderência condicionada'}</span>`,
      vencida(o) ? '<span class="tag erro">Prazo vencido</span>' : o.prazo ? '<span class="tag">Aberta</span>' : '<span class="tag">Prazo não informado</span>',
      o.carteira ? '<span class="tag pub">Na carteira</span>' : '',
      o.triagem === 'Monitorar' && !o.carteira ? '<span class="tag aviso">Monitorando</span>' : '',
      o.triagem === 'Descartar' ? `<span class="tag erro">Descartada · ${esc(o.motivoDescarte || '')}</span>` : '',
    ].join('');
    const meta = [o.orgao, [o.modalidade, o.srp ? 'registro de preços' : ''].filter(Boolean).join(' · '), (o.municipio ? o.municipio + '/' : '') + (o.uf || ''), frenteDe(o), (o.entidades || []).map(nomeEmpresa).join(', ')].filter(Boolean).map(esc).join(' · ');
    const acoes = o.triagem === 'Descartar'
      ? `<button type="button" class="lnk" data-desf="${esc(o.id)}">Desfazer descarte</button>`
      : o.carteira ? '<span class="note">Siga pela carteira</span>'
      : `<button type="button" class="sm" data-disp="${esc(o.id)}">Disputar</button>${o.triagem === 'Monitorar' ? '' : `<button type="button" class="ghost sm" data-mon="${esc(o.id)}">Monitorar</button>`}<select class="lc-desc" data-desc="${esc(o.id)}" aria-label="Descartar com motivo"><option value="">Descartar…</option>${MOTIVOS_DESCARTE.map((m) => `<option>${m}</option>`).join('')}</select>`;
    return `<li class="lc-it"><div class="lc-c"><div class="lc-tags">${tags}</div><p class="lc-obj">${esc(o.objeto)}</p><p class="note">${meta}</p>${o.motivo ? `<p class="note">Cérebro: ${esc(o.motivo)}</p>` : o.nota ? `<p class="note">${esc(o.nota)}</p>` : ''}</div>
    <div class="lc-v">${o.score != null ? `<span class="lc-nota${o.score >= 65 ? ' alta' : ''}"><b>${o.score}</b> nota</span>` : ''}<span class="lc-val num">${valorTxt(o.valor)}</span><span class="note num">${o.prazo ? 'até ' + dt(o.prazo) : 'publicado ' + dt(o.publicado || '')}</span>
    <div class="lc-acts">${o.url ? `<a class="cn-f" href="${esc(o.url)}" target="_blank" rel="noopener">PNCP ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}${acoes}</div></div></li>`;
  }

  // ---------------------------------------------------------------- carteira
  function carteira(): string {
    const C = O.filter((o) => o.carteira);
    if (!C.length) return vazio({ titulo: 'Carteira vazia', texto: 'Use Disputar no Radar. Cada oportunidade passa por triagem, decisão go/no-go, proposta, sessão e resultado.' });
    return `<div class="lc-kanban">${ETAPAS.map((et) => {
      const L = C.filter((o) => (o.etapa || 'Triagem') === et);
      const soma = L.reduce((s, o) => s + (o.valor || 0), 0);
      return `<section class="lc-col${et === 'Proposta' || et === 'Sessão' ? ' quente' : ''}" aria-label="${et}"><div class="lc-colh"><span class="lab">${et}</span><span class="note num">${int(L.length)} · ${soma ? brl(soma) : 'sem valor'}</span></div>
      ${L.map((o) => `<div class="lc-card"><button type="button" class="nm" data-abre="${esc(o.id)}">${esc(o.objeto.slice(0, 120))}${o.objeto.length > 120 ? '…' : ''}</button><span class="note">${esc(o.orgao)} · ${esc(o.uf || '')}</span>
        <div class="lc-tags"><span class="note num">${valorTxt(o.valor)}</span>${o.decisao ? `<span class="tag ${o.decisao === 'Go' ? 'ok' : 'erro'}">${esc(o.decisao)}</span>` : ''}${vencida(o) ? '<span class="tag erro">Vencido</span>' : ''}</div>
        <div class="lc-mv"><button type="button" class="ghost sm" data-et="${esc(o.id)}" data-d="-1" ${et === ETAPAS[0] ? 'disabled' : ''} aria-label="Etapa anterior">←</button><button type="button" class="ghost sm" data-et="${esc(o.id)}" data-d="1" ${et === 'Resultado' ? 'disabled' : ''} aria-label="Próxima etapa">→</button></div></div>`).join('')}</section>`;
    }).join('')}</div>`;
  }

  function resumoHabilitacao(ents: string[]): string {
    if (!ents.length) return 'Nenhuma empresa associada.';
    return ents.map((id) => {
      const h = H.find((x) => x.id === id);
      const faltas = REQUISITOS.filter((r) => ['pendente', 'vencida'].includes(situacao(h?.req?.[r.id]))).map((r) => r.nome + (situacao(h?.req?.[r.id]) === 'vencida' ? ' (vencida)' : ''));
      return `${nomeEmpresa(id)}: ${faltas.length ? 'pendente — ' + faltas.join(', ') : 'tudo registrado como em dia'}`;
    }).join('\n');
  }

  function detalhe(id: string, quem: HTMLElement | null) {
    const o = O.find((x) => x.id === id);
    if (!o) return;
    const hab = resumoHabilitacao(o.entidades || []);
    abrirDialogo(D, `<div class="dh"><div><span class="lab">${esc(o.orgao)} · ${esc(o.uf || '')}</span><h2 class="d d-sub" id="lcDT">${esc(o.objeto.slice(0, 90))}${o.objeto.length > 90 ? '…' : ''}</h2></div><button type="button" class="x" id="lcX" aria-label="Fechar">×</button></div>
    <dl class="det"><div><dt>Valor estimado</dt><dd>${o.valor ? brl(o.valor) : '—'}</dd></div><div><dt>Prazo</dt><dd>${o.prazo ? dt(o.prazo) : '—'}</dd></div><div><dt>Etapa</dt><dd>${esc(o.etapa || 'Triagem')}</dd></div></dl>
    <p class="obs">${esc(o.objeto)}</p>
    <p class="note">${[o.modalidade, frenteDe(o), 'aderência ' + (o.aderencia || '—'), (o.entidades || []).map(nomeEmpresa).join(', ') || 'sem empresa associada', o.ref ? 'Ref. PNCP ' + o.ref : ''].filter(Boolean).map(esc).join(' · ')}</p>
    ${o.url ? `<p><a class="cn-f" href="${esc(o.url)}" target="_blank" rel="noopener">Abrir fonte oficial ↗<span class="sr"> (abre em nova aba)</span></a></p>` : ''}
    <div class="det fm"><div class="f"><label for="lcDec">Decisão</label><select id="lcDec"><option value="">Em análise</option><option${o.decisao === 'Go' ? ' selected' : ''}>Go</option><option${o.decisao === 'No-go' ? ' selected' : ''}>No-go</option></select></div>
    <div class="f"><label for="lcProx">Próxima ação</label><input id="lcProx" value="${esc(o.proxAcao || '')}"></div></div>
    <div class="lc-box"><span class="lab">Habilitação registrada</span><p class="lc-pre">${esc(hab)}</p></div>
    <div class="dacts"><button type="button" id="lcIA">${o.analise ? 'Refazer análise go/no-go' : 'Análise go/no-go com IA'}</button></div>
    <p class="erro" id="lcIAe" role="alert"></p>
    <div class="lc-box" id="lcIAo"${o.analise ? '' : ' hidden'}><span class="lab">Última análise</span><p class="lc-pre" id="lcIAt">${esc(o.analise || '')}</p></div>
    <div class="dacts fim"><button type="button" class="ghost perigo" id="lcTira">Tirar da carteira</button></div>`, quem, '#lcX');
    $('#lcX').onclick = () => D.close();
    $<HTMLSelectElement>('#lcDec').onchange = (e) => gravar(o.id, { decisao: (e.target as HTMLSelectElement).value }, 'Decisão salva.');
    $<HTMLInputElement>('#lcProx').onblur = (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (v !== (o.proxAcao || '')) gravar(o.id, { proxAcao: v }, 'Próxima ação salva.');
    };
    $('#lcTira').onclick = async () => { await gravar(o.id, { carteira: false }, 'Removida da carteira; continua no radar.'); D.close(); };
    const bIA = $<HTMLButtonElement>('#lcIA');
    bIA.onclick = async () => {
      bIA.disabled = true; bIA.textContent = 'Analisando…'; $('#lcIAe').textContent = '';
      $('#lcIAo').hidden = false; $('#lcIAt').textContent = '';
      try {
        const txt = await perguntar(`${CONTEXTO}

Faça uma análise GO / NO-GO preliminar desta oportunidade pública para o hub PRODUCERIA. Seja direto.
Oportunidade: ${o.objeto}
Órgão: ${o.orgao} · ${o.modalidade || ''} · UF ${o.uf || ''} · valor estimado ${o.valor == null ? 'não divulgado' : 'R$ ' + o.valor.toFixed(2)} · prazo ${o.prazo || 'não informado'}
Frente: ${frenteDe(o)} · aderência ${o.aderencia || '—'} · empresas potencialmente aderentes: ${(o.entidades || []).join(', ') || 'nenhuma'}
Motivo da nota do cérebro: ${o.motivo || '—'}
Situação de habilitação registrada no Studio:
${hab}

Estruture: Recomendação (GO, GO com condições ou NO-GO) · Por quê (3 a 5 pontos) · Riscos de habilitação · O que conferir no edital · Margem e caixa (sem inventar números) · Atestado que esta oportunidade pode gerar. Lembre que prazos e regras precisam ser confirmados no edital vigente.`, { tier: 'complex', aoEscrever: (t) => { $('#lcIAt').textContent = t; } });
        $('#lcIAt').textContent = String(txt);
        await gravar(o.id, { analise: String(txt) }, 'Análise salva.');
      } catch (e) {
        $('#lcIAe').textContent = e instanceof ErroIA ? e.message : 'A análise falhou. Tente de novo.';
        if (!o.analise) $('#lcIAo').hidden = true;
      } finally { bIA.disabled = false; bIA.textContent = 'Refazer análise go/no-go'; }
    };
  }

  // ---------------------------------------------------------------- habilitação
  function habilitacao(): string {
    const sits = EMPRESAS.flatMap((e) => REQUISITOS.map((r) => situacao(H.find((h) => h.id === e.id)?.req?.[r.id])));
    const total = sits.length, emDia = sits.filter((s) => s === 'ok' || s === 'vence').length;
    const venc = sits.filter((s) => s === 'vencida').length, vence = sits.filter((s) => s === 'vence').length;
    return `<section class="kpis" aria-label="Resumo da habilitação">${kpis([
      { rotulo: 'Requisitos em dia', valor: numero(`${emDia}/${total}`), nota: 'clique no status para alternar' },
      { rotulo: 'Vencidas', valor: numero(int(venc)), nota: 'reemitir antes da próxima sessão' },
      { rotulo: 'Vencem em 30 dias', valor: numero(int(vence)), nota: 'o FGTS vale só 30 dias' },
      { rotulo: 'Empresas', valor: numero(int(EMPRESAS.length)), nota: 'todas ME' },
    ])}</section>
    <div class="tw" tabindex="0" role="region" aria-label="Requisitos por empresa"><table class="lc-hab"><thead><tr><th scope="col"><span class="th">Requisito</span></th>${EMPRESAS.map((e) => `<th scope="col"><span class="th">${esc(e.nome.replace('Produceria ', ''))}</span></th>`).join('')}</tr></thead><tbody>
    ${REQUISITOS.map((r) => `<tr><th scope="row"><span class="lc-req">${esc(r.nome)}</span>${r.nota ? `<span class="sub">${esc(r.nota)}</span>` : ''}</th>${EMPRESAS.map((e) => {
      const q = H.find((h) => h.id === e.id)?.req?.[r.id] || { status: 'pendente' as const };
      const s = situacao(q);
      return `<td><button type="button" class="lnk lc-st" data-hab="${e.id}" data-req="${r.id}" aria-label="${esc(r.nome)} · ${esc(e.nome)}: ${SIT_TXT[s]}. Alternar."><span class="tag ${SIT_CLS[s]}">${SIT_TXT[s]}</span></button>${q.status === 'ok' && r.id !== 'cnae' ? `<input type="date" class="lc-val-d" data-val="${e.id}" data-req="${r.id}" aria-label="Validade · ${esc(r.nome)} · ${esc(e.nome)}" value="${esc(q.validade || '')}">` : ''}${q.nota ? `<span class="sub">${esc(q.nota)}</span>` : ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="lc-emp">${EMPRESAS.map((e) => `<div class="p"><h3 class="d d-sub">${esc(e.nome)}</h3><p class="note num">CNPJ ${e.cnpj} · ${e.porte} · CNAE ${e.cnaes.join(' · ')}</p><p class="note">${esc(e.vocacao)}</p></div>`).join('')}</div>`;
  }

  async function mudarRequisito(emp: string, req: string, d: Partial<Requisito>) {
    const h = H.find((x) => x.id === emp);
    const atual = h?.req?.[req] || { status: 'pendente' as const };
    const novo: Habilitacao = { id: emp, req: { ...(h?.req || {}), [req]: { ...atual, ...d } } };
    if (colH) {
      try { await colH.doc(emp).set({ req: novo.req }); } catch { avisar('Não foi possível salvar.'); return; }
    } else { H = H.filter((x) => x.id !== emp).concat([novo]); render(); }
    avisar('Habilitação atualizada.');
  }

  // ---------------------------------------------------------------- vias
  function vias(): string {
    return `<ol class="lc-vias">${VIAS.map((v) => `<li><h3 class="d d-sub">${esc(v.nome)}</h3><p>${esc(v.texto)}</p></li>`).join('')}</ol>
    <p class="note">Resumo do Relatório Estratégico de Oportunidades Licitatórias. Leis, limites e prazos mudam: confirme no edital vigente e com assessoria jurídica antes de decidir.</p>`;
  }

  // ---------------------------------------------------------------- ler edital
  function lerEdital(quem: HTMLElement | null) {
    let ents: string[] = [];
    abrirDialogo(D, `<div class="dh"><div><span class="lab">Nova oportunidade</span><h2 class="d d-sub" id="lcDT">Ler edital ou aviso</h2></div><button type="button" class="x" id="lcX" aria-label="Fechar">×</button></div>
    <form id="lcF" novalidate>
    <div class="f"><label for="ed_txt">Texto do aviso, edital ou termo de referência</label><span class="hint">Cole o trecho com objeto, órgão, valor e prazos.</span><textarea id="ed_txt" rows="7"></textarea></div>
    <div class="dacts"><button type="button" class="ghost" id="ed_ia">Extrair dados com IA</button></div>
    <p class="erro" id="ed_iae" role="alert"></p>
    <div class="det fm">
      <div class="f full"><label for="ed_obj">Objeto *</label><input id="ed_obj" required></div>
      <div class="f"><label for="ed_org">Órgão *</label><input id="ed_org" required></div>
      <div class="f"><label for="ed_mod">Modalidade</label><input id="ed_mod" value="Dispensa"></div>
      <div class="f"><label for="ed_uf">UF</label><input id="ed_uf" maxlength="2"></div>
      <div class="f"><label for="ed_val">Valor estimado (R$)</label><input id="ed_val" inputmode="decimal"></div>
      <div class="f"><label for="ed_prazo">Prazo de recebimento</label><input id="ed_prazo" type="date"></div>
      <div class="f"><label for="ed_fr">Frente</label><select id="ed_fr">${FRENTES_MANUAIS.map((f) => `<option>${esc(f)}</option>`).join('')}</select></div>
      <div class="f"><label for="ed_url">Link oficial</label><input id="ed_url" type="url" placeholder="https://pncp.gov.br/…"></div>
    </div>
    <fieldset class="f rs"><legend class="lab">Empresas que podem disputar</legend><div class="acts" id="ed_ents">${EMPRESAS.map((e) => `<button type="button" class="chip" data-ent="${e.id}" aria-pressed="false">${esc(e.nome.replace('Produceria ', ''))}</button>`).join('')}</div></fieldset>
    <p class="note" id="ed_req"></p>
    <p class="erro" id="ed_e" role="alert"></p>
    <div class="dacts fim"><button type="button" class="ghost" id="ed_x">Cancelar</button><button type="submit">Registrar na carteira</button></div></form>`, quem, '#ed_txt');
    let nota = '', requisitos: string[] = [];
    const v = (id: string) => $<HTMLInputElement>('#' + id);
    $('#lcX').onclick = $('#ed_x').onclick = () => D.close();
    $('#ed_ents').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ent]');
      if (!b) return;
      const id = b.dataset.ent!;
      ents = ents.includes(id) ? ents.filter((x) => x !== id) : [...ents, id];
      b.setAttribute('aria-pressed', String(ents.includes(id)));
    };
    const bIA = $<HTMLButtonElement>('#ed_ia');
    bIA.onclick = async () => {
      const txt = v('ed_txt').value.trim();
      $('#ed_iae').textContent = '';
      if (txt.length < 40) { $('#ed_iae').textContent = 'Cole o texto do aviso ou do termo de referência.'; return; }
      bIA.disabled = true; bIA.textContent = 'Lendo…';
      try {
        const r = (await perguntar(`Leia o trecho de edital/aviso de contratação pública abaixo e extraia dados para a carteira de licitações da PRODUCERIA.
Frentes possíveis: ${FRENTES_MANUAIS.join('; ')}.
Empresas do hub e CNAEs: ${EMPRESAS.map((e) => `${e.id}=${e.nome} [${e.cnaes.join(', ')}]`).join('; ')}.
Responda só com JSON: {"objeto": "...", "orgao": "...", "modalidade": "...", "uf": "XX", "valor": number|null, "prazo": "AAAA-MM-DD"|null, "frente": "<uma das frentes>", "aderencia": "direta"|"condicionada", "entidades": ["cria"|"producoes"|"digitais"], "requisitos": ["requisito de habilitação citado"], "nota": "uma frase sobre riscos ou o que conferir"}.
Use null quando o texto não informar. Não invente valores nem datas.

TEXTO:
${txt.slice(0, 30000)}`, { json: true })) as Record<string, unknown> | null;
        if (r && typeof r === 'object') {
          const put = (id: string, x: unknown) => { if (x != null && x !== '') v(id).value = String(x); };
          put('ed_obj', r.objeto); put('ed_org', r.orgao); put('ed_mod', r.modalidade); put('ed_uf', r.uf);
          if (typeof r.valor === 'number') v('ed_val').value = String(r.valor);
          if (typeof r.prazo === 'string') v('ed_prazo').value = r.prazo.slice(0, 10);
          if (typeof r.frente === 'string' && FRENTES_MANUAIS.includes(r.frente)) $<HTMLSelectElement>('#ed_fr').value = r.frente;
          ents = Array.isArray(r.entidades) ? r.entidades.filter((x): x is string => EMPRESAS.some((e) => e.id === x)) : [];
          root.querySelectorAll<HTMLElement>('#ed_ents [data-ent]').forEach((b) => b.setAttribute('aria-pressed', String(ents.includes(b.dataset.ent!))));
          nota = typeof r.nota === 'string' ? r.nota : '';
          requisitos = Array.isArray(r.requisitos) ? r.requisitos.map(String) : [];
          $('#ed_req').textContent = requisitos.length ? 'Requisitos citados: ' + requisitos.join('; ') : '';
        }
      } catch (e) {
        $('#ed_iae').textContent = e instanceof ErroIA ? e.message : 'A leitura falhou. Preencha os campos à mão.';
      } finally { bIA.disabled = false; bIA.textContent = 'Extrair dados com IA'; }
    };
    $<HTMLFormElement>('#lcF').onsubmit = async (e) => {
      e.preventDefault();
      const obj = v('ed_obj').value.trim(), org = v('ed_org').value.trim();
      D.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
      if (!obj || !org) {
        if (!obj) v('ed_obj').setAttribute('aria-invalid', 'true');
        if (!org) v('ed_org').setAttribute('aria-invalid', 'true');
        $('#ed_e').textContent = 'Objeto e órgão são obrigatórios.';
        (obj ? v('ed_org') : v('ed_obj')).focus();
        return;
      }
      const valor = Number(v('ed_val').value.replace(/\./g, '').replace(',', '.')) || null;
      const id = 'op-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const doc: Oportunidade = {
        id, objeto: obj, orgao: org, modalidade: v('ed_mod').value.trim(), uf: v('ed_uf').value.trim().toUpperCase().slice(0, 2), valor,
        prazo: v('ed_prazo').value || null, publicado: hoje(), frente: $<HTMLSelectElement>('#ed_fr').value, aderencia: ents.length ? 'direta' : 'condicionada',
        entidades: ents, ref: '', url: v('ed_url').value.trim(), nota: [nota, requisitos.length ? 'Requisitos citados: ' + requisitos.join('; ') : ''].filter(Boolean).join(' '),
        fonte: 'Equipe', carteira: true, etapa: 'Triagem', decisao: '', triagem: 'Disputar', triadoEm: new Date().toISOString(),
      };
      if (col) {
        try { await col.doc(id).set(doc); } catch { $('#ed_e').textContent = 'Não foi possível salvar.'; return; }
      } else { O = [doc, ...O]; }
      D.close(); aba = 'carteira'; render(); avisar('Oportunidade registrada na carteira.');
    };
  }

  // ---------------------------------------------------------------- eventos
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !root.contains(b) || D.contains(b)) return;
    const d = b.dataset;
    if (d.aba) { abas.ir(d.aba as Aba); $<HTMLElement>('#lc-tab-' + aba).focus(); return; }
    if (d.fr !== undefined) { F.frente = F.frente === d.fr ? '' : d.fr; limite = 60; render(); return; }
    if (d.ad !== undefined) { F.aderencia = d.ad as FiltroRadar['aderencia']; limite = 60; render(); return; }
    if (d.tg) { const k = d.tg as 'nota60' | 'abertas' | 'estudio' | 'descartadas'; F[k] = !F[k]; limite = 60; render(); return; }
    if (b.id === 'lcMais') { limite += 60; render(); return; }
    if (b.id === 'lcEd' || b.id === 'lcEd2') { lerEdital(b); return; }
    if (d.disp) { gravar(d.disp, { carteira: true, etapa: 'Triagem', decisao: '', triagem: 'Disputar', triadoEm: new Date().toISOString() }, 'Disputar: na carteira, etapa Triagem.'); return; }
    if (d.mon) { gravar(d.mon, { triagem: 'Monitorar', triadoEm: new Date().toISOString() }, 'Monitorando esta oportunidade.'); return; }
    if (d.desf) { gravar(d.desf, { triagem: '', motivoDescarte: '', triadoEm: new Date().toISOString() }, 'Descarte desfeito.'); return; }
    if (d.abre) { ultimoAberto = d.abre; detalhe(d.abre, b); return; }
    if (d.et) {
      const o = O.find((x) => x.id === d.et);
      if (!o) return;
      const i = ETAPAS.indexOf((o.etapa || 'Triagem') as typeof ETAPAS[number]);
      const nova = ETAPAS[Math.max(0, Math.min(ETAPAS.length - 1, i + Number(d.d)))];
      gravar(o.id, { etapa: nova }, `Etapa: ${nova}.`);
      return;
    }
    if (d.hab && d.req) {
      const atual = H.find((h) => h.id === d.hab)?.req?.[d.req]?.status || 'pendente';
      mudarRequisito(d.hab, d.req, { status: PROX_STATUS[atual] });
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (D.contains(t)) return;
    if (t.dataset.desc && t.value) { gravar(t.dataset.desc, { triagem: 'Descartar', motivoDescarte: t.value, triadoEm: new Date().toISOString() }, 'Descartada: ' + t.value + '.'); return; }
    if (t.id === 'lcOrd') { F.ordem = t.value as FiltroRadar['ordem']; render(); return; }
    if (t.dataset.val && t.dataset.req) mudarRequisito(t.dataset.val, t.dataset.req, { validade: t.value });
  });
  let tq: ReturnType<typeof setTimeout> | null = null;
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id !== 'lcQ') return;
    if (tq) clearTimeout(tq);
    tq = setTimeout(() => {
      F.q = t.value; limite = 60; render();
      const q = $<HTMLInputElement>('#lcQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    }, 200);
  });

  render();
  (async () => {
    const db = await banco();
    if (!db) { carregando = false; render(); return; }
    col = db.collection<Oportunidade>('b2g');
    colH = db.collection<Habilitacao>('habilitacao');
    offs.push(col.onSnapshot((s) => { O = s.docs.map(comId); carregando = false; if (!D.open) render(); }, () => { carregando = false; render(); }));
    offs.push(colH.onSnapshot((s) => { H = s.docs.map(comId); if (aba === 'habilitacao') render(); }, () => {}));
    offs.push(db.collection<Status & { id: string }>('cerebro').onSnapshot((s) => {
      const d = s.docs.find((x) => x.id === 'status');
      st = d ? (d.data() as Status) : {};
      if (aba === 'radar' && !D.open) render();
    }, () => {}));
  })();
  return () => { abas.parar(); if (desPca) desPca(); offs.forEach((f) => { try { f(); } catch { /* já cancelado */ } }); };
}
