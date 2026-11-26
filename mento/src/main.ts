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

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => n.toLocaleString('pt-BR');
const curto = (s = '', n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const pl = (n: number, um: string, v: string) => `${fmt(n)} ${n === 1 ? um : v}`;
const GUARDA = 'mento.rede.v1';

const face = (fam: string, b64: string, w: number) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64.trim()}) format("woff2");font-weight:${w};font-style:normal;font-display:swap}`;
document.head.insertAdjacentHTML('beforeend', `<style>${face('Saira Stencil', saira, 500)}${face('Inter', inter400, 400)}${face('Inter', inter500, 500)}${estilo}</style>`);
/** O logo exato da MENTO (vetorizado do arquivo oficial), com o ℗ no canto. */
const LOGO = logo.replace('<svg ', '<svg role="img" aria-label="MENTO" ');
const raiz = document.getElementById('app')!;
raiz.innerHTML = `<div class="mt">
<header class="hero">
 <p class="eb"><i></i>Estratégia. Mídia. Pessoas. · reação em cadeia</p>
 <h1 class="marca">${LOGO}</h1>
 <p class="h2">Conexões que <em>movem marcas.</em></p>
 <p class="lead">Cada pessoa da equipe baixa o arquivo de dados do próprio LinkedIn e entrega aqui. A página junta as redes, põe a MENTO no centro e abre a reação: <b>MENTO → equipe → quem cada um conhece e por onde passou → as empresas onde essas pessoas estão hoje</b>. Cada ponto ganha uma nota de oportunidade e o caminho até a MENTO.</p>
 <p class="priv"><b>Privado por construção.</b> Os arquivos são lidos neste navegador e não são enviados a lugar nenhum. Só o perfil, os cargos e as conexões são lidos; mensagens e o resto do arquivo, nunca.</p>
</header>
<section class="passo" aria-labelledby="t1"><h2 class="t" id="t1"><span>01</span>Os dados de cada pessoa</h2>
 <details class="como"><summary>Como cada pessoa baixa o arquivo do LinkedIn (5 minutos)</summary><ol>
  <li>No LinkedIn, clique em <b>Eu</b> → <b>Configurações e privacidade</b> → <b>Privacidade de dados</b> → <b>Obter uma cópia dos seus dados</b>.</li>
  <li>Escolha <b>Quero um pacote de dados específico</b> e marque <b>Conexões</b>, <b>Cargos</b> e <b>Perfil</b>. Clique em <b>Solicitar arquivo</b> e confirme a senha.</li>
  <li>O LinkedIn manda um e-mail em cerca de 10 minutos. Baixe o <b>.zip</b> e entregue à MENTO (ou arraste aqui, no quadro da pessoa).</li>
 </ol><p class="nota">É o caminho oficial do LinkedIn: ninguém precisa passar a senha a ninguém, e a pessoa decide o que entrega. O .zip inteiro pode vir; aqui só três arquivos são lidos.</p></details>
 <div class="slots" id="slots"></div>
 <div class="acoes"><button type="button" class="btn" data-rodar>Rodar a reação em cadeia</button><button type="button" class="btn sec" data-exemplo>Ver com dados de exemplo</button><label class="chk"><input type="checkbox" id="lembrar"> Lembrar neste navegador</label><button type="button" class="lnk" data-limpar>Apagar tudo</button></div>
 <p class="msg" id="msg" aria-live="polite"></p>
