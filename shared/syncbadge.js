// Punto de sincronización de la cabecera, justo antes del botón "Sincronizar ahora" (#sync-now).
// Muestra el estado (sincronizado, cambios sin subir, sin conexión, error, sincronizando) y, al tocarlo,
// el detalle con la hora de la última sincronización. Lo alimenta el cloud.js de cada app con
// SyncBadge.set({ dirty, error, syncing, lastSyncAt }); la conexión la vigila él solo.
// Las reglas de qué estado toca están en SyncCore.statusOf (shared/synccore.js, con tests).
(function () {
  var state = { dirty: false, error: '', syncing: false, lastSyncAt: 0 };
  var badge = null, pop = null, hideTimer = null;

  function status() {
    return window.SyncCore.statusOf({
      online: navigator.onLine !== false,
      syncing: state.syncing,
      error: state.error,
      dirty: state.dirty,
      lastSyncAt: state.lastSyncAt,
      now: Date.now()
    });
  }

  function paintPop(s) {
    pop.innerHTML = '';
    var title = document.createElement('strong');
    title.textContent = s.label;
    var detail = document.createElement('span');
    detail.textContent = s.detail;
    pop.appendChild(title);
    pop.appendChild(detail);
  }

  function hidePop() {
    clearTimeout(hideTimer);
    if (pop) pop.hidden = true;
  }

  function render() {
    if (!badge) return;
    var s = status();
    badge.setAttribute('data-state', s.state);
    badge.setAttribute('aria-label', 'Sincronización: ' + s.label);
    badge.title = s.label;
    if (pop && !pop.hidden) paintPop(s);
  }

  function togglePop() {
    if (!pop.hidden) { hidePop(); return; }
    paintPop(status());
    pop.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePop, 7000);
  }

  function mount() {
    var anchor = document.getElementById('sync-now');
    if (!anchor || badge) return;
    badge = document.createElement('button');
    badge.type = 'button';
    badge.id = 'sync-badge';
    badge.className = 'sync-badge';
    badge.addEventListener('click', function (e) { e.stopPropagation(); togglePop(); });
    anchor.parentNode.insertBefore(badge, anchor);

    pop = document.createElement('div');
    pop.className = 'sync-pop';
    pop.setAttribute('role', 'status');
    pop.hidden = true;
    document.body.appendChild(pop);

    document.addEventListener('click', function (e) { if (pop && !pop.hidden && !pop.contains(e.target)) hidePop(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePop(); });
    render();
  }

  window.addEventListener('online', render);
  window.addEventListener('offline', render);

  window.SyncBadge = {
    set: function (partial) {
      Object.keys(partial).forEach(function (k) { state[k] = partial[k]; });
      render();
    },
    get: function () { return status(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
