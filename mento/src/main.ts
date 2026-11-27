// MENTO · Reação em cadeia: página única, sem servidor. Lê os arquivos de dados do LinkedIn que cada pessoa da equipe
// baixou e entregou, monta a rede e mostra a reação em cadeia, o multiverso e o radar. Nada sai deste navegador.
import { lerArquivos, pessoaDosArquivos, type Pessoa } from './exportacao';
import { montarRede, reacao, multiverso, radar, emComum, caminho, csvRadar, ZERO, type Rede, type Multiverso, type Reacao, type No } from './rede';
import estilo from './estilo.css';
import saira from './fonte/saira-stencil-500.woff2.b64';
import inter400 from './fonte/inter-400.woff2.b64';
import inter500 from './fonte/inter-500.woff2.b64';
import logo from './logo.svg';
import { EXEMPLO } from './exemplo-dados';
import { EQUIPE_PUBLICA } from './publico';
import { paraRede, type Registro } from './crm';
import { montarArvore } from './arvore';
import { abrirLoja } from './dados';
import { montarCrm, HTML_CRM } from './crm-ui';
import { montarUx } from './ux';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => n.toLocaleString('pt-BR');
const curto = (s = '', n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const pl = (n: number, um: string, v: string) => `${fmt(n)} ${n === 1 ? um : v}`;
const GUARDA = 'mento.rede.v1';

const face = (fam: string, b64: string, w: number) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64.trim()}) format("woff2");font-weight:${w};font-style:normal;font-display:swap}`;
document.head.insertAdjacentHTML('beforeend', `<style>${face('Saira Stencil', saira, 500)}${face('Inter', inter400, 400)}${face('Inter', inter500, 500)}${estilo}</style>`);
/** O logo exato da MENTO (vetorizado do arquivo oficial), com o ℗ no canto. */
const LOGO = logo.replace('<svg ', '<svg role="img" aria-label="MENTO" ');
/** Só o desenho do logo (sem o <svg>), para o centro do multiverso. */
const LOGO_MAPA = (logo.match(/<path[^>]*\/>/) || [''])[0].replace('fill="currentColor"', 'fill="#000" transform="translate(-50 -10)"');
const raiz = document.getElementById('app')!;
const VISTAS: [string, string][] = [['painel', 'Painel'], ['dashboard', 'Dashboard'], ['bigdata', 'Big Data'], ['rede', 'Rede'], ['funil', 'Funil'], ['agenda', 'Agenda'], ['equipe', 'Equipe']];
raiz.innerHTML = `<div class="mt app" id="conteudo">
<header class="topo"><a href="#painel" class="lg" aria-label="MENTO · Painel">${LOGO}</a><nav class="nav" id="nav" aria-label="Seções">${VISTAS.map(([k, t]) => `<a href="#${k}" data-v="${k}"${k === 'funil' ? ' id="navFn"' : ''}>${t}</a>`).join('')}</nav><span class="modo" id="modo"></span></header>
<p class="msg aviso-topo" id="crmMsg" role="status" hidden></p>
${HTML_CRM(EQUIPE_PUBLICA.map((p) => p.nome.split(' ')[0]))}
<section class="vista" data-vista="rede" aria-labelledby="t2" hidden>
 <p class="lead">A reação em cadeia: <b>MENTO → equipe → quem cada um conhece e por onde passou → quem decide lá → quem anuncia</b>. Alimentada pelo Big Data e pelos arquivos de LinkedIn da equipe.</p>
 <div id="res">
 <section class="passo" aria-labelledby="t2"><h2 class="t" id="t2">O tamanho da rede</h2><ul class="kpis" id="kpis"></ul></section>
 <section class="passo" aria-labelledby="t3"><h2 class="t" id="t3">Em comum</h2><p class="nota">Quem as duas pessoas conhecem e as empresas onde as duas têm gente: a conversa pode vir de qualquer uma, e a outra reforça.</p><div class="dois" id="comum"></div></section>
 <section class="passo" aria-labelledby="t4"><h2 class="t" id="t4">Reação em cadeia</h2><p class="nota">Da MENTO para fora, galho por galho, em tamanho de leitura. Clique num cartão para ver o dossiê e acender o caminho; clique no número para abrir o galho. Setas do teclado andam pela árvore, Enter abre o dossiê, espaço abre e fecha.</p>
  <div class="av-ferr"><button type="button" class="btn sec" data-av-melhores>Abrir os melhores caminhos</button><button type="button" class="btn sec" data-av-recolher>Recolher tudo</button><span class="nota" id="avConta"></span></div>
  <div class="av-grade"><div class="av-vp" id="rc" tabindex="-1"></div><aside class="dossie av-info" id="avInfo" aria-live="polite"></aside></div></section>
 <section class="passo" aria-labelledby="t5"><h2 class="t" id="t5">Multiverso</h2><p class="nota">A rede inteira. Clique num ponto para acender o caminho até a MENTO; role para aproximar; arraste para andar.</p>
  <div class="mv"><div class="palco"><div class="ferr"><input type="search" id="q" placeholder="Buscar pessoa ou empresa" autocomplete="off"><div class="seg" role="group" aria-label="Mostrar"><button type="button" data-f="tudo" aria-pressed="true">Tudo</button><button type="button" data-f="decide" aria-pressed="false">Só quem decide</button><button type="button" data-f="comum" aria-pressed="false">Em comum</button></div><button type="button" class="acao" id="btFora" aria-pressed="false" hidden>Mostrar sem ponte</button></div><svg id="svg" viewBox="-560 -560 1120 1120" role="group" aria-label="Multiverso da MENTO"></svg><div class="leg" id="leg" role="group" aria-label="Legenda e filtro do mapa"></div><div class="zoom"><button type="button" data-z="1.4" aria-label="Aproximar">+</button><button type="button" data-z="0.7" aria-label="Afastar">−</button><button type="button" data-z="0" aria-label="Ver tudo">⌂</button></div></div><aside class="dossie" id="dossie" aria-live="polite"></aside></div>
  <div class="acoes"><button type="button" class="btn sec" data-svg>Baixar o mapa (SVG)</button></div></section>
 <section class="passo" aria-labelledby="t6"><h2 class="t" id="t6">Radar · por onde começar</h2>
  <div class="seg" id="rf" role="group" aria-label="Filtrar o radar"><button type="button" data-r="tudo" aria-pressed="true">Tudo</button><button type="button" data-r="contato" aria-pressed="false">Pessoas</button><button type="button" data-r="empresa" aria-pressed="false">Empresas</button><button type="button" data-r="decide" aria-pressed="false">Quem decide</button><button type="button" data-r="comum" aria-pressed="false">Em comum</button></div>
  <ol class="radar" id="radar"></ol><div class="acoes"><button type="button" class="lnk" id="mais" hidden>Mostrar mais</button><button type="button" class="btn" data-csv>Baixar o radar (planilha)</button></div></section>
