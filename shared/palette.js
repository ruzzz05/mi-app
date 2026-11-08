// Tema de color compartido por Mi-Menu, Gimnasio y Gastos. Se carga en el <head> (después de
// palettecore.js): aplica el tema guardado al instante, sin parpadeo, y monta en la cabecera el
// botón que abre el selector. El tema se guarda en el móvil y vale para las tres apps.
(function () {
  var KEY = 'palette';
  var PC = window.PaletteCore;
  var root = document.documentElement;
  var current = null;
  var button = null;
  var picker = null;

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.6-1.2-2.7 0-.9.7-1.5 1.7-1.5H17a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>';

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  function apply(id) {
    var p = PC.resolve(id);
    current = p.id;
    var v = PC.varsOf(p);
    Object.keys(v).forEach(function (k) { root.style.setProperty(k, v[k]); });
    root.setAttribute('data-palette', p.id);
    if (document.head) {
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.remove(); });
      var meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = p.bg;
      document.head.appendChild(meta);
    }
    mark();
  }

  function set(id) {
    var p = PC.resolve(id);
    try { localStorage.setItem(KEY, p.id); } catch (e) { /* sin almacenamiento */ }
    apply(p.id);
  }

  function mark() {
    if (!picker) return;
    picker.querySelectorAll('[data-palette-id]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.paletteId === current));
    });
  }

  function close() { if (picker) picker.hidden = true; }
  function open() { if (!picker) buildPicker(); mark(); picker.hidden = false; }

  var CSS = '#palette-picker{position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}' +
    '#palette-picker[hidden]{display:none}' +
    '#palette-picker .pp-panel{width:100%;max-width:640px;max-height:85dvh;overflow-y:auto;background:var(--bg);color:var(--ink);border-radius:28px 28px 0 0;padding:12px 20px calc(24px + env(safe-area-inset-bottom));font-family:var(--sans)}' +
    '#palette-picker .pp-grab{display:block;width:38px;height:4px;border-radius:9px;background:var(--line);margin:0 auto 12px}' +
    '#palette-picker h2{margin:0 0 14px;font-size:20px;font-weight:800;letter-spacing:-.02em}' +
    '#palette-picker .pp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 8px}' +
    '#palette-picker button{appearance:none;border:0;background:none;color:inherit;font:600 12px var(--sans);display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:0;text-align:center;line-height:1.15}' +
    '#palette-picker .pp-sw{width:56px;height:56px;border-radius:50%;border:2px solid transparent;box-shadow:0 0 0 1px rgba(128,128,128,.4);background:conic-gradient(var(--sa) 0 33%,var(--sb) 33% 66%,var(--sc) 66% 100%)}' +
    '#palette-picker button[aria-pressed="true"] .pp-sw{border-color:var(--bg);box-shadow:0 0 0 3px var(--ink)}';

  function buildPicker() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    picker = document.createElement('div');
    picker.id = 'palette-picker';
    picker.hidden = true;
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-modal', 'true');
    picker.setAttribute('aria-label', 'Tema de color');
    picker.innerHTML = '<div class="pp-panel"><span class="pp-grab"></span><h2>Tema de color</h2><div class="pp-grid">' +
      PC.PALETTES.map(function (p) {
        return '<button type="button" data-palette-id="' + p.id + '" aria-pressed="false"><span class="pp-sw" style="--sa:' + p.bg + ';--sb:' + p.acc + ';--sc:' + p.ink + '"></span>' + p.name + '</button>';
      }).join('') + '</div></div>';
    picker.addEventListener('click', function (e) {
      var b = e.target.closest('[data-palette-id]');
      if (b) { set(b.dataset.paletteId); close(); return; }
      if (e.target === picker) close();
    });
    document.body.appendChild(picker);
  }

  function mount() {
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'palette-btn';
    button.className = 'theme-toggle';
    button.innerHTML = ICON;
    button.setAttribute('aria-label', 'Elegir tema de color');
    button.title = 'Elegir tema de color';
    button.addEventListener('click', open);
    var spacer = document.querySelector('.topbar .spacer');
    if (spacer) spacer.replaceWith(button);
    else { button.classList.add('floating'); document.body.appendChild(button); }
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  apply(stored());
  window.MiPalette = { set: set, get: function () { return current; }, open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
