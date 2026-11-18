/* Visor do arquivo do mapa da Investigação (HTML baixado). Roda sozinho, sem rede: lê os dados de #dados e desenha o
 * multiverso como árvore radial (o ponto de partida no centro, uma volta por ramificação, os filhos de cada ponto juntos
 * no mesmo arco). Zoom, arrasto, busca, dossiê de cada ponto, radar dos mais fortes e filtros por ramificação. */
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('dados').textContent);
  var NOS = D.nos, por = {}, filhos = {}, raiz = D.semente;
  NOS.forEach(function (n) { por[n.id] = n; });
  NOS.forEach(function (n) { if (n.p && por[n.p]) (filhos[n.p] = filhos[n.p] || []).push(n.id); });
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var curto = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var GER = function (g) { return g ? g + 'ª ramificação' : 'Ponto de partida'; };
  var TIPO = { origem: 'Ponto zero', empresa: 'Anunciante', agencia: 'Agência', pessoa: 'Pessoa' };
  var NIVEL = { contrata: 'contrata produção', aprova: 'aprova fornecedor', lidera: 'alta liderança' };
  var host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'fonte'; } };
  var dt = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

  /* ── geometria: árvore radial, cada ponto com um arco proporcional às folhas que carrega ── */
  var folhas = {};
  (function contar(id) { var f = filhos[id] || [], s = 0; f.forEach(function (c) { s += contar(c); }); folhas[id] = Math.max(1, s); return folhas[id]; })(raiz);
  // cada volta tem o raio que a quantidade de pontos dela pede (uns 15 px de arco por ponto), e no mínimo 95 px depois da anterior
  var maxG = D.camadas.length - 1, RAIOS = [0];
  for (var gi = 1; gi <= maxG; gi++) RAIOS[gi] = Math.max(RAIOS[gi - 1] + (gi === 1 ? 120 : 95), D.camadas[gi].n * 15 / (2 * Math.PI));
  var raio = function (g) { return RAIOS[g] || 0; };
  var ang = {};
  (function dist(id, a0, a1) {
    ang[id] = (a0 + a1) / 2;
    var f = filhos[id] || [], tot = 0, a = a0; f.forEach(function (c) { tot += folhas[c]; });
    f.forEach(function (c) { var w = (a1 - a0) * folhas[c] / tot; dist(c, a, a + w); a += w; });
  })(raiz, 0, Math.PI * 2);
  var pos = function (id) { var n = por[id], r = raio(n.g), t = ang[id] - Math.PI / 2; return [r * Math.cos(t), r * Math.sin(t), t]; };
  var tam = function (n) { return n.id === raiz ? 27 : n.t === 'pessoa' ? 2.2 + n.nota / 40 : n.x ? 4 : 3.4 + n.nota / 18; };
  // na visão geral, só os rótulos da 1ª ramificação e dos 10 mais fortes; o resto aparece ao aproximar ou passar o mouse
  var topo = {}; NOS.filter(function (n) { return n.f != null && n.id !== raiz && !n.x; }).sort(function (a, b) { return b.f - a.f; }).slice(0, 10).forEach(function (n) { topo[n.id] = 1; });
  var P = {}; NOS.forEach(function (n) { P[n.id] = pos(n.id); });
  var S = 2 * (raio(maxG) + 190);

  /* ── desenho ── */
  var pt = function (r, t) { return (r * Math.cos(t)).toFixed(1) + ',' + (r * Math.sin(t)).toFixed(1); };
  var aneis = '', fios = '', extras = '', nos = '', porG = [];
  for (var g = 1; g <= maxG; g++) {
    var c = D.camadas[g];
    aneis += '<g class="onda" style="--g:' + g + '"><circle class="anel" r="' + raio(g) + '"></circle><g transform="translate(0,' + (-raio(g)) + ')"><text class="anel-r" x="6" y="-6">' + esc(GER(g)) + ' · ' + c.n + '</text></g></g>';
    porG[g] = { f: '', n: '' };
  }
  NOS.forEach(function (n) {
    if (n.id === raiz) return;
    var p = por[n.p], a = P[n.p], b = P[n.id], rm = (raio(p.g) + raio(n.g)) / 2;
    var cls = 'fio g' + n.g + (n.t === 'pessoa' || p.t === 'pessoa' ? ' pessoa' : '') + (n.r === 'virou' ? ' virou' : '') + (n.f == null ? ' fechado' : '');
    porG[n.g].f += '<path class="' + cls + '" data-a="' + esc(n.p) + '" data-b="' + esc(n.id) + '" d="M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' C' + pt(rm, ang[n.p] - Math.PI / 2) + ' ' + pt(rm, b[2]) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1) + '"></path>';
  });
  D.extras.forEach(function (e) {
    var a = P[e[0]], b = P[e[1]]; if (!a || !b) return;
    extras += '<path class="extra g' + por[e[0]].g + ' g' + por[e[1]].g + '" data-a="' + esc(e[0]) + '" data-b="' + esc(e[1]) + '" d="M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' Q' + ((a[0] + b[0]) * 0.3).toFixed(1) + ',' + ((a[1] + b[1]) * 0.3).toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1) + '"><title>' + esc(por[e[0]].n + ' ↔ ' + por[e[1]].n + ': ' + e[2]) + '</title></path>';
  });
  NOS.forEach(function (n) {
    var q = P[n.id], r = tam(n);
    if (n.id === raiz) { nos += '<g class="no zero" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-label="' + esc(n.n) + ', ponto de partida"><g class="es"><circle r="' + r + '"></circle><text style="font-size:' + Math.min(11, Math.max(6.5, 80 / Math.max(6, n.n.length))).toFixed(1) + 'px">' + esc(curto(n.n, 16)) + '</text></g></g>'; return; }
    var dir = Math.cos(q[2]) >= 0, graus = q[2] * 180 / Math.PI + (dir ? 0 : 180);
    var rot = (n.g <= 1 && n.t !== 'pessoa') || topo[n.id];
    var cls = 'no ' + n.t + ' g' + n.g + (n.nv ? ' ' + n.nv : '') + (n.x ? ' extinta' : '') + (n.f == null ? ' fechado' : '') + (rot ? ' rot' : '') + (n.novo ? ' novo' : '');
    porG[n.g].n += '<g class="' + cls + '" data-id="' + esc(n.id) + '" transform="translate(' + q[0].toFixed(1) + ',' + q[1].toFixed(1) + ')"' + (n.g <= 1 ? ' tabindex="0"' : '') + ' role="button" aria-label="' + esc(n.n + ', ' + TIPO[n.t]) + '">' +
      '<g class="es">' + (n.novo ? '<circle class="halo" r="' + r + '"></circle>' : '') + '<circle r="' + r + '"></circle><text transform="rotate(' + graus.toFixed(1) + ')" x="' + (dir ? r + 5 : -(r + 5)) + '" dy=".32em" text-anchor="' + (dir ? 'start' : 'end') + '">' + esc(curto(n.n, 30)) + '</text></g><title>' + esc(n.n + ' · ' + (n.t === 'pessoa' ? (n.s || '') + (n.o ? ' · ' + n.o : '') : TIPO[n.t])) + '</title></g>';
  });
  for (g = 1; g <= maxG; g++) { fios += '<g class="onda" style="--g:' + g + '">' + porG[g].f + '</g>'; nos += '<g class="onda" style="--g:' + g + '">' + porG[g].n + '</g>'; }
  var svg = $('#tela');
  svg.setAttribute('viewBox', (-S / 2) + ' ' + (-S / 2) + ' ' + S + ' ' + S);
  svg.innerHTML = '<g id="mundo"><g>' + aneis + '</g><g>' + fios + '</g><g>' + extras + '</g><g>' + nos + '</g></g>';
  var mundo = $('#mundo');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { svg.classList.add('entra'); setTimeout(function () { svg.classList.remove('entra'); }, 700 + maxG * 280 + 300); }

  /* ── números do topo e voltas ── */
  var abertos = NOS.filter(function (n) { return n.f != null && n.id !== raiz; }), portas = NOS.filter(function (n) { return n.nv === 'contrata'; }).length;
  $('#num').innerHTML = [[D.total, 'pontos no mapa'], [D.alcance, 'alcançados daqui'], [maxG, 'ramificações'], [abertos.length, 'abertos na reação'], [portas, 'pessoas que contratam']]
    .map(function (x) { return '<li><b>' + x[0] + '</b><span>' + x[1] + '</span></li>'; }).join('');
  var maxN = Math.max.apply(null, D.camadas.slice(1).map(function (c) { return c.n; }).concat([D.fora, 1]));
  var escondidas = {};
  function voltas() {
    $('#voltas').innerHTML = D.camadas.slice(1).map(function (c) {
      return '<li><button type="button" data-g="' + c.ger + '" aria-pressed="' + !escondidas[c.ger] + '" title="Mostrar ou esconder esta ramificação"><span>' + esc(GER(c.ger)) + '</span><span class="barra"><i style="width:' + (c.n / maxN * 100).toFixed(1) + '%"></i><s style="width:' + (c.abertos / maxN * 100).toFixed(1) + '%"></s></span><b>' + c.n + '</b></button></li>';
    }).join('') + '<li><button type="button" disabled class="fora"><span>Fora de alcance</span><span class="barra"><i style="width:' + (D.fora / maxN * 100).toFixed(1) + '%;opacity:.5"></i></span><b>' + D.fora + '</b></button></li>';
    $('#esconde').textContent = Object.keys(escondidas).filter(function (k) { return escondidas[k]; }).map(function (k) { return '#tela .g' + k + '{display:none}'; }).join('');
  }
  voltas();

  /* ── zoom e arrasto ── */
  var V = { x: 0, y: 0, k: 1 };
  function aplicar(suave) {
    mundo.style.transition = suave ? 'transform .45s cubic-bezier(.2,.7,.2,1)' : 'none';
    mundo.setAttribute('transform', 'translate(' + V.x.toFixed(1) + ',' + V.y.toFixed(1) + ') scale(' + V.k.toFixed(3) + ')');
    svg.classList.toggle('perto', V.k >= 2.4);
    // pontos, rótulos e linhas mantêm o tamanho na tela, com qualquer zoom
    var lado = Math.min(svg.clientWidth || 800, svg.clientHeight || 800), base = lado / S, tela = Math.max(0.5, Math.min(1, lado / 680));
    svg.style.setProperty('--s', (tela / (V.k * base)).toFixed(4));
  }
  window.addEventListener('resize', function () { aplicar(false); });
  function emSvg(cx, cy) { var m = svg.getScreenCTM(); if (!m) return [0, 0]; var p = svg.createSVGPoint(); p.x = cx; p.y = cy; p = p.matrixTransform(m.inverse()); return [p.x, p.y]; }
  function zoomEm(f, cx, cy) { var k = Math.max(0.5, Math.min(8, V.k * f)), q = emSvg(cx, cy); V.x = q[0] - (q[0] - V.x) * (k / V.k); V.y = q[1] - (q[1] - V.y) * (k / V.k); V.k = k; aplicar(false); }
  svg.addEventListener('wheel', function (e) { e.preventDefault(); zoomEm(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  var toques = {}, arr = null, moveu = false;
  svg.addEventListener('pointerdown', function (e) { toques[e.pointerId] = [e.clientX, e.clientY]; arr = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; moveu = false; });
  svg.addEventListener('pointermove', function (e) {
    if (!toques[e.pointerId]) return;
    var ids = Object.keys(toques);
    if (ids.length === 2) {
      var o = toques[ids[0]], p = toques[ids[1]], d0 = Math.hypot(o[0] - p[0], o[1] - p[1]);
      toques[e.pointerId] = [e.clientX, e.clientY]; o = toques[ids[0]]; p = toques[ids[1]];
      var d1 = Math.hypot(o[0] - p[0], o[1] - p[1]); if (d0) zoomEm(d1 / d0, (o[0] + p[0]) / 2, (o[1] + p[1]) / 2); moveu = true; return;
    }
    toques[e.pointerId] = [e.clientX, e.clientY];
    if (!arr) return;
    var dx = e.clientX - arr.x, dy = e.clientY - arr.y; if (Math.abs(dx) + Math.abs(dy) > 4) { moveu = true; svg.classList.add('arrasta'); if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId); }
    if (!moveu) return;
    var esc2 = S / Math.min(svg.clientWidth, svg.clientHeight); V.x = arr.vx + dx * esc2; V.y = arr.vy + dy * esc2; aplicar(false);
  });
  var solta = function (e) { delete toques[e.pointerId]; if (!Object.keys(toques).length) { arr = null; svg.classList.remove('arrasta'); } };
  svg.addEventListener('pointerup', solta); svg.addEventListener('pointercancel', solta);
  $('#zmais').onclick = function () { var r = svg.getBoundingClientRect(); zoomEm(1.5, r.left + r.width / 2, r.top + r.height / 2); };
  $('#zmenos').onclick = function () { var r = svg.getBoundingClientRect(); zoomEm(1 / 1.5, r.left + r.width / 2, r.top + r.height / 2); };
  $('#zinicio').onclick = function () { V = { x: 0, y: 0, k: 1 }; aplicar(true); };
  aplicar(false);
  function centrar(id) { var q = P[id], k = Math.max(V.k, id === raiz ? 1 : 2.2); V = { x: -q[0] * k, y: -q[1] * k, k: k }; aplicar(true); }

  /* ── escolher um ponto: caminho até o centro, vizinhos e dossiê ── */
  var sel = '';
  function caminho(id) { var c = [], x = por[id]; while (x) { c.unshift(x); x = x.p ? por[x.p] : null; } return c; }
  function vizinhos(id) {
    var v = {}; v[id] = 1; var n = por[id]; if (n.p) v[n.p] = 1; (filhos[id] || []).forEach(function (c) { v[c] = 1; });
    D.extras.forEach(function (e) { if (e[0] === id) v[e[1]] = 1; if (e[1] === id) v[e[0]] = 1; }); return v;
  }
  function escolher(id, centralizar) {
    sel = sel === id && !centralizar ? '' : id;
    var cam = {}, viz = sel ? vizinhos(sel) : {};
    if (sel) caminho(sel).forEach(function (x) { cam[x.id] = 1; });
    svg.classList.toggle('foco', !!sel);
    svg.querySelectorAll('.no').forEach(function (el) { var i = el.getAttribute('data-id'); el.classList.toggle('on', i === sel); el.classList.toggle('cam', !!cam[i]); el.classList.toggle('viz', !!viz[i]); el.setAttribute('aria-pressed', String(i === sel)); });
    svg.querySelectorAll('.fio').forEach(function (el) { var a = el.getAttribute('data-a'), b = el.getAttribute('data-b'); el.classList.toggle('cam', !!(cam[a] && cam[b])); el.classList.toggle('viz', a === sel || b === sel); });
    svg.querySelectorAll('.extra').forEach(function (el) { var a = el.getAttribute('data-a'), b = el.getAttribute('data-b'); el.classList.toggle('viz', a === sel || b === sel); });
    dossie(); radar();
    if (sel && centralizar) centrar(sel);
    $('#vivo').textContent = sel ? por[sel].n + ' selecionado' : 'Seleção desfeita';
  }
  function chip(id, extra) { var n = por[id]; return n ? '<button type="button" data-ir="' + esc(id) + '">' + esc(curto(n.n, 30)) + '</button>' + (extra || '') : ''; }
  function dossie() {
    var el = $('#dossie'), n = sel && por[sel];
    if (!n) { el.innerHTML = '<span class="lab">Dossiê</span><p>Clique num ponto do mapa (ou num nome do radar) para ver quem é, por que entrou na reação e o caminho até ' + esc(D.sementeNome) + '. Role para aproximar; arraste para andar.</p>'; return; }
    var c = caminho(sel), lig = Object.keys(vizinhos(sel)).length - 1, forca = n.f != null ? n.f : n.nota;
    el.innerHTML = '<span class="lab">Dossiê · ' + esc(TIPO[n.t]) + ' · ' + esc(GER(n.g)) + (n.f == null && n.id !== raiz ? ' · alcançável' : '') + '</span><h2>' + esc(n.n) + (n.x ? ' <span class="tag">extinta</span>' : '') + (n.novo ? ' <span class="tag">novo</span>' : '') + (n.alvo ? ' <span class="tag">no radar</span>' : '') + '</h2>' +
      (n.s || n.o ? '<p class="sub">' + esc(n.s) + (n.t === 'pessoa' && n.o ? ' · ' + esc(n.o) : '') + (n.nv ? ' · ' + esc(NIVEL[n.nv] || '') : '') + '</p>' : '') +
      (n.id !== raiz && !n.x ? '<div class="forca" title="Força como possibilidade de negócio, de 0 a 100"><span><i style="width:' + Math.min(100, forca) + '%"></i></span><b>' + forca + '</b></div>' : '') +
      (n.fa.length ? '<ul class="fatos">' + n.fa.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      (c.length > 1 ? '<span class="lab">Caminho</span><p class="cam">' + c.map(function (x, i) { return (i ? '<em>→ ' + esc(curto(x.r || '', 28)) + '</em> ' : '') + chip(x.id); }).join(' ') + '</p>' : '') +
      (lig ? '<p class="sub">' + lig + ' ligação(ões) com outros pontos do mapa.</p>' : '') +
      (n.fo.length ? '<p class="fontes"><span class="lab">Fontes</span>' + n.fo.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host(u)) + ' ↗</a>'; }).join('') + '</p>' : '');
  }
  var limite = 20;
  function radar() {
    var L = abertos.filter(function (n) { return !n.x; }).sort(function (a, b) { return b.f - a.f || a.n.localeCompare(b.n, 'pt-BR'); });
    $('#radar').innerHTML = L.slice(0, limite).map(function (n) {
      return '<li><button type="button" data-ir="' + esc(n.id) + '" aria-pressed="' + (n.id === sel) + '"><b class="n">' + n.f + '</b><span><b>' + esc(n.n) + '</b>' + (n.novo ? '<span class="tag">novo</span>' : '') + '<small>' + esc(TIPO[n.t] + (n.t === 'pessoa' ? ' · ' + curto(n.s, 40) + (n.o ? ' · ' + n.o : '') : '') + ' · ' + GER(n.g)) + '</small><small>' + esc(n.fa[0] || '') + '</small></span></button></li>';
    }).join('') + (L.length > limite ? '<li><button type="button" id="rmais"><b class="n">+</b><span>Mostrar mais ' + Math.min(20, L.length - limite) + ' (' + (L.length - limite) + ' restantes)</span></button></li>' : '');
  }
  dossie(); radar();

  /* ── cliques ── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    var ir = t.closest('[data-ir]'); if (ir) { escolher(ir.getAttribute('data-ir'), true); return; }
    if (t.closest('#rmais')) { limite += 20; radar(); return; }
    var g = t.closest('[data-g]'); if (g) { var k = g.getAttribute('data-g'); escondidas[k] = !escondidas[k]; voltas(); return; }
    var m = t.closest('[data-modo]'); if (m) { var v = m.getAttribute('data-modo'); svg.classList.toggle('so-abertos', v === 'abertos'); document.querySelectorAll('[data-modo]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === m)); }); return; }
    if (t.closest('#todas')) { var on = svg.classList.toggle('todas'); t.closest('#todas').setAttribute('aria-pressed', String(on)); return; }
    if (t.closest('#tema')) { var cl = document.documentElement.getAttribute('data-tema') === 'claro'; document.documentElement.setAttribute('data-tema', cl ? 'escuro' : 'claro'); $('#tema').textContent = cl ? 'Tema claro' : 'Tema escuro'; return; }
    var no = t.closest('#tela .no'); if (no) { if (!moveu) escolher(no.getAttribute('data-id'), false); return; }
    if (t.closest('#tela') && !moveu && sel) escolher(sel, false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sel) { escolher(sel, false); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('no')) { e.preventDefault(); escolher(e.target.getAttribute('data-id'), true); }
  });
  $('#q').addEventListener('input', function (e) {
    var q = norm(e.target.value).trim();
    $('#sug').innerHTML = q.length < 2 ? '' : NOS.filter(function (n) { return norm(n.n).indexOf(q) >= 0; }).sort(function (a, b) { return (norm(a.n).indexOf(q) === 0 ? 0 : 1) - (norm(b.n).indexOf(q) === 0 ? 0 : 1) || b.nota - a.nota; }).slice(0, 8)
      .map(function (n) { return '<button type="button" data-ir="' + esc(n.id) + '"><b>' + esc(n.n) + '</b> <small>' + esc(TIPO[n.t] + ' · ' + GER(n.g)) + '</small></button>'; }).join('');
  });
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.busca')) $('#sug').innerHTML = ''; });
  $('#rodape').textContent = 'Gerado pelo PRODUCERia Studio em ' + dt(D.geradoEm) + '. Pontos e ligações do Big Data do mercado (notícias, Cenp, LinkedIn e as fontes de cada ponto). Cada ponto aparece na primeira ramificação em que é alcançado; a força soma quem contrata produção, conta nova ou mudança recente, encaixe do craft e ponte com a PRODUCERIA.';
})();
