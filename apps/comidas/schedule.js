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

  // Una comida dejada vacía a propósito ({ empty: true }) cuenta como sin plato
  const entryOf = (menu, key) => { const e = menu.plan[key]; return e && !e.empty ? e : null; };

  const mealNow = now => (now.getHours() < DINNER_FROM ? 'comida' : 'cena');

  // Cuándo propone empezar un menú creado ahora.
  function proposeStart(now) {
    const h = now.getHours();
    if (h < DINNER_FROM) return { date: toISODate(now), firstMeal: 'comida' };
    if (h < TOMORROW_FROM) return { date: toISODate(now), firstMeal: 'cena' };
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { date: toISODate(tomorrow), firstMeal: 'comida' };
  }

  // Comidas que vienen después de la actual: las que quedan hoy o, si no queda ninguna,
  // las del día siguiente. Cada una: { dayOffset, meal, entry } (entry null si no tiene plato).
  function upcomingMeals(menu, dayIdx, meal) {
    const keys = R.slotKeys(menu);
    const at = keys.indexOf(R.slotKey(dayIdx, meal));
    if (at < 0) return [];
    const rest = keys.slice(at + 1).map(k => { const [d, m] = k.split('-'); return { key: k, day: parseInt(d, 10), meal: m }; });
    const today = rest.filter(x => x.day === dayIdx);
    const chosen = today.length ? today : rest.filter(x => x.day === dayIdx + 1);
    return chosen.map(x => ({ dayOffset: x.day - dayIdx, meal: x.meal, entry: entryOf(menu, x.key) }));
  }

  // Qué toca ahora según el menú: { status: 'none'|'notStarted'|'active'|'finished', ... }
  function todayView({ menu, now }) {
    if (!menu) return { status: 'none' };
    const today = toISODate(now);
    const dayIdx = daysBetween(menu.startDate, today);
    const base = { startDate: menu.startDate, totalDays: menu.days, date: today };

    if (dayIdx < 0) return { ...base, status: 'notStarted', current: null, upcoming: [] };
    if (dayIdx >= menu.days) return { ...base, status: 'finished', current: null, upcoming: [] };

    const firstDayDinnerOnly = dayIdx === 0 && menu.firstMeal === 'cena';
    const meal = firstDayDinnerOnly ? 'cena' : mealNow(now);
    return {
      ...base,
      status: 'active',
      dayNumber: dayIdx + 1,
      meal,
      current: entryOf(menu, R.slotKey(dayIdx, meal)),
      upcoming: upcomingMeals(menu, dayIdx, meal)
    };
  }

  // Comidas del menú que ya han pasado (sus ingredientes ya no hacen falta en la compra). Una comida
  // pasa cuando empieza la siguiente: la comida a las 17:00 y la cena al terminar el día. Con el menú
  // sin empezar no ha pasado ninguna; con el menú terminado, todas.
  function pastSlotKeys(menu, now) {
    if (!menu) return [];
    const keys = R.slotKeys(menu);
    const dayIdx = daysBetween(menu.startDate, toISODate(now));
    if (dayIdx < 0) return [];
    if (dayIdx >= menu.days) return keys;
    const meal = dayIdx === 0 && menu.firstMeal === 'cena' ? 'cena' : mealNow(now);
    const at = keys.indexOf(R.slotKey(dayIdx, meal));
    return at < 0 ? [] : keys.slice(0, at);
  }

  const api = { mealNow, proposeStart, todayView, toISODate, pastSlotKeys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
