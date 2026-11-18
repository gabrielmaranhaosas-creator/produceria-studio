// Big Data do mercado: anunciantes (dos grandes aos que mais investem), as agências que os atendem e as pessoas
// que decidem em cada lado, tudo ligado e com fonte. A base publicada dá o ponto de partida; a rotina diária amplia.
import { esc, int, dt } from '../lib/formato';
import { chave, slug, nomeLegivel, mesmaEmpresa } from '../lib/nomes';
import { banco, lerBase, type Colecao } from '../lib/db';
import { montarGrafo, nivelDe, notaEncaixe, NIVEIS, CRITERIOS, TIPOS_PILULA, type TipoPilula, type Pilula, type Cenario, type Nivel, type Grafo, type NoEmpresa, type NoAgencia, type PessoaMapa, type EmpresaMapa, type AgenciaMapa, type MercadoBase, type MovimentoBase } from '../lib/grafo';
import type { Alvo } from '../lib/tipos';
import { seletor, elDe, mensagem, comId, type Dialogo } from './dom';
import { kpis, numero, vazio, barras, contar, painel, sugerir, irPara, type Barra } from '../componentes';

type Visao = 'empresas' | 'radar' | 'agencias' | 'pessoas';
const VISOES: [Visao, string][] = [['empresas', 'Anunciantes'], ['radar', 'Fora do radar'], ['agencias', 'Agências'], ['pessoas', 'Pessoas']];
const link = (url: string, texto: string) => url ? `<a class="cn-f" href="${esc(url)}" target="_blank" rel="noopener">${texto} ↗<span class="sr"> (abre em nova aba)</span></a>` : '';
const redes = (o: { site?: string; instagram?: string; linkedin?: string }) => [link(o.site || '', 'Site'), link(o.instagram || '', 'Instagram'), link(o.linkedin || '', 'LinkedIn')].filter(Boolean).join(' ');
const veiculo = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'fonte'; } };
const ORDEM: Record<Nivel, number> = { contrata: 0, aprova: 1, lidera: 2 };
const rotuloNivel = (n: Nivel) => (NIVEIS.find((x) => x[0] === n) || NIVEIS[1])[1];
const portas = (l: PessoaMapa[]) => l.filter((p) => nivelDe(p) === 'contrata').length;
/** Bloco "por que o craft encaixa": critérios comprovados, serviços, sinais com fonte e a ação proposta. */
export function blocoRadar(e: NoEmpresa): string {
  const r = e.radar; if (!r) return '';
  const tem = new Set(r.criterios);
  return `<section class="bd-radar" aria-label="Encaixe do craft"><h3 class="bd-h">Fora do radar · encaixe do craft <span class="bd-nota num">${notaEncaixe(r)}</span><span class="note">/100</span></h3>
  <p>${esc(r.porque)} <span class="tag">hipótese</span></p>
  <ul class="bd-crit">${CRITERIOS.map(([k, peso, t, s]) => `<li class="${tem.has(k) ? 'sim' : 'nao'}"><span aria-hidden="true">${tem.has(k) ? '●' : '○'}</span> <b>${esc(t)}</b> <span class="note">${esc(s)} · ${tem.has(k) ? '+' + peso : 'não comprovado'}</span></li>`).join('')}</ul>
  ${r.servicos?.length ? `<p><span class="lab">O que oferecer</span> ${r.servicos.map((x) => `<span class="chip sm">${esc(x)}</span>`).join(' ')}</p>` : ''}
  ${r.sinais?.length ? `<h3 class="bd-h">Sinais</h3><ul class="bd-lig">${[...r.sinais].sort((a, b) => (b.data || '').localeCompare(a.data || '')).map((x) => `<li>${x.data ? `<span class="note">${esc(dt(x.data))}</span> ` : ''}${esc(x.texto)} ${link(x.fonte, veiculo(x.fonte))}</li>`).join('')}</ul>` : ''}
  ${r.pilulas?.length ? `<h3 class="bd-h">Pílulas de ação</h3><ul class="bd-pil">${r.pilulas.map((x) => cartaoPilula(x)).join('')}</ul>` : ''}
  ${r.acao ? `<p class="bd-acao"><span class="lab">Ação proposta</span> ${esc(r.acao)}</p>` : ''}</section>`;
}
const CURTO: Record<string, string> = { imagem: 'Imagem', lancamentos: 'Lançamentos', varejo: 'Varejo', multicanal: 'Multicanal', porta: 'Porta aberta', verba: 'Verba' };
const rotuloPilula = (t: TipoPilula) => (TIPOS_PILULA.find((x) => x[0] === t) || TIPOS_PILULA[0])[1];
/** Cartão de uma pílula de ação; com a empresa, vira atalho para a ficha dela. */
export function cartaoPilula(x: Pilula, empresa?: string): string {
  return `<li class="bd-pc p-${esc(x.tipo)}"><span class="lab">${esc(rotuloPilula(x.tipo))}</span><b>${esc(x.titulo)}</b><p>${esc(x.texto)}</p>
  ${empresa || x.prazo ? `<span class="bd-pc-pe">${empresa ? `<button type="button" class="chip sm" data-org="${esc(empresa)}">${esc(nomeLegivel(empresa))}</button>` : ''}${x.prazo ? `<span class="note">até ${esc(dt(x.prazo))}</span>` : ''}</span>` : ''}</li>`;
}
/** Leitura do mercado: fato com fonte e o que a Produceria faz com ele. */
export function faixaCenario(L: Cenario[]): string {
  if (!L.length) return '';
  return `<section class="bd-cen" aria-labelledby="bdCenT"><h3 class="bd-h" id="bdCenT">Leitura do mercado</h3><ul class="bd-cen-l">${[...L].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 6).map((c) => `<li>
  <span class="note">${esc(dt(c.data))}${c.tipo ? ' · ' + esc(rotuloPilula(c.tipo)) : ''}</span><b>${esc(c.titulo)}</b><p class="note">${esc(c.texto)}</p>
  <p class="bd-cen-a"><span class="lab">O que fazer</span> ${esc(c.implicacao)}</p>${link(c.fonte, veiculo(c.fonte))}</li>`).join('')}</ul></section>`;
}
const curto = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Mapa de conexões: a organização no centro, quem trabalha com ela em volta e as pessoas de cada lado, por nível. */
export function mapaConexoes(centro: { nome: string; pessoas: PessoaMapa[] }, vizinhos: { nome: string; pessoas: PessoaMapa[]; data: string }[]): string {
  const W = 680, H = 400, cx = W / 2, cy = H / 2, rx = 205, ry = 135;
  const V = [...vizinhos].sort((a, b) => b.pessoas.length - a.pessoas.length || (b.data || '').localeCompare(a.data || '')).slice(0, 12);
  const pts = (n: number, i: number, ox: number, oy: number, rr: number, ry2 = rr, desloc = -Math.PI / 2) => { const t = desloc + (2 * Math.PI * i) / Math.max(n, 1); return [ox + rr * Math.cos(t), oy + ry2 * Math.sin(t), t] as const; };
  const pessoaNo = (p: PessoaMapa, x: number, y: number) => `<g class="bd-pn n-${nivelDe(p)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${nivelDe(p) === 'lidera' ? 4 : 6}"></circle><title>${esc(p.nome)} · ${esc(p.cargo)} · ${esc(rotuloNivel(nivelDe(p)))}</title></g>`;
  let linhas = '', nos = '', gente = '';
  V.forEach((v, i) => {
    const [x, y, t] = pts(V.length, i, cx, cy, rx, ry);
    linhas += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
    const ps = [...v.pessoas].sort((a, b) => ORDEM[nivelDe(a)] - ORDEM[nivelDe(b)]).slice(0, 4);
    ps.forEach((p, j) => { const a = t + Math.PI + (j - (ps.length - 1) / 2) * 0.55, px = x + 30 * Math.cos(a), py = y + 30 * Math.sin(a); gente += `<line class="bd-lp" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"></line>` + pessoaNo(p, px, py); });
    const anc = Math.cos(t) > 0.35 ? 'start' : Math.cos(t) < -0.35 ? 'end' : 'middle', dx = anc === 'start' ? 16 : anc === 'end' ? -16 : 0, dy = anc === 'middle' ? (Math.sin(t) > 0 ? 26 : -18) : 4;
    nos += `<g class="bd-vn" data-org="${esc(v.nome)}" role="button" tabindex="0" aria-label="Abrir ${esc(nomeLegivel(v.nome))}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"></circle><text x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anc}">${esc(curto(nomeLegivel(v.nome), anc === 'middle' ? 24 : 17))}</text></g>`;
  });
  const cp = [...centro.pessoas].sort((a, b) => ORDEM[nivelDe(a)] - ORDEM[nivelDe(b)]).slice(0, 10);
  cp.forEach((p, j) => { const [x, y] = pts(cp.length, j, cx, cy, 62, 50, Math.PI / 2); gente += `<line class="bd-lp" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>` + pessoaNo(p, x, y); });
  return `<figure class="bd-mapa"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de conexões de ${esc(nomeLegivel(centro.nome))}: ${V.length} organizações e ${cp.length} pessoas">
  <g class="bd-ls">${linhas}</g>${gente}${nos}<g class="bd-cn"><circle cx="${cx}" cy="${cy}" r="30"></circle><text x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(curto(nomeLegivel(centro.nome), 9))}</text><title>${esc(nomeLegivel(centro.nome))}</title></g></svg>
  <figcaption class="bd-leg">${NIVEIS.map(([n, t]) => `<span><i class="n-${n}"></i>${t}</span>`).join('')}<span><i class="bd-vi"></i>Organização ligada (clique para abrir)</span></figcaption></figure>`;
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap">
 <section class="kpis" id="bdK" aria-label="Tamanho da base"></section>
 <section class="bar cnbar" aria-label="Filtros do Big Data">
  <div class="f f-wide" role="group" aria-labelledby="bdLV"><span class="lab" id="bdLV">Ver</span><div class="pills" id="bdV"></div></div>
  <div class="f"><label for="bdQ">Buscar</label><input id="bdQ" type="search" placeholder="Anunciante, agência, pessoa ou setor" autocomplete="off"></div>
  <div class="f"><label for="bdO">Ordenar</label><select id="bdO"><option value="relevancia">Relevância</option><option value="recente">Movimento mais recente</option><option value="nome">Nome</option></select></div>
 </section>
 <div id="bdPn"></div>
 <p class="sr" id="bdLive" aria-live="polite"></p>
 <div id="bdL"></div></div><dialog id="bdD" class="bd-det" aria-labelledby="bdDT"></dialog>`;
  const $ = seletor(root);
  let mercado: MercadoBase | null = null, cen: Cenario[] = [], movs: MovimentoBase[] = [], emp: EmpresaMapa[] = [], ags: AgenciaMapa[] = [], pes: PessoaMapa[] = [], alvos: Alvo[] = [];
  let G: Grafo = montarGrafo({}), colAlvos: Colecao<Alvo> | null = null, lim = 60;
  const offs: (() => void)[] = [];
  const F: { v: Visao; q: string; o: string; n: Nivel | ''; r: 'lista' | 'pilulas'; p: TipoPilula | '' } = { v: 'empresas', q: '', o: 'relevancia', n: '', r: 'lista', p: '' };
  try { const sv = JSON.parse(localStorage.getItem('bd.filtros') || 'null'); if (sv) Object.assign(F, sv); } catch { /* sem armazenamento */ }
  const ehAlvo = (nome: string) => alvos.some((a) => a.id === 'al-' + slug(nome) || mesmaEmpresa(a.nome, nome));

  const recalcular = () => { G = montarGrafo({ mercado, movimentos: movs, empresas: emp, agencias: ags, pessoas: pes }); render(); };

  function linhaEmpresa(e: NoEmpresa): string {
    const ags = [...new Set(e.ligacoes.map((l) => l.agencia))];
    return `<li><button type="button" class="bd-linha" data-e="${esc(e.k)}">
  <span class="bd-rank num">${e.ranking ? e.ranking + 'º' : '·'}</span>
  <span class="bd-c"><b>${esc(nomeLegivel(e.nome))}</b><span class="note">${esc([e.setor, e.grupo].filter(Boolean).join(' · ') || (e.ranking ? 'entre os 20 que mais investiram em mídia em 2025' : 'anunciante'))}${ags.length ? ' · ' + esc(ags.slice(0, 3).map(nomeLegivel).join(', ')) + (ags.length > 3 ? ` e mais ${ags.length - 3}` : '') : ''}</span></span>
  <span class="bd-n" title="${int(e.pessoas.length)} pessoa(s) mapeada(s)"><b class="num">${int(portas(e.pessoas))}</b><span class="note">porta(s) de entrada</span></span>
  <span class="bd-n"><b class="num">${int(ags.length)}</b><span class="note">agência(s)</span></span></button></li>`;
  }
  function linhaRadar(e: NoEmpresa): string {
    const nota = notaEncaixe(e.radar), tem = new Set(e.radar?.criterios || []);
    return `<li><button type="button" class="bd-linha" data-e="${esc(e.k)}">
  <span class="bd-rank bd-enc num" title="Encaixe do craft, de 0 a 100">${nota}<span class="bd-meter" aria-hidden="true"><i style="width:${nota}%"></i></span></span>
  <span class="bd-c"><b>${esc(nomeLegivel(e.nome))}</b><span class="note">${esc(e.setor || 'anunciante')}${e.radar?.servicos?.length ? ' · ' + esc(e.radar.servicos.slice(0, 4).join(', ')) : ''}${e.radar?.pilulas?.length ? ` · ${int(e.radar.pilulas.length)} pílula(s) de ação` : ''}</span>
   <span class="bd-crits" aria-label="Critérios comprovados">${CRITERIOS.filter(([k]) => tem.has(k)).map(([k, , t]) => `<span class="bd-ct" title="${esc(t)}">${esc(CURTO[k])}</span>`).join('')}</span></span>
  <span class="bd-n" title="${int(e.pessoas.length)} pessoa(s) mapeada(s)"><b class="num">${int(e.pessoas.length)}</b><span class="note">pessoa(s)</span></span>
  <span class="bd-n"><b class="num">${int(new Set(e.ligacoes.map((l) => l.agencia)).size)}</b><span class="note">agência(s)</span></span></button></li>`;
  }
  function linhaAgencia(a: NoAgencia): string {
    const cl = [...new Set(a.ligacoes.map((l) => l.empresa))];
    return `<li><button type="button" class="bd-linha" data-a="${esc(a.k)}">
  <span class="bd-rank num" title="${a.cenp ? 'Posição no Cenp-Meios 2025' : ''}">${a.cenp ? a.cenp + 'º' : '·'}</span>
  <span class="bd-c"><b>${esc(nomeLegivel(a.nome))}</b><span class="note">${esc([a.grupo, a.perfil, a.uf].filter(Boolean).join(' · '))}${cl.length ? ' · ' + esc(cl.slice(0, 3).map(nomeLegivel).join(', ')) + (cl.length > 3 ? ` e mais ${cl.length - 3}` : '') : ''}</span></span>
  <span class="bd-n" title="${int(a.pessoas.length)} pessoa(s) mapeada(s)"><b class="num">${int(portas(a.pessoas))}</b><span class="note">porta(s) de entrada</span></span>
  <span class="bd-n"><b class="num">${int(cl.length)}</b><span class="note">cliente(s)</span></span></button></li>`;
  }
  function linhaPessoa(p: PessoaMapa): string {
    const n = nivelDe(p);
    return `<li><div class="bd-linha bd-pessoa"><span class="bd-c"><b>${esc(p.nome)} <span class="bd-nv n-${n}">${esc(rotuloNivel(n))}</span></b><span class="note">${esc(p.cargo)}${p.campanha ? ' · ' + esc(p.campanha) : ''}</span></span>
  <span class="bd-org"><button type="button" class="chip sm" data-org="${esc(p.organizacao)}">${esc(nomeLegivel(p.organizacao))}</button></span>
  <span class="bd-links">${redes(p)} ${link(p.fonte, veiculo(p.fonte))}</span></div></li>`;
  }

  function render() {
    try { localStorage.setItem('bd.filtros', JSON.stringify(F)); } catch { /* sem armazenamento */ }
    $('#bdV').innerHTML = VISOES.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${F.v === v}">${t} <span class="note">${int(v === 'empresas' ? G.empresas.length : v === 'radar' ? G.empresas.filter((e) => e.radar).length : v === 'agencias' ? G.agencias.length : G.pessoas.length)}</span></button>`).join('');
    const qi = $<HTMLInputElement>('#bdQ'); if (document.activeElement !== qi) qi.value = F.q;
    $<HTMLSelectElement>('#bdO').value = F.o;
    const comFonte = G.ligacoes.filter((l) => l.fonte).length;
    $('#bdK').innerHTML = kpis([
      { rotulo: 'Anunciantes', valor: numero(int(G.empresas.length)), nota: `${int(G.empresas.filter((e) => e.ranking).length)} entre os maiores investidores em mídia`, kpi: 'empresas', ativo: F.v === 'empresas' && !F.q, acao: 'Ver os anunciantes' },
      { rotulo: 'Agências', valor: numero(int(G.agencias.length)), nota: `${int(G.agencias.filter((a) => a.perfil === 'rede').length)} de redes globais`, kpi: 'agencias', ativo: F.v === 'agencias' && !F.q, acao: 'Ver as agências' },
      { rotulo: 'Pessoas', valor: numero(int(G.pessoas.length)), nota: `${int(portas(G.pessoas))} contratam produção · ${int(G.pessoas.filter((p) => nivelDe(p) === 'aprova').length)} aprovam`, kpi: 'pessoas', ativo: F.v === 'pessoas' && !F.q && !F.n, acao: 'Ver as pessoas' },
      { rotulo: 'Ligações', valor: numero(int(G.ligacoes.length)), nota: `${int(comFonte)} com link da fonte`, href: '#investigacao', acao: 'Ver as ligações no mapa' },
    ]);
    const q = chave(F.q);
    const porNome = (x: { nome: string }, y: { nome: string }) => chave(x.nome).localeCompare(chave(y.nome));
    const ordem = <T extends { nome: string; ultima?: string }>(L: T[]) => F.o === 'nome' ? [...L].sort((x, y) => chave(x.nome).localeCompare(chave(y.nome))) : F.o === 'recente' ? [...L].sort((x, y) => (y.ultima || '').localeCompare(x.ultima || '')) : L;
    let html = '', n = 0, pn: string[] = [];
    const busca = (b: Barra[]) => b.map((x) => ({ ...x, ativo: chave(x.rotulo) === q }));
    // "Sem setor" não é setor: fica fora das barras (esmagava a escala e não filtrava nada) e vira nota com a contagem
    const porSetor = (L: NoEmpresa[]) => { const sem = L.filter((e) => !e.setor).length; return barras('Por setor', busca(contar(L, (e) => e.setor)), { attr: 'q', nota: `clique para filtrar${sem ? ` · ${int(sem)} de ${int(L.length)} ainda sem setor no Big Data` : ''}`, vazio: 'Nenhuma empresa com setor informado.' }); };
    const nAg = (e: NoEmpresa) => new Set(e.ligacoes.map((l) => l.agencia)).size;
    if (F.v === 'empresas') {
      const L = ordem(G.empresas.filter((e) => !q || chave([e.nome, e.setor, e.grupo, ...e.ligacoes.map((l) => l.agencia), ...e.pessoas.map((p) => p.nome)].join(' ')).includes(q)));
      pn = [porSetor(L),
        barras('Mais agências ligadas', L.map((e) => ({ rotulo: nomeLegivel(e.nome), valor: nAg(e), dado: e.k })).sort((a, b) => b.valor - a.valor), { attr: 'e', nota: 'clique para abrir' }),
        barras('Mais portas de entrada', L.map((e) => ({ rotulo: nomeLegivel(e.nome), valor: portas(e.pessoas), dado: e.k })).sort((a, b) => b.valor - a.valor), { attr: 'e', nota: 'pessoas que contratam produção' })];
      n = L.length; html = L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaEmpresa).join('')}</ul>` : '';
    } else if (F.v === 'radar') {
      const base = G.empresas.filter((e) => e.radar && (!q || chave([e.nome, e.setor, e.radar.porque, ...(e.radar.servicos || []), ...e.ligacoes.map((l) => l.agencia), ...e.pessoas.map((p) => p.nome)].join(' ')).includes(q)));
      const L = F.o === 'relevancia' ? [...base].sort((x, y) => notaEncaixe(y.radar) - notaEncaixe(x.radar) || porNome(x, y)) : ordem(base);
      const P = L.flatMap((e) => (e.radar?.pilulas || []).map((x) => ({ x, e })));
      pn = [barras('Maior encaixe do craft', [...L].sort((x, y) => notaEncaixe(y.radar) - notaEncaixe(x.radar)).map((e) => ({ rotulo: nomeLegivel(e.nome), valor: notaEncaixe(e.radar), dado: e.k })), { attr: 'e', nota: 'nota de 0 a 100; clique para abrir' }),
        porSetor(L),
        barras('Pílulas por tipo', contar(P, (y) => (TIPOS_PILULA.find((t) => t[0] === y.x.tipo) || [y.x.tipo, y.x.tipo])[1]))];
      const PF = P.filter((y) => !F.p || y.x.tipo === F.p);
      const modo = `<div class="pills bd-modo" role="group" aria-label="Mostrar"><button type="button" data-r="lista" aria-pressed="${F.r === 'lista'}">Empresas por encaixe <span class="note">${int(L.length)}</span></button><button type="button" data-r="pilulas" aria-pressed="${F.r === 'pilulas'}">Pílulas de ação <span class="note">${int(P.length)}</span></button></div>`;
      const topo = (q ? '' : faixaCenario(cen)) + modo;
      if (F.r === 'pilulas') {
        n = PF.length;
        const tipos = `<div class="pills bd-niveis" role="group" aria-label="Tipo de pílula">${[['', 'Todas'], ...TIPOS_PILULA.map(([v, t]) => [v, t])].map(([v, t]) => `<button type="button" data-p="${v}" aria-pressed="${F.p === v}">${t} <span class="note">${int(v ? P.filter((y) => y.x.tipo === v).length : P.length)}</span></button>`).join('')}</div>
      <p class="note bd-dica">${esc(F.p ? (TIPOS_PILULA.find((x) => x[0] === F.p) || TIPOS_PILULA[0])[2] : 'Uma jogada curta para cada possibilidade de negócio, da empresa com mais encaixe para a de menos. Clique na empresa para ver as fontes e virar alvo.')}</p>`;
        html = topo + tipos + (PF.length ? `<ul class="bd-pil">${PF.slice(0, lim).map((y) => cartaoPilula(y.x, y.e.nome)).join('')}</ul>` : vazio({ titulo: 'Nenhuma pílula deste tipo ainda', texto: 'A varredura de quarta-feira escreve novas pílulas para cada empresa.' }));
      } else {
        n = L.length;
        html = topo + `<p class="note bd-dica">Grandes anunciantes fora da disputa das grandes contas, onde o craft da Produceria faz diferença. A nota soma só o que a fonte comprova; o porquê é hipótese até a primeira conversa.</p>`
          + (L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaRadar).join('')}</ul>` : vazio({ titulo: F.q ? 'Nada com essa busca' : 'Nenhuma empresa na varredura ainda', texto: 'A rotina da Central faz a varredura toda quarta-feira e grava aqui as empresas com fonte.' }));
      }
    } else if (F.v === 'agencias') {
      const L = ordem(G.agencias.filter((a) => !q || chave([a.nome, a.grupo, ...a.ligacoes.map((l) => l.empresa), ...a.pessoas.map((p) => p.nome)].join(' ')).includes(q)));
      pn = [barras('Mais clientes ligados', L.map((a) => ({ rotulo: nomeLegivel(a.nome), valor: new Set(a.ligacoes.map((l) => l.empresa)).size, dado: a.k })).sort((x, y) => y.valor - x.valor), { attr: 'a', nota: 'clique para abrir' }),
        barras('Por grupo', busca(contar(L, (a) => a.grupo || 'Independente')), { attr: 'q', nota: 'clique para filtrar' }),
        barras('Por estado', contar(L, (a) => a.uf || 'Sem UF'))];
      n = L.length; html = L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaAgencia).join('')}</ul>` : '';
    } else {
      const L = [...G.pessoas].filter((p) => (!F.n || nivelDe(p) === F.n) && (!q || chave([p.nome, p.cargo, p.organizacao, p.area, p.campanha].join(' ')).includes(q)))
        .sort((x, y) => F.o === 'recente' ? (y.data || '').localeCompare(x.data || '') : F.o === 'nome' ? chave(x.nome).localeCompare(chave(y.nome)) : ORDEM[nivelDe(x)] - ORDEM[nivelDe(y)] || chave(x.organizacao).localeCompare(chave(y.organizacao)));
      n = L.length;
      pn = [barras('Por nível', contar(L, (p) => nivelDe(p)).map((b) => ({ ...b, rotulo: rotuloNivel(b.dado as Nivel), ativo: b.dado === F.n })), { attr: 'n', nota: 'clique para filtrar' }),
        barras('Organizações com mais pessoas', contar(L, (p) => p.organizacao).map((b) => ({ ...b, rotulo: nomeLegivel(b.rotulo) })), { attr: 'org', nota: 'clique para abrir' }),
        barras('Por área', contar(L, (p) => p.area || 'Sem área'))];
      const pills = `<div class="pills bd-niveis" role="group" aria-label="Nível">${[['', 'Todos os níveis'], ...NIVEIS.map(([v, t]) => [v, t])].map(([v, t]) => `<button type="button" data-n="${v}" aria-pressed="${F.n === v}">${t} <span class="note">${int(v ? G.pessoas.filter((p) => nivelDe(p) === v).length : G.pessoas.length)}</span></button>`).join('')}</div>
      <p class="note bd-dica">${esc(F.n ? (NIVEIS.find((x) => x[0] === F.n) || NIVEIS[0])[2] : 'Comece por quem contrata produção: são as pessoas que pedem orçamento e mandam o job. A alta liderança abre portas, mas raramente escolhe o fornecedor.')}</p>`;
      html = pills + (L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaPessoa).join('')}</ul>` : vazio({ titulo: 'Ninguém neste nível ainda', texto: 'A rotina diária procura essas pessoas nas fichas técnicas das campanhas e nas notícias.' }));
    }
    $('#bdPn').innerHTML = n ? painel(pn, 'Resumo') : '';
    $('#bdL').innerHTML = html ? html + (n > lim ? `<p class="mais"><button type="button" class="ghost" id="bdM">Mostrar mais ${int(Math.min(60, n - lim))} (${int(n - lim)} restantes)</button></p>` : '')
      : vazio({ titulo: F.q ? 'Nada com essa busca' : F.v === 'pessoas' ? 'Nenhuma pessoa mapeada ainda' : 'Base vazia', texto: F.q ? 'Tente parte do nome ou limpe a busca.' : 'A rotina diária da Central grava aqui, todo dia, quem decide em cada anunciante e agência, sempre com a fonte.' });
    $('#bdLive').textContent = `${int(n)} resultados.`;
  }

  function detalhe(no: NoEmpresa | NoAgencia, tipo: 'e' | 'a', btn: HTMLElement) {
    const d = $<Dialogo>('#bdD');
    const lig = [...no.ligacoes].sort((x, y) => (y.data || '').localeCompare(x.data || ''));
    const outro = (l: { empresa: string; agencia: string }) => tipo === 'e' ? l.agencia : l.empresa;
    const e = tipo === 'e' ? no as NoEmpresa : null, a = tipo === 'a' ? no as NoAgencia : null;
    const inv = e?.investimento;
    const lista = tipo === 'e' ? G.agencias : G.empresas;
    const viz = [...new Set(lig.map(outro))].map((nome) => { const o = lista.find((x) => x.nome === nome); return { nome, pessoas: o ? o.pessoas : [], data: lig.find((l) => outro(l) === nome)?.data || '' }; });
    const pontes = viz.flatMap((v) => v.pessoas.filter((p) => nivelDe(p) !== 'lidera').map((p) => ({ org: v.nome, p }))).sort((x, y) => ORDEM[nivelDe(x.p)] - ORDEM[nivelDe(y.p)]).slice(0, 12);
    d.innerHTML = `<div class="dh"><div><span class="lab">${tipo === 'e' ? 'Anunciante' : 'Agência'}</span><h2 class="d d-sub" id="bdDT">${esc(nomeLegivel(no.nome))}</h2>
  <p class="note">${esc([e?.setor, e?.grupo, a?.grupo, a?.perfil, a?.uf].filter(Boolean).join(' · '))}${e?.ranking ? ` · ${e.ranking}º maior anunciante de 2025` : ''}${a?.cenp ? ` · ${a.cenp}º no Cenp-Meios 2025` : ''}</p></div><button type="button" class="x" id="bdX" aria-label="Fechar">×</button></div>
 <div class="bd-corpo">
  ${no.nota ? `<p class="note">${esc(no.nota)}</p>` : ''}
  ${e ? blocoRadar(e) : ''}
  ${inv ? `<p><span class="lab">Investimento em mídia</span> ${int(inv.valor)} em ${inv.ano} <span class="note">(${esc(inv.escala || 'como publicado')})</span> ${link(inv.fonte, veiculo(inv.fonte))}</p>` : ''}
  ${redes(no) ? `<p>${redes(no)}</p>` : ''}
  <h3 class="bd-h">${tipo === 'e' ? 'Agências e o que cada uma faz' : 'Clientes e o que atende'}</h3>
  ${lig.length ? `<ul class="bd-lig">${lig.map((l) => `<li><button type="button" class="chip sm" data-org="${esc(outro(l))}">${esc(nomeLegivel(outro(l)))}</button> <span class="note">${esc(l.disciplina || l.tipo || '')}${l.data ? ' · ' + esc(/^\d{4}-\d{2}-\d{2}/.test(l.data) ? dt(l.data) : l.data) : ''}</span> ${link(l.fonte, veiculo(l.fonte))}</li>`).join('')}</ul>` : '<p class="note">Nenhuma ligação registrada ainda.</p>'}
  <h3 class="bd-h">Conexões</h3>
  ${mapaConexoes(no, viz)}
  ${NIVEIS.map(([n, t, dica]) => { const ps = no.pessoas.filter((p) => nivelDe(p) === n); return `<h3 class="bd-h">${t}${n === 'contrata' ? ' · porta de entrada' : ''}</h3>${ps.length ? `<ul class="bd-lig">${ps.map((p) => `<li><b>${esc(p.nome)}</b> · ${esc(p.cargo)}${p.campanha ? ` <span class="note">(${esc(p.campanha)})</span>` : ''} ${redes(p)} ${link(p.fonte, veiculo(p.fonte))}</li>`).join('')}</ul>` : `<p class="note">${n === 'contrata' ? 'Ninguém mapeado ainda. A rotina procura produção gráfica, RTV, art buyer e finalização nas fichas técnicas das campanhas.' : 'Ninguém mapeado ainda.'}</p>`}${n === 'contrata' && ps.length === 0 ? '' : ''}`; }).join('')}
  ${pontes.length ? `<h3 class="bd-h">Caminhos por quem trabalha com ${esc(nomeLegivel(no.nome))}</h3><ul class="bd-lig">${pontes.map((x) => `<li><button type="button" class="chip sm" data-org="${esc(x.org)}">${esc(nomeLegivel(x.org))}</button> <b>${esc(x.p.nome)}</b> · ${esc(x.p.cargo)} <span class="bd-nv n-${nivelDe(x.p)}">${esc(rotuloNivel(nivelDe(x.p)))}</span></li>`).join('')}</ul>` : ''}
  <div class="dacts fim">${ehAlvo(no.nome) ? `<a class="tag ok" href="#captacao">Já é alvo da Captação</a>` : `<button type="button" id="bdAlvo">Virar alvo da Captação</button>`}</div>
 </div>`;
    d._ret = btn; d.showModal(); $<HTMLElement>('#bdX').focus();
    $('#bdX').onclick = () => d.close();
    const b = root.querySelector<HTMLButtonElement>('#bdAlvo');
    if (b) b.onclick = async () => {
      const id = 'al-' + slug(no.nome), ult = lig[0];
      const doc = { id, nome: nomeLegivel(no.nome), perfil: tipo === 'a' ? ((no as NoAgencia).perfil === 'rede' ? 'rede' : 'independente') : 'inhouse', contato: no.pessoas.map((p) => `${p.nome} (${p.cargo})`).join('; '),
        gatilho: e?.radar?.sinais?.length ? `Fora do radar: ${[...e.radar.sinais].sort((x, y) => (y.data || '').localeCompare(x.data || ''))[0].texto}` : ult ? `${nomeLegivel(ult.empresa)} com ${nomeLegivel(ult.agencia)}${ult.data ? ' em ' + dt(ult.data) : ''}` : 'Big Data do mercado', fonte: e?.radar?.sinais?.[0]?.fonte || ult?.fonte || '', status: 'Mapeado',
        proximoPasso: e?.radar?.acao || 'Pesquisar quem decide produção e fazer o primeiro contato', prazo: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), notas: '', origem: e?.radar ? 'Big Data · Fora do radar' : 'Big Data do mercado', criadoEm: new Date().toISOString() } as Alvo;
      b.disabled = true; b.textContent = 'Criando…';
      if (!colAlvos) { alvos = [...alvos, doc]; d.close(); render(); return; }
      try { await colAlvos.doc(id).set(doc); $('#bdLive').textContent = `${doc.nome} entrou como alvo na Captação.`; d.close(); } catch (err) { b.disabled = false; b.textContent = 'Tentar de novo'; $('#bdLive').textContent = 'Não foi possível criar o alvo: ' + mensagem(err); }
    };
  }
  const abrirOrg = (nome: string, btn: HTMLElement) => {
    const e = G.empresas.find((x) => x.k === chave(nome)) || G.empresas.find((x) => mesmaEmpresa(x.nome, nome));
    const a = G.agencias.find((x) => x.k === chave(nome)) || G.agencias.find((x) => mesmaEmpresa(x.nome, nome));
    if (a) detalhe(a, 'a', btn); else if (e) detalhe(e, 'e', btn);
  };

  $('#bdD').addEventListener('close', () => { const d = $<Dialogo>('#bdD'); if (d._ret && d._ret.isConnected) d._ret.focus(); });
  root.addEventListener('click', (ev) => {
    const el = elDe(ev);
    const kk = el.closest<HTMLElement>('[data-kpi]'); if (kk) { F.v = kk.dataset.kpi as Visao; F.q = ''; F.n = ''; lim = 60; render(); irPara($('#bdPn').firstElementChild ? $('#bdPn') : $('#bdL')); return; }
    const rr = el.closest<HTMLElement>('[data-r]'); if (rr) { F.r = rr.dataset.r === 'pilulas' ? 'pilulas' : 'lista'; lim = 60; render(); root.querySelector<HTMLElement>(`[data-r="${F.r}"]`)?.focus(); return; }
    const pp = el.closest<HTMLElement>('[data-p]'); if (pp) { F.p = (pp.dataset.p || '') as TipoPilula | ''; lim = 60; render(); root.querySelector<HTMLElement>(`[data-p="${F.p}"]`)?.focus(); return; }
    const bq = el.closest<HTMLElement>('.pn [data-q]'); if (bq) { F.q = chave(F.q) === chave(bq.dataset.q || '') ? '' : bq.dataset.q || ''; lim = 60; render(); return; }
    const nv = el.closest<HTMLElement>('[data-n]'); if (nv) { F.n = (nv.closest('.pn') && F.n === nv.dataset.n ? '' : nv.dataset.n || '') as Nivel | ''; lim = 60; render(); root.querySelector<HTMLElement>(`[data-n="${F.n}"]`)?.focus(); return; }
    const v = el.closest<HTMLElement>('[data-v]'); if (v) { F.v = v.dataset.v as Visao; lim = 60; render(); root.querySelector<HTMLElement>(`[data-v="${F.v}"]`)?.focus(); return; }
    if (el.id === 'bdM') { lim += 60; render(); return; }
    const org = el.closest<HTMLElement>('[data-org]'); if (org) { const dd = $<Dialogo>('#bdD'); if (dd.open) dd.close(); abrirOrg(org.dataset.org || '', org); return; }
    const be = el.closest<HTMLElement>('[data-e]'); if (be) { const e = G.empresas.find((x) => x.k === be.dataset.e); if (e) detalhe(e, 'e', be); return; }
    const ba = el.closest<HTMLElement>('[data-a]'); if (ba) { const a = G.agencias.find((x) => x.k === ba.dataset.a); if (a) detalhe(a, 'a', ba); }
  });
  root.addEventListener('keydown', (ev) => { const g = (ev.target as Element).closest?.('svg [data-org]'); if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); (g as SVGGElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  $<HTMLInputElement>('#bdQ').oninput = (e) => { F.q = (e.target as HTMLInputElement).value; lim = 60; render(); };
  $<HTMLSelectElement>('#bdO').onchange = (e) => { F.o = (e.target as HTMLSelectElement).value; render(); };
  // a busca abre com tudo o que existe, por categoria; escolher leva à visão daquela categoria
  sugerir('bdQ', () => [
    { nome: 'Anunciantes', itens: G.empresas.map((e) => ({ texto: nomeLegivel(e.nome), sub: [e.setor, e.grupo].filter(Boolean).join(' · ') || undefined, peso: e.pessoas.length + e.ligacoes.length + (e.ranking ? 20 : 0) })) },
    { nome: 'Agências', itens: G.agencias.map((a) => ({ texto: nomeLegivel(a.nome), sub: [a.grupo, a.perfil, a.uf].filter(Boolean).join(' · ') || undefined, peso: a.pessoas.length + a.ligacoes.length + (a.cenp ? 20 : 0) })) },
    { nome: 'Pessoas', itens: G.pessoas.map((x) => ({ texto: x.nome, sub: [x.cargo, nomeLegivel(x.organizacao)].filter(Boolean).join(' · '), peso: 3 - ORDEM[nivelDe(x)] })) },
    { nome: 'Setores', itens: contar(G.empresas, (e) => e.setor).map((b) => ({ texto: b.rotulo, sub: `${int(b.valor)} anunciante(s)`, peso: b.valor })) },
    { nome: 'Grupos de agências', itens: contar(G.agencias, (a) => a.grupo).map((b) => ({ texto: b.rotulo, sub: `${int(b.valor)} agência(s)`, peso: b.valor })) },
  ], { aoEscolher: (it, g, campo) => {
    F.v = g === 'Agências' || g === 'Grupos de agências' ? 'agencias' : g === 'Pessoas' ? 'pessoas' : 'empresas'; F.n = '';
    F.q = it.texto; campo.value = it.texto; lim = 60; render(); irPara($('#bdL'));
  } });
  render();
  lerBase<MercadoBase>('mercado').then((m) => { mercado = m; recalcular(); }).catch(() => {});
  (async () => {
    const db = await banco(); if (!db) return;
    const sub = <T>(nome: string, f: (l: T[]) => void) => offs.push(db.collection<T>(nome).onSnapshot((s) => { f(s.docs.map(comId) as T[]); recalcular(); }, () => {}));
    sub<MovimentoBase & { id: string }>('movimentos', (l) => { movs = l; });
    sub<EmpresaMapa & { id: string }>('mapa_empresas', (l) => { emp = l; });
    sub<AgenciaMapa & { id: string }>('mapa_agencias', (l) => { ags = l; });
    sub<PessoaMapa>('mapa_pessoas', (l) => { pes = l; });
    sub<Cenario>('mapa_cenario', (l) => { cen = l; });
    colAlvos = db.collection<Alvo>('alvos');
    offs.push(colAlvos.onSnapshot((s) => { alvos = s.docs.map(comId); }, () => {}));
  })();
  return () => { for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}
