// Núcleo de la interfaz del gimnasio: estado guardado, navegación, hoja inferior y avisos.
// Cada pantalla se registra con GymApp.register(nombre, { render(el, params) }).
// Todo lo que viene de datos (nombres, archivos importados…) se pinta con h(), que usa texto
// y nunca HTML.
(() => {
  const G = window.Gym;
  const CAT = window.GymCatalog;
  const KEY = 'gimnasio.v1';
  const NAMES = ['hoy', 'rutinas', 'perfil', 'editar', 'usar'];
  const MAIN = ['hoy', 'rutinas', 'perfil']; // pantallas con barra inferior, en el orden de la barra

  const $ = id => document.getElementById(id);

  // h('div', { class: 'x', onclick: fn, value: 3 }, 'texto', otroNodo) -> elemento
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const emptyState = () => ({ version: 1, routines: [], logs: {}, updatedAt: 0 });

  function normalize(raw) {
    const s = emptyState();
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw.routines)) s.routines = raw.routines.filter(G.isValidRoutine);
    if (raw.logs && typeof raw.logs === 'object' && !Array.isArray(raw.logs)) {
      for (const [k, m] of Object.entries(raw.logs)) {
        if (/^\d{4}-\d{2}$/.test(k) && m && Array.isArray(m.sessions)) s.logs[k] = { updatedAt: m.updatedAt || 0, sessions: m.sessions.filter(G.isValidSession) };
      }
    }
    s.updatedAt = Number(raw.updatedAt) || 0;
    return s;
  }

  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { return emptyState(); }
  }

  const byId = new Map(CAT.exercises.map(e => [e.id, e]));

  const screens = {};
  let current = null;
  let toastTimer;

  const App = window.GymApp = {
    state: load(),
    $, h,
    catalog: CAT,

    // Sustituye el contenido de un elemento; acepta nodos, arrays de nodos, null y false
    mount(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false)); },

    exercise: id => byId.get(id) || null,
    exerciseName: id => (byId.get(id) ? byId.get(id).name : 'Ejercicio desconocido'),

    // save({ config: true, months: ['2026-11'] }) guarda y avisa a la nube de qué cambió.
    // Sin argumentos cuenta como cambio de rutinas; save({ touch: false }) solo guarda en el móvil.
    save(opts) {
      const o = opts || { config: true };
      const touch = o.touch !== false;
      const changes = { config: !!o.config, months: o.months || [] };
      const now = Date.now();
      if (touch) {
        if (changes.config) App.state.updatedAt = now;
        changes.months.forEach(k => { if (App.state.logs[k]) App.state.logs[k].updatedAt = now; });
      }
      try { localStorage.setItem(KEY, JSON.stringify(App.state)); } catch (e) { /* sin almacenamiento */ }
      if (touch && (changes.config || changes.months.length) && App.onSave) App.onSave(changes);
    },

    onSave: null, // lo rellena cloud.js

    // Todos los entrenos guardados (incluidos los borrados; Gym.* ya los ignora)
    allSessions() {
      return Object.values(App.state.logs).flatMap(m => m.sessions);
    },

    recordSession(session) {
      const key = G.monthKey(G.dayOf(session.startedAt));
      const month = App.state.logs[key] || (App.state.logs[key] = { updatedAt: 0, sessions: [] });
      month.sessions = month.sessions.filter(s => s.id !== session.id).concat(session);
      App.save({ months: [key] });
    },

    deleteSession(id) {
      for (const [key, month] of Object.entries(App.state.logs)) {
        const s = month.sessions.find(x => x.id === id);
        if (!s) continue;
        s.deleted = true;
        s.updatedAt = Date.now();
        App.save({ months: [key] });
        return;
      }
    },

    // Sustituye los datos por los recuperados de la nube
    adoptState(next) {
      App.state = normalize(next);
      App.save({ touch: false });
      App.go(current && screens[current] && MAIN.includes(current) ? current : 'hoy');
    },

    // Borra los datos guardados en este móvil (los usa cloud.js cuando entra otra cuenta)
    clearLocal() {
      ['gimnasio.v1', 'gimnasio.active', 'gimnasio.hoy', 'gimnasio.google.token', 'gimnasio.google.connected'].forEach(k => {
        try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
      });
      App.adoptState(emptyState());
    },

    toast(msg, ms) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
    },

    // node: un elemento (o varios en un array) para el cuerpo de la hoja
    // opts.tall: la hoja ocupa siempre el mismo alto (el buscador, para que no baje al haber pocos resultados)
    openSheet(title, node, opts) {
      $('sheet-title').textContent = title;
      $('sheet').querySelector('.sheet-panel').classList.toggle('tall', !!(opts && opts.tall));
      const body = $('sheet-body');
      body.replaceChildren(...[].concat(node).flat(Infinity).filter(Boolean));
      $('sheet').classList.add('open');
      $('sheet').setAttribute('aria-hidden', 'false');
    },

    closeSheet() {
      $('sheet').classList.remove('open');
      $('sheet').setAttribute('aria-hidden', 'true');
    },

    sheetOpen: () => $('sheet').classList.contains('open'),

    register(name, screen) { screens[name] = screen; },

    go(name, params) {
      current = name;
      NAMES.forEach(n => $('screen-' + n).classList.toggle('hidden', n !== name));
      document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
      $('tabbar').classList.toggle('hidden', !MAIN.includes(name));
      App.params = params;
      App.render();
      const sc = document.querySelector('.scroller');
      if (sc) sc.scrollTop = 0;
    },

    render() {
      if (current && screens[current]) screens[current].render($('screen-' + current), App.params);
    },

    current: () => current,

    // Con el teclado abierto en el móvil, la hoja se ajusta a la parte VISIBLE de la pantalla (si no,
    // se queda detrás del teclado). vv = window.visualViewport.
    fitSheet(vv) {
      const s = $('sheet');
      if (vv && vv.height < window.innerHeight - 80) {
        s.style.top = vv.offsetTop + 'px';
        s.style.height = vv.height + 'px';
      } else {
        s.style.top = '';
        s.style.height = '';
      }
    },

    start() {
      if (window.visualViewport) {
        const fit = () => App.fitSheet(window.visualViewport);
        window.visualViewport.addEventListener('resize', fit);
        window.visualViewport.addEventListener('scroll', fit);
      }
      $('sheet-close').onclick = App.closeSheet;
      $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) App.closeSheet(); });
      document.querySelectorAll('.tabbar button').forEach(b => { b.onclick = () => App.go(b.dataset.screen); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') App.closeSheet(); });
      App.go(App.afterStart ? App.afterStart() : 'hoy');
    }
  };
})();
