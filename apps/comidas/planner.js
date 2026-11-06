// Lógica pura del planning semanal (sin DOM). Se prueba en tests/comidas.
(function (root) {
  const DAYS = 7;
  const SLOTS = ['comida', 'cena'];
  const slotKey = (day, slot) => `${day}-${slot}`;
  const dayOfKey = key => parseInt(key.split('-')[0], 10);
  const norm = s => String(s).trim().toLowerCase();

  // ---------- Exclusiones ----------
  // { scope: 'week' | 'day', day?: number, dishId?: string, ingredient?: string }
  function matches(exclusion, dish) {
    if (exclusion.dishId) return dish.id === exclusion.dishId;
    if (exclusion.ingredient) {
      return (dish.ingredients || []).some(i => norm(i) === norm(exclusion.ingredient));
    }
    return false;
  }

  function isAllowed(dish, day, exclusions = []) {
    return !exclusions.some(ex =>
      (ex.scope === 'week' || (ex.scope === 'day' && ex.day === day)) && matches(ex, dish)
    );
  }

  // ---------- Relleno de huecos ----------
  function fill({ dishes, plan, exclusions, rng, keys }) {
    const result = { ...plan };
    const used = new Set(Object.values(result).map(e => e.id).filter(Boolean));

    for (const key of keys) {
      if (result[key]) continue;
      const allowed = dishes.filter(x => isAllowed(x, dayOfKey(key), exclusions));
      if (!allowed.length) continue;
      let pool = allowed.filter(x => !used.has(x.id));
      if (!pool.length) { used.clear(); pool = allowed; }
      const pick = pool[Math.floor(rng() * pool.length)];
      used.add(pick.id);
      result[key] = { id: pick.id, name: pick.name };
    }
    return result;
  }

  function allKeys() {
    const keys = [];
    for (let d = 0; d < DAYS; d++) for (const s of SLOTS) keys.push(slotKey(d, s));
    return keys;
  }

  function generateWeek({ dishes = [], plan = {}, exclusions = [], rng = Math.random } = {}) {
    return fill({ dishes, plan, exclusions, rng, keys: allKeys() });
  }

  // Añade una exclusión, quita los platos planificados que afecta y los sustituye.
  function excludeAndReplace({ dishes = [], plan = {}, exclusions = [], exclusion, rng = Math.random }) {
    const nextExclusions = [...exclusions, exclusion];
    const cleared = { ...plan };
    const affected = [];
    for (const key of Object.keys(plan)) {
      const dish = dishes.find(x => x.id === plan[key].id);
      if (!dish || isAllowed(dish, dayOfKey(key), nextExclusions)) continue;
      delete cleared[key];
      affected.push(key);
    }
    return {
      plan: fill({ dishes, plan: cleared, exclusions: nextExclusions, rng, keys: affected }),
      exclusions: nextExclusions
    };
  }

  // Cambia los huecos indicados por otro plato distinto; si no hay alternativa, se quedan como estaban.
  function replaceKeys({ dishes, plan, exclusions, rng, keys }) {
    const cleared = { ...plan };
    const avoid = [];
    for (const key of keys) {
      if (!plan[key]) continue;
      delete cleared[key];
      if (plan[key].id) avoid.push({ scope: 'day', day: dayOfKey(key), dishId: plan[key].id });
    }
    const filled = fill({ dishes, plan: cleared, exclusions: [...exclusions, ...avoid], rng, keys });
    for (const key of keys) if (!filled[key] && plan[key]) filled[key] = plan[key];
    return filled;
  }

  function rerollSlot({ dishes = [], plan = {}, exclusions = [], day, slot, rng = Math.random }) {
    return replaceKeys({ dishes, plan, exclusions, rng, keys: [slotKey(day, slot)] });
  }

  function regenerateDay({ dishes = [], plan = {}, exclusions = [], day, rng = Math.random }) {
    return replaceKeys({ dishes, plan, exclusions, rng, keys: SLOTS.map(s => slotKey(day, s)) });
  }

  // ---------- Lista de la compra ----------
  // list = { removed: [claves ocultas], extras: [{key, name, qty}], checked: {clave: true} }
  const emptyList = () => ({ removed: [], extras: [], checked: {} });

  const keyOrder = key => dayOfKey(key) * 10 + Math.max(0, SLOTS.indexOf(key.split('-')[1]));

  function buildShoppingList({ dishes = [], plan = {}, list = emptyList() }) {
    const map = new Map();
    const bump = (key, name, qty, recipe, manual) => {
      const item = map.get(key) || { key, name, qty: 0, recipes: [], manual };
      item.qty += qty;
      if (recipe && !item.recipes.includes(recipe)) item.recipes.push(recipe);
      map.set(key, item);
    };

    Object.keys(plan).sort((a, b) => keyOrder(a) - keyOrder(b)).forEach(k => {
      const dish = dishes.find(x => x.id === plan[k].id);
      if (!dish) return;
      (dish.ingredients || []).forEach(ing => {
        const key = norm(ing);
        if (!list.removed.includes(key)) bump(key, ing.trim(), 1, dish.name, false);
      });
    });
    list.extras.forEach(ex => bump(ex.key, ex.name, ex.qty, null, true));

    return [...map.values()]
      .map(item => ({ ...item, checked: !!list.checked[item.key] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function removeFromList(list, key) {
    const checked = { ...list.checked };
    delete checked[key];
    const extras = list.extras.filter(e => e.key !== key);
    const removed = list.removed.includes(key) ? list.removed : [...list.removed, key];
    return { removed, extras, checked };
  }

  function restoreToList(list, key) {
    return { ...list, removed: list.removed.filter(k => k !== key) };
  }

  function addToList(list, name, qty = 1) {
    const clean = String(name).trim();
    if (!clean) return list;
    const key = norm(clean);
    const exists = list.extras.some(e => e.key === key);
    const extras = exists
      ? list.extras.map(e => (e.key === key ? { ...e, qty: e.qty + qty } : e))
      : [...list.extras, { key, name: clean, qty }];
    return { ...list, extras };
  }

  function toggleChecked(list, key) {
    const checked = { ...list.checked };
    if (checked[key]) delete checked[key]; else checked[key] = true;
    return { ...list, checked };
  }

  const api = {
    DAYS, SLOTS, slotKey, isAllowed,
    generateWeek, excludeAndReplace, rerollSlot, regenerateDay,
    emptyList, buildShoppingList, removeFromList, restoreToList, addToList, toggleChecked
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = api;
})(typeof window !== 'undefined' ? window : globalThis);
