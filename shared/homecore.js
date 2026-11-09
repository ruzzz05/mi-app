// Portada: el dato del día que enseña la tarjeta de cada app, sacado de lo que cada una guarda en el
// móvil (sin red ni DOM). Usa la lógica de Gastos (gastoscore.js) y de Mi-Menu (recipes.js, planner.js,
// schedule.js), que la portada carga antes. Se prueba en shared/tests.
(function (root) {
  const parse = raw => { try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };

  // Gastos: lo que queda (o lo que te has pasado) del presupuesto del mes. null si aún no se ha usado.
  function gastosNote(raw, now, P) {
    const s = parse(raw);
    if (!s || !Array.isArray(s.expenses) || (!s.expenses.length && !(s.subs || []).length && !s.updatedAt)) return null;
    const today = P.toISODate(now);
    const budget = s.budget > 0 ? s.budget : P.DEFAULT_MONTH_BUDGET;
    const st = P.monthStats(s.expenses.filter(e => e && typeof e.date === 'string' && Number.isFinite(e.amount)), today.slice(0, 7), budget, today);
    return st.left < 0 ? `Te has pasado ${P.euros(-st.left, 0)} este mes` : `Te quedan ${P.euros(st.left, 0)} este mes`;
  }

  // Mi-Menu: el plato que toca ahora. null sin menú en marcha o si esa comida está vacía.
  function comidasNote(raw, now, P) {
    const s = parse(raw);
    if (!s) return null;
    const v = P.todayView({ menu: P.migrateState(s).menu, now });
    if (v.status !== 'active') return null;
    const names = [v.current, ...v.currentExtras].filter(Boolean).map(e => e.name).filter(Boolean).join(' + ');
    return names ? `${v.meal === 'cena' ? 'Cena' : 'Comida'}: ${names}` : null;
  }

  // Gimnasio: si hay un entreno a medias.
  function gymNote(raw) {
    const s = parse(raw);
    if (!s || !s.id || !s.startedAt || !Array.isArray(s.exercises)) return null;
    return 'Entreno en curso' + (s.routineName ? ': ' + s.routineName : '');
  }

  // data = { gastos, comidas, gymActive } (texto tal cual está guardado) y now (Date).
  // Devuelve la frase de cada app por su id de apps.json, o null si no hay nada que decir.
  // Un dato roto nunca rompe la portada: esa app se queda con su frase normal.
  function notes(data, P) {
    P = P || root.Planner;
    const safe = fn => { try { return fn(); } catch (e) { return null; } };
    return {
      gastos: safe(() => gastosNote(data.gastos, data.now, P)),
      comidas: safe(() => comidasNote(data.comidas, data.now, P)),
      gimnasio: safe(() => gymNote(data.gymActive))
    };
  }

  const api = { notes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HomeCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