</section>
<div id="res" hidden>
 <section class="passo" aria-labelledby="t2"><h2 class="t" id="t2"><span>02</span>O tamanho da rede</h2><ul class="kpis" id="kpis"></ul></section>
 <section class="passo" aria-labelledby="t3"><h2 class="t" id="t3"><span>03</span>Em comum</h2><p class="nota">Quem as duas pessoas conhecem e as empresas onde as duas têm gente: a conversa pode vir de qualquer uma, e a outra reforça.</p><div class="dois" id="comum"></div></section>
 <section class="passo" aria-labelledby="t4"><h2 class="t" id="t4"><span>04</span>Reação em cadeia</h2><p class="nota">Volta por volta, os pontos mais fortes. A nota soma quem decide a contratação, quem é conhecido pelas duas pessoas, quantos conhecidos há na mesma empresa e onde a equipe já trabalhou.</p><div class="rc" id="rc" tabindex="0" role="region" aria-label="Voltas da reação, rola de lado"></div></section>
 <section class="passo" aria-labelledby="t5"><h2 class="t" id="t5"><span>05</span>Multiverso</h2><p class="nota">A rede inteira. Clique num ponto para acender o caminho até a MENTO; role para aproximar; arraste para andar.</p>
  <div class="mv"><div class="palco"><div class="ferr"><input type="search" id="q" placeholder="Buscar pessoa ou empresa" autocomplete="off"><div class="seg" role="group" aria-label="Mostrar"><button type="button" data-f="tudo" aria-pressed="true">Tudo</button><button type="button" data-f="decide" aria-pressed="false">Só quem decide</button><button type="button" data-f="comum" aria-pressed="false">Em comum</button></div></div><svg id="svg" viewBox="-560 -560 1120 1120" role="group" aria-label="Multiverso da MENTO"></svg><div class="zoom"><button type="button" data-z="1.4" aria-label="Aproximar">+</button><button type="button" data-z="0.7" aria-label="Afastar">−</button><button type="button" data-z="0" aria-label="Ver tudo">⌂</button></div></div><aside class="dossie" id="dossie" aria-live="polite"></aside></div>
  <div class="acoes"><button type="button" class="btn sec" data-svg>Baixar o mapa (SVG)</button></div></section>
 <section class="passo" aria-labelledby="t6"><h2 class="t" id="t6"><span>06</span>Radar · por onde começar</h2>
  <div class="seg" id="rf" role="group" aria-label="Filtrar o radar"><button type="button" data-r="tudo" aria-pressed="true">Tudo</button><button type="button" data-r="contato" aria-pressed="false">Pessoas</button><button type="button" data-r="empresa" aria-pressed="false">Empresas</button><button type="button" data-r="decide" aria-pressed="false">Quem decide</button><button type="button" data-r="comum" aria-pressed="false">Em comum</button></div>
  <ol class="radar" id="radar"></ol><div class="acoes"><button type="button" class="lnk" id="mais" hidden>Mostrar mais</button><button type="button" class="btn" data-csv>Baixar o radar (planilha)</button></div></section>
