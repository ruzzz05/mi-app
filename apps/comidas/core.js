// Núcleo de la interfaz: estado guardado, navegación, hoja inferior y avisos.
// Cada pantalla se registra con Comidas.register(nombre, { render }).
(() => {
  const P = window.Planner;
  const KEY = 'comidas.v1';
  const NAMES = ['hoy', 'menu', 'compra', 'recetas'];

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function load() {
    try { return P.migrateState(JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { return P.migrateState(null); }
  }

  const screens = {};
  let current = null;
  let toastTimer;

  const C = window.Comidas = {
    state: load(),

    $, esc,

    // touch:false guarda sin considerarlo un cambio del usuario (no cambia la marca de tiempo
    // ni dispara la subida a la nube).
    save(opts) {
      const touch = !opts || opts.touch !== false;
      if (touch) C.state.updatedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(C.state)); } catch (e) { /* sin almacenamiento */ }
      if (touch && C.onSave) C.onSave(C.state);
    },

    onSave: null, // lo rellena cloud.js

    // Sustituye los datos por los recuperados de la nube
    adoptState(next) {
      C.state = next;
      C.save({ touch: false });
      C.go(current && screens[current] ? current : (next.menu ? 'hoy' : (next.dishes.length ? 'menu' : 'recetas')));
    },

    // Borra los datos guardados en este móvil (los usa cloud.js cuando entra otra cuenta)
    clearLocal() {
      ['', '.bak', '.pre-limpieza'].forEach(suffix => {
        try { localStorage.removeItem(KEY + suffix); } catch (e) { /* sin almacenamiento */ }
      });
      C.adoptState(P.migrateState(null));
    },

    toast(msg) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    },

    openSheet(title, html) {
      $('sheet-title').textContent = title;
      $('sheet-body').innerHTML = html;
      $('sheet').classList.add('open');
      $('sheet').setAttribute('aria-hidden', 'false');
    },

    closeSheet() {
      $('sheet').classList.remove('open');
      $('sheet').setAttribute('aria-hidden', 'true');
    },

    sheetOpen: () => $('sheet').classList.contains('open'),

    register(name, screen) { screens[name] = screen; },

    go(name) {
      current = name;
      NAMES.forEach(n => $('screen-' + n).classList.toggle('hidden', n !== name));
      document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
      C.render();
      const sc = document.querySelector('.scroller');
      if (sc) sc.scrollTop = 0;
    },

    render() {
      if (current && screens[current]) screens[current].render($('screen-' + current));
    },

    // Quita un plato borrado del menú y del borrador (los huecos se rellenan con otro).
    dropDish(id) {
      const s = C.state;
      s.dishes = s.dishes.filter(d => d.id !== id);
      ['menu', 'draft'].forEach(k => {
        const m = s[k];
        if (!m) return;
        const plan = { ...m.plan };
        Object.keys(plan).forEach(key => { if (plan[key].id === id) delete plan[key]; });
        const exclusions = m.exclusions.filter(ex => ex.dishId !== id);
        s[k] = P.fillMenu({ dishes: s.dishes, menu: { ...m, plan, exclusions } });
      });
    },

    start() {
      $('sheet-close').onclick = C.closeSheet;
      $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) C.closeSheet(); });
      document.querySelectorAll('.tabbar button').forEach(b => { b.onclick = () => C.go(b.dataset.screen); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') C.closeSheet(); });
      // "Hoy" se refresca solo cuando cambia la hora
      setInterval(() => { if (current === 'hoy' && !C.sheetOpen()) C.render(); }, 60000);

      // Diagnóstico de pantalla: 5 toques seguidos en el título "Mi-Menu" muestran/ocultan las medidas
      const title = document.querySelector('.topbar .title');
      let taps = [];
      if (title) title.addEventListener('click', () => {
        const now = Date.now();
        taps = taps.filter(t => now - t < 2000).concat(now);
        if (taps.length < 5) return;
        taps = [];
        let box = $('diag');
        if (box) { box.remove(); return; }
        box = document.createElement('pre');
        box.id = 'diag';
        box.style.cssText = 'position:fixed;left:8px;right:8px;top:70px;z-index:300;margin:0;padding:10px;font:11px/1.4 monospace;background:#000;color:#0f0;border-radius:8px;white-space:pre-wrap';
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top)';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const bar = document.querySelector('.tabbar').getBoundingClientRect();
        box.textContent = [
          'innerHeight ' + innerHeight + '  screen.height ' + screen.height,
          'visualViewport ' + (window.visualViewport ? Math.round(window.visualViewport.height) : '-'),
          'safe-area top ' + cs.paddingTop + '  bottom ' + cs.paddingBottom,
          'standalone ' + (navigator.standalone === true),
          'tabbar bottom ' + Math.round(bar.bottom) + '  alto ' + Math.round(bar.height),
          'hueco bajo la barra ' + Math.round(innerHeight - bar.bottom) + 'px'
        ].join('\n');
        probe.remove();
        document.body.appendChild(box);
      });

      const s = C.state;
      // Antes de sobrescribir con el estado migrado, guarda una copia del anterior (una sola vez)
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && !localStorage.getItem(KEY + '.bak')) localStorage.setItem(KEY + '.bak', raw);
        // Copia previa a la limpieza de recetas de ejemplo (solo la primera vez)
        if (raw && !JSON.parse(raw).seedPurged) localStorage.setItem(KEY + '.pre-limpieza', raw);
      } catch (e) { /* sin almacenamiento */ }
      C.save({ touch: false });
      C.go(!s.dishes.length ? 'recetas' : (s.menu ? 'hoy' : 'menu'));
    }
  };
})();
