// Semana comercial: o ritual de segunda. Meta e realizado, previsão ponderada do funil, a semana em uma página
// (entrou, avançou, travou, sem próximo passo), sinais que esfriam, ganhos e perdas e carteira em risco.
import { esc, int, brl, dt } from '../lib/formato';
import { banco, lerBase, type Banco } from '../lib/db';
import { SERVICOS } from '../lib/servicos';
import { mesmaEmpresa, nomeLegivel } from '../lib/nomes';
import { hoje as hojeISO, addDias } from '../lib/datas';
import { segunda, previsao, realizado, ganhosPerdas, esfriando, carteiraRisco, porPerfil, resumoSemana, expansao, canalAgencias, PESOS, META_PADRAO, type Metas, type Linha, type AgenciaBase } from '../lib/semana';
import { seletor, comId } from './dom';
import { kpis, barras, vazio } from '../componentes';
import type { Alvo } from '../lib/tipos';

type Doc = Record<string, unknown> & { id: string };
const PERFIS: Record<string, string> = { independente: 'Agências independentes', rede: 'Agências de rede', inhouse: 'In-house', publica: 'Contas públicas', eua: 'EUA' };
const CAMPOS: [keyof Metas, string][] = [['contatos', 'Contatos'], ['respostas', 'Respostas'], ['propostas', 'Propostas'], ['clientes', 'Clientes novos']];

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc sm-w">
  <div class="acts" role="group" aria-label="Semana" id="smS"></div>
  <div id="smK"></div>
  <p class="sr" id="smLive" aria-live="polite" aria-atomic="true"></p>
  <section aria-labelledby="sm-r"><div class="ph"><h2 class="d d-sub" id="sm-r">Entrou, avançou, travou</h2><span class="note" id="smRn"></span></div><div class="sm-g" id="smR"></div></section>
  <section aria-labelledby="sm-e"><div class="ph"><h2 class="d d-sub" id="sm-e">Sinais esfriando</h2><span class="note">um sinal vale 14 dias: depois disso a conversa perde o gancho</span></div><div id="smE"></div></section>
  <section aria-labelledby="sm-p"><div class="ph"><h2 class="d d-sub" id="sm-p">Previsão do funil</h2><a class="cn-f" href="#funil">Funil →</a></div><div id="smP"></div></section>
  <section aria-labelledby="sm-gp"><div class="ph"><h2 class="d d-sub" id="sm-gp">Ganhos e perdas</h2><span class="note">últimos 90 dias</span></div><div id="smG"></div></section>
  <section aria-labelledby="sm-c"><div class="ph"><h2 class="d d-sub" id="sm-c">Carteira e canais</h2><a class="cn-f" href="#contas">Mapa de contas →</a></div><div class="dp-pts" id="smC"></div></section>
  <section aria-labelledby="sm-a"><div class="ph"><h2 class="d d-sub" id="sm-a">Agências como canal</h2><a class="cn-f" href="#mercado">Contas e agências →</a></div><p class="note">Cada agência atende várias marcas: uma parceria de produção abre várias contas de uma vez. Ordem: quantas marcas a agência atende na base do mercado.</p><div class="dp-pts" id="smA"></div></section>
  <section class="lc-box" aria-labelledby="sm-m"><span class="lab" id="sm-m">Metas</span><form id="smM" class="sm-m" novalidate></form><p class="note">A meta da semana vale para toda semana até ser mudada. A meta do trimestre entra na previsão.</p></section></div>`;
  const $ = seletor(root);
  const D: Record<string, Doc[]> = { pipeline: [], alvos: [], disparos: [], alertas: [] };
  let agencias: AgenciaBase[] = [], metas: Metas = {}, db: Banco | null = null, carregado = false, passada = false;
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#smLive').textContent = t; };
  const meta = (k: keyof Metas) => Number(metas[k] ?? META_PADRAO[k]) || 0;
  const lista = (L: Linha[], nada: string, max = 8) => L.length
    ? `<ul class="vc-l">${L.slice(0, max).map((l) => `<li><a class="ini-link" href="${l.href}"><span class="vc-c"><b>${esc(l.titulo)}</b><span class="note">${esc(l.onde)}${l.d ? ' · ' + dt(l.d) : ''}</span></span></a></li>`).join('')}</ul>${L.length > max ? `<p class="note">e mais ${int(L.length - max)}</p>` : ''}`
    : `<p class="note">${nada}</p>`;

  function render() {
    const h = hojeISO(), seg = segunda(h), desde = passada ? addDias(seg, -7) : seg, ate = passada ? seg : '9999';
    const alvos = D.alvos as unknown as Alvo[];
    $('#smS').innerHTML = [['0', 'Esta semana'], ['1', 'Semana passada']].map(([v, t]) => `<button type="button" class="chip" data-sem="${v}" aria-pressed="${passada === (v === '1')}">${t}</button>`).join('')
      + `<span class="note">de ${dt(desde)} a ${dt(addDias(desde, 6))}</span>`;
    if (!carregado) { $('#smK').innerHTML = '<p class="note">Carregando…</p>'; return; }
    const R = realizado(alvos, D.disparos, desde, ate), P = previsao(D.pipeline, h), mTri = meta('receitaTrimestre');
    $('#smK').innerHTML = `<div class="kpis">${kpis([
      ...CAMPOS.map(([k, l]) => ({ rotulo: l, valor: `<b${R[k as 'contatos'] >= meta(k) && meta(k) ? ' class="ok"' : ''}>${int(R[k as 'contatos'])}</b><small> / ${int(meta(k))}</small>`, nota: meta(k) ? (R[k as 'contatos'] >= meta(k) ? 'meta batida' : `faltam ${int(meta(k) - R[k as 'contatos'])}`) : 'sem meta' })),
      { rotulo: 'Previsão do trimestre', valor: `<b>${brl(P.ganho + P.ponderado)}</b>`, nota: mTri ? (P.ganho + P.ponderado >= mTri ? 'cobre a meta' : `faltam ${brl(mTri - P.ganho - P.ponderado)} para ${brl(mTri)}`) : 'ganho + funil ponderado' },
    ])}</div>`;
    const S = resumoSemana(D.pipeline, alvos, desde, h, ate);
    $('#smRn').textContent = `${S.entrou.length} entraram · ${S.avancou.length} avançaram · ${S.travou.length} travados`;
    $('#smR').innerHTML = ([['Entrou', S.entrou, 'Nada novo no período.'], ['Avançou', S.avancou, 'Nenhuma etapa mudou no período.'], ['Travou', S.travou, 'Nenhum prazo vencido.'], ['Sem próximo passo', S.semPasso, 'Toda conversa tem um próximo passo.']] as [string, Linha[], string][])
      .map(([t, L, n]) => `<div><span class="lab">${t} <span class="num">${int(L.length)}</span></span>${lista(L, n)}</div>`).join('');
    const E = esfriando(D.alertas, alvos, h);
    $('#smE').innerHTML = E.length ? `<ul class="vc-l">${E.slice(0, 10).map((x) => `<li><a class="ini-link" href="${x.href}"><span class="vc-c"><b>${esc(x.titulo)}</b><span class="note">${esc(x.onde)} · desde ${dt(x.desde)}</span></span><span class="tag${x.resta <= 3 ? ' quente' : ''}">${x.resta > 0 ? `vence em ${x.resta} dia${x.resta > 1 ? 's' : ''}` : x.resta === 0 ? 'vence hoje' : `venceu há ${-x.resta} dia${x.resta < -1 ? 's' : ''}`}</span></a></li>`).join('')}</ul>${E.length > 10 ? `<p class="note">e mais ${int(E.length - 10)}</p>` : ''}`
      : vazio({ texto: 'Nenhum sinal parado: todo alerta novo e todo alvo vindo de sinal já teve um toque.' });
    $('#smP').innerHTML = `<div class="dp-pt"><table><thead><tr><th scope="col">Estágio</th><th scope="col" class="r">Oportunidades</th><th scope="col" class="r">Valor</th><th scope="col" class="r">Chance</th><th scope="col" class="r">Ponderado</th></tr></thead><tbody>
      ${P.linhas.map((l) => `<tr><td>${l.estagio}${l.semValor ? `<small class="note"> · ${l.semValor} sem valor</small>` : ''}</td><td class="r">${int(l.n)}</td><td class="r">${brl(l.valor)}</td><td class="r">${Math.round(PESOS[l.estagio] * 100)}%</td><td class="r">${brl(l.ponderado)}</td></tr>`).join('')}
      <tr><td>Ganho desde ${dt(P.desde)}</td><td></td><td></td><td class="r">100%</td><td class="r">${brl(P.ganho)}</td></tr></tbody></table></div>
      <p class="note">Ponderado = valor × chance do estágio. Oportunidade sem valor não entra na conta: vale registrar o valor estimado no funil.</p>`;
    const G = ganhosPerdas(D.pipeline, addDias(h, -90));
    $('#smG').innerHTML = G.ganhas + G.perdidas ? `<div class="kpis">${kpis([
      { rotulo: 'Ganhas', valor: `<b>${int(G.ganhas)}</b>`, nota: G.valorGanho ? brl(G.valorGanho) : 'sem valor registrado' },
      { rotulo: 'Perdidas', valor: `<b>${int(G.perdidas)}</b>`, nota: G.motivos[0] ? 'mais comum: ' + esc(G.motivos[0][0]) : '' },
      { rotulo: 'Taxa de ganho', valor: `<b>${G.taxa == null ? '—' : Math.round(G.taxa * 100) + '%'}</b>`, nota: 'das fechadas no período' },
    ])}</div><div class="dp-pts">${barras('Motivos de perda', G.motivos.map(([m, n]) => ({ rotulo: m, valor: n })), { vazio: 'Nenhuma perda no período.' })}
      ${barras('Fechadas por eixo', G.porEixo.map((e) => ({ rotulo: e.eixo, valor: e.ganhas + e.perdidas, nota: `${e.ganhas} ganha(s) · ${e.perdidas} perdida(s)` })))}</div>`
      : vazio({ texto: 'Nenhuma oportunidade fechada nos últimos 90 dias. Ao marcar uma oportunidade como perdida no funil, escolha o motivo: é ele que mostra o padrão.' });
    const C = carteiraRisco(alvos, h), PP = porPerfil(alvos), XP = expansao(alvos, (id) => SERVICOS.find((x) => x.id === id)?.cat);
    $('#smC').innerHTML = `<div class="dp-pt"><span class="lab">Clientes sem contato há 60 dias ou mais</span>${C.length ? `<ul class="vc-l">${C.slice(0, 8).map((x) => `<li><a class="ini-link" href="#captacao"><span class="vc-c"><b>${esc(x.a.nome)}</b><span class="note">${x.ultimo ? 'último contato ' + dt(x.ultimo) : 'sem contato registrado'}</span></span></a></li>`).join('')}</ul>` : '<p class="note">Nenhum cliente parado.</p>'}</div>
      <div class="dp-pt"><span class="lab">Por perfil</span>${PP.length ? `<table><thead><tr><th scope="col">Perfil</th><th scope="col" class="r">Em andamento</th><th scope="col" class="r">Em conversa</th><th scope="col" class="r">Clientes</th></tr></thead><tbody>${PP.map((p) => `<tr><td>${esc(PERFIS[p.perfil] || p.perfil)}</td><td class="r">${int(p.andamento)}</td><td class="r">${int(p.conversa)}</td><td class="r">${int(p.clientes)}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Nenhum alvo na Captação.</p>'}
</div>
      <div class="dp-pt"><span class="lab">Expansão: o que oferecer a cada cliente</span>${XP.length ? `<ul class="vc-l">${XP.slice(0, 8).map((x) => `<li><a class="ini-link" href="#captacao"><span class="vc-c"><b>${esc(x.a.nome)}</b><span class="note">${x.ja.length ? 'já compra ' + esc(x.ja.join(', ').toLowerCase()) + (x.oferecer.length ? ' · oferecer ' + esc(x.oferecer.join(', ').toLowerCase()) : '') : 'sem proposta registrada: registre o que ele compra para aparecer o que oferecer'}</span></span></a></li>`).join('')}</ul>` : '<p class="note">Nenhum cliente na Captação.</p>'}</div>`;
    const CA = canalAgencias(agencias, alvos, mesmaEmpresa), ag = (x: (typeof CA.abrir)[number]) => `<li><a class="ini-link" href="${x.alvo ? '#captacao' : '#mercado'}"><span class="vc-c"><b>${esc(nomeLegivel(x.nome))}${x.alvo ? ` <span class="tag">${esc(x.alvo.status || 'Mapeado')}</span>` : ''}</b><span class="note">${int(x.marcas)} marca(s): ${esc(x.exemplo.map(nomeLegivel).join(', '))}${x.marcas > 3 ? '…' : ''}</span></span></a></li>`;
    $('#smA').innerHTML = !agencias.length ? '<p class="note">Base do mercado indisponível agora.</p>'
      : `<div class="dp-pt"><span class="lab">Já na Captação</span>${CA.naCaptacao.length ? `<ul class="vc-l">${CA.naCaptacao.map(ag).join('')}</ul>` : '<p class="note">Nenhuma agência da base está na Captação ainda.</p>'}</div>
      <div class="dp-pt"><span class="lab">Maior alcance, ainda fora</span>${CA.abrir.length ? `<ul class="vc-l">${CA.abrir.map(ag).join('')}</ul>` : '<p class="note">Todas já estão na Captação.</p>'}</div>`;
    if (!root.querySelector('#smM input:focus')) $('#smM').innerHTML = [...CAMPOS, ['receitaTrimestre', 'Receita do trimestre (R$)'] as [keyof Metas, string]]
      .map(([k, l]) => `<div class="f"><label for="sm_${k}">${l}${k === 'receitaTrimestre' ? '' : ' por semana'}</label><input id="sm_${k}" data-meta="${k}" inputmode="numeric" value="${meta(k) || ''}"></div>`).join('');
  }

  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-sem]');
    if (b) { passada = b.dataset.sem === '1'; render(); }
  });
  root.addEventListener('change', async (ev) => {
    const i = (ev.target as HTMLElement).closest<HTMLInputElement>('[data-meta]');
    if (!i || !db) return;
    const n = Number(i.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
    metas = { ...metas, [i.dataset.meta!]: n };
    try { await db.collection('metas').doc('semana').set({ id: 'semana', ...metas, em: new Date().toISOString() }); avisar('Meta salva.'); }
    catch { avisar('Não foi possível salvar a meta agora.'); }
    render();
  });

  render();
  (async () => {
    db = await banco();
    if (!db) { carregado = true; render(); return; }
    let faltam = Object.keys(D).length;
    for (const c of Object.keys(D)) offs.push(db.collection<Doc>(c).onSnapshot((s) => { D[c] = s.docs.map(comId); if (faltam && !--faltam) carregado = true; if (carregado) render(); }, () => { if (faltam && !--faltam) carregado = true; render(); }));
    lerBase<{ agencias?: AgenciaBase[] }>('mercado').then((m) => { agencias = m.agencias || []; render(); }, () => {});
    offs.push(db.collection<Metas & { id: string }>('metas').onSnapshot((s) => { const d = s.docs.map(comId).find((x) => x.id === 'semana'); if (d) metas = d; render(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