</div>
</section>
<section class="vista" data-vista="equipe" aria-labelledby="t1" hidden>
 <section class="passo" aria-labelledby="t1"><h2 class="t" id="t1">Equipe e dados do LinkedIn</h2>
 <details class="como"><summary>Como cada pessoa baixa o arquivo do LinkedIn (5 minutos)</summary><ol>
  <li>No LinkedIn, clique em <b>Eu</b> → <b>Configurações e privacidade</b> → <b>Privacidade de dados</b> → <b>Obter uma cópia dos seus dados</b>.</li>
  <li>Escolha <b>Quero um pacote de dados específico</b> e marque <b>Conexões</b>, <b>Cargos</b> e <b>Perfil</b>. Clique em <b>Solicitar arquivo</b> e confirme a senha.</li>
  <li>O LinkedIn manda um e-mail em cerca de 10 minutos. Baixe o <b>.zip</b> e entregue à MENTO (ou arraste aqui, no quadro da pessoa).</li>
 </ol><p class="nota">É o caminho oficial do LinkedIn: ninguém precisa passar a senha a ninguém, e a pessoa decide o que entrega. O .zip inteiro pode vir; aqui só três arquivos são lidos.</p></details>
 <div class="slots" id="slots"></div>
 <div class="acoes"><button type="button" class="btn" data-rodar>Rodar a reação em cadeia</button><button type="button" class="btn sec" data-exemplo>Ver com dados de exemplo</button><label class="chk"><input type="checkbox" id="pub" checked> Incluir a pesquisa pública</label><label class="chk"><input type="checkbox" id="lembrar"> Lembrar neste navegador</label><button type="button" class="lnk" data-limpar>Apagar tudo</button></div>
 <p class="msg" id="msg" aria-live="polite"></p>
