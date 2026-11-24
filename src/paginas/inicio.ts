// Início: o que fazer agora, com os dois negócios lado a lado e sem misturar: Privado (alvos, agenda, funil privado)
// e Público (carteira de licitações, habilitação, funil público). A Gestão, que soma os dois, fica embaixo.
import { esc, int, brl, dt } from '../lib/formato';
import { hoje as hojeISO, addDias } from '../lib/datas';
import { ativo, devido } from '../lib/prioridade';
import { banco } from '../lib/db';
import type { Alvo } from '../lib/tipos';
import { seletor, comId } from './dom';
import { kpis, vazio } from '../componentes';
import { alertasHabilitacao } from './licitacoes';
import type { Habilitacao } from '../lib/tipos';

type Doc = Record<string, unknown> & { id: string };
export interface Passo { d: string; txt: string; onde: string; href: string }

/** Próximos passos com data, de oportunidades do funil, alvos da Captação e licitações da carteira. */
export function passos(pipeline: Doc[], alvos: Doc[], b2g: Doc[]): Passo[] {
  const s = (v: unknown) => String(v ?? '');
  const abertas = pipeline.filter((o) => !['Ganha', 'Perdida'].includes(s(o.estagio)));
  return [
    ...abertas.filter((o) => o.prazo).map((o) => ({ d: s(o.prazo).slice(0, 10), txt: s(o.proximoPasso || o.titulo), onde: 'Funil · ' + s(o.titulo) + (o.estagio ? ' · ' + s(o.estagio) : ''), href: '#funil' })),
    ...alvos.filter((a) => a.status !== 'Cliente' && a.status !== 'Descartado' && a.prazo).map((a) => ({ d: s(a.prazo).slice(0, 10), txt: s(a.proximoPasso || 'Próximo passo a definir'), onde: 'Alvo · ' + s(a.nome) + ' · ' + s(a.status), href: '#captacao' })),
    ...b2g.filter((o) => o.carteira && o.prazo).map((o) => ({ d: s(o.prazo).slice(0, 10), txt: s(o.objeto), onde: 'Licitação · ' + s(o.orgao) + (o.etapa ? ' · ' + s(o.etapa) : ''), href: '#b2g' })),
  ].sort((a, b) => a.d.localeCompare(b.d));
}

/** Lado de cada oportunidade do funil: público quando o eixo é Público; o resto (privado e internacional) é com empresa. */
export const ladoDoFunil = (o: Doc): 'publico' | 'privado' => (String(o.eixo || '') === 'Público' ? 'publico' : 'privado');

