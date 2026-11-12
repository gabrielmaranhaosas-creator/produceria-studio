// Modo consulta do Studio (fora do claude.ai): substitui o banco do Claude por um banco só leitura que lê a fotografia
// dos dados servida pelo servidor da consulta (consulta/server.mjs). Gravar, IA e downloads ficam desligados.
// Entra em dist/consulta.html antes dos módulos (montar.mjs); o dist/index.html do claude.ai não leva este script.
(function () {
  var cache = {};
  function carregar(c) {
    if (!cache[c]) cache[c] = fetch(location.origin + '/dados/' + encodeURIComponent(c), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    return cache[c];
  }
  function compara(a, op, b) {
    switch (op) {
      case '==': case 'eq': return a === b;
      case '!=': case 'ne': return a !== b;
      case '<': case 'lt': return a < b;
      case '<=': case 'lte': return a <= b;
      case '>': case 'gt': return a > b;
      case '>=': case 'gte': return a >= b;
      case 'in': return Array.isArray(b) && b.indexOf(a) >= 0;
      case 'not-in': return Array.isArray(b) && b.indexOf(a) < 0;
      case 'array-contains': return Array.isArray(a) && a.indexOf(b) >= 0;
      default: return true;
    }
  }
  function negar() {
    var e = new Error('Modo consulta: só leitura. Para gravar, use o Studio no Claude.');
    e.code = 'somente_leitura';
    return Promise.reject(e);
  }
  function consulta(c, filtros, ordem, limite) {
    return {
      where: function (f, op, v) { return consulta(c, filtros.concat([[f, op, v]]), ordem, limite); },
      orderBy: function (f, d) { return consulta(c, filtros, [f, d || 'asc'], limite); },
      limit: function (n) { return consulta(c, filtros, ordem, n); },
      onSnapshot: function (ok, erro) {
        var vivo = true;
        carregar(c).then(function (lista) {
          if (!vivo) return;
          var l = lista.filter(function (d) { return filtros.every(function (w) { return compara((d.data || {})[w[0]], w[1], w[2]); }); });
          if (ordem) {
            var f = ordem[0], s = ordem[1] === 'desc' ? -1 : 1;
            l = l.slice().sort(function (x, y) { var a = (x.data || {})[f], b = (y.data || {})[f]; return a === b ? 0 : (a > b ? s : -s); });
          }
          if (limite) l = l.slice(0, limite);
          ok({ docs: l.map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) });
        }, function (e) { if (erro) erro(e); });
        return function () { vivo = false; };
      },
      doc: function () { return { set: negar, update: negar, delete: negar }; },
    };
  }
  var banco = { collection: function (c) { return consulta(c, [], null, null); } };
  window.claude = { use: function (n) { return Promise.resolve(n === 'db' ? banco : null); } };

  // Faixa no topo: deixa claro que é uma cópia só leitura e de quando são os dados.
  function faixa() {
    var b = document.createElement('div');
    b.id = 'consultaFaixa';
    b.setAttribute('role', 'status');
    b.textContent = 'Modo consulta · só leitura';
    document.body.insertBefore(b, document.body.firstChild);
    fetch(location.origin + '/dados/_meta', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
      if (m && m.atualizadoEm) {
        var d = new Date(m.atualizadoEm);
        b.textContent = 'Modo consulta · só leitura · dados de ' + d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · para gravar, use o Studio no Claude';
      }
    }).catch(function () {});
  }
  if (document.body) faixa(); else document.addEventListener('DOMContentLoaded', faixa);
})();
