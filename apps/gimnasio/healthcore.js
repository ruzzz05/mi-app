// Lógica pura de la conexión con Google Health (sin red ni DOM). Se prueba en apps/gimnasio/tests.
(function (root) {
  const FRESH_MS = 2 * 60 * 1000;    // un resumen de menos de 2 minutos no se vuelve a pedir
  const TOKEN_MARGIN_MS = 60 * 1000; // el token se da por caducado un minuto antes

  // Desde la medianoche local de hoy hasta la de mañana, en formato ISO con zona horaria (UTC)
  function todayRange(now) {
    const d = new Date(now);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  // Suma todo lo que devuelve un rollUp. La documentación no detalla los nombres exactos de los
  // campos (countSum, kcalSum…), así que se suma cualquier campo numérico que termine en "Sum".
  // null si no hay ningún dato.
  function sumRollup(response) {
    const points = response && Array.isArray(response.rollupDataPoints) ? response.rollupDataPoints : [];
    let total = null;
    for (const point of points) {
      if (!point || typeof point !== 'object') continue;
      for (const value of Object.values(point)) {
        if (!value || typeof value !== 'object') continue;
        for (const [key, v] of Object.entries(value)) {
          if (!/Sum$/.test(key)) continue;
          const n = Number(v);
          if (v !== '' && v !== null && Number.isFinite(n)) { total = (total || 0) + n; break; }
        }
      }
    }
    return total;
  }

  function tokenValid(tok, now) {
    return !!(tok && tok.token && Number(tok.exp) - TOKEN_MARGIN_MS > now);
  }

  function summaryFresh(cache, day, now) {
    return !!(cache && cache.day === day && now - Number(cache.at) < FRESH_MS);
  }

  const api = { todayRange, sumRollup, tokenValid, summaryFresh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HealthCore = Object.assign(root.HealthCore || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
