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

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(C.state)); } catch (e) { /* sin almacenamiento */ }
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

      const s = C.state;
      // Antes de sobrescribir con el estado migrado, guarda una copia del anterior (una sola vez)
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && !localStorage.getItem(KEY + '.bak')) localStorage.setItem(KEY + '.bak', raw);
      } catch (e) { /* sin almacenamiento */ }
      C.save();
      C.go(!s.dishes.length ? 'recetas' : (s.menu ? 'hoy' : 'menu'));
    }
  };
})();
