// Hora, inicio propuesto del menú y vista de "Hoy" (sin DOM). Se prueba en apps/comidas/tests.
(function (root) {
  const R = root.Planner; // planner.js debe cargarse antes
  const DINNER_FROM = 17; // desde esta hora toca cena
  const TOMORROW_FROM = 22; // desde esta hora un menú nuevo empieza mañana
  const DAY_MS = 86400000;

  const pad = n => String(n).padStart(2, '0');
  const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Días enteros entre dos fechas "YYYY-MM-DD" (sin depender del horario de verano).
  function daysBetween(fromISO, toISO) {
    const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((utc(toISO) - utc(fromISO)) / DAY_MS);
  }

  const mealNow = now => (now.getHours() < DINNER_FROM ? 'comida' : 'cena');

  // Cuándo propone empezar un menú creado ahora.
  function proposeStart(now) {
    const h = now.getHours();
    if (h < DINNER_FROM) return { date: toISODate(now), firstMeal: 'comida' };
    if (h < TOMORROW_FROM) return { date: toISODate(now), firstMeal: 'cena' };
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { date: toISODate(tomorrow), firstMeal: 'comida' };
  }

  // Qué toca ahora según el menú: { status: 'none'|'notStarted'|'active'|'finished', ... }
  function todayView({ menu, now }) {
    if (!menu) return { status: 'none' };
    const today = toISODate(now);
    const dayIdx = daysBetween(menu.startDate, today);
    const base = { startDate: menu.startDate, totalDays: menu.days, date: today };

    if (dayIdx < 0) return { ...base, status: 'notStarted', current: null, other: null };
    if (dayIdx >= menu.days) return { ...base, status: 'finished', current: null, other: null };

    const firstDayDinnerOnly = dayIdx === 0 && menu.firstMeal === 'cena';
    const meal = firstDayDinnerOnly ? 'cena' : mealNow(now);
    const otherMeal = meal === 'comida' ? 'cena' : 'comida';
    return {
      ...base,
      status: 'active',
      dayNumber: dayIdx + 1,
      meal,
      current: menu.plan[R.slotKey(dayIdx, meal)] || null,
      other: (dayIdx === 0 && menu.firstMeal === 'cena' && otherMeal === 'comida')
        ? null // ese día el menú no tiene comida
        : { meal: otherMeal, entry: menu.plan[R.slotKey(dayIdx, otherMeal)] || null }
    };
  }

  const api = { mealNow, proposeStart, todayView, toISODate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
