// Pregunta de confirmación con la propia interfaz de la app (en lugar del cuadro del navegador).
// Uso: if (await AppConfirm({ title: '¿Borrar X?', text: 'Detalle', okLabel: 'Borrar' })) { ... }
// Devuelve true si se confirma y false si se cancela (botón, tocar fuera o Escape). Va por encima de
// cualquier hoja que esté abierta, que no se toca.
(function () {
  window.AppConfirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var overlay = document.createElement('div');
      overlay.id = 'app-confirm';
      overlay.className = 'confirm-overlay';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      var box = document.createElement('div');
      box.className = 'confirm-box';
      var title = document.createElement('h2');
      title.textContent = opts.title || '¿Seguro?';
      box.appendChild(title);
      if (opts.text) {
        var p = document.createElement('p');
        p.textContent = opts.text;
        box.appendChild(p);
      }
      var row = document.createElement('div');
      row.className = 'confirm-actions';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'confirm-btn';
      cancel.dataset.act = 'confirm-cancel';
      cancel.textContent = opts.cancelLabel || 'Cancelar';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'confirm-btn confirm-ok' + (opts.danger === false ? '' : ' danger');
      ok.dataset.act = 'confirm-ok';
      ok.textContent = opts.okLabel || 'Borrar';
      row.appendChild(cancel);
      row.appendChild(ok);
      box.appendChild(row);
      overlay.appendChild(box);

      function done(value) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        try { if (prev && prev.focus) prev.focus(); } catch (e) { /* sin foco */ }
        resolve(value);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      }
      cancel.onclick = function () { done(false); };
      ok.onclick = function () { done(true); };
      overlay.addEventListener('click', function (e) { if (e.target === overlay) done(false); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      cancel.focus();
    });
  };
})();
