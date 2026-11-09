// Cálculos puros de las animaciones compartidas (sin DOM). Los usa shared/anim.js. Se prueba en shared/tests.
(function (root) {
  // Frena al final (easeOutCubic); p fuera de 0..1 se recorta
  const ease = p => { const c = Math.min(1, Math.max(0, p)); return 1 - Math.pow(1 - c, 3); };

  // Igual que la app escribe sus cifras: miles al estilo español, o decimales con coma
  // grouped: puntos de miles desde 4 cifras (como los euros de Gastos); sin él, el estilo de toLocaleString
  const formatCount = (n, decimals, grouped) => {
    if (!grouped) return decimals > 0 ? n.toFixed(decimals).replace('.', ',') : Math.round(n).toLocaleString('es-ES');
    const [int, dec] = Math.abs(n).toFixed(decimals || 0).split('.');
    return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '');
  };

  // Texto del número cuando ha pasado la fracción p de la animación (siempre acaba exactamente en `to`)
  const countText = (to, p, decimals, grouped) => formatCount(p >= 1 ? to : to * ease(p), decimals || 0, grouped);

  // Retraso (ms) del elemento i de una lista que entra en cascada; tope para que las listas largas no tarden
  const delayFor = (i, step = 70, max = 560) => Math.min(i * step, max);

  // Lado por el que entra la pestaña nueva ('' si no hay que moverla)
  const direction = (from, to) => (from < 0 || to < 0 || from === to ? '' : to > from ? 'r' : 'l');

  const api = { ease, formatCount, countText, delayFor, direction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AnimCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