</div>
<footer class="rod">MENTO · Conexões que movem marcas. Rede montada só com os dados que cada pessoa entregou.</footer>
</div>`;
const $ = <T extends Element = HTMLElement>(s: string) => raiz.querySelector(s) as T;

interface Slot { nome: string; pessoa: Pessoa | null }
let slots: Slot[] = [{ nome: '', pessoa: null }, { nome: '', pessoa: null }];
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
    const p: Pessoa = antes && !lista.some((x) => /\.zip$/i.test(x.nome)) ? { ...antes, nome: nova.nome || antes.nome, titulo: nova.titulo || antes.titulo, posicoes: nova.posicoes.length ? nova.posicoes : antes.posicoes, conexoes: nova.conexoes.length ? nova.conexoes : antes.conexoes, arquivos: [...new Set([...antes.arquivos, ...nova.arquivos])].sort() } : nova;
    slots[i] = { nome: p.nome, pessoa: p }; guardar(); desenharSlots();
    msg(`${p.nome || 'Pessoa ' + (i + 1)}: ${pl(p.conexoes.length, 'conexão lida', 'conexões lidas')} e ${pl(p.posicoes.length, 'cargo', 'cargos')}.`);
  } catch (e) { msg(`Pessoa ${i + 1}: ${(e as Error).message || 'não deu para ler o arquivo.'}`); }
}
const msg = (t: string) => { $('#msg').textContent = t; };

/* ── a rede ── */
function rodar() {
  const equipe = slots.map((s) => s.pessoa).filter((p): p is Pessoa => !!p);
  if (!equipe.length) { msg('Carregue o arquivo de pelo menos uma pessoa.'); return; }
  R = montarRede(equipe); M = multiverso(R); Q = reacao(R); sel = ''; lim = 20;
  $('#res').hidden = false; resultado(); $('#res').scrollIntoView({ behavior: 'smooth', block: 'start' });
  msg(equipe.length < 2 ? 'Rodou com uma pessoa. Carregue a segunda para ver o que as duas têm em comum.' : '');
}
const no = (id: string) => R!.nos.get(id)!;
const chip = (id: string) => { const n = R!.nos.get(id); return n ? `<button type="button" class="chip t-${n.tipo}" data-ir="${esc(id)}">${esc(curto(n.nome, 30))}</button>` : ''; };
const quemDe = (n: No) => n.quem.map((id) => no(id).nome.split(' ')[0]).join(' e ');
function resultado() {
  const r = R!, todos = [...r.nos.values()], cont = todos.filter((n) => n.tipo === 'contato'), emp = todos.filter((n) => n.tipo === 'empresa');
  const soma = r.equipe.reduce((t, p) => t + p.conexoes.length, 0), comum = emComum(r);
  $('#kpis').innerHTML = [[soma, 'conexões somadas', `${fmt(cont.length)} pessoas únicas fora da MENTO`], [comum.length, 'em comum', 'conhecidas pelas duas pessoas'], [emp.length, 'empresas', `${fmt(emp.filter((e) => !e.agencia).length)} sem contar agências`], [cont.filter((c) => c.nivel === 'decide').length, 'decidem', 'cargos que contratam agência e mídia'], [M!.voltas.length - 1, 'voltas', 'da MENTO até o ponto mais distante']]
    .map(([v, t, d], i) => `<li${i ? '' : ' class="on"'}><b>${fmt(Number(v))}</b><span>${esc(t)}</span><small>${esc(d)}</small></li>`).join('');
  const empC = emp.filter((e) => e.quem.length > 1).sort((a, b) => b.nota - a.nota);
  $('#comum').innerHTML = `<div><h3 class="st">Pessoas <span class="n">${fmt(comum.length)}</span></h3>${lista(comum.slice(0, 12))}</div><div><h3 class="st">Empresas <span class="n">${fmt(empC.length)}</span></h3>${lista(empC.slice(0, 12))}</div>`;
  const NOMES = ['Ponto zero', 'Equipe', 'Quem conhecem e onde passaram', 'Empresas que se abrem', 'Quem mais está nessas empresas'];
  $('#rc').innerHTML = Q!.geracoes.map((col, g) => `<div class="col"><h3 class="ct">${esc(NOMES[g] || g + 'ª volta')}<span>${fmt(col.length)}${Q!.ocultos[g] ? ` de ${fmt(col.length + Q!.ocultos[g])}` : ''}</span></h3>${col.map((x) => {
    const n = no(x.id), pai = x.pais[0];
    return `<button type="button" class="card t-${n.tipo}" data-ir="${esc(n.id)}"><span class="k">${n.tipo === 'zero' ? 'Ponto zero' : n.tipo === 'equipe' ? 'Equipe' : n.tipo === 'empresa' ? (n.agencia ? 'Agência' : 'Empresa') : n.nivel === 'decide' ? 'Decide' : 'Pessoa'}</span>${n.tipo === 'zero' ? `<span class="lz">${LOGO}</span>` : `<b>${esc(n.nome)}</b>`}${n.tipo === 'contato' ? `<span class="m">${esc(curto([n.sub, n.empresa].filter(Boolean).join(' · '), 64))}</span>` : n.tipo === 'empresa' ? `<span class="m">${esc(n.fatos[0] || '')}</span>` : ''}${g > 1 && pai ? `<span class="de">via ${esc(curto(no(pai.id).nome, 26))}${x.pais.length > 1 ? ` e mais ${x.pais.length - 1}` : ''}</span>` : ''}${g > 1 ? `<span class="f">${x.forca}</span>` : ''}</button>`;
  }).join('')}</div>`).join('');
  desenharMv(); dossie(); desenharRadar();
}
const lista = (L: No[]) => L.length ? `<ul class="li">${L.map((n) => `<li><button type="button" data-ir="${esc(n.id)}"><b>${esc(n.nome)}</b><span>${esc(curto(n.tipo === 'contato' ? [n.sub, n.empresa].filter(Boolean).join(' · ') : n.fatos[0] || '', 70))}</span></button><em>${n.nota}</em></li>`).join('')}</ul>` : '<p class="nota">Nada em comum ainda.</p>';

/* ── 05 · multiverso radial ── */
const RAIO = [0, 120, 330, 500];
const pos = new Map<string, { x: number; y: number; r: number; a: number }>();
function layout() {
  pos.clear(); const m = M!, r = R!;
  pos.set(ZERO, { x: 0, y: 0, r: 22, a: 0 });
  const eq = m.voltas[1] || [];
  // setores da equipe proporcionais ao tamanho da rede de cada um
  const peso = eq.map((id) => Math.max(1, (m.voltas[2] || []).filter((x) => m.pai.get(x)?.id === id).length)), tot = peso.reduce((a, b) => a + b, 0);
  let a0 = -Math.PI / 2; const setor = new Map<string, [number, number]>();
  eq.forEach((id, i) => { const da = (peso[i] / tot) * Math.PI * 2; setor.set(id, [a0, a0 + da]); const a = a0 + da / 2; pos.set(id, { x: Math.cos(a) * RAIO[1], y: Math.sin(a) * RAIO[1], r: 11, a }); a0 += da; });
  const OURO = 0.6180339887;
  for (const g of [2, 3]) {
    const v = m.voltas[g] || []; if (!v.length) continue;
    const esc2 = Math.min(1, Math.sqrt(500 / v.length)); // rede grande: pontos menores
    if (g === 2) for (const id of eq) {
      // os mais fortes se espalham pelo setor (passo áureo), em vez de se amontoar no começo dele
      const fil = v.filter((x) => m.pai.get(x)?.id === id).sort((p, q) => r.nos.get(q)!.nota - r.nos.get(p)!.nota), [s, e] = setor.get(id)!;
      fil.forEach((x, k) => { const f = fil.length > 1 ? (k * OURO) % 1 : 0.5, a = s + (e - s) * (0.02 + f * 0.96), n = r.nos.get(x)!, rr = RAIO[2] + (((k * 7919) % 11) - 5) * (fil.length > 60 ? 9 : 4);
        pos.set(x, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: (n.tipo === 'empresa' ? 3.5 + n.nota / 14 : 1.6 + n.nota / 26) * (n.tipo === 'empresa' ? 1 : esc2) + (n.tipo === 'empresa' ? 0 : 0.6), a }); });
    } else {
      // empresas: o anel inteiro, na ordem do ângulo médio de quem as traz (ficam perto dos seus conhecidos)
      const ang = v.map((x) => { let sx = 0, sy = 0; for (const a of r.adj.get(x) || []) { const p = pos.get(a.b); if (p && a.b.startsWith('c:')) { sx += Math.cos(p.a); sy += Math.sin(p.a); } } return { x, a: Math.atan2(sy, sx) }; }).sort((p, q) => p.a - q.a);
      ang.forEach(({ x }, k) => { const a = -Math.PI / 2 + (k + 0.5) / ang.length * Math.PI * 2, n = r.nos.get(x)!, rr = RAIO[3] + (ang.length > 80 ? ((k % 3) - 1) * 14 : 0); pos.set(x, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: (2.5 + n.nota / 11) * Math.max(0.55, esc2), a }); });
    }
  }
}
let vb = { x: -560, y: -560, w: 1120 };
const svg = () => $<SVGSVGElement>('#svg');
const aplicarVb = () => svg().setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.w}`);
function visivel(n: No) { return filtro === 'tudo' || n.tipo === 'zero' || n.tipo === 'equipe' || (filtro === 'decide' ? (n.tipo === 'contato' ? n.nivel === 'decide' : n.fatos.some((f) => /decide/.test(f))) : n.quem.length > 1); }
function desenharMv() {
  layout(); const r = R!, m = M!, aceso = new Set(sel ? caminho(m, sel) : []);
  const top = new Set([...r.nos.values()].filter((n) => n.tipo !== 'zero' && n.tipo !== 'equipe').sort((a, b) => b.nota - a.nota).slice(0, 24).map((n) => n.id));
  let fios = '', pts = '', rots = '';
  for (const [id, p] of m.pai) { const a = pos.get(id), b = pos.get(p.id); if (!a || !b || !visivel(r.nos.get(id)!)) continue; fios += `<line x1="${b.x.toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${a.x.toFixed(1)}" y2="${a.y.toFixed(1)}" class="fio${aceso.has(id) && aceso.has(p.id) ? ' on' : ''}"/>`; }
  for (const [id, p] of pos) {
    const n = r.nos.get(id)!; if (!visivel(n)) continue;
    const cls = `p t-${n.tipo}${n.nivel === 'decide' ? ' dec' : ''}${n.quem.length > 1 ? ' com' : ''}${n.agencia ? ' ag' : ''}${aceso.has(id) ? ' on' : ''}${id === sel ? ' sel' : ''}`;
    pts += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" class="${cls}" data-ir="${esc(id)}" tabindex="${n.tipo === 'zero' || n.tipo === 'equipe' || top.has(id) ? 0 : -1}"><title>${esc(n.nome)}${n.sub && n.tipo !== 'zero' ? ' · ' + esc(n.sub) : ''}</title></circle>`;
    if (n.tipo === 'zero' || n.tipo === 'equipe' || top.has(id) || aceso.has(id)) {
      const dx = n.tipo === 'zero' ? 0 : Math.cos(p.a) * (p.r + 6), dy = n.tipo === 'zero' ? p.r + 22 : Math.sin(p.a) * (p.r + 6) + 4, ali = n.tipo === 'zero' || Math.abs(Math.cos(p.a)) < 0.3 ? 'middle' : Math.cos(p.a) > 0 ? 'start' : 'end';
      rots += `<text x="${(p.x + dx).toFixed(1)}" y="${(p.y + dy).toFixed(1)}" text-anchor="${ali}" class="rot t-${n.tipo}${aceso.has(id) ? ' on' : ''}">${esc(curto(n.tipo === 'equipe' ? n.nome.split(' ')[0] : n.nome, 26))}</text>`;
    }
  }
  const aneis = RAIO.slice(1).map((rr, i) => `<circle r="${rr}" class="anel"/><text y="${-rr - 8}" class="anel-t">${['equipe', 'conhecidos e trajetória', 'empresas dos conhecidos'][i]} · ${fmt((m.voltas[i + 1] || []).length)}</text>`).join('');
  svg().innerHTML = `<g>${aneis}</g><g>${fios}</g><g>${pts}</g><g>${rots}</g>`;
}
function dossie() {
  const el = $('#dossie'); if (!sel || !R) { el.innerHTML = `<span class="lab">Dossiê</span><p class="nota">Clique num ponto do mapa, do radar ou da reação para ver quem é, por que importa e o caminho até a MENTO.</p>`; return; }
  const n = no(sel), c = caminho(M!, sel);
  el.innerHTML = `<span class="lab">${esc(n.tipo === 'contato' ? (n.nivel === 'decide' ? 'Pessoa · decide' : 'Pessoa') : n.tipo === 'empresa' ? (n.agencia ? 'Agência' : 'Empresa') : n.tipo === 'equipe' ? 'Equipe' : 'Ponto zero')}</span><h3>${esc(n.nome)}</h3>
  ${n.tipo === 'contato' ? `<p class="sub">${esc([n.sub, n.empresa].filter(Boolean).join(' · '))}</p>` : n.sub && n.tipo !== 'zero' ? `<p class="sub">${esc(n.sub)}</p>` : ''}
  ${n.tipo === 'contato' || n.tipo === 'empresa' ? `<div class="nota-b"><span><i style="width:${n.nota}%"></i></span><b>${n.nota}</b></div>` : ''}
  ${n.fatos.length ? `<ul class="fatos">${n.fatos.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
  ${n.quem.length && n.tipo !== 'equipe' ? `<p class="sub">Quem conhece: <b>${esc(quemDe(n))}</b></p>` : ''}
  ${c.length > 1 ? `<span class="lab">Caminho</span><p class="cam">${c.map(chip).join('<em>→</em>')}</p>` : ''}
  ${n.tipo === 'empresa' ? `<span class="lab">Quem está lá</span>${lista((R!.adj.get(n.id) || []).map((a) => no(a.b)).filter((x) => x.tipo === 'contato').sort((a, b) => b.nota - a.nota).slice(0, 8))}` : ''}
  ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">Perfil no LinkedIn ↗</a></p>` : ''}${n.email ? `<p class="sub">${esc(n.email)}</p>` : ''}`;
}
function escolher(id: string) { sel = sel === id ? '' : id; desenharMv(); dossie(); }

/* ── 06 · radar ── */
function listaRadar() {
  const r = R!; let L = radar(r, rf === 'contato' || rf === 'empresa' ? rf : 'tudo');
  if (rf === 'decide') L = L.filter((n) => n.tipo === 'contato' && n.nivel === 'decide');
  if (rf === 'comum') L = L.filter((n) => n.quem.length > 1);
  return L;
}
function desenharRadar() {
  const L = listaRadar(), nome = (id: string) => no(id).nome;
  $('#radar').innerHTML = L.slice(0, lim).map((n) => `<li><b class="f">${n.nota}</b><div><button type="button" class="nm" data-ir="${esc(n.id)}">${esc(n.nome)}</button> <span class="k">${esc(n.tipo === 'contato' ? [n.sub, n.empresa].filter(Boolean).join(' · ') : n.agencia ? 'Agência' : 'Empresa')}</span>
  <p class="cam">${caminho(M!, n.id).map((id) => `<span class="chip t-${no(id).tipo}">${esc(curto(nome(id), 28))}</span>`).join('<em>→</em>')}</p><p class="nota">${esc(n.fatos.slice(0, 3).join(' · '))}</p></div></li>`).join('') || '<li><div class="nota">Nada nesse filtro.</div></li>';
  const m = $('#mais'); m.hidden = L.length <= lim; m.textContent = `Mostrar mais ${Math.min(20, L.length - lim)} (${fmt(L.length - lim)} restantes)`;
}

/* ── downloads ── */
function baixar(nome: string, dados: string, tipo: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([dados], { type: tipo })); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const dia = () => new Date().toISOString().slice(0, 10);

/* ── eventos ── */
raiz.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.dataset.arq && t.files?.length) void carregar(Number(t.dataset.arq), t.files);
  if (t.id === 'lembrar') guardar();
});
raiz.addEventListener('input', (ev) => { const t = ev.target as HTMLInputElement; if (t.dataset.nome) { const s = slots[Number(t.dataset.nome)]; if (s.pessoa) { s.pessoa.nome = t.value; guardar(); } } if (t.id === 'q') buscar(t.value); });
raiz.addEventListener('dragover', (ev) => { const d = (ev.target as HTMLElement).closest('[data-drop]'); if (d) { ev.preventDefault(); d.classList.add('sobre'); } });
raiz.addEventListener('dragleave', (ev) => { (ev.target as HTMLElement).closest('[data-drop]')?.classList.remove('sobre'); });
raiz.addEventListener('drop', (ev) => { const d = (ev.target as HTMLElement).closest<HTMLElement>('[data-drop]'); if (!d) return; ev.preventDefault(); d.classList.remove('sobre'); if (ev.dataTransfer?.files.length) void carregar(Number(d.dataset.drop), ev.dataTransfer.files); });
raiz.addEventListener('click', (ev) => {
  const el = ev.target as Element, b = el.closest<HTMLElement>('button, circle[data-ir]');
  if (!b) return;
  if (b.hasAttribute('data-rodar')) { rodar(); return; }
  if (b.hasAttribute('data-exemplo')) { slots = EXEMPLO().map((p) => ({ nome: p.nome, pessoa: p })); desenharSlots(); msg('Dados de exemplo (pessoas fictícias). Troque pelos arquivos reais e rode de novo.'); rodar(); return; }
  if (b.hasAttribute('data-limpar')) { slots = [{ nome: '', pessoa: null }, { nome: '', pessoa: null }]; try { localStorage.removeItem(GUARDA); } catch { /* */ } $<HTMLInputElement>('#lembrar').checked = false; R = null; $('#res').hidden = true; desenharSlots(); msg('Tudo apagado deste navegador.'); return; }
  if (b.dataset.ir) { escolher(b.dataset.ir); if (!b.closest('#svg') && !b.closest('#dossie')) $('.mv').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (b.dataset.f) { filtro = b.dataset.f; b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharMv(); return; }
  if (b.dataset.r) { rf = b.dataset.r; lim = 20; b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharRadar(); return; }
  if (b.id === 'mais') { lim += 20; desenharRadar(); return; }
  if (b.dataset.z) { const k = Number(b.dataset.z); if (!k) vb = { x: -560, y: -560, w: 1120 }; else { const cx = vb.x + vb.w / 2, cy = vb.y + vb.w / 2; vb.w = Math.min(2400, Math.max(80, vb.w / k)); vb.x = cx - vb.w / 2; vb.y = cy - vb.w / 2; } aplicarVb(); return; }
  if (b.hasAttribute('data-csv') && R) { baixar(`mento-radar-${dia()}.csv`, csvRadar(R, M!, listaRadar()), 'text/csv;charset=utf-8'); return; }
  if (b.hasAttribute('data-svg') && R) { const s = svg().cloneNode(true) as SVGSVGElement; s.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); s.setAttribute('viewBox', '-560 -560 1120 1120'); s.insertAdjacentHTML('afterbegin', `<style>${SVG_CSS}</style><rect x="-560" y="-560" width="1120" height="1120" fill="#000"/>`); baixar(`mento-multiverso-${dia()}.svg`, s.outerHTML, 'image/svg+xml'); }
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
if (slots.some((s) => s.pessoa)) msg('Os arquivos da última visita estão aqui (você marcou "Lembrar neste navegador").');
