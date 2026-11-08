// Temas de color compartidos por Mi-Menu, Gimnasio y Gastos (sin DOM). Se prueba en shared/tests.
// Cada tema son diez colores; varsOf los traduce a las variables que usan las hojas de estilo de las apps.
(function (root) {
  const mk = (id, name, bg, card, ink, mut, acc, onacc, tabbg, tabink, tabonbg, tabonink) =>
    ({ id, name, bg, card, ink, mut, acc, onacc, tabbg, tabink, tabonbg, tabonink });
  const dark = (id, name, acc, onacc) => mk(id, name, '#0A0A0A', '#171717', '#F5F5F5', '#8C8C8C', acc, onacc, '#171717', '#8C8C8C', acc, onacc);

  const PALETTES = [
    dark('turquesa', 'Negro y turquesa', '#14E0D0', '#021B19'),
    dark('violeta', 'Negro y violeta', '#9D6BFF', '#10052B'),
    dark('lima', 'Negro y lima', '#B8FF2C', '#0B1500'),
    mk('blanco-verde', 'Blanco y verde', '#F2F4F2', '#FFFFFF', '#0A0A0A', '#5C6860', '#12B76A', '#031A0F', '#0A0A0A', '#9AA39D', '#12B76A', '#031A0F'),
    mk('blanco-azul', 'Blanco y azul', '#F1F4FA', '#FFFFFF', '#0A0A0A', '#5A6479', '#2F6BFF', '#FFFFFF', '#0A0A0A', '#9AA3B8', '#2F6BFF', '#FFFFFF'),
    mk('rosa-pastel', 'Rosa pastel', '#FCEBF1', '#FFFFFF', '#3B1F2B', '#8F6577', '#F4A3C0', '#3B1F2B', '#3B1F2B', '#D9B3C4', '#F4A3C0', '#3B1F2B'),
    mk('lila-pastel', 'Lila pastel', '#F1ECFB', '#FFFFFF', '#2A2147', '#7A6FA0', '#BFA8F5', '#2A2147', '#2A2147', '#C5BBE6', '#BFA8F5', '#2A2147'),
    mk('rosa-noche', 'Rosa noche', '#1C1318', '#2A1E25', '#FBEFF4', '#B592A3', '#F4A3C0', '#2A0F1B', '#2A1E25', '#B592A3', '#F4A3C0', '#2A0F1B'),
    mk('lavanda-noche', 'Lavanda noche', '#17141F', '#231F2F', '#F3EFFA', '#A59DBB', '#C9B6F7', '#1D1233', '#231F2F', '#A59DBB', '#C9B6F7', '#1D1233')
  ];
  const DEFAULT_ID = PALETTES[0].id;

  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = hex => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // Relación de contraste de WCAG entre dos colores #RRGGBB
  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const isDark = p => luminance(p.bg) < 0.2;
  const resolve = id => PALETTES.find(p => p.id === id) || PALETTES[0];
  const next = id => PALETTES[(PALETTES.indexOf(resolve(id)) + 1) % PALETTES.length].id;

  const mix = (a, pct, b) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
  function varsOf(p) {
    return {
      '--bg': p.bg, '--surface': p.card, '--surface-2': mix(p.ink, 8, p.card), '--ink': p.ink,
      '--ink-2': mix(p.ink, 72, p.bg), '--ink-3': p.mut, '--line': mix(p.ink, 14, p.bg),
      '--btn-bg': p.acc, '--btn-ink': p.onacc, '--accent': p.acc, '--accent-soft': mix(p.acc, 20, p.bg),
      '--tab-ink': p.tabonbg, '--tab-bg': p.tabbg,
      '--tabbg': p.tabbg, '--tabink': p.tabink, '--tabonbg': p.tabonbg, '--tabonink': p.tabonink,
      '--ok': p.acc, '--on-ok': p.onacc,
      '--lv0': mix(p.ink, 10, p.bg), '--lv1': mix(p.acc, 30, p.bg), '--lv2': mix(p.acc, 55, p.bg), '--lv3': mix(p.acc, 80, p.bg), '--lv4': p.acc,
      '--shadow': isDark(p) ? '0 1px 2px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.45)' : '0 1px 2px rgba(20,20,40,.06), 0 8px 24px rgba(20,20,40,.10)',
      'color-scheme': isDark(p) ? 'dark' : 'light'
    };
  }
  const cssText = vars => Object.keys(vars).map(k => `${k}:${vars[k]};`).join('').replace(/;$/, '');

  const api = { PALETTES, DEFAULT_ID, contrast, isDark, resolve, next, varsOf, cssText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PaletteCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
