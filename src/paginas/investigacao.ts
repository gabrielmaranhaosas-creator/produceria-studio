// Investigação: a reação em cadeia da prospecção. Parte de um ponto (a PRODUCERIA ou qualquer empresa, agência ou
// pessoa do Big Data) e abre as ramificações: quem atende quem, quem trabalha onde, por onde cada um passou, qual
// agência extinta virou qual. Cada ponto ganha uma nota de possibilidade de negócio e pode ir direto para a Captação.
import { esc, dt } from '../lib/formato';
import { hoje as hojeISO, addDias } from '../lib/datas';
import { slug } from '../lib/nomes';
import { banco, lerBase, type Colecao } from '../lib/db';
import { montarGrafo, NIVEIS, type MercadoBase, type MovimentoBase, type EmpresaMapa, type AgenciaMapa, type PessoaMapa } from '../lib/grafo';
import { montarUniverso, reacao, caminho, leads, buscarNo, linhagem, novidades, chegadas, multiverso, ordenarReacao, dadosDoArquivo, ORIGEM, type Novidades, type Universo, type Reacao, type NoU, type PessoaInv, type OrgInv, type Multiverso } from '../lib/investigacao';
import { htmlDoMapa, fontesDaPagina } from '../lib/mapa-arquivo';
import { baixarArquivo } from './oficina';
import type { Alvo } from '../lib/tipos';
import { seletor, elDe, comId, mensagem } from './dom';
import { kpis, numero, vazio, barras, contar, painel } from '../componentes';

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'fonte'; } };
const link = (u: string | undefined, t: string) => (u && /^https?:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗<span class="sr"> (abre em nova aba)</span></a>` : '');
const curto = (s = '', n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const ROT: Record<string, string> = Object.fromEntries(NIVEIS.map(([n, t]) => [n, t]));
const TIPO: Record<string, string> = { origem: 'Ponto zero', empresa: 'Anunciante', agencia: 'Agência', pessoa: 'Pessoa' };
const GER = ['Ponto de partida', '1ª ramificação', '2ª ramificação', '3ª ramificação', '4ª ramificação'];
const LIMITES = [10, 14, 18, 14];

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap iv">
 <section class="iv-hoje" id="ivH" aria-label="O que chegou no mapa" hidden></section>
 <section class="kpis" id="ivK" aria-label="Tamanho da reação"></section>
 <section class="iv-ctl" aria-label="Ponto de partida">
  <div class="iv-eq"><span class="lab">Rastro</span><div class="iv-rastro" id="ivR"></div></div>
  <div class="f iv-busca"><label for="ivQ">Partir de outro ponto</label><input id="ivQ" type="search" placeholder="Empresa, agência ou pessoa" autocomplete="off" aria-controls="ivS"><div class="iv-sug" id="ivS" role="list"></div></div>
  <div class="seg sm" id="ivA" role="group" aria-label="Abertura dos ramos"><button type="button" data-ab="1" aria-pressed="true">Essencial</button><button type="button" data-ab="2" aria-pressed="false">Ampla</button></div>
  <button type="button" class="iv-baixar" id="ivB" data-baixar>Baixar o mapa interativo</button>
 </section>
 <section class="iv-mv" id="ivMv" aria-labelledby="ivMvT"></section>
 <p class="note iv-dica">Clique num ponto para acender o caminho até ele e ver o dossiê ao lado. O quadro rola por dentro, para baixo e para os lados.</p>
 <div class="iv-mesa" id="ivMesa">
  <div class="iv-rolo" id="ivRolo" tabindex="0" role="region" aria-label="Quadro da reação em cadeia, rola por dentro"><section class="iv-quadro" id="ivQd"></section></div>
  <aside class="iv-ficha" id="ivFi" aria-live="polite" aria-label="Dossiê do ponto escolhido"></aside>
 </div>
 <p class="sr" id="ivLive" aria-live="polite"></p>
 <section aria-labelledby="ivLT"><h2 class="iv-h" id="ivLT">Radar de prospecção</h2><p class="note">As possibilidades de negócio desta reação, da mais forte para a mais fraca. A força soma a nota do ponto (quem contrata produção, conta que acabou de mudar, encaixe do craft, ponte com a PRODUCERIA), quantos caminhos chegam nele e a distância do ponto de partida.</p><div class="seg sm" id="ivLF" role="group" aria-label="Mostrar no radar"><button type="button" data-lf="" aria-pressed="true">Tudo</button><button type="button" data-lf="novo" aria-pressed="false">Novos</button><button type="button" data-lf="org" aria-pressed="false">Empresas e agências</button><button type="button" data-lf="pessoa" aria-pressed="false">Pessoas</button><button type="button" data-lf="nova" aria-pressed="false">Sem ponte ainda</button></div><ol class="iv-radar" id="ivL"></ol><p class="iv-radar-mais" id="ivLM"></p></section>
 <section aria-labelledby="ivGT"><h2 class="iv-h" id="ivGT">Gráficos da reação</h2><div id="ivG"></div></section>
 <section aria-labelledby="ivXT"><h2 class="iv-h" id="ivXT">Rastro das agências extintas</h2><p class="note">Agência que fechou ou mudou de nome não é beco sem saída: a reação segue para a casa que herdou contas e equipe.</p><div id="ivLn"></div></section>
</div>`;
  const $ = seletor(root);
  let mercado: MercadoBase | null = null, movs: MovimentoBase[] = [], emp: (EmpresaMapa & OrgInv)[] = [], ags: (AgenciaMapa & OrgInv)[] = [], pes: PessoaInv[] = [], alvos: Alvo[] = [];
  let U: Universo = montarUniverso({ empresas: [], agencias: [], pessoas: [], orgsInv: [] });
  let R: Reacao = reacao(U, ORIGEM), M: Multiverso = multiverso(U, ORIGEM, R), G: Reacao['geracoes'] = ordenarReacao(R), sel = '', ab = 1, lf = '', lim = 10, rastroIds: string[] = [ORIGEM], colAlvos: Colecao<Alvo> | null = null;
  const offs: (() => void)[] = [];
  // o que chegou: faixa "Hoje no mapa", etiqueta "novo", linha do tempo e a reação que abre pela troca do dia
  let N: Novidades = novidades(U, []), novos = new Set<string>(), foco = '', janela = 30, auto = true, abriuDia = false;
  let vazioAntes = true, ultimaSem = '', animarAte = 0, tAnim = 0;
  const VISTO = 'studio.iv.visto';
  const visto = new Set<string>((() => { try { const v = JSON.parse(localStorage.getItem(VISTO) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } })());
  const guardar = () => { try { localStorage.setItem(VISTO, JSON.stringify([...visto].slice(-3000))); } catch { /* sem armazenamento: vale só nesta visita */ } };
  const novo = (id: string) => novos.has(id) && !visto.has(id);
  const naoVistos = () => [...novos].filter((id) => !visto.has(id)).length;
  const no = (id: string) => U.nos.get(id);
  const ramos = () => new Map(R.geracoes.flat().map((r) => [r.id, r]));

  const cartao = (n: NoU, forca: number) => {
    if (n.tipo === 'origem') return `<button type="button" class="iv-c iv-zero" data-n="${esc(n.id)}"><b>PRODUCERIA</b><span class="iv-m">ponto zero · equipe e pontes</span></button>`;
    const pes = n.tipo === 'pessoa', cls = pes ? `iv-fic n-${n.nivel}` : `iv-dos${n.tipo === 'empresa' ? ' emp' : ''}${n.extinta ? ' ext' : ''}`;
    const tipo = pes ? (n.org ? curto(n.org, 34) : 'Pessoa') : TIPO[n.tipo] + (n.sub && !n.extinta ? ' · ' + curto(n.sub, 26) : '');
    const linha = pes ? `<span class="iv-m">${esc(curto(n.sub, 60))}</span>` : n.extinta && n.fatos[0] ? `<span class="iv-m">${esc(curto(n.fatos[0], 60))}</span>` : '';
    const fato = !n.extinta && n.fatos[0] ? `<span class="iv-fato" title="${esc(n.fatos[0])}">${esc(n.fatos[0])}</span>` : '<span class="iv-fato"></span>';
    return `<button type="button" class="iv-c ${cls}${novo(n.id) ? ' novo' : ''}" data-n="${esc(n.id)}" title="${esc(n.nome)}">${novo(n.id) ? '<span class="iv-novo">novo</span>' : ''}<span class="iv-k">${esc(tipo)}</span><b>${esc(n.nome)}</b>${linha}${n.extinta ? '<span class="iv-car">Extinta</span>' : `<span class="iv-rod">${fato}${n.alvo ? '<span class="iv-tag">no radar</span>' : ''}<span class="iv-pt" title="Força na reação">${forca}</span></span>`}</button>`;
  };

  function render() {
    N = novidades(U, movs, foco); novos = new Set([...N.pessoas, ...N.orgs]);
    hoje();
    const L = leads(U, R), todos = R.geracoes.flat();
    const portas = L.filter((x) => x.no.nivel === 'contrata').length, gat = L.filter((x) => x.no.recente).length;
    const orgsU = [...U.nos.values()].filter((n) => n.tipo !== 'pessoa' && n.tipo !== 'origem').length, pesU = [...U.nos.values()].filter((n) => n.tipo === 'pessoa').length;
    $('#ivK').innerHTML = kpis([
      { rotulo: 'Pontos no mapa', valor: numero(String(U.nos.size - 1)), nota: `${orgsU} organizações e ${pesU} pessoas, de todas as fontes` },
      { rotulo: 'Possibilidades na reação', valor: numero(String(L.length)), nota: `em ${R.geracoes.length - 1} ramificações` },
      { rotulo: 'Portas que contratam', valor: numero(String(portas)), nota: 'pessoas que pedem orçamento de produção' },
      { rotulo: 'Gatilhos recentes', valor: numero(String(gat)), nota: 'conta nova ou mudança nos últimos 120 dias' },
    ]);
    $('#ivR').innerHTML = rastroIds.map((id, i) => { const n = no(id); return n ? `${i ? '<span class="iv-seta" aria-hidden="true">→</span>' : ''}<button type="button" class="chip sm" data-s="${esc(id)}" aria-current="${id === R.semente}">${esc(curto(n.nome, 28))}</button>` : ''; }).join('');
    if (U.nos.size <= 1) {
      $('#ivQd').innerHTML = vazio({ titulo: 'Carregando o mapa', texto: 'Juntando contas, movimentações, empresas, agências e pessoas do Big Data.' });
      $('#ivL').innerHTML = ''; $('#ivG').innerHTML = ''; $('#ivFi').innerHTML = ''; $('#ivLn').innerHTML = ''; vazioAntes = true; return;
    }
    // cada ramificação na ordem dos pais: os filhos de um mesmo ponto ficam juntos, sob o nome dele, e os fios não se cruzam
    const col = (g: number) => {
      const l = G[g] || [], alc = M.camadas[g]?.ids.length ?? l.length;
      let ult = '', h = '';
      for (const r of l) { const p = g > 1 ? r.pais[0]?.id || '' : ''; if (p && p !== ult) h += `<p class="iv-grupo" title="${esc(no(p)?.nome || '')}">de ${esc(curto(no(p)?.nome || '', 30))}</p>`; ult = p; h += cartao(no(r.id)!, r.forca); }
      return `<div class="iv-col" style="--g:${g}"><h3 class="iv-ct">${GER[g]} <span>${l.length}${g && alc > l.length ? ` de ${alc}` : ''}</span></h3>${h}${g && alc > l.length ? `<p class="iv-m iv-mais">+${alc - l.length} pontos mais fracos nesta ramificação${ab === 1 ? ' · use "Ampla" para abrir mais' : ''}</p>` : ''}</div>`;
    };
    const n = R.geracoes.length;
    $('#ivQd').style.setProperty('--iv-grade', `minmax(0,.7fr) repeat(${Math.max(1, n - 1)},minmax(0,1fr))`);
    $('#ivQd').style.setProperty('--iv-min', `${n > 1 ? 190 + (n - 1) * 230 : 0}px`); // cada ramificação pede ~190px de cartão; o resto rola de lado, dentro do quadro
    $('#ivQd').innerHTML = `<svg class="iv-fios" id="ivF" aria-hidden="true"></svg>${R.geracoes.map((_, g) => col(g)).join('')}${n === 1 ? '<div class="iv-col"><p class="iv-m">Este ponto ainda não tem ligações no Big Data. Pesquise quem trabalha nele e por onde passou, e a reação abre daqui.</p></div>' : ''}`;
    // a reação entra em cascata quando muda o ponto de partida (ou na primeira vez que há dados), não a cada atualização
    const q = $('#ivQd');
    if (vazioAntes || R.semente !== ultimaSem) {
      animarAte = performance.now() + 1500; q.classList.add('entra');
      clearTimeout(tAnim); tAnim = window.setTimeout(() => { q.classList.remove('entra'); redesenhar(); }, 1600);
    } else if (performance.now() >= animarAte) q.classList.remove('entra');
    vazioAntes = false; ultimaSem = R.semente;
    acender(); desenhar(); ficha(); radar(L); graficos(L, todos.length); extintas(); tamanho();
  }

  /** Faixa "Hoje no mapa" e linha do tempo das chegadas. */
  function hoje() {
    const el = $('#ivH'), h = hojeISO();
    if (U.nos.size <= 1 || (!N.diaP && !N.diaM)) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const nv = naoVistos(), C = chegadas(U, movs, janela, h), max = Math.max(1, ...C.map((c) => c.pessoas));
    const parado = !foco && N.diaP && N.diaP < addDias(h, -2);
    const troca = (t: Novidades['trocas'][number]) => `<button type="button" class="chip sm" ${t.a ? `data-s="${esc(t.a)}"` : 'disabled'} title="${esc(t.tipo || 'troca de conta')}">${esc(curto(t.anunciante, 30))} <span aria-hidden="true">→</span> ${esc(curto(t.agencia, 30))}</button>`;
    const doDia = !!N.semente && R.semente === N.semente;
    el.innerHTML = `<div class="iv-hoje-c">
      <div class="iv-hoje-t"><span class="iv-pulso${nv ? ' vivo' : ''}" aria-hidden="true"></span><span class="lab">${foco ? 'Dia em foco · ' + dt(foco) : 'Hoje no mapa'}</span>${foco ? '<button type="button" class="lnk" data-dia="">voltar ao mais recente</button>' : ''}</div>
      <p class="iv-hoje-n"><span><b class="num">+${N.pessoas.length}</b>pessoas novas ou atualizadas${N.diaP ? ` <span class="note">coleta de ${dt(N.diaP)}</span>` : ''}</span><span><b class="num">${N.trocas.length}</b>troca${N.trocas.length === 1 ? '' : 's'} de conta${N.diaM ? ` <span class="note">notícias de ${dt(N.diaM)}</span>` : ''}</span></p>
      ${N.trocas.length ? `<div class="iv-hoje-tr">${N.trocas.slice(0, 4).map(troca).join('')}${N.trocas.length > 4 ? `<span class="note">e mais ${N.trocas.length - 4}</span>` : ''}</div>` : ''}
      ${parado ? `<p class="note">A coleta diária não traz pessoas desde ${dt(N.diaP)}. Confira em <a href="#rotinas">Rotinas do Claude</a>.</p>` : ''}
      <div class="iv-hoje-a">${N.semente && !doDia ? `<button type="button" data-s="${esc(N.semente)}">Abrir a reação pela troca ${foco ? 'deste dia' : 'do dia'}</button>` : ''}${novos.size ? `<button type="button" class="ghost" data-novos>Ver só o que é novo${nv ? ` · ${nv} não vistos` : ''}</button>` : ''}${nv ? '<button type="button" class="ghost" data-vistos>Marcar tudo como visto</button>' : ''}${doDia ? `<span class="note">A reação abaixo abriu por ${esc(no(N.semente!)?.nome || '')}.</span>` : ''}</div>
    </div>
    <div class="iv-linha"><div class="iv-linha-t"><span class="lab">Chegadas por dia</span><div class="seg sm" role="group" aria-label="Período da linha do tempo"><button type="button" data-jan="7" aria-pressed="${janela === 7}">7 dias</button><button type="button" data-jan="30" aria-pressed="${janela === 30}">30 dias</button></div></div>
      <div class="iv-barras" style="--n:${janela}">${C.map((c) => `<button type="button" class="iv-dia${c.dia === (foco || N.diaP) ? ' on' : ''}" data-dia="${c.dia}" aria-pressed="${c.dia === foco}" title="${dt(c.dia)}: ${c.pessoas} pessoa(s), ${c.contas} troca(s) de conta" aria-label="${dt(c.dia)}: ${c.pessoas} pessoas, ${c.contas} trocas de conta"><i style="height:${c.pessoas ? Math.max(5, Math.round(Math.sqrt(c.pessoas / max) * 100)) : 0}%"></i>${c.contas ? `<s>${c.contas}</s>` : ''}</button>`).join('')}</div>
      <div class="iv-barras-e note"><span>${dt(C[0].dia).slice(0, 5)}</span><span>hoje</span></div>
      <p class="note">Barra: pessoas que a coleta gravou. Selo: trocas de conta noticiadas. Clique num dia para ver o que chegou nele.</p></div>`;
  }

  /** O tamanho do multiverso: quantos pontos cada ramificação alcança, quantos a reação abriu e quantos ficam fora. */
  function tamanho() {
    const el = $('#ivMv'); if (U.nos.size <= 1) { el.innerHTML = ''; return; }
    const C = M.camadas.slice(1), max = Math.max(1, M.fora, ...C.map((c) => c.ids.length)), nome = no(M.semente)?.nome || '';
    const pc = (n: number) => `${Math.max(n ? 0.6 : 0, (n / max) * 100).toFixed(2)}%`;
    const linha = (c: (typeof C)[number]) => {
      const nAb = c.abertos, resto = c.ids.length - nAb, tipos = [[c.agencias, 'agência', 'agências'], [c.empresas, 'anunciante', 'anunciantes'], [c.pessoas, 'pessoa', 'pessoas']].filter(([n]) => n).map(([n, a, b]) => `${n} ${n === 1 ? a : b}`).join(' · ');
      return `<li class="iv-mv-l"><span class="iv-mv-g">${GER[c.ger] || c.ger + 'ª ramificação'}</span><span class="iv-mv-b" role="img" aria-label="${c.ids.length} pontos alcançados, ${nAb} abertos na reação"><i class="ab" style="width:${pc(nAb)}"></i><i class="al" style="width:${pc(resto)}"></i></span><span class="iv-mv-n"><b class="num">${c.ids.length}</b>${nAb ? ` <span class="note">${nAb} abertos</span>` : ''}</span><span class="iv-mv-t note">${tipos}${c.extintas ? ` · ${c.extintas} extinta${c.extintas > 1 ? 's' : ''}` : ''}</span></li>`;
    };
    el.innerHTML = `<header class="iv-mv-h"><h2 class="iv-h" id="ivMvT">Tamanho do multiverso</h2><p class="note">A partir de <b>${esc(nome)}</b>, as ligações do Big Data alcançam <b>${M.alcance}</b> dos ${M.total} pontos do mapa em <b>${C.length}</b> ramificações. A reação abre só os mais fortes de cada uma (preto); os demais estão alcançáveis (cinza) e aparecem em "Ampla", na busca e no arquivo baixado.</p></header>
      <ol class="iv-mv-lista">${C.map(linha).join('')}<li class="iv-mv-l fora"><span class="iv-mv-g">Fora de alcance</span><span class="iv-mv-b" aria-hidden="true"><i class="fo" style="width:${pc(M.fora)}"></i></span><span class="iv-mv-n"><b class="num">${M.fora}</b></span><span class="iv-mv-t note">pontos sem ligação com ${esc(curto(nome, 30))}: partem de outro ponto</span></li></ol>
      <p class="iv-mv-leg note"><span><i class="ab"></i>abertos na reação</span><span><i class="al"></i>alcançáveis</span><span><i class="fo"></i>fora de alcance</span></p>`;
  }

  /** O arquivo do mapa: HTML único, com o multiverso inteiro desenhado e navegável, para guardar ou mandar. */
  async function baixar(btn: HTMLButtonElement) {
    if (U.nos.size <= 1) return;
    const t = btn.textContent; btn.disabled = true; btn.textContent = 'Montando o arquivo…';
    try {
      const agora = new Date(), dados = dadosDoArquivo(U, R, M, { geradoEm: agora.toISOString(), novos });
      const html = htmlDoMapa(dados, fontesDaPagina());
      const nome = `mapa-investigacao-${slug(no(M.semente)?.nome || 'produceria')}-${agora.toISOString().slice(0, 10)}.html`;
      const msg = await baixarArquivo(nome, html);
      $('#ivLive').textContent = msg || 'Download cancelado.';
      if (msg) { btn.textContent = msg.startsWith('Arquivo salvo') ? 'Mapa baixado' : t; window.setTimeout(() => { btn.textContent = t; }, 2500); } else btn.textContent = t;
    } catch (e) { $('#ivLive').textContent = 'Não foi possível montar o arquivo: ' + mensagem(e); btn.textContent = t; }
    finally { btn.disabled = false; }
  }

  /** O ponto e todos os seus antecessores até a semente. */
  function subida(): Set<string> {
    const rm = ramos(), s = new Set([sel]), fila = [sel];
    while (fila.length) { const r = rm.get(fila.pop()!); for (const p of r?.pais || []) if (!s.has(p.id)) { s.add(p.id); fila.push(p.id); } }
    return s;
  }
  /** Ids acesos: o caminho até a semente e os filhos diretos do ponto. */
  function acesos(): Set<string> | null {
    if (!sel) return null;
    const s = subida();
    for (const r of ramos().values()) if (r.pais.some((p) => p.id === sel)) s.add(r.id);
    return s;
  }
  function acender() {
    const viz = acesos();
    root.querySelectorAll<HTMLElement>('.iv-quadro [data-n]').forEach((b) => { b.classList.toggle('on', b.dataset.n === sel); b.classList.toggle('apaga', !!viz && !viz.has(b.dataset.n || '')); b.setAttribute('aria-pressed', String(b.dataset.n === sel)); });
  }
  function desenhar() {
    const q0 = root.querySelector<HTMLElement>('#ivQd'), svg = root.querySelector<SVGSVGElement>('#ivF'); if (!q0 || !svg) return;
    const B = q0.getBoundingClientRect(); if (!B.width) return;
    svg.setAttribute('viewBox', `0 0 ${B.width} ${q0.scrollHeight}`); svg.style.height = q0.scrollHeight + 'px';
    const anima = performance.now() < animarAte; svg.classList.toggle('entra', anima);
    const pos = new Map<string, DOMRect>();
    q0.querySelectorAll<HTMLElement>('[data-n]').forEach((b) => pos.set(b.dataset.n || '', b.getBoundingClientRect()));
    const viz = acesos(), up = sel ? subida() : null; let s = '', pontos = '';
    for (const r of G.flat()) for (const [ip, p] of r.pais.entries()) {
      const a = pos.get(p.id), b = pos.get(r.id); if (!a || !b) continue;
      const lig = !up || p.id === sel || (up.has(p.id) && up.has(r.id));
      const x1 = a.right - B.left, y1 = a.top + a.height / 2 - B.top, x2 = b.left - B.left, y2 = b.top + b.height / 2 - B.top, m = (x2 - x1) / 2;
      const cls = p.rotulo === 'virou' ? 'f-sucessao' : p.id === ORIGEM || /^ponte/.test(p.rotulo) ? 'f-ponte' : no(r.id)?.tipo === 'pessoa' || no(p.id)?.tipo === 'pessoa' ? 'f-org-pessoa' : 'f-conta';
      s += `<path class="${cls}${ip ? ' f-extra' : ''}${novo(r.id) ? ' f-novo' : ''}${viz ? (lig ? ' acesa' : ' apaga') : ''}"${anima ? ` pathLength="1" style="--d:${(r.ger * 0.16 + 0.12).toFixed(2)}s"` : ''} d="M${x1},${y1} C${x1 + m},${y1 + 10} ${x2 - m},${y2 + 10} ${x2},${y2}"></path>`;
      if (viz && lig) pontos += `<circle cx="${x1}" cy="${y1}" r="3.5"></circle><circle cx="${x2}" cy="${y2}" r="3.5"></circle>`;
    }
    svg.innerHTML = s + pontos;
  }
  function ficha() {
    const n = sel ? no(sel) : undefined, el = $('#ivFi');
    $('#ivMesa').classList.toggle('com-ficha', !!n);
    if (!n) { el.innerHTML = ''; return; }
    const r = ramos().get(sel), cam = caminho(R, sel);
    const viz = (U.adj.get(sel) || []).slice().sort((a, b) => (no(b.b)?.nota || 0) - (no(a.b)?.nota || 0));
    const chip = (id: string, extra = '') => { const y = no(id); return y ? `<button type="button" class="chip sm" data-n="${esc(id)}">${esc(curto(y.nome, 34))}${extra}</button>` : ''; };
    el.innerHTML = `<article class="iv-dossie"><header><span class="iv-k">Dossiê · ${esc(TIPO[n.tipo])}${r ? ' · ' + esc(GER[r.ger] || '') : ''}</span><h3>${esc(n.nome)}</h3>${n.extinta ? '<span class="iv-car">Extinta</span>' : ''}<button type="button" class="iv-fechar" data-fechar aria-label="Fechar o dossiê">×</button></header>
    ${n.sub || n.org ? `<p><b>${esc(n.sub)}</b>${n.tipo === 'pessoa' && n.org ? ' · ' + esc(n.org) : ''}${n.nivel ? ` <span class="note">(${esc(ROT[n.nivel] || '')})</span>` : ''}</p>` : ''}
    ${n.tipo !== 'origem' && !n.extinta ? `<div><span class="lab">Possibilidade de negócio</span><div class="iv-forca"><span class="iv-bar" aria-hidden="true"><i style="width:${n.nota}%"></i></span><b class="num">${n.nota}</b></div></div>` : ''}
    ${n.fatos.length ? `<ul class="iv-fatos">${n.fatos.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${cam.length > 1 ? `<div><span class="lab">Caminho</span><p class="iv-cam">${cam.map((c, i) => `${i ? `<span class="iv-seta" aria-hidden="true">→</span><span class="iv-rot" title="${esc(c.rotulo)}">${esc(curto(c.rotulo, 34))}</span>` : ''}${chip(c.id)}`).join(' ')}</p></div>` : ''}
    ${r && r.pais.length > 1 ? `<p class="note">${r.pais.length} caminhos chegam aqui: ${r.pais.map((p) => esc(no(p.id)?.nome || '')).join(', ')}.</p>` : ''}
    ${viz.length ? `<div><span class="lab">Ligações no Big Data (${viz.length})</span><p class="iv-cam">${viz.slice(0, 10).map((a) => chip(a.b, ` <span class="iv-rot">${esc(curto(a.rotulo, 26))}</span>`)).join(' ')}${viz.length > 10 ? ` <span class="note">e mais ${viz.length - 10}</span>` : ''}</p></div>` : ''}
    ${n.fontes.length ? `<p class="note"><span class="lab">Fontes</span> ${[...new Set(n.fontes)].slice(0, 5).map((u) => link(u, host(u))).filter(Boolean).join(' · ')}</p>` : ''}
    <div class="iv-acoes">${sel !== R.semente ? `<button type="button" data-s="${esc(sel)}">Abrir a reação a partir daqui</button>` : ''}${n.tipo !== 'origem' && !n.extinta ? (n.alvo ? '<a class="tag ok" href="#captacao">Já está no radar da Captação</a>' : `<button type="button" class="ghost" data-alvo="${esc(sel)}">Pôr no radar da Captação</button>`) : ''}<a class="lnk" href="#bigdata">Ver no Big Data</a></div></article>`;
  }

  function radar(L: ReturnType<typeof leads>) {
    const diretas = new Set((U.adj.get(ORIGEM) || []).map((a) => a.b)), semPonte = (x: (typeof L)[number]) => !diretas.has(x.id) && !x.no.fatos.some((f) => /ponte/i.test(f));
    if (lf === 'novo') { const rm = ramos(); L = [...novos].map((id) => ({ id, no: no(id)!, forca: rm.get(id)?.forca ?? no(id)?.nota ?? 0, pais: [], ger: rm.get(id)?.ger ?? 0 })).filter((x) => x.no && !x.no.extinta && x.no.tipo !== 'origem').sort((a, b) => b.forca - a.forca); }
    else L = L.filter((x) => !lf || (lf === 'pessoa' ? x.no.tipo === 'pessoa' : lf === 'org' ? x.no.tipo !== 'pessoa' : semPonte(x)));
    const resto = L.length - lim;
    $('#ivLM').innerHTML = resto > 0 ? `<button type="button" class="ghost" data-rmais>Mostrar mais ${Math.min(10, resto)} (${resto} restantes)</button>` : '';
    $('#ivL').innerHTML = L.length ? L.slice(0, lim).map((x) => {
      const cam = caminho(R, x.id).map((c) => no(c.id)?.nome || '').join(' → ');
      return `<li class="iv-ld${x.id === sel ? ' on' : ''}"><span class="iv-ldn num">${x.forca}</span><span class="iv-ldc"><button type="button" class="lnk" data-n="${esc(x.id)}"><b>${esc(x.no.nome)}</b></button>${novo(x.id) ? ' <span class="iv-novo">novo</span>' : ''} <span class="note">${esc(TIPO[x.no.tipo])}${x.no.tipo === 'pessoa' ? ' · ' + esc(curto(x.no.sub, 50)) + (x.no.org ? ' · ' + esc(x.no.org) : '') : ''}</span><span class="iv-m">${esc(curto(cam, 140))}</span>${x.no.fatos.length ? `<span class="iv-fatos-l">${x.no.fatos.slice(0, 3).map((f) => `<span>${esc(f)}</span>`).join('')}</span>` : ''}</span><span class="iv-lda">${x.no.alvo ? '<span class="tag ok">no radar</span>' : `<button type="button" class="ghost sm" data-alvo="${esc(x.id)}">Pôr no radar</button>`}<button type="button" class="ghost sm" data-s="${esc(x.id)}">Partir daqui</button></span></li>`;
    }).join('') : `<li class="note">${lf === 'novo' ? 'Nada novo neste dia.' : 'Nenhuma possibilidade a partir deste ponto ainda.'}</li>`;
  }

  function graficos(L: ReturnType<typeof leads>, total: number) {
    const gat = (f: string) => /^Conta nova|^Mudou de agência/.test(f) ? 'Conta nova ou mudança' : /^Encaixe/.test(f) ? 'Encaixe do craft' : /^Contrata/.test(f) ? 'Quem contrata produção' : /ponte/i.test(f) ? 'Ponte com a PRODUCERIA' : /maior anunciante/.test(f) ? 'Grande anunciante' : /Independente/.test(f) ? 'Agência independente' : '';
    $('#ivG').innerHTML = painel([
      barras('Mais fortes da reação', L.slice(0, 8).map((x) => ({ rotulo: x.no.nome, valor: x.forca, dado: x.id })), { attr: 'n', nota: 'clique para acender o caminho' }),
      barras('Possibilidades por ramificação', R.geracoes.slice(1).map((g, i) => ({ rotulo: GER[i + 1], valor: g.filter((r) => !no(r.id)?.extinta).length })), { nota: `${total - 1} pontos abertos` }),
      barras('Por tipo', contar(L, (x) => (x.no.tipo === 'pessoa' ? 'Pessoa · ' + (ROT[x.no.nivel || ''] || '') : TIPO[x.no.tipo])), { nota: 'empresas, agências e pessoas' }),
      barras('Gatilhos', contar(L.flatMap((x) => x.no.fatos.map(gat).filter(Boolean).map((g) => ({ g }))), (y) => y.g), { nota: 'por que cada ponto entrou no radar' }),
    ], 'Gráficos da reação');
  }

  function extintas() {
    const ext = ags.filter((o) => o.perfil === 'extinta');
    $('#ivLn').innerHTML = ext.length ? `<ol class="iv-ln">${ext.map((o) => { const l = linhagem(o, ags); return `<li><div class="iv-trilha">${l.map((y, i) => { const id = [...U.nos.values()].find((n) => n.nome === y.nome)?.id || ''; return `<button type="button" class="iv-et${y.perfil === 'extinta' ? ' ext' : ' viva'}" ${id ? `data-s="${esc(id)}"` : 'disabled'}>${esc(y.nome)}${y.perfil === 'extinta' ? '<i>extinta</i>' : i ? '<i>hoje</i>' : ''}</button>`; }).join('<span class="iv-seta" aria-hidden="true">→</span>')}</div></li>`; }).join('')}</ol>` : '<p class="note">Nenhuma agência marcada como extinta no Big Data.</p>';
  }

  const reabrir = () => { lim = 10; R = reacao(U, rastroIds[rastroIds.length - 1], LIMITES.map((l) => Math.round(l * (ab === 2 ? 1.8 : 1)))); G = ordenarReacao(R); M = multiverso(U, R.semente, R); if (sel && !ramos().has(sel)) sel = ''; render(); };
  const recalcular = () => {
    const G = montarGrafo({ mercado, movimentos: movs, empresas: emp, agencias: ags, pessoas: pes.filter((p) => p.nome && p.organizacao) as PessoaMapa[] });
    U = montarUniverso({ empresas: G.empresas, agencias: G.agencias, pessoas: pes, orgsInv: [...ags, ...emp], alvos });
    rastroIds = rastroIds.filter((id) => U.nos.has(id)); if (!rastroIds.length) rastroIds = [ORIGEM];
    // na chegada, a reação abre pela troca de conta mais recente (até 7 dias), com a PRODUCERIA no rastro para voltar
    abriuDia = false;
    if (auto && movs.length && pes.length && rastroIds.length === 1 && rastroIds[0] === ORIGEM) {
      const n0 = novidades(U, movs);
      if (n0.semente && n0.diaM >= addDias(hojeISO(), -7)) { rastroIds = [ORIGEM, n0.semente]; abriuDia = true; }
      auto = false;
    }
    reabrir();
    if (abriuDia) $('#ivLive').textContent = `A reação abriu pela troca de conta de ${dt(N.diaM)}: ${no(R.semente)?.nome || ''}. Volte à PRODUCERIA pelo rastro.`;
  };
  let tRe = 0;
  const agendar = () => { clearTimeout(tRe); tRe = window.setTimeout(recalcular, 60); };

  const partir = (id: string) => {
    if (!U.nos.has(id)) return;
    const i = rastroIds.indexOf(id); rastroIds = i >= 0 ? rastroIds.slice(0, i + 1) : [...rastroIds, id].slice(-6);
    sel = ''; reabrir(); $('#ivLive').textContent = `Reação a partir de ${no(id)!.nome}: ${leads(U, R).length} possibilidades`;
    const rolo = $('#ivRolo'); rolo.scrollTo({ top: 0, left: 0 }); if (rolo.getBoundingClientRect().top < 0) rolo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const escolher = (id: string) => {
    sel = sel === id ? '' : id;
    if (sel && novo(sel)) { visto.add(sel); guardar(); root.querySelectorAll<HTMLElement>(`[data-n="${CSS.escape(sel)}"]`).forEach((b) => { b.classList.remove('novo'); b.querySelector('.iv-novo')?.remove(); b.parentElement?.querySelector('.iv-novo')?.remove(); }); hoje(); }
    acender(); desenhar(); ficha(); radar(leads(U, R)); const n = no(sel); $('#ivLive').textContent = n ? `${n.nome} selecionado` : 'Seleção desfeita'; };

  async function porNoRadar(id: string, btn: HTMLButtonElement) {
    const n = no(id); if (!n) return;
    const org = n.tipo === 'pessoa' ? [...(U.adj.get(id) || [])].map((a) => no(a.b)).find((y) => y && (y.tipo === 'empresa' || y.tipo === 'agencia')) : n;
    const nome = org?.nome || n.org || n.nome;
    const cam = caminho(R, id).map((c) => no(c.id)?.nome || '').join(' → ');
    const pessoas = (U.adj.get(org?.id || '') || []).map((a) => no(a.b)).filter((y): y is NoU => !!y && y.tipo === 'pessoa');
    const doc: Alvo = { id: 'al-' + slug(nome), nome, perfil: org?.tipo === 'agencia' ? (/independente/i.test(ags.find((a) => a.nome === org.nome)?.perfil || '') ? 'independente' : 'rede') : 'inhouse',
      contato: (n.tipo === 'pessoa' ? [n, ...pessoas.filter((p) => p.id !== id)] : pessoas).slice(0, 4).map((p) => `${p.nome} (${p.sub})`).join('; '),
      gatilho: `Reação em cadeia: ${cam}. ${n.fatos.slice(0, 2).join('; ')}`, fonte: n.fontes[0] || org?.fontes[0] || '', status: 'Mapeado',
      proximoPasso: n.tipo === 'pessoa' ? `Abordar ${n.nome} pelo caminho mapeado` : 'Achar quem contrata produção e fazer o primeiro contato', prazo: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), notas: '', origem: 'Investigação · reação em cadeia', criadoEm: new Date().toISOString() } as Alvo;
    if (alvos.some((a) => a.id === doc.id)) { $('#ivLive').textContent = `${nome} já está no radar da Captação.`; return; }
    btn.disabled = true; btn.textContent = 'Criando…';
    if (!colAlvos) { alvos = [...alvos, doc]; agendar(); $('#ivLive').textContent = `${nome} entrou no radar (só nesta sessão).`; return; }
    try { await colAlvos.doc(doc.id).set(doc); $('#ivLive').textContent = `${nome} entrou no radar da Captação, coluna Mapeado.`; }
    catch (e) { btn.disabled = false; btn.textContent = 'Tentar de novo'; $('#ivLive').textContent = 'Não foi possível criar o alvo: ' + mensagem(e); }
  }

  root.addEventListener('click', (ev) => {
    const el = elDe(ev);
    auto = false; // quem já mexeu no mapa não é levado para outro ponto quando chegam dados
    const a = el.closest<HTMLButtonElement>('[data-alvo]'); if (a) { ev.preventDefault(); porNoRadar(a.dataset.alvo || '', a); return; }
    const bx = el.closest<HTMLButtonElement>('[data-baixar]'); if (bx) { ev.preventDefault(); baixar(bx); return; }
    const d = el.closest<HTMLElement>('[data-dia]'); if (d) { const v = d.dataset.dia || ''; foco = foco === v ? '' : v; auto = false; if (lf === 'novo') lim = 10; render(); $('#ivLive').textContent = foco ? `Dia em foco: ${dt(foco)}` : 'De volta ao mais recente'; return; }
    const j = el.closest<HTMLElement>('[data-jan]'); if (j) { janela = Number(j.dataset.jan) || 30; hoje(); return; }
    if (el.closest('[data-novos]')) { lf = 'novo'; lim = 10; $('#ivLF').querySelectorAll<HTMLElement>('[data-lf]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lf === 'novo'))); radar(leads(U, R)); $('#ivLT').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (el.closest('[data-vistos]')) { novos.forEach((id) => visto.add(id)); guardar(); render(); $('#ivLive').textContent = 'Tudo marcado como visto'; return; }
    const s = el.closest<HTMLElement>('[data-s]'); if (s) { ev.preventDefault(); auto = false; $<HTMLInputElement>('#ivQ').value = ''; $('#ivS').innerHTML = ''; partir(s.dataset.s || ''); return; }
    if (el.closest('[data-fechar]')) { const v = sel; escolher(sel); root.querySelector<HTMLElement>(`.iv-quadro [data-n="${CSS.escape(v)}"]`)?.focus(); return; }
    if (el.closest('[data-rmais]')) { lim += 10; radar(leads(U, R)); return; }
    const f = el.closest<HTMLElement>('[data-lf]'); if (f) { lf = f.dataset.lf || ''; lim = 10; $('#ivLF').querySelectorAll<HTMLElement>('[data-lf]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); radar(leads(U, R)); return; }
    const k = el.closest<HTMLElement>('[data-ab]'); if (k) { ab = Number(k.dataset.ab) || 1; $('#ivA').querySelectorAll<HTMLElement>('[data-ab]').forEach((b) => b.setAttribute('aria-pressed', String(b === k))); reabrir(); return; }
    const b = el.closest<HTMLElement>('[data-n]'); if (!b || !root.contains(b)) return;
    ev.preventDefault(); const id = b.dataset.n || '';
    if (!ramos().has(id)) { partir(id); return; } // ponto fora da reação: abre a partir dele
    escolher(id); if (b.closest('#ivFi, #ivL, #ivG')) root.querySelector<HTMLElement>(`.iv-quadro [data-n="${CSS.escape(sel)}"]`)?.focus();
  });
  const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && sel && !(ev.target as HTMLElement).closest?.('#ivQ')) { const v = sel; escolher(sel); root.querySelector<HTMLElement>(`.iv-quadro [data-n="${CSS.escape(v)}"]`)?.focus(); } };
  document.addEventListener('keydown', tecla);
  $<HTMLInputElement>('#ivQ').oninput = (e) => {
    const l = buscarNo(U, (e.target as HTMLInputElement).value);
    $('#ivS').innerHTML = l.map((n) => `<button type="button" role="listitem" data-s="${esc(n.id)}"><b>${esc(n.nome)}</b> <span class="note">${esc(TIPO[n.tipo])}${n.sub ? ' · ' + esc(curto(n.sub, 40)) : ''}</span></button>`).join('');
  };
  let quadro = 0;
  const redesenhar = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(desenhar); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redesenhar) : null;
  ro?.observe($('#ivQd'));
  document.fonts?.ready.then(redesenhar).catch(() => {});
  render();
  lerBase<MercadoBase>('mercado').then((m) => { mercado = m; agendar(); }).catch(() => {});
  (async () => {
    const db = await banco(); if (!db) return;
    const sub = <T>(nome: string, f: (l: T[]) => void) => offs.push(db.collection<T>(nome).onSnapshot((s) => { f(s.docs.map(comId) as T[]); agendar(); }, () => {}));
    sub<MovimentoBase & { id: string }>('movimentos', (l) => { movs = l; });
    sub<PessoaInv>('mapa_pessoas', (l) => { pes = l; });
    sub<AgenciaMapa & OrgInv>('mapa_agencias', (l) => { ags = l; });
    sub<EmpresaMapa & OrgInv>('mapa_empresas', (l) => { emp = l; });
    colAlvos = db.collection<Alvo>('alvos');
    sub<Alvo>('alvos', (l) => { alvos = l; });
  })();
  return () => { document.removeEventListener('keydown', tecla); ro?.disconnect(); cancelAnimationFrame(quadro); clearTimeout(tRe); clearTimeout(tAnim); for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}