</section>
</section>
<footer class="rod">MENTO · Conexões que movem marcas. Big Data com fonte pública; conexões só com os arquivos que cada pessoa entregou.</footer>
</div>`;
const $ = <T extends Element = HTMLElement>(s: string) => raiz.querySelector(s) as T;

interface Slot { nome: string; pessoa: Pessoa | null }
const publicos = (): Slot[] => EQUIPE_PUBLICA.map((p) => ({ nome: p.nome, pessoa: JSON.parse(JSON.stringify(p)) as Pessoa }));
let slots: Slot[] = publicos();
let bdAtual: Registro[] = [];
let R: Rede | null = null, M: Multiverso | null = null, Q: Reacao | null = null, sel = '', filtro = 'tudo', rf = 'tudo', lim = 20;
try { const g = JSON.parse(localStorage.getItem(GUARDA) || 'null'); if (g?.slots) { slots = g.slots; $<HTMLInputElement>('#lembrar').checked = true; } } catch { /* sem armazenamento */ }
const guardar = () => { try { if ($<HTMLInputElement>('#lembrar').checked) localStorage.setItem(GUARDA, JSON.stringify({ slots })); else localStorage.removeItem(GUARDA); } catch { /* sem espaço ou sem armazenamento */ } };

/* ── 01 ── */
function desenharSlots() {
  $('#slots').innerHTML = slots.map((s, i) => {
    const p = s.pessoa;
    return `<article class="slot${p ? ' ok' : ''}" data-slot="${i}"><h3 class="st">Pessoa ${i + 1}${p ? ` · <b>${esc(p.nome || 'sem nome')}</b>` : ''}</h3>
  <label class="drop" data-drop="${i}"><input type="file" accept=".zip,.csv" multiple data-arq="${i}"><span>${p ? 'Trocar o arquivo' : 'Arraste aqui o <b>.zip do LinkedIn</b><br>(ou Connections.csv, Positions.csv, Profile.csv)'}</span></label>
  ${p ? `<label class="campo">Nome<input data-nome="${i}" value="${esc(p.nome)}"></label>
  <ul class="lido"><li><b>${fmt(p.conexoes.length)}</b> conexões</li><li><b>${fmt(p.posicoes.length)}</b> cargos</li><li><b>${fmt(new Set(p.conexoes.map((c) => c.empresa).filter(Boolean)).size)}</b> empresas</li></ul>
  ${p.conexoes.length ? '' : '<p class="aviso">Sem Connections.csv: só a trajetória entra. A rede de conexões é o que mais abre a reação.</p>'}
  <p class="nota">Lido: ${p.arquivos.map(esc).join(', ') || 'nada'}</p>` : ''}</article>`;
  }).join('');
}
async function carregar(i: number, files: FileList | File[]) {
  const lista = await Promise.all([...files].map(async (f) => ({ nome: f.name, dados: await f.arrayBuffer() })));
  try {
    const arq = await lerArquivos(lista);
    if (!Object.keys(arq).length) { msg(`Pessoa ${i + 1}: não achei Connections.csv, Positions.csv nem Profile.csv nesse arquivo.`); return; }
    const antes = slots[i].pessoa, nova = pessoaDosArquivos(String(i + 1), arq);
    // CSVs soltos somam aos que já estavam
    // o arquivo soma ao que já estava (a trajetória pública fica quando o arquivo não traz Positions.csv)
    const p: Pessoa = antes ? { ...antes, nome: nova.nome || antes.nome, titulo: nova.titulo || antes.titulo, posicoes: nova.posicoes.length ? nova.posicoes : antes.posicoes, conexoes: nova.conexoes.length ? nova.conexoes : antes.conexoes, arquivos: [...new Set([...antes.arquivos, ...nova.arquivos])].sort() } : nova;
    slots[i] = { nome: p.nome, pessoa: p }; guardar(); desenharSlots();
    msg(`${p.nome || 'Pessoa ' + (i + 1)}: ${pl(p.conexoes.length, 'conexão lida', 'conexões lidas')} e ${pl(p.posicoes.length, 'cargo', 'cargos')}.`);
  } catch (e) { msg(`Pessoa ${i + 1}: ${(e as Error).message || 'não deu para ler o arquivo.'}`); }
}
const msg = (t: string) => { $('#msg').textContent = t; };

/* ── a rede ── */
function rodar(rolar = true) {
  const equipe = slots.map((s) => s.pessoa).filter((p): p is Pessoa => !!p);
  if (!equipe.length) { msg('Carregue o arquivo de pelo menos uma pessoa.'); return; }
  const pub = $<HTMLInputElement>('#pub').checked;
  R = montarRede(equipe, pub ? paraRede(bdAtual) : {}); M = multiverso(R); Q = reacao(R); sel = ''; lim = 20;
  resultado(); if (rolar) location.hash = '#rede';
  const semConexoes = equipe.filter((p) => !p.conexoes.length).map((p) => p.nome.split(' ')[0]);
  msg(semConexoes.length ? `Rede montada com a pesquisa pública. Falta a lista de conexões de ${semConexoes.join(' e ')}: arraste o .zip do LinkedIn (com Conexões marcado) no quadro de cada um.` : '');
}
const no = (id: string) => R!.nos.get(id)!;
const chip = (id: string) => { const n = R!.nos.get(id); return n ? `<button type="button" class="chip t-${n.tipo}" data-ir="${esc(id)}">${esc(curto(n.nome, 30))}</button>` : ''; };
const quemDe = (n: No) => n.quem.map((id) => no(id).nome.split(' ')[0]).join(' e ');
function resultado() {
  const r = R!, todos = [...r.nos.values()], cont = todos.filter((n) => n.tipo === 'contato'), emp = todos.filter((n) => n.tipo === 'empresa');
  const soma = r.equipe.reduce((t, p) => t + p.conexoes.length, 0), comum = emComum(r);
  $('#kpis').innerHTML = [[soma, 'conexões somadas', `${fmt(cont.length)} pessoas únicas fora da MENTO`], [comum.length, 'em comum', 'conhecidas pelas duas pessoas'], [emp.length, 'empresas', `${fmt(emp.filter((e) => !e.agencia).length)} sem contar agências`], [cont.filter((c) => c.nivel === 'decide').length, 'decidem', 'cargos que contratam agência e mídia'], [M!.voltas.length - 1, 'voltas', 'da MENTO até o ponto mais distante'], [M!.fora.length, 'sem ponte ainda', 'no Big Data, esperando uma ligação']]
    .map(([v, t, d], i) => `<li${i ? '' : ' class="on"'}><b>${fmt(Number(v))}</b><span>${esc(t)}</span><small>${esc(d)}</small></li>`).join('');
  const empC = emp.filter((e) => e.quem.length > 1).sort((a, b) => b.nota - a.nota);
  $('#comum').innerHTML = `<div><h3 class="st">Pessoas <span class="n">${fmt(comum.length)}</span></h3>${lista(comum.slice(0, 12))}</div><div><h3 class="st">Empresas <span class="n">${fmt(empC.length)}</span></h3>${lista(empC.slice(0, 12))}</div>`;
  arv.desenhar(); contarAv();
  desenharMv(); dossie(); desenharRadar();
}
const lista = (L: No[]) => L.length ? `<ul class="li">${L.map((n) => `<li><button type="button" data-ir="${esc(n.id)}"><b>${esc(n.nome)}</b><span>${esc(curto(n.tipo === 'contato' ? [n.sub, n.empresa].filter(Boolean).join(' · ') : n.fatos[0] || '', 70))}</span></button><em>${n.nota}</em></li>`).join('')}</ul>` : '<p class="nota">Nada em comum ainda.</p>';

/* ── 05 · multiverso radial ── */
/** Raio de cada volta: equipe perto do centro, as voltas seguintes para fora, e o anel "sem ponte ainda" por último. */
const raioDe = (g: number) => [0, 120, 300, 450, 580, 690, 790][g] ?? 790 + (g - 6) * 90;
const pos = new Map<string, { x: number; y: number; r: number; a: number }>();
let RAIOS: number[] = [], RFORA = 0, VB0 = 560, mostrarFora = false, kDesenho = 1;
/** Unidades do desenho por pixel da tela: com ela, pontos e nomes guardam um tamanho mínimo legível em qualquer zoom. */
const escalaK = () => { const w = svg().getBoundingClientRect().width; return w > 0 ? vb.w / w : 1; };
function layout() {
  pos.clear(); const m = M!, r = R!;
  pos.set(ZERO, { x: 0, y: 0, r: 22, a: 0 });
  const eq = m.voltas[1] || [];
  // setores da equipe proporcionais ao tamanho da rede de cada um
  const peso = eq.map((id) => Math.max(1, (m.voltas[2] || []).filter((x) => m.pai.get(x)?.id === id).length)), tot = peso.reduce((a, b) => a + b, 0);
  let a0 = -Math.PI / 2; const setor = new Map<string, [number, number]>();
  eq.forEach((id, i) => { const da = (peso[i] / tot) * Math.PI * 2; setor.set(id, [a0, a0 + da]); const a = a0 + da / 2; pos.set(id, { x: Math.cos(a) * raioDe(1), y: Math.sin(a) * raioDe(1), r: 11, a }); a0 += da; });
  const OURO = 0.6180339887, tam = (n: No, esc2: number) => (n.tipo === 'empresa' ? (2.8 + n.nota / 12) * Math.max(0.6, esc2) : (1.6 + n.nota / 26) * esc2 + 0.6);
  RAIOS = [0, raioDe(1)];
  for (let g = 2; g < m.voltas.length; g++) {
    const v = m.voltas[g] || []; if (!v.length) continue;
    const esc2 = Math.min(1, Math.sqrt(500 / v.length)), R0 = raioDe(g); RAIOS[g] = R0;
    if (g === 2) for (const id of eq) {
      // os mais fortes se espalham pelo setor (passo áureo), em vez de se amontoar no começo dele
      const fil = v.filter((x) => m.pai.get(x)?.id === id).sort((p, q) => r.nos.get(q)!.nota - r.nos.get(p)!.nota), [s, e] = setor.get(id)!;
      fil.forEach((x, k) => { const f = fil.length > 1 ? (k * OURO) % 1 : 0.5, a = s + (e - s) * (0.02 + f * 0.96), rr = R0 + (((k * 7919) % 11) - 5) * (fil.length > 60 ? 9 : 4); pos.set(x, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: tam(r.nos.get(x)!, esc2), a }); });
    } else {
      // da 3ª volta em diante: o anel inteiro, na ordem do ângulo de quem trouxe cada ponto (fica perto do pai)
      const ang = v.map((x) => { const p = pos.get(m.pai.get(x)?.id || ''); return { x, a: p ? p.a : 0 }; }).sort((p, q) => p.a - q.a);
      ang.forEach(({ x }, k) => { const a = -Math.PI / 2 + (k + 0.5) / ang.length * Math.PI * 2, rr = R0 + (ang.length > 80 ? ((k % 3) - 1) * 14 : 0); pos.set(x, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: tam(r.nos.get(x)!, esc2), a }); });
    }
  }
  // sem ponte ainda: um anel próprio, por fora, agrupado por ligação entre si (anunciante perto da agência)
  const F = mostrarFora ? m.fora : []; RFORA = F.length ? raioDe(m.voltas.length) + 40 : 0;
  if (F.length) {
    const fset = new Set(F), ordem: string[] = [], feito = new Set<string>();
    for (const id of F) { if (feito.has(id)) continue; const fila = [id]; feito.add(id); while (fila.length) { const x = fila.shift()!; ordem.push(x); for (const a of r.adj.get(x) || []) if (fset.has(a.b) && !feito.has(a.b)) { feito.add(a.b); fila.push(a.b); } } }
    const esc2 = Math.min(1, Math.sqrt(400 / F.length));
    ordem.forEach((x, k) => { const a = -Math.PI / 2 + (k + 0.5) / ordem.length * Math.PI * 2, rr = RFORA + ((k % 3) - 1) * 16; pos.set(x, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: tam(r.nos.get(x)!, esc2), a }); });
  }
  VB0 = Math.max(560, (RFORA || RAIOS[RAIOS.length - 1] || 450) + 140);
}
let vb = { x: -560, y: -560, w: 1120 };
const vbInicial = () => ({ x: -VB0, y: -VB0, w: VB0 * 2 });
const svg = () => $<SVGSVGElement>('#svg');
let tZoom = 0;
const aplicarVb = () => { svg().setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.w}`); svg().style.setProperty('--k', escalaK().toFixed(3)); clearTimeout(tZoom); tZoom = window.setTimeout(() => { const k = escalaK(); if (R && Math.abs(k / kDesenho - 1) > 0.12) desenharMv(); }, 140); };
function visivel(n: No) { return filtro === 'tudo' || n.tipo === 'zero' || n.tipo === 'equipe' || (filtro === 'decide' ? (n.tipo === 'contato' ? n.nivel === 'decide' : n.fatos.some((f) => /decide/.test(f))) : n.quem.length > 1); }
/** O tipo visual de cada ponto (ícone + cor): quem é, sem depender só da cor. */
type Tipo = 'zero' | 'equipe' | 'anunciante' | 'agencia' | 'veiculo' | 'decide' | 'pessoa' | 'empresa';
const tipoDe = (n: No): Tipo => n.tipo === 'zero' ? 'zero' : n.tipo === 'equipe' ? 'equipe' : n.tipo === 'contato' ? (n.nivel === 'decide' ? 'decide' : 'pessoa') : n.anunciante ? 'anunciante' : n.agencia ? 'agencia' : n.veiculo ? 'veiculo' : 'empresa';
const LEGENDA: [Tipo, string][] = [['anunciante', 'Anunciantes'], ['agencia', 'Agências'], ['veiculo', 'Veículos'], ['decide', 'Quem contrata'], ['pessoa', 'Pessoas'], ['empresa', 'Outras empresas']];
const ocultos = new Set<Tipo>();
/** Ícones (viewBox -12 -12 24 24): megafone, lâmpada, antena, pessoa, estrela, prédio. */
const ICONES = `<defs>
<symbol id="i-anunciante" viewBox="-12 -12 24 24"><path d="M-8.5-3.2h4.2l9.3-5.3v17l-9.3-5.3h-4.2z"/><path d="M-4.6 4.6l1.7 5.2h3l-1.6-5.2z"/><path d="M7 -3.2a4.4 4.4 0 0 1 0 6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-agencia" viewBox="-12 -12 24 24"><path d="M0-9.5a6.3 6.3 0 0 1 3.6 11.5V4.4h-7.2V2A6.3 6.3 0 0 1 0-9.5z"/><path d="M-3.2 6.2h6.4v1.7h-6.4zM-2.2 9.2h4.4v1.5h-4.4z"/></symbol>
<symbol id="i-veiculo" viewBox="-12 -12 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><rect x="-9" y="-4.5" width="18" height="12.5" rx="2"/><path d="M-4.5-10l4.5 5.5 4.5-5.5"/><path d="M-4 10.5h8"/></g></symbol>
<symbol id="i-pessoa" viewBox="-12 -12 24 24"><circle cy="-4.2" r="4.1"/><path d="M-7.6 9.5c0-4.8 3.4-7.4 7.6-7.4s7.6 2.6 7.6 7.4z"/></symbol>
<symbol id="i-empresa" viewBox="-12 -12 24 24"><path d="M-8 9.5V-8.5h10v18zM3 9.5v-12h6v12z"/></symbol>
<symbol id="i-estrela" viewBox="-12 -12 24 24"><path d="M0-10l2.9 6.4 7 .8-5.2 4.7 1.4 6.9L0 5.3l-6.1 3.5 1.4-6.9-5.2-4.7 7-.8z"/></symbol>
<filter id="brilho" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<radialGradient id="halo"><stop offset="0" stop-color="#0BCF55" stop-opacity=".45"/><stop offset="1" stop-color="#0BCF55" stop-opacity="0"/></radialGradient>
</defs>`;
const ICONE: Partial<Record<Tipo, string>> = { anunciante: 'i-anunciante', agencia: 'i-agencia', veiculo: 'i-veiculo', decide: 'i-pessoa', pessoa: 'i-pessoa', equipe: 'i-pessoa', empresa: 'i-empresa' };
/** Fio curvo: a curva puxa para o centro, como uma teia. */
const curva = (a: { x: number; y: number }, b: { x: number; y: number }) => { const mx = (a.x + b.x) / 2 * 0.86, my = (a.y + b.y) / 2 * 0.86; return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`; };
function desenharMv() {
  if (sel && M!.fora.includes(sel) && !mostrarFora) mostrarFora = true;
  const antes = VB0; layout(); const r = R!, m = M!, aceso = new Set(sel ? caminho(m, sel) : []); kDesenho = escalaK(); const K = kDesenho;
  if (antes !== VB0 && !sel) { vb = vbInicial(); aplicarVb(); }
  const foraSet = new Set(m.fora), mostra = (n: No) => visivel(n) && !ocultos.has(tipoDe(n));
  const top = new Set([...r.nos.values()].filter((n) => n.tipo !== 'zero' && n.tipo !== 'equipe' && mostra(n)).sort((a, b) => b.nota - a.nota).slice(0, 28).map((n) => n.id));
  let fios = '', acesos = '', pts = '', rots = '';
  for (const [id, p] of m.pai) {
    const a = pos.get(id), b = pos.get(p.id); if (!a || !b || !mostra(r.nos.get(id)!)) continue;
    if (aceso.has(id) && aceso.has(p.id)) acesos += `<path d="${curva(b, a)}" class="fio on"/>`; else fios += `<path d="${curva(b, a)}" class="fio"/>`;
  }
  // ligações entre os pontos sem ponte (anunciante ↔ agência, pessoa ↔ empresa), tracejadas; acendem com a seleção
  const visto2 = new Set<string>();
  for (const id of m.fora) for (const ar of r.adj.get(id) || []) {
    if (!foraSet.has(ar.b)) continue; const k = id < ar.b ? id + '|' + ar.b : ar.b + '|' + id; if (visto2.has(k)) continue; visto2.add(k);
    const a = pos.get(id), b = pos.get(ar.b); if (!a || !b || !mostra(r.nos.get(id)!) || !mostra(r.nos.get(ar.b)!)) continue;
    if (sel === id || sel === ar.b) acesos += `<path d="${curva(a, b)}" class="fio fora on"/>`; else fios += `<path d="${curva(a, b)}" class="fio fora"/>`;
  }
  for (const [id, p] of pos) {
    const n = r.nos.get(id)!; if (!mostra(n)) continue;
    const t = tipoDe(n), on = aceso.has(id), miudo = t === 'pessoa' && !top.has(id) && !on, R0 = n.tipo === 'zero' ? Math.max(34, 22 * K) : n.tipo === 'equipe' ? Math.max(15, 11 * K) : miudo ? Math.max(p.r, 2.5 * K) : Math.max(p.r * 1.35, 6, 7 * K);
    const cls = `no t-${t}${foraSet.has(id) ? ' longe' : ''}${n.quem.length > 1 ? ' com' : ''}${on ? ' on' : ''}${id === sel ? ' sel' : ''}`;
    const rot = `${esc(n.nome)}${n.tipo === 'zero' ? '' : ', ' + (LEGENDA.find(([k]) => k === t)?.[1].replace(/s$/, '') || 'Equipe')}${n.sub && n.tipo !== 'zero' && n.tipo !== 'empresa' ? ', ' + esc(n.sub) : ''}`;
    let g = `<g class="${cls}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" data-ir="${esc(id)}" role="button" aria-label="${rot}" tabindex="${n.tipo === 'zero' || n.tipo === 'equipe' || top.has(id) ? 0 : -1}"><title>${rot}</title>`;
    if (n.tipo === 'zero') g += `<circle r="90" fill="url(#halo)" class="halo"/><circle r="${R0}" class="disc"/><g class="lz" transform="translate(-26 -9) scale(0.076)">${LOGO_MAPA}</g>`;
    else {
      if (on || id === sel) g += `<circle r="${(R0 * 2.2).toFixed(1)}" fill="url(#halo)"/>`;
      g += `<circle r="${R0.toFixed(1)}" class="disc"/>`;
      const ic = ICONE[t], s = R0 * 1.25; if (ic && R0 >= 4.5) g += `<use href="#${ic}" x="${(-s / 2).toFixed(1)}" y="${(-s / 2).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" class="ic"/>`;
      if (t === 'decide' && R0 >= 4.5) { const bR = Math.max(3, R0 * 0.42); g += `<g transform="translate(${(R0 * 0.78).toFixed(1)} ${(-R0 * 0.78).toFixed(1)})"><circle r="${bR.toFixed(1)}" class="selo"/><use href="#i-estrela" x="${(-bR * 0.75).toFixed(1)}" y="${(-bR * 0.75).toFixed(1)}" width="${(bR * 1.5).toFixed(1)}" height="${(bR * 1.5).toFixed(1)}" class="ic-selo"/></g>`; }
    }
    pts += g + '</g>';
    if (n.tipo !== 'zero' && (n.tipo === 'equipe' || top.has(id) || on)) {
      const dist = R0 + 7 * K, dx = Math.cos(p.a) * dist, dy = Math.sin(p.a) * dist + 4, ali = Math.abs(Math.cos(p.a)) < 0.3 ? 'middle' : Math.cos(p.a) > 0 ? 'start' : 'end';
      rots += `<text x="${(p.x + dx).toFixed(1)}" y="${(p.y + dy).toFixed(1)}" text-anchor="${ali}" class="rot t-${t}${on ? ' on' : ''}">${esc(curto(n.tipo === 'equipe' ? n.nome.split(' ')[0] : n.nome, 26))}</text>`;
    }
  }
  const NOMEV = ['', 'equipe', 'conhecidos e trajetória', 'onde estão hoje'];
  const aneis = RAIOS.map((rr, g) => (g && rr ? `<circle r="${rr}" class="anel"/><text y="${-rr - 8 * K}" class="anel-t">${NOMEV[g] || g + 'ª volta'} · ${fmt((m.voltas[g] || []).length)}</text>` : '')).join('')
    + (RFORA ? `<circle r="${RFORA}" class="anel fora"/><text y="${-RFORA - 26 * K}" class="anel-t">sem ponte ainda · ${fmt(m.fora.length)}</text>` : '');
  svg().innerHTML = `${ICONES}<g>${aneis}</g><g>${fios}</g><g filter="url(#brilho)">${acesos}</g><g>${pts}</g><g>${rots}</g>`;
  legenda();
  const bf = document.getElementById('btFora'); if (bf) { bf.hidden = !m.fora.length; bf.setAttribute('aria-pressed', String(mostrarFora)); bf.textContent = `${mostrarFora ? 'Esconder' : 'Mostrar'} sem ponte (${fmt(m.fora.length)})`; }
}
/** A legenda do mapa: ícone, nome e quantos; cada item liga e desliga o tipo no desenho. */
function legenda() {
  const el = document.getElementById('leg'); if (!el || !R) return;
  const conta = new Map<Tipo, number>(); for (const n of R.nos.values()) { const t = tipoDe(n); conta.set(t, (conta.get(t) || 0) + 1); }
  el.innerHTML = LEGENDA.filter(([t]) => conta.get(t)).map(([t, rot]) => `<button type="button" class="lg-i t-${t}" data-leg="${t}" aria-pressed="${!ocultos.has(t)}" title="Mostrar ou esconder: ${rot}"><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11.5" class="disc"/>${ICONE[t] ? `<use href="#${ICONE[t]}" x="-7.5" y="-7.5" width="15" height="15" class="ic"/>` : ''}</svg><span>${rot}</span><b>${fmt(conta.get(t) || 0)}</b></button>`).join('');
}
function dossie() {
  const el = { set innerHTML(h: string) { $('#dossie').innerHTML = h; $('#avInfo').innerHTML = h; } }; if (!sel || !R) { el.innerHTML = `<span class="lab">Dossiê</span><p class="nota">Clique num ponto do mapa, do radar ou da reação para ver quem é, por que importa e o caminho até a MENTO.</p>`; return; }
  const n = no(sel), c = caminho(M!, sel);
  el.innerHTML = `<span class="lab">${esc(n.tipo === 'contato' ? (n.nivel === 'decide' ? 'Pessoa · decide' : 'Pessoa') : n.tipo === 'empresa' ? (n.agencia ? 'Agência' : 'Empresa') : n.tipo === 'equipe' ? 'Equipe' : 'Ponto zero')}</span><h3>${esc(n.nome)}</h3>
  ${n.tipo === 'contato' ? `<p class="sub">${esc([n.sub, n.empresa].filter(Boolean).join(' · '))}</p>` : n.sub && n.tipo !== 'zero' ? `<p class="sub">${esc(n.sub)}</p>` : ''}
  ${n.tipo === 'contato' || n.tipo === 'empresa' ? `<div class="nota-b"><span><i style="width:${n.nota}%"></i></span><b>${n.nota}</b></div>` : ''}
  ${n.fatos.length ? `<ul class="fatos">${n.fatos.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
  ${n.quem.length && n.tipo !== 'equipe' ? `<p class="sub">Quem conhece: <b>${esc(quemDe(n))}</b></p>` : ''}
  ${c.length > 1 ? `<span class="lab">Caminho</span><p class="cam">${c.map(chip).join('<em>→</em>')}</p>` : n.tipo !== 'zero' && n.tipo !== 'equipe' ? `<p class="aviso">Sem ponte com a MENTO ainda. Pergunte à equipe quem conhece alguém aqui, ou suba o LinkedIn de quem conhece: a ligação aparece sozinha.</p>` : ''}
  ${n.tipo === 'empresa' ? `<span class="lab">Quem está lá</span>${lista((R!.adj.get(n.id) || []).map((a) => no(a.b)).filter((x) => x.tipo === 'contato').sort((a, b) => b.nota - a.nota).slice(0, 8))}` : ''}
  ${n.url && /^https:/.test(n.url) ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">Perfil no LinkedIn ↗</a></p>` : ''}${n.fonte && /^https:/.test(n.fonte) && n.fonte !== n.url ? `<p class="sub">Fonte: <a href="${esc(n.fonte)}" target="_blank" rel="noopener">${esc(n.fonte.replace(/^https:\/\/(www\.)?/, '').split('/')[0])} ↗</a></p>` : ''}${n.email ? `<p class="sub">${esc(n.email)}</p>` : ''}${n.tipo === 'contato' || n.tipo === 'empresa' ? `<div class="acoes"><button type="button" class="btn sec" data-funil-rede="${esc(n.id)}">Levar ao funil</button></div>` : ''}`;
}
function escolher(id: string, daArvore = false) { sel = daArvore ? id : sel === id ? '' : id; desenharMv(); dossie(); arv.desenhar(); if (daArvore) arvFoco(id); }
const arvFoco = (id: string) => { const c = document.querySelector<HTMLElement>(`#rc [data-av="${CSS.escape(id)}"]`); c?.focus({ preventScroll: true }); };
const arv = montarArvore($('#rc'), () => (R && M ? { R, M } : null), { aoEscolher: (id) => escolher(id, true), sel: () => sel, icones: "", ocultos: () => ocultos as Set<string> });
function contarAv() { const n = document.querySelectorAll('#rc [role=treeitem]').length; $('#avConta').textContent = R ? `${fmt(n)} cartões abertos de ${fmt(R.nos.size - M!.fora.length)} na rede` : ''; }

/* ── 06 · radar ── */
function listaRadar() {
  const r = R!; let L = radar(r, rf === 'contato' || rf === 'empresa' ? rf : 'tudo');
  if (rf === 'decide') L = L.filter((n) => n.tipo === 'contato' && n.nivel === 'decide');
  if (rf === 'comum') L = L.filter((n) => n.quem.length > 1);
  return L;
}
function desenharRadar() {
  const L = listaRadar(), nome = (id: string) => no(id).nome;
  $('#radar').innerHTML = L.slice(0, lim).map((n) => `<li><b class="f">${n.nota}</b><div><button type="button" class="nm" data-ir="${esc(n.id)}">${esc(n.nome)}</button> <span class="k">${esc(n.tipo === 'contato' ? [n.sub, n.empresa].filter(Boolean).join(' · ') : n.sub)}</span>
  <p class="cam">${caminho(M!, n.id).map((id) => `<span class="chip t-${no(id).tipo}">${esc(curto(nome(id), 28))}</span>`).join('<em>→</em>')}</p><p class="nota">${esc(n.fatos.slice(0, 3).join(' · '))}</p><button type="button" class="acao" data-funil-rede="${esc(n.id)}">Levar ao funil</button></div></li>`).join('') || '<li><div class="nota">Nada nesse filtro.</div></li>';
  const m = $('#mais'); m.hidden = L.length <= lim; m.textContent = `Mostrar mais ${Math.min(20, L.length - lim)} (${fmt(L.length - lim)} restantes)`;
}

/* ── downloads ── */
/** Dentro do claude.ai o download passa pelo próprio claude.ai (o viewer confirma); no arquivo aberto direto, link comum. */
type Downloads = { save(o: { filename: string; data: string }): Promise<unknown> };
const cl = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
const dlPronto: Promise<Downloads | null> = cl ? cl.use('downloads').then((d) => (d as Downloads) || null).catch(() => null) : Promise.resolve(null);
async function baixar(nome: string, dados: string, tipo: string) {
  if (cl) {
    const d = await dlPronto;
    if (!d) { msg('O download não está disponível nesta visualização. Abra o artefato no navegador do computador.'); return; }
    try { await d.save({ filename: nome, data: dados }); } catch (e) { const c = (e as { code?: string }).code; if (c && c !== 'declined') msg(c === 'host_unavailable' ? 'Este app não salva arquivos: abra o artefato no navegador do computador.' : 'Não deu para salvar o arquivo agora. Tente de novo em instantes.'); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([dados], { type: tipo })); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const dia = () => new Date().toISOString().slice(0, 10);

/* ── eventos ── */
raiz.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.dataset.arq && t.files?.length) void carregar(Number(t.dataset.arq), t.files);
  if (t.id === 'lembrar') guardar();
  if (t.id === 'pub' && R) rodar(false);
});
raiz.addEventListener('input', (ev) => { const t = ev.target as HTMLInputElement; if (t.dataset.nome) { const s = slots[Number(t.dataset.nome)]; if (s.pessoa) { s.pessoa.nome = t.value; guardar(); } } if (t.id === 'q') buscar(t.value); });
raiz.addEventListener('dragover', (ev) => { const d = (ev.target as HTMLElement).closest('[data-drop]'); if (d) { ev.preventDefault(); d.classList.add('sobre'); } });
raiz.addEventListener('dragleave', (ev) => { (ev.target as HTMLElement).closest('[data-drop]')?.classList.remove('sobre'); });
raiz.addEventListener('drop', (ev) => { const d = (ev.target as HTMLElement).closest<HTMLElement>('[data-drop]'); if (!d) return; ev.preventDefault(); d.classList.remove('sobre'); if (ev.dataTransfer?.files.length) void carregar(Number(d.dataset.drop), ev.dataTransfer.files); });
raiz.addEventListener('click', (ev) => {
  const el = ev.target as Element, b = el.closest<HTMLElement>('button, [data-ir]');
  if (!b) return;
  if (b.hasAttribute('data-rodar')) { rodar(); return; }
  if (b.hasAttribute('data-exemplo')) { slots = EXEMPLO().map((p) => ({ nome: p.nome, pessoa: p })); desenharSlots(); msg('Dados de exemplo (pessoas fictícias). Troque pelos arquivos reais e rode de novo.'); rodar(); return; }
  if (b.hasAttribute('data-limpar')) { slots = publicos(); try { localStorage.removeItem(GUARDA); } catch { /* */ } $<HTMLInputElement>('#lembrar').checked = false; desenharSlots(); rodar(false); msg('Tudo apagado deste navegador.'); return; }
  if (b.id === 'btFora') { mostrarFora = !mostrarFora; if (!mostrarFora && sel && M?.fora.includes(sel)) { sel = ''; dossie(); } layout(); vb = vbInicial(); aplicarVb(); desenharMv(); return; }
  if (b.hasAttribute('data-av-melhores')) { arv.melhores(); contarAv(); return; }
  if (b.hasAttribute('data-av-recolher')) { arv.recolher(); contarAv(); return; }
  if (b.closest('#rc')) { contarAv(); return; }
  if (b.dataset.leg) { const t = b.dataset.leg as Tipo; if (!ocultos.delete(t)) ocultos.add(t); desenharMv(); arv.desenhar(); contarAv(); return; }
  if (b.dataset.funilRede && R && crm) { const n = R.nos.get(b.dataset.funilRede); if (n) void crm.levarAoFunil({ id: '', nome: n.nome, tipo: n.tipo === 'contato' ? 'pessoa' : n.anunciante ? 'anunciante' : n.agencia ? 'agencia' : n.veiculo ? 'veiculo' : 'anunciante', cargo: n.tipo === 'contato' ? n.sub : '', empresa: n.empresa, fonte: n.fonte }, 'Rede'); return; }
  if (b.dataset.ir) { escolher(b.dataset.ir); if (!b.closest('#svg') && !b.closest('#dossie')) $('.mv').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (b.dataset.f) { filtro = b.dataset.f; b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharMv(); return; }
  if (b.dataset.r) { rf = b.dataset.r; lim = 20; b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharRadar(); return; }
  if (b.id === 'mais') { lim += 20; desenharRadar(); return; }
  if (b.dataset.z) { const k = Number(b.dataset.z); if (!k) vb = vbInicial(); else { const cx = vb.x + vb.w / 2, cy = vb.y + vb.w / 2; vb.w = Math.min(2400, Math.max(80, vb.w / k)); vb.x = cx - vb.w / 2; vb.y = cy - vb.w / 2; } aplicarVb(); return; }
  if (b.hasAttribute('data-csv') && R) { void baixar(`mento-radar-${dia()}.csv`, csvRadar(R, M!, listaRadar()), 'text/csv;charset=utf-8'); return; }
  if (b.hasAttribute('data-svg') && R) { const s = svg().cloneNode(true) as SVGSVGElement; s.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); s.setAttribute('viewBox', `${-VB0} ${-VB0} ${VB0 * 2} ${VB0 * 2}`); s.insertAdjacentHTML('afterbegin', `<style>${SVG_CSS}</style><rect x="${-VB0}" y="${-VB0}" width="${VB0 * 2}" height="${VB0 * 2}" fill="#000"/>`); void baixar(`mento-multiverso-${dia()}.svg`, s.outerHTML, 'image/svg+xml'); }
});
function buscar(q: string) {
  if (!R || q.trim().length < 2) return;
  const t = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const n = [...R.nos.values()].filter((x) => x.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t)).sort((a, b) => b.nota - a.nota)[0];
  if (n && n.id !== sel) { sel = n.id; desenharMv(); dossie(); const p = pos.get(n.id); if (p) { vb = { x: p.x - 200, y: p.y - 200, w: 400 }; aplicarVb(); } }
}
// zoom no cursor e arraste
svg().addEventListener('wheel', (ev) => {
  ev.preventDefault(); const B = svg().getBoundingClientRect(), k = Math.exp(ev.deltaY * 0.0015);
  const px = vb.x + ((ev.clientX - B.left) / B.width) * vb.w, py = vb.y + ((ev.clientY - B.top) / B.height) * vb.w, w = Math.min(2400, Math.max(80, vb.w * k));
  vb = { x: px - (px - vb.x) * (w / vb.w), y: py - (py - vb.y) * (w / vb.w), w }; aplicarVb();
}, { passive: false });
let arr: { x: number; y: number; vx: number; vy: number } | null = null;
svg().addEventListener('pointerdown', (ev) => { if ((ev.target as Element).closest('[data-ir]')) return; arr = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }; svg().setPointerCapture(ev.pointerId); });
svg().addEventListener('pointermove', (ev) => { if (!arr) return; const B = svg().getBoundingClientRect(), s = vb.w / B.width; vb.x = arr.vx - (ev.clientX - arr.x) * s; vb.y = arr.vy - (ev.clientY - arr.y) * s; aplicarVb(); });
svg().addEventListener('pointerup', () => { arr = null; });
svg().addEventListener('keydown', (ev) => { const c = (ev.target as Element).closest?.('[data-ir]') as SVGElement | null; if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); escolher(c.dataset.ir || ''); } });

