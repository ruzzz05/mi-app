// Modo claro / oscuro (y los extra que declare la página en <html data-themes="light,dark,warm">).
// Se carga en el <head> de cada página: aplica la preferencia
// guardada al instante (sin parpadeo) y añade el botón de cambio en la cabecera.
(function () {
  var KEY = 'theme';
  var root = document.documentElement;
  var dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // Modos que admite esta página: por defecto claro y oscuro; Mi-Menu añade "warm"
  function modes() { return (root.getAttribute('data-themes') || 'light,dark').split(','); }

  // El modo guardado solo cuenta si esta página lo admite (si no, se sigue el del sistema)
  function stored() {
    try { var v = localStorage.getItem(KEY); return modes().indexOf(v) >= 0 ? v : null; }
    catch (e) { return null; }
  }
  function effective() { return stored() || (dark && dark.matches ? 'dark' : 'light'); }

  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  var PALETTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.6-1.2-2.7 0-.9.7-1.5 1.7-1.5H17a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>';
  var DROP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3.5 4.2 6 7.2 6 10.5a6 6 0 01-12 0C6 10.2 8.5 7.2 12 3z"/></svg>';
  var ICONS = { light: SUN, dark: MOON, warm: PALETTE, aqua: DROP };
  var NAMES = { light: 'modo claro', dark: 'modo oscuro', warm: 'modo cálido', aqua: 'modo aqua' };

  function next() { var m = modes(); return m[(m.indexOf(effective()) + 1) % m.length]; }

  var button = null;

  function apply() {
    var s = stored();
    if (s) root.setAttribute('data-theme', s); else root.removeAttribute('data-theme');
    refresh();
  }

  // Icono, etiqueta y color de la barra del navegador según el tema efectivo
  function refresh() {
    if (button) {
      // El botón muestra el modo al que se pasa al pulsarlo
      var n = next();
      button.innerHTML = ICONS[n] || SUN;
      var label = 'Cambiar a ' + (NAMES[n] || n);
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    if (document.head) {
      var bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) {
        document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.remove(); });
        var meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = bg;
        document.head.appendChild(meta);
      }
    }
  }

  function toggle() {
    try { localStorage.setItem(KEY, next()); } catch (e) { /* sin almacenamiento */ }
    apply();
  }

  function mount() {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.addEventListener('click', toggle);

    // En las apps sustituye al hueco vacío de la cabecera; en el inicio, flota arriba a la derecha
    var spacer = document.querySelector('.topbar .spacer');
    if (spacer) {
      spacer.replaceWith(button);
    } else {
      button.classList.add('floating');
      document.body.appendChild(button);
    }
    refresh();
  }

  apply();
  if (dark && dark.addEventListener) dark.addEventListener('change', function () { if (!stored()) refresh(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
