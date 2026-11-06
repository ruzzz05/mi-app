// Modo claro / oscuro. Se carga en el <head> de cada página: aplica la preferencia
// guardada al instante (sin parpadeo) y añade el botón de cambio en la cabecera.
(function () {
  var KEY = 'theme';
  var root = document.documentElement;
  var dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; }
    catch (e) { return null; }
  }
  function effective() { return stored() || (dark && dark.matches ? 'dark' : 'light'); }

  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  var button = null;

  function apply() {
    var s = stored();
    if (s) root.setAttribute('data-theme', s); else root.removeAttribute('data-theme');
    refresh();
  }

  // Icono, etiqueta y color de la barra del navegador según el tema efectivo
  function refresh() {
    var isDark = effective() === 'dark';
    if (button) {
      button.innerHTML = isDark ? SUN : MOON;
      var label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
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
    var next = effective() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) { /* sin almacenamiento */ }
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
