// Animaciones compartidas por Mi-Menu, Gimnasio y Gastos (la parte con DOM; los cálculos están en animcore.js).
// Todo se apaga solo si el móvil pide "reducir movimiento". Los estilos están en shared/anim.css.
(function (root) {
  const C = root.AnimCore;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Elementos de lista que suben en cascada al cambiar de pantalla
  const ITEMS = '.rc, .routine, .hist-row, .card-row, .wc, .rec, .mv, .catrow, .buy, .day, .today-card, .tiles3 > div, .mus-row';
  const BARS = '.bar i, .rbar i, .p i';

  // Números con data-count="1234" (y data-decimals, data-group="1", data-prefix, data-suffix) suben desde 0 hasta su valor.
  // El texto final es siempre el que ya puso la pantalla.
  function countAll(scope) {
    scope.querySelectorAll('[data-count]').forEach(el => {
      const to = Number(el.dataset.count);
      if (!Number.isFinite(to)) return;
      const dec = Number(el.dataset.decimals || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      const final = el.textContent;
      const t0 = performance.now(), dur = 1100;
      cancelAnimationFrame(el._animCount);
      const step = t => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = p >= 1 ? final : pre + C.countText(to, p, dec, el.dataset.group === '1') + suf;
        if (p < 1) el._animCount = requestAnimationFrame(step);
      };
      el._animCount = requestAnimationFrame(step);
    });
  }

  // Al entrar en una pantalla: se desliza desde el lado, la lista sube en cascada, las barras crecen,
  // el calendario se enciende en ola y los números cuentan. dir: 'r' | 'l' | ''
  function enter(section, dir) {
    if (!section || reduced()) return;
    clearTimeout(section._animT);
    section.classList.remove('anim-in-r', 'anim-in-l');
    section.classList.add('anim-enter');
    if (dir) { void section.offsetWidth; section.classList.add('anim-in-' + dir); }
    section.querySelectorAll(ITEMS).forEach((el, i) => { el.classList.add('anim-rise'); el.style.setProperty('--d', C.delayFor(i) + 'ms'); });
    section.querySelectorAll(BARS).forEach((el, i) => el.style.setProperty('--d', C.delayFor(i, 60, 600) + 'ms'));
    section.querySelectorAll('.cal-cell').forEach((el, i) => el.style.setProperty('--d', Math.min(Math.floor(i / 7) * 14 + (i % 7) * 18, 900) + 'ms'));
    countAll(section);
    section._animT = setTimeout(() => {
      section.classList.remove('anim-enter', 'anim-in-r', 'anim-in-l');
      section.querySelectorAll('.anim-rise').forEach(el => { el.classList.remove('anim-rise'); el.style.removeProperty('--d'); });
    }, 1800);
  }

  // Borrado: el elemento se desliza fuera y el hueco se cierra; luego se ejecuta done (que quita el dato y repinta)
  function remove(el, done) {
    if (!el || reduced()) { done(); return; }
    el.style.height = el.offsetHeight + 'px';
    el.style.overflow = 'hidden';
    void el.offsetHeight;
    el.classList.add('anim-out');
    setTimeout(() => {
      el.style.height = '0px';
      el.style.marginTop = el.style.marginBottom = el.style.paddingTop = el.style.paddingBottom = '0px';
      el.style.borderWidth = '0px';
      setTimeout(done, 380);
    }, 330);
  }

  // Aviso: reinicia la barrita de tiempo y la ajusta a lo que dura el aviso
  function toast(el, ms) {
    el.style.setProperty('--toast-ms', (ms || 2200) + 'ms');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // Pastilla de la barra de pestañas que se desliza al botón activo. Devuelve { place } (llamar tras cada cambio de pestaña)
  function indicator(bar, buttons) {
    if (!bar) return { place() {} };
    if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    const ind = document.createElement('i');
    ind.className = 'anim-ind';
    bar.classList.add('has-ind');
    bar.prepend(ind);
    let first = true;
    const place = () => {
      const b = bar.querySelector(buttons + '.active');
      if (!b || !b.offsetWidth) { ind.style.opacity = '0'; first = true; return; }
      ind.style.opacity = '1';
      ind.style.width = b.offsetWidth + 'px';
      ind.style.height = b.offsetHeight + 'px';
      ind.style.borderRadius = getComputedStyle(b).borderRadius;
      if (first) ind.style.transition = 'none';
      ind.style.transform = 'translate(' + b.offsetLeft + 'px, ' + b.offsetTop + 'px)';
      if (first) { void ind.offsetWidth; ind.style.transition = ''; first = false; }
    };
    root.addEventListener('resize', place);
    return { place };
  }

  // Insignia con confeti (récord personal). lines: textos debajo del título. Se cierra sola o al tocar.
  function celebrate(title, lines) {
    if (reduced()) return;
    const cols = ['var(--accent)', '#FFC857', 'var(--ink)', '#FF7A7A'];
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const parts = Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2 + Math.random() * 0.4, r = 90 + Math.random() * 70;
      return '<i class="anim-pc" style="--dx:' + Math.cos(a) * r + 'px;--dy:' + (Math.sin(a) * r * 0.8 - 14) + 'px;--r:' + Math.round(Math.random() * 540 - 270) + 'deg;--c:' + cols[i % 4] + '"></i>';
    }).join('');
    const box = document.createElement('div');
    box.className = 'anim-pr';
    box.setAttribute('role', 'status');
    box.innerHTML = '<div class="anim-pr-in">' + parts + '<div class="anim-badge">★</div><b>' + esc(title) + '</b>' +
      (lines || []).map(l => '<small>' + esc(l) + '</small>').join('') + '</div>';
    document.body.append(box);
    const close = () => { box.classList.add('bye'); setTimeout(() => box.remove(), 300); };
    box.onclick = close;
    setTimeout(close, 3400);
  }

  // Bloque que se despliega: la altura crece desde 0 y las filas de series (.set-row) aparecen una tras otra
  function reveal(el) {
    if (!el || reduced() || !el.animate) return;
    const h = el.offsetHeight;
    el.style.overflow = 'hidden';
    const a = el.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
    a.onfinish = a.oncancel = () => { el.style.overflow = ''; };
    el.querySelectorAll('.set-row').forEach((r, i) => r.animate(
      [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 350, delay: 80 + i * 60, easing: 'ease-out', fill: 'backwards' }));
  }

  // Reordenar: se guarda dónde está cada elemento (flipCapture), se repinta, y flipPlay los desliza desde su sitio anterior
  function flipCapture(scope, selector, keyOf) {
    const m = new Map();
    scope.querySelectorAll(selector).forEach(el => m.set(keyOf(el), el.getBoundingClientRect().top));
    return m;
  }
  function flipPlay(scope, selector, keyOf, first) {
    if (reduced()) return;
    scope.querySelectorAll(selector).forEach(el => {
      const was = first.get(keyOf(el));
      if (was == null || !el.animate) return;
      const dy = was - el.getBoundingClientRect().top;
      if (dy) el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.9,.25,1.05)' });
    });
  }

  // Elementos recién llegados (tras un esqueleto) que suben en cascada y luego quedan limpios
  function rise(els) {
    if (reduced()) return;
    Array.from(els).forEach((el, i) => {
      el.classList.add('anim-rise');
      el.style.setProperty('--d', C.delayFor(i) + 'ms');
      el.addEventListener('animationend', () => { el.classList.remove('anim-rise'); el.style.removeProperty('--d'); }, { once: true });
    });
  }

  root.Anim = { enter, countAll, remove, toast, indicator, celebrate, reveal, flipCapture, flipPlay, rise, reduced, direction: C.direction };
})(typeof window !== 'undefined' ? window : globalThis);
