// Recetas: cantidades, ingredientes y migración del estado guardado. Sin DOM.
(function (root) {
  const norm = s => String(s).trim().toLowerCase();
  const newId = () => Math.random().toString(36).slice(2, 10);
  const emptyList = () => ({ removed: [], extras: [], checked: {} });

  // "1,5" o "1.5" -> 1.5. Devuelve null si no es un número mayor que cero.
  function parseQty(text) {
    const t = String(text).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    const n = parseFloat(t);
    return n > 0 ? n : null;
  }

  // 1.5 -> "1,5"; 2 -> "2"
  function formatQty(n) {
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  // Acepta ingredientes como texto o como { name, qty }.
  function ingredientsOf(dish) {
    return (dish.ingredients || [])
      .map(i => (typeof i === 'string' ? { name: i, qty: 1 } : { name: i.name, qty: i.qty }))
      .map(i => ({ name: String(i.name || '').trim(), qty: i.qty > 0 ? i.qty : 1 }))
      .filter(i => i.name)
      .map(i => ({ key: norm(i.name), name: i.name, qty: i.qty }));
  }

  function normalizeDish(raw) {
    return {
      id: raw.id || newId(),
      name: String(raw.name || '').trim(),
      ingredients: ingredientsOf(raw).map(({ name, qty }) => ({ name, qty }))
    };
  }

  // Ingrediente de mayor cantidad. Si varios empatan no hay uno principal (null):
  // elegir el primero sería arbitrario.
  function mainIngredient(dish) {
    const list = ingredientsOf(dish);
    if (!list.length) return null;
    const max = Math.max(...list.map(i => i.qty));
    const top = list.filter(i => i.qty === max);
    return top.length === 1 ? top[0].key : null;
  }

  // Lleva cualquier estado guardado (o ninguno) a la forma actual.
  function migrateState(raw) {
    const s = raw || {};
    return {
      dishes: (s.dishes || []).map(normalizeDish),
      draft: s.draft || null,
      menu: s.menu || null,
      list: s.list || { ...emptyList(), checked: s.checked || {} }
    };
  }

  const api = { norm, newId, emptyList, parseQty, formatQty, ingredientsOf, normalizeDish, mainIngredient, migrateState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
