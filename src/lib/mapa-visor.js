/* Visor do arquivo do mapa da Investigação (HTML baixado). Roda sozinho, sem rede: lê os dados de #dados e desenha o
 * multiverso com o mesmo desenho do Studio: o ponto de partida no centro, uma volta (elipse) por ramificação, cada ponto
 * perto de quem o trouxe, nomes na horizontal só onde cabem. Clique acende o caminho e abre o dossiê; arraste anda;
 * Ctrl + rolar, pinça ou os botões aproximam em torno do cursor. */
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('dados').textContent);
  var NOS = D.nos, por = {}, raiz = D.semente;
  NOS.forEach(function (n) { por[n.id] = n; });
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
  var curto = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var GER = function (g) { return g ? g + 'ª ramificação' : 'Ponto de partida'; };
  var TIPO = { origem: 'Ponto zero', empresa: 'Anunciante', agencia: 'Agência', pessoa: 'Pessoa' };
  var NIVEL = { contrata: 'contrata produção', aprova: 'aprova fornecedor', lidera: 'alta liderança' };
  var host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'fonte'; } };
  var dt = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  var forcaDe = function (n) { return n.f != null ? n.f : Math.round(n.nota * 0.6); };
  var abertos = NOS.filter(function (n) { return n.f != null && n.id !== raiz; });

  var svg = $('#tela'), mundo = null, modo = abertos.length ? 'abertos' : 'todos', escondidas = {}, sel = '';
  var W = 0, H = 0, V = { x: 0, y: 0, k: 1 }, pos = {}, pai = {}, filhos = {}, vis = [];

  /* ── quem aparece e de quem descende (na reação aberta, o pai é o antecessor aberto mais próximo) ── */
  function montar() {
    vis = NOS.filter(function (n) { return n.id === raiz || ((modo === 'todos' || n.f != null) && !escondidas[n.g]); });
    var on = {}; vis.forEach(function (n) { on[n.id] = 1; });
    pai = {}; filhos = {};
    vis.forEach(function (n) {
      if (n.id === raiz) return;
      var p = n.p; while (p && !on[p] && por[p]) p = por[p].p;
      pai[n.id] = p && on[p] ? p : raiz; (filhos[pai[n.id]] = filhos[pai[n.id]] || []).push(n.id);
    });
  }

  /* ── geometria: elipses por ramificação, cada volta começa onde mais aproxima os pontos dos seus pais ── */
  function geometria() {
    var B = svg.getBoundingClientRect(); W = B.width || 800; H = B.height || 600;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var gs = {}; vis.forEach(function (n) { if (n.id !== raiz) (gs[n.g] = gs[n.g] || []).push(n); });
    var Gs = Object.keys(gs).map(Number).sort(function (a, b) { return a - b; }), G = Gs.length;
    var cx = W / 2, cy = H / 2 + 8, mx = W < 600 ? 36 : 150, o0 = W < 600 ? 1.5 : 0.6;
    // cada volta ganha espaço conforme a quantidade de pontos que carrega (uma volta cheia não espreme as outras)
    var peso = Gs.map(function (g) { return Math.max(1, Math.sqrt(gs[g].length) / 3); }), tot = o0 + peso.reduce(function (a, b) { return a + b; }, 0), acum = o0;
    var fr = peso.map(function (w) { acum += w; return acum / tot; });
    var RX = Math.max(60, W / 2 - mx), RY = Math.max(50, H / 2 - 44);
    var esc0 = Math.max(0.55, Math.min(1, W / 760)); // tela estreita: pontos menores
    pos = {}; pos[raiz] = { x: cx, y: cy, a: -Math.PI / 2, v: 0, r: 24 * Math.max(0.7, esc0) };
    var aneis = [];
    Gs.forEach(function (g, i) {
      var v = i + 1, rx = fr[i] * RX, ry = fr[i] * RY, l = gs[g], n = l.length, passo = 2 * Math.PI / n;
      aneis.push({ g: g, rx: rx, ry: ry, n: n });
      var pref = function (x) { var q = pos[pai[x.id]]; return q ? q.a : -Math.PI / 2; };
      var ord = v === 1 ? l.slice().sort(function (a, b) { return forcaDe(b) - forcaDe(a); }) : l.slice().sort(function (a, b) { return pref(a) - pref(b) || forcaDe(b) - forcaDe(a); });
      var ini = -Math.PI / 2 + passo / 2;
      if (v > 1) { var ss = 0, cc = 0; ord.forEach(function (x, j) { var d = pref(x) - j * passo; ss += Math.sin(d); cc += Math.cos(d); }); ini = Math.atan2(ss, cc); }
      // com muitos pontos numa volta, os pontos encolhem para não se sobrepor
      var vao = Math.max(2.2, Math.min(rx, ry) * passo * 0.42);
      ord.forEach(function (x, j) {
        var a = ini + j * passo, f = forcaDe(x), r = (x.t === 'pessoa' ? 3.5 + f / 22 : 5.5 + f / 11) * esc0;
        pos[x.id] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, a: a, v: v, r: Math.min(r, vao) };
      });
    });
    return { cx: cx, cy: cy, aneis: aneis };
  }

  /* ── desenho ── */
  function desenhar() {
    montar(); var Q = geometria(), cx = Q.cx, cy = Q.cy, h = '', fios = '', ext = '', nos = '';
    for (var i = Q.aneis.length - 1; i >= 0; i--) { var A = Q.aneis[i], c = D.camadas[A.g] || { n: A.n }; h += '<ellipse class="anel" cx="' + cx + '" cy="' + cy + '" rx="' + A.rx.toFixed(1) + '" ry="' + A.ry.toFixed(1) + '"></ellipse><text class="anel-t" x="' + cx + '" y="' + (cy - A.ry - 6).toFixed(1) + '">' + esc(GER(A.g)) + ' · ' + A.n + (A.n < c.n ? ' de ' + c.n : '') + '</text>'; }
    vis.forEach(function (n) {
      if (n.id === raiz) return;
      var a = pos[pai[n.id]], b = pos[n.id]; if (!a || !b) return;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, qx = mx + (cx - mx) * 0.18, qy = my + (cy - my) * 0.18;
      var cls = 'fio' + (n.t === 'pessoa' ? ' pessoa' : '') + (n.r === 'virou' ? ' virou' : '') + (n.f == null ? ' fechado' : '') + (n.novo ? ' novo' : '');
      fios += '<path class="' + cls + '" data-a="' + esc(pai[n.id]) + '" data-b="' + esc(n.id) + '" style="--v:' + b.v + '" d="M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ' Q' + qx.toFixed(1) + ',' + qy.toFixed(1) + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + '"><title>' + esc(n.r || '') + '</title></path>';
    });
    D.extras.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]]; if (!a || !b) return;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ext += '<path class="extra" data-a="' + esc(e[0]) + '" data-b="' + esc(e[1]) + '" d="M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ' Q' + (mx + (cx - mx) * 0.4).toFixed(1) + ',' + (my + (cy - my) * 0.4).toFixed(1) + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + '"><title>' + esc(por[e[0]].n + ' ↔ ' + por[e[1]].n + ': ' + e[2]) + '</title></path>';
    });
    vis.forEach(function (n) {
      var q = pos[n.id]; if (!q) return;
      var z = n.id === raiz, dir = Math.cos(q.a) >= 0;
      var cls = 'no ' + (z ? 'zero' : n.t === 'pessoa' ? 'pe' + (n.nv === 'contrata' ? ' ct' : '') : n.t === 'agencia' ? 'ag' : 'em') + (n.x ? ' ext' : '') + (n.f == null && !z ? ' fechado' : '') + (n.novo ? ' novo' : '') + (n.alvo ? ' alvo' : '');
      var lab = z ? '<text class="rot mostra fixo" x="' + q.x + '" y="' + (q.y + q.r + 17) + '" text-anchor="middle">' + esc(curto(n.t === 'origem' ? 'PRODUCERIA' : n.n, 30)) + '</text>'
        : '<text class="rot" x="' + (q.x + (dir ? q.r + 5 : -q.r - 5)).toFixed(1) + '" y="' + (q.y + 4).toFixed(1) + '" text-anchor="' + (dir ? 'start' : 'end') + '">' + esc(curto(n.n, 28)) + '</text>';
      nos += '<g class="' + cls + '" data-id="' + esc(n.id) + '" tabindex="0" role="button" style="--v:' + q.v + '" aria-label="' + esc(n.n + ', ' + TIPO[n.t] + (n.t === 'pessoa' && n.s ? ', ' + n.s : '') + (q.v ? ', ' + GER(n.g) + ', força ' + forcaDe(n) : '')) + '">' +
        (n.novo ? '<circle class="pulso" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + (q.r + 4).toFixed(1) + '"></circle>' : '') + '<circle class="c" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + q.r.toFixed(1) + '"></circle>' + lab + '</g>';
    });
    svg.innerHTML = '<g id="mundo"><g>' + h + '</g><g>' + fios + '</g><g>' + ext + '</g><g>' + nos + '</g></g>';
    mundo = $('#mundo'); mover(false); acender();
  }

  /* ── zoom e arrasto ── */
  var tRot = 0;
  function mover(suave) {
    if (!mundo) return;
    mundo.classList.toggle('suave', !!suave);
    mundo.style.transform = 'translate(' + V.x.toFixed(1) + 'px,' + V.y.toFixed(1) + 'px) scale(' + V.k.toFixed(3) + ')';
    mundo.style.setProperty('--k', V.k.toFixed(3));
    clearTimeout(tRot); tRot = setTimeout(rotulos, suave ? 420 : 90);
  }
  function zoom(f, px, py, suave) {
    if (px == null) { px = W / 2; py = H / 2; }
    var k = Math.max(0.6, Math.min(6, V.k * f)); V.x = px - (px - V.x) * (k / V.k); V.y = py - (py - V.y) * (k / V.k); V.k = k; mover(suave);
  }
  var local = function (e) { var B = svg.getBoundingClientRect(); return [e.clientX - B.left, e.clientY - B.top]; };
  svg.addEventListener('wheel', function (e) {
    e.preventDefault(); var p = local(e);
    if (e.ctrlKey || e.metaKey) zoom(Math.exp(-e.deltaY * 0.01), p[0], p[1]);
    else { V.x -= e.deltaX; V.y -= e.deltaY; mover(false); }
  }, { passive: false });
  var toques = {}, arr = null, moveu = false, pinca = 0;
  svg.addEventListener('pointerdown', function (e) { toques[e.pointerId] = local(e); arr = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; moveu = false; });
  svg.addEventListener('pointermove', function (e) {
    if (!toques[e.pointerId]) return;
    toques[e.pointerId] = local(e);
    var ids = Object.keys(toques);
    if (ids.length === 2) {
      var o = toques[ids[0]], p = toques[ids[1]], d = Math.hypot(o[0] - p[0], o[1] - p[1]);
      if (pinca) zoom(d / pinca, (o[0] + p[0]) / 2, (o[1] + p[1]) / 2); pinca = d; moveu = true; arr = null; return;
    }
    if (!arr) return;
    var dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (!moveu && Math.abs(dx) + Math.abs(dy) > 4) { moveu = true; svg.classList.add('arrasta'); try { svg.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ } }
    if (moveu) { V.x = arr.vx + dx; V.y = arr.vy + dy; mover(false); }
  });
  var solta = function (e) { delete toques[e.pointerId]; pinca = 0; if (!Object.keys(toques).length) { arr = null; svg.classList.remove('arrasta'); } };
  svg.addEventListener('pointerup', solta); svg.addEventListener('pointercancel', solta);
  $('#zmais').onclick = function () { zoom(1.4, null, null, true); };
  $('#zmenos').onclick = function () { zoom(1 / 1.4, null, null, true); };
  $('#zinicio').onclick = function () { V = { x: 0, y: 0, k: 1 }; mover(true); };
  var tRes = 0;
  if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(tRes); tRes = setTimeout(desenhar, 120); }).observe(svg);
  else window.addEventListener('resize', function () { clearTimeout(tRes); tRes = setTimeout(desenhar, 120); });

  /* ── nomes: o caminho aceso primeiro, depois os mais fortes, só onde não encavalam ── */
  function rotulos() {
    if (!mundo) return;
    var viz = acesos(), caixas = [], q0 = pos[raiz];
    if (q0) caixas.push([q0.x * V.k + V.x - 60, q0.y * V.k + V.y - q0.r * V.k, 120, q0.r * V.k * 2 + 24]);
    var ids = Object.keys(pos).filter(function (id) { return id !== raiz; }).sort(function (a, b) { return (viz && viz[b] ? 1 : 0) - (viz && viz[a] ? 1 : 0) || (por[b].alvo ? 1 : 0) - (por[a].alvo ? 1 : 0) || forcaDe(por[b]) - forcaDe(por[a]); });
    var nv = viz ? Object.keys(viz).length : 0;
    ids.forEach(function (id) {
      var el = mundo.querySelector('[data-id="' + cssEsc(id) + '"] .rot'); if (!el) return;
      var q = pos[id], w = (el.textContent || '').length * 6.6 + 4, dir = el.getAttribute('text-anchor') === 'start';
      var x0 = q.x * V.k + V.x + (dir ? q.r * V.k + 5 : -q.r * V.k - 5 - w), y0 = q.y * V.k + V.y - 9;
      var dentro = x0 >= 2 && x0 + w <= W - 2 && y0 > 0 && y0 + 16 < H;
      var livre = dentro && !caixas.some(function (c) { return x0 < c[0] + c[2] && x0 + w > c[0] && y0 < c[1] + c[3] && y0 + 16 > c[1]; });
      var forcado = !!(viz && viz[id]) && (id === sel || nv <= 14);
      var mostra = (livre && (!viz || viz[id])) || forcado;
      el.classList.toggle('mostra', mostra); if (mostra) caixas.push([x0, y0, w, 16]);
    });
  }
  var cssEsc = function (s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); };

  /* ── escolher um ponto: o caminho até o centro, os filhos e as outras ligações acendem ── */
  function subida(id) { var s = {}, x = id; while (x) { s[x] = 1; x = x === raiz ? '' : pai[x]; } return s; }
  function acesos() {
    if (!sel || !pos[sel]) return null;
    var s = subida(sel); (filhos[sel] || []).forEach(function (c) { s[c] = 1; });
    D.extras.forEach(function (e) { if (e[0] === sel && pos[e[1]]) s[e[1]] = 1; if (e[1] === sel && pos[e[0]]) s[e[0]] = 1; });
    return s;
  }
  function acender() {
    var viz = acesos(), up = sel && pos[sel] ? subida(sel) : null;
    svg.classList.toggle('foco', !!viz);
    svg.querySelectorAll('.no').forEach(function (el) { var i = el.getAttribute('data-id'); el.classList.toggle('on', i === sel); el.classList.toggle('apaga', !!viz && !viz[i]); el.setAttribute('aria-pressed', String(i === sel)); });
    svg.querySelectorAll('.fio').forEach(function (el) { var a = el.getAttribute('data-a'), b = el.getAttribute('data-b'), lig = !!up && (a === sel || (up[a] && up[b])); el.classList.toggle('acesa', lig); el.classList.toggle('apaga', !!viz && !lig); });
    svg.querySelectorAll('.extra').forEach(function (el) { var a = el.getAttribute('data-a'), b = el.getAttribute('data-b'); el.classList.toggle('acesa', !!sel && (a === sel || b === sel)); });
    rotulos();
  }
  /** Traz o ponto escolhido e o que acende com ele para o meio do palco, contando com os nomes. */
  function enquadrar() {
    var viz = acesos(); if (!viz) return;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    Object.keys(viz).forEach(function (id) {
      var q = pos[id]; if (!q) return;
      var x = q.x * V.k + V.x, y = q.y * V.k + V.y, w = id === raiz ? 60 : curto(por[id].n, 28).length * 6.6 + q.r * V.k + 8, dir = Math.cos(q.a) >= 0;
      x0 = Math.min(x0, id === raiz ? x - w : dir ? x - q.r * V.k : x - w); x1 = Math.max(x1, id === raiz ? x + w : dir ? x + w : x + q.r * V.k);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    });
    var mudou = false;
    if (x1 > W - 16 || x0 < 16) { V.x += W / 2 - (x0 + x1) / 2; mudou = true; }
    if (y1 > H - 30 || y0 < 30) { V.y += H / 2 - (y0 + y1) / 2; mudou = true; }
    if (mudou) mover(true);
  }
  function escolher(id, alternar) {
    sel = alternar && sel === id ? '' : id;
    if (sel && !pos[sel]) { // escolhido pela busca ou radar, mas escondido pelo filtro: mostra o multiverso inteiro
      escondidas = {}; if (por[sel].f == null) modo = 'todos'; marcarModo(); voltas(); desenhar();
    }
    acender(); dossie(); radar();
    if (sel) enquadrar();
    $('#vivo').textContent = sel ? por[sel].n + ' selecionado' : 'Seleção desfeita';
  }

  /* ── números, ramificações, dossiê e radar ── */
  var portas = NOS.filter(function (n) { return n.nv === 'contrata'; }).length;
  $('#num').innerHTML = [[D.total, 'pontos no mapa'], [D.alcance, 'alcançados daqui'], [D.camadas.length - 1, 'ramificações'], [abertos.length, 'abertos na reação'], [portas, 'pessoas que contratam']]
    .map(function (x) { return '<li><b>' + x[0] + '</b><span>' + x[1] + '</span></li>'; }).join('');
  var maxN = Math.max.apply(null, D.camadas.slice(1).map(function (c) { return c.n; }).concat([D.fora, 1]));
  function voltas() {
    $('#voltas').innerHTML = D.camadas.slice(1).map(function (c) {
      return '<li><button type="button" data-g="' + c.ger + '" aria-pressed="' + !escondidas[c.ger] + '" title="Mostrar ou esconder esta ramificação"><span>' + esc(GER(c.ger)) + '</span><span class="barra"><i style="width:' + (c.n / maxN * 100).toFixed(1) + '%"></i><s style="width:' + (c.abertos / maxN * 100).toFixed(1) + '%"></s></span><b>' + c.n + '</b></button></li>';
    }).join('') + '<li><button type="button" disabled class="fora"><span>Fora de alcance</span><span class="barra"><i style="width:' + (D.fora / maxN * 100).toFixed(1) + '%;opacity:.5"></i></span><b>' + D.fora + '</b></button></li>';
  }
  function caminho(id) { var c = [], x = por[id]; while (x) { c.unshift(x); x = x.p ? por[x.p] : null; } return c; }
  function chip(id) { var n = por[id]; return n ? '<button type="button" data-ir="' + esc(id) + '">' + esc(curto(n.n, 30)) + '</button>' : ''; }
  function dossie() {
    var el = $('#dossie'), n = sel && por[sel];
    if (!n) { el.innerHTML = '<span class="lab">Dossiê</span><p>Clique num ponto do mapa (ou num nome do radar) para ver quem é, por que entrou na reação e o caminho até ' + esc(D.sementeNome) + '.</p>'; return; }
    var c = caminho(sel), lig = D.extras.filter(function (e) { return e[0] === sel || e[1] === sel; }).length, forca = forcaDe(n);
    el.innerHTML = '<span class="lab">Dossiê · ' + esc(TIPO[n.t]) + ' · ' + esc(GER(n.g)) + (n.f == null && n.id !== raiz ? ' · alcançável' : '') + '</span><h2>' + esc(n.n) + (n.x ? ' <span class="tag">extinta</span>' : '') + (n.novo ? ' <span class="tag">novo</span>' : '') + (n.alvo ? ' <span class="tag">no radar</span>' : '') + '</h2>' +
      (n.s || n.o ? '<p class="sub">' + esc(n.s) + (n.t === 'pessoa' && n.o ? ' · ' + esc(n.o) : '') + (n.nv ? ' · ' + esc(NIVEL[n.nv] || '') : '') + '</p>' : '') +
      (n.id !== raiz && !n.x ? '<div class="forca" title="Força como possibilidade de negócio, de 0 a 100"><span><i style="width:' + Math.min(100, forca) + '%"></i></span><b>' + forca + '</b></div>' : '') +
      (n.fa.length ? '<ul class="fatos">' + n.fa.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      (c.length > 1 ? '<span class="lab">Caminho</span><p class="cam">' + c.map(function (x, i) { return (i ? '<em>→ ' + esc(curto(x.r || '', 28)) + '</em> ' : '') + chip(x.id); }).join(' ') + '</p>' : '') +
      (lig ? '<p class="sub">Mais ' + lig + ' ligação(ões) com outros pontos do mapa, tracejadas no desenho.</p>' : '') +
      (n.fo.length ? '<p class="fontes"><span class="lab">Fontes</span>' + n.fo.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host(u)) + ' ↗</a>'; }).join('') + '</p>' : '');
  }
  var limite = 20;
  function radar() {
    var L = abertos.filter(function (n) { return !n.x; }).sort(function (a, b) { return b.f - a.f || a.n.localeCompare(b.n, 'pt-BR'); });
    $('#radar').innerHTML = L.slice(0, limite).map(function (n) {
      return '<li><button type="button" data-ir="' + esc(n.id) + '" aria-pressed="' + (n.id === sel) + '"><b class="n">' + n.f + '</b><span><b>' + esc(n.n) + '</b>' + (n.novo ? '<span class="tag">novo</span>' : '') + '<small>' + esc(TIPO[n.t] + (n.t === 'pessoa' ? ' · ' + curto(n.s, 40) + (n.o ? ' · ' + n.o : '') : '') + ' · ' + GER(n.g)) + '</small><small>' + esc(n.fa[0] || '') + '</small></span></button></li>';
    }).join('') + (L.length > limite ? '<li><button type="button" id="rmais"><b class="n">+</b><span>Mostrar mais ' + Math.min(20, L.length - limite) + ' (' + (L.length - limite) + ' restantes)</span></button></li>' : '');
  }
  function marcarModo() { document.querySelectorAll('[data-modo]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-modo') === modo)); }); }

  /* ── cliques e teclado ── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    var ir = t.closest('[data-ir]'); if (ir) { escolher(ir.getAttribute('data-ir'), false); return; }
    if (t.closest('#rmais')) { limite += 20; radar(); return; }
    var g = t.closest('[data-g]'); if (g) { var k = g.getAttribute('data-g'); escondidas[k] = !escondidas[k]; voltas(); desenhar(); return; }
    var m = t.closest('[data-modo]'); if (m) { modo = m.getAttribute('data-modo'); marcarModo(); desenhar(); return; }
    if (t.closest('#todas')) { var on = svg.classList.toggle('todas'); t.closest('#todas').setAttribute('aria-pressed', String(on)); return; }
    if (t.closest('#tema')) { var cl = document.documentElement.getAttribute('data-tema') === 'claro'; document.documentElement.setAttribute('data-tema', cl ? 'escuro' : 'claro'); $('#tema').textContent = cl ? 'Tema claro' : 'Tema escuro'; return; }
    var no = t.closest('#tela .no'); if (no) { if (!moveu) escolher(no.getAttribute('data-id'), true); return; }
    if (t.closest('#tela') && !moveu && sel) escolher(sel, true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sel) { escolher(sel, true); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('no')) { e.preventDefault(); escolher(e.target.getAttribute('data-id'), true); }
  });
  $('#q').addEventListener('input', function (e) {
    var q = norm(e.target.value).trim();
    $('#sug').innerHTML = q.length < 2 ? '' : NOS.filter(function (n) { return norm(n.n).indexOf(q) >= 0; }).sort(function (a, b) { return (norm(a.n).indexOf(q) === 0 ? 0 : 1) - (norm(b.n).indexOf(q) === 0 ? 0 : 1) || b.nota - a.nota; }).slice(0, 8)
      .map(function (n) { return '<button type="button" data-ir="' + esc(n.id) + '"><b>' + esc(n.n) + '</b> <small>' + esc(TIPO[n.t] + ' · ' + GER(n.g)) + '</small></button>'; }).join('');
  });
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.busca')) $('#sug').innerHTML = ''; });
  $('#rodape').textContent = 'Gerado pelo PRODUCERia Studio em ' + dt(D.geradoEm) + '. Pontos e ligações do Big Data do mercado (notícias, Cenp, LinkedIn e as fontes de cada ponto). Cada ponto aparece na primeira ramificação em que é alcançado; a força soma quem contrata produção, conta nova ou mudança recente, encaixe do craft e ponte com a PRODUCERIA.';

  marcarModo(); voltas(); dossie(); radar(); desenhar();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { svg.classList.add('entra'); setTimeout(function () { svg.classList.remove('entra'); }, 1900); }
})();
