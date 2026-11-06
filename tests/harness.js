// Mini arnés de tests para navegador (sin dependencias). Ejecutar con tests/run.sh
(function () {
  const results = [];

  window.test = function (name, fn) {
    try { fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, msg: e && e.message ? e.message : String(e) }); }
  };

  const show = v => JSON.stringify(v);

  window.assert = {
    ok(v, msg) { if (!v) throw new Error(msg || 'se esperaba un valor verdadero'); },
    eq(actual, expected, msg) {
      if (show(actual) !== show(expected)) {
        throw new Error((msg ? msg + ': ' : '') + `esperado ${show(expected)}, recibido ${show(actual)}`);
      }
    }
  };

  window.finish = function () {
    const failed = results.filter(r => !r.ok).length;
    const lines = results.map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + r.msg));
    lines.push(`SUMMARY passed=${results.length - failed} failed=${failed}`);
    const pre = document.createElement('pre');
    pre.id = 'out';
    pre.textContent = lines.join('\n');
    document.body.appendChild(pre);
  };

  // Errores de carga (p. ej. un script que no existe) también cuentan como fallo
  window.addEventListener('error', e => {
    results.push({ ok: false, name: 'error de carga', msg: e.message || String(e.target && e.target.src) });
  }, true);
})();