const GESTAO: [string, string, string][] = [['semana', 'Semana comercial', 'Meta, previsão, o que travou e os sinais esfriando, dos dois lados.'], ['funil', 'Funil e estratégia', 'Receita por eixo, funil de oportunidades, SWOT e frentes.'], ['tabela', 'Oferta da casa', 'Tabela de serviços, casos e biblioteca.'], ['rotinas', 'Rotinas do Claude', 'O que roda sozinho todo dia, quando rodou e o que trouxe.']];
const ATALHOS: Record<'privado' | 'publico', [string, string, string][]> = {
  privado: [['#alertas', 'Ler os alertas do dia', 'O que mudou entre marcas e agências e a ação proposta.'], ['#captacao', 'Abordar um alvo', 'Casos e provas da casa entram na mensagem.'], ['#investigacao', 'Seguir uma pista', 'Quem saiu, para onde foi e quem chegou no lugar.']],
  publico: [['#b2g', 'Avaliar licitação', 'GO / NO-GO cruzando o edital com o que a Produceria entrega.'], ['#vencedores', 'Ver contratos vencendo', 'Órgãos que vão renovar ou licitar de novo, e os preços de referência.']],
};
const lista = (L: [string, string, string][]) => `<ul class="vc-l">${L.map(([h, t, d]) => `<li><a class="ini-link" href="${h}"><span class="vc-c"><b>${t}</b><span class="note">${d}</span></span><span aria-hidden="true">→</span></a></li>`).join('')}</ul>`;

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc ini">
  <header class="page-head"><span class="eyebrow">Início · ${dt(hojeISO())}</span><h1 class="d d-title">Dois negócios, uma casa</h1>
    <p class="lead measure muted">Privado é o negócio com marcas e agências; Público, o negócio com o governo. Cada lado tem as próprias telas e números, sem misturar. A Gestão soma os dois. Tudo que a IA propõe chega como rascunho para a equipe decidir.</p></header>
  <div class="ini-lados">
    <section class="ini-lado-n" aria-labelledby="in-pr"><div class="ph"><span class="lab">Privado · marcas e agências</span></div><h2 class="d d-sub" id="in-pr">Prospecção e carteira</h2>
      <div id="inKpr"></div>
      <section aria-labelledby="in-h"><div class="ph"><h3 id="in-h">Quem contatar hoje</h3><a class="cn-f" href="#agenda">Agenda →</a></div><div id="inH"></div></section>
      <section aria-labelledby="in-p"><div class="ph"><h3 id="in-p">Próximos passos</h3><a class="cn-f" href="#captacao">Prospecção →</a></div><div id="inP"></div></section>
      <section aria-labelledby="in-v"><div class="ph"><h3 id="in-v">Atalhos</h3></div>${lista(ATALHOS.privado)}</section>
    </section>
    <section class="ini-lado-n" aria-labelledby="in-pu"><div class="ph"><span class="lab">Público · governo</span></div><h2 class="d d-sub" id="in-pu">Licitações e contratos</h2>
      <div id="inKpu"></div>
      <section class="lc-box ini-alerta" id="inA" aria-labelledby="in-a" hidden></section>
      <section aria-labelledby="in-q"><div class="ph"><h3 id="in-q">Próximos passos</h3><a class="cn-f" href="#b2g/carteira">Carteira →</a></div><div id="inQ"></div></section>
      <section aria-labelledby="in-w"><div class="ph"><h3 id="in-w">Atalhos</h3></div>${lista(ATALHOS.publico)}</section>
    </section>
  </div>
  <section class="lc-box ini-of" aria-labelledby="in-o"><span class="lab">Gestão · os dois lados</span><h2 class="d d-sub" id="in-o">A casa em ordem</h2>
    <ul>${GESTAO.map(([h, t, d]) => `<li><a href="#${h}"><b>${t} →</b><span class="note">${d}</span></a></li>`).join('')}</ul></section></div>`;
  const $ = seletor(root);
  const D: Record<string, Doc[]> = { pipeline: [], alvos: [], b2g: [], habilitacao: [] };
  const offs: (() => void)[] = [];

  function render() {
    const h = hojeISO(), sem = addDias(h, 7);
    const abertas = D.pipeline.filter((o) => !['Ganha', 'Perdida'].includes(String(o.estagio)));
    const soma = (L: Doc[]) => L.reduce((s, o) => s + (Number(o.valor) || 0), 0);
    const fPr = abertas.filter((o) => ladoDoFunil(o) === 'privado'), fPu = abertas.filter((o) => ladoDoFunil(o) === 'publico');
    const andamento = D.alvos.filter((a) => a.status !== 'Cliente' && a.status !== 'Descartado'), clientes = D.alvos.filter((a) => a.status === 'Cliente');
    const carteira = D.b2g.filter((o) => o.carteira), vCart = soma(carteira);
    const Ppr = passos(D.pipeline.filter((o) => ladoDoFunil(o) === 'privado'), D.alvos, []), Ppu = passos(D.pipeline.filter((o) => ladoDoFunil(o) === 'publico'), [], D.b2g);
    const atras = Ppr.filter((p) => p.d < h).length, prox = Ppr.filter((p) => p.d >= h && p.d <= sem).length;
    const atrasPu = Ppu.filter((p) => p.d < h).length;
    $('#inKpr').innerHTML = `<div class="kpis ini-k">${kpis([
      { rotulo: 'Alvos em andamento', href: '#captacao', acao: 'Abrir a Captação', valor: `<b>${int(andamento.length)}</b>`, nota: `${clientes.length} cliente(s) na carteira` },
      { rotulo: 'Funil privado', href: '#funil', acao: 'Abrir o funil', valor: `<b>${int(fPr.length)}</b>`, nota: soma(fPr) ? brl(soma(fPr)) + ' em jogo' : 'sem valor registrado' },
      { rotulo: 'Passos atrasados', href: '#agenda', acao: 'Abrir a agenda', valor: `<b${atras ? ' class="quente"' : ''}>${int(atras)}</b>`, nota: `${prox} vencem nos próximos 7 dias` },
    ])}</div>`;
    $('#inKpu').innerHTML = `<div class="kpis ini-k">${kpis([
      { rotulo: 'Carteira de licitações', href: '#b2g/carteira', acao: 'Abrir a carteira', valor: `<b>${int(carteira.length)}</b>`, nota: vCart ? brl(vCart) + ' estimados' : 'sem valor estimado' },
      { rotulo: 'Funil público', href: '#funil', acao: 'Abrir o funil', valor: `<b>${int(fPu.length)}</b>`, nota: soma(fPu) ? brl(soma(fPu)) + ' em jogo' : 'sem valor registrado' },
      { rotulo: 'Passos atrasados', href: '#b2g/carteira', acao: 'Abrir a carteira', valor: `<b${atrasPu ? ' class="quente"' : ''}>${int(atrasPu)}</b>`, nota: `${Ppu.filter((p) => p.d >= h && p.d <= sem).length} vencem nos próximos 7 dias` },
    ])}</div>`;
    const hojeL = (D.alvos as unknown as Alvo[]).filter((a) => ativo(a) && a.status !== 'Descartado').map((a) => ({ a, d: devido(a) })).filter((x) => x.d && x.d <= h).sort((x, y) => x.d.localeCompare(y.d));
    $('#inH').innerHTML = hojeL.length ? `<ul class="vc-l">${hojeL.slice(0, 5).map(({ a, d }) => `<li><a class="ini-passo" href="#agenda"><span class="num${d < h ? ' cp-venc' : ' note'}">${d < h ? 'atrasado' : 'hoje'}</span><span class="vc-c"><b>${esc(a.nome)}</b><span class="note">${esc(a.proximoToque?.texto || a.proximoPasso || 'Definir próximo passo')}</span></span></a></li>`).join('')}</ul>` : '<p class="note">Nenhum contato vencendo hoje.</p>';
    const hab = alertasHabilitacao(D.habilitacao as unknown as Habilitacao[], h);
    const prazos = D.b2g.filter((o) => o.carteira && o.prazo && String(o.prazo).slice(0, 10) >= h && String(o.prazo).slice(0, 10) <= sem).sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
    const al = $('#inA');
    al.hidden = !hab.length && !prazos.length;
    al.innerHTML = `<span class="lab" id="in-a">Atenção</span>
      ${prazos.length ? `<p><b>${prazos.length} proposta(s) da carteira vencem em 7 dias</b></p><ul class="ini-al">${prazos.slice(0, 4).map((o) => `<li><a href="#b2g"><span class="num">${dt(String(o.prazo))}</span> ${esc(String(o.objeto || '').slice(0, 90))}</a></li>`).join('')}</ul>` : ''}
      ${hab.length ? `<p><b>${hab.filter((x) => x.situacao === 'vencida').length} certidão(ões) vencida(s) · ${hab.filter((x) => x.situacao === 'vence').length} vencem em 30 dias</b></p><ul class="ini-al">${hab.slice(0, 6).map((x) => `<li><a href="#b2g"><span class="num${x.situacao === 'vencida' ? ' cp-venc' : ''}">${x.situacao === 'vencida' ? 'vencida' : dt(x.validade)}</span> ${esc(x.requisito)} · ${esc(x.empresa.replace('Produceria ', ''))}</a></li>`).join('')}</ul><p class="note">Certidão vencida inabilita na sessão. Atualize em Licitações › Habilitação do hub.</p>` : ''}`;
    const lp = (P: Passo[], vazioTxt: string, acao: string) => P.length ? `<ul class="vc-l">${P.slice(0, 6).map((p) => `<li><a class="ini-passo" href="${p.href}"><span class="num${p.d < h ? ' cp-venc' : ' note'}">${dt(p.d)}</span><span class="vc-c"><span>${esc(p.txt)}</span><span class="note">${esc(p.onde)}</span></span></a></li>`).join('')}</ul>`
      : vazio({ titulo: 'Nenhum próximo passo com data', texto: vazioTxt, acao });
    $('#inP').innerHTML = lp(Ppr, 'Dê prazo aos próximos passos dos alvos e das oportunidades privadas do funil para que apareçam aqui.', '<a class="btn sm" href="#captacao">Mapear alvos →</a>');
    $('#inQ').innerHTML = lp(Ppu, 'Dê prazo às licitações da carteira e às oportunidades públicas do funil para que apareçam aqui.', '<a class="btn sm" href="#b2g">Abrir o radar →</a>');
  }

  render();
  (async () => {
    const db = await banco();
    if (!db) return;
    for (const c of Object.keys(D)) offs.push(db.collection<Doc>(c).onSnapshot((s) => { D[c] = s.docs.map(comId); render(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