const SVG_CSS = `.anel{fill:none;stroke:#2a2a2a;stroke-dasharray:2 6}.anel-t{fill:#777;font:10px sans-serif;letter-spacing:.12em;text-transform:uppercase;text-anchor:middle}.fio{stroke:#2b2b2b;stroke-width:.6}.fio.on{stroke:#0BCF55;stroke-width:2}.p{fill:#777}.p.t-zero,.p.t-equipe{fill:#0BCF55}.p.t-empresa{fill:#fff}.p.ag{fill:none;stroke:#fff}.p.dec{fill:#fff}.p.com{stroke:#0BCF55;stroke-width:1.5}.p.on{fill:#0BCF55}.rot{fill:#fff;font:11px Inter,sans-serif;paint-order:stroke;stroke:#000;stroke-width:3px}.rot.t-zero{font:500 22px 'Saira Stencil',sans-serif}`;
desenharSlots();
let ux: ReturnType<typeof montarUx> | null = null;
function rota() {
  const v = location.hash.slice(1), ok = VISTAS.some(([k]) => k === v) ? v : 'painel';
  ux?.aoTrocar(ok);
  ux?.dobras();
  raiz.querySelectorAll<HTMLElement>('.vista').forEach((x) => { x.hidden = x.dataset.vista !== ok; });
  raiz.querySelectorAll<HTMLElement>('#nav a').forEach((a) => { if (a.dataset.v === ok) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (ok === 'rede' && R) desenharMv();
}
window.addEventListener('hashchange', rota); rota();
let crm: ReturnType<typeof montarCrm> | null = null;
void abrirLoja().then((loja) => {
  $('#modo').textContent = loja.compartilhada ? 'Dados compartilhados da equipe' : 'Dados neste navegador';
  crm = montarCrm({
    raiz, loja,
    equipe: () => slots.map((x) => x.pessoa?.nome.split(' ')[0]).filter((x): x is string => !!x),
    trajetoria: () => new Set(slots.flatMap((x) => x.pessoa?.posicoes || []).map((p) => p.empresa.toLowerCase().trim()).filter((e) => e && !/\bmento\b/.test(e))),
    aoMudarBd: (regs) => { bdAtual = regs; rodar(false); },
    verNaRede: (nome) => { location.hash = '#rede'; setTimeout(() => buscar(nome), 50); },
    aoAtualizar: () => { ux?.passos(); ux?.dobras(); },
  });
  ux = montarUx({
    raiz, vistas: VISTAS, bd: () => crm!.bd(), ops: () => crm!.ops(),
    temConexoes: () => slots.some((x) => (x.pessoa?.conexoes.length || 0) > 0),
    abrirOp: (id) => crm!.abrirOp(id), buscarBd: (q) => crm!.buscarBd(q),
    verNaRede: (nome) => { location.hash = '#rede'; setTimeout(() => buscar(nome), 50); },
  });
  ux.aoTrocar(VISTAS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : 'painel'); ux.passos();
  crm.definirBaixar((nome, dados) => baixar(nome, dados, 'text/csv;charset=utf-8'));
});
rodar(false);
