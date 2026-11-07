// Generación y edición del menú (sin DOM). Se prueba en apps/comidas/tests.
// Menu = { startDate, firstMeal: 'comida'|'cena', days, plan, exclusions }
// plan = { "<dia>-<comida|cena>": { id, name } }   (día desde 0)
(function (root) {
  const R = root.Planner; // recipes.js debe cargarse antes
  const SLOTS = ['comida', 'cena'];
  const slotKey = (day, slot) => `${day}-${slot}`;
  const dayOfKey = key => parseInt(key.split('-')[0], 10);

  // Huecos del menú en orden cronológico. Con firstMeal 'cena' el día 0 no tiene comida.
  function slotKeys({ days, firstMeal = 'comida' }) {
    const keys = [];
    for (let d = 0; d < days; d++) {
      for (const s of SLOTS) {
        if (d === 0 && firstMeal === 'cena' && s === 'comida') continue;
        keys.push(slotKey(d, s));
      }
    }
    return keys;
  }

  // ---------- Exclusiones ----------
  // { scope: 'menu' | 'day', day?: number, dishId?: string, ingredient?: string }
  function matches(exclusion, dish) {
    if (exclusion.dishId) return dish.id === exclusion.dishId;
    if (exclusion.ingredient) {
      const wanted = R.norm(exclusion.ingredient);
      return R.ingredientsOf(dish).some(i => i.key === wanted);
    }
    return false;
  }

  function isAllowed(dish, day, exclusions = []) {
    return !exclusions.some(ex =>
      (ex.scope === 'menu' || (ex.scope === 'day' && ex.day === day)) && matches(ex, dish)
    );
  }

  // ---------- Puntuación: menú con sentido ----------
  const WEIGHTS = { repeat: 1000, mainNear: 100, sharedNear: 10, sharedAll: 1 };
  const NEAR = 3; // comidas anteriores y siguientes que cuentan como "cercanas"

  // Coste de poner `dish` en `key` dado lo que ya hay en el plan (menor = mejor).
  function cost(dish, key, plan, order, dishes) {
    const keysOf = d => new Set(R.ingredientsOf(d).map(i => i.key));
    const mine = keysOf(dish);
    const myMain = R.mainIngredient(dish);
    const at = order.indexOf(key);
    let total = 0;

    order.forEach((k, i) => {
      const e = plan[k];
      if (!e || k === key) return;
      if (e.id === dish.id) { total += WEIGHTS.repeat; return; }
      const other = dishes.find(x => x.id === e.id);
      if (!other) return;
      let shared = 0;
      keysOf(other).forEach(x => { if (mine.has(x)) shared++; });
      if (Math.abs(i - at) <= NEAR) {
        if (myMain && myMain === R.mainIngredient(other)) total += WEIGHTS.mainNear;
        total += shared * WEIGHTS.sharedNear;
      } else {
        total += shared * WEIGHTS.sharedAll;
      }
    });
    return total;
  }

  // ---------- Relleno de huecos ----------
  // Devuelve un plan nuevo con los huecos indicados rellenos (los ya ocupados no se tocan).
  function fill({ dishes, menu, plan, keys, rng }) {
    const result = { ...plan };
    const order = slotKeys(menu);

    for (const key of keys) {
      if (result[key]) continue;
      const allowed = dishes.filter(x => isAllowed(x, dayOfKey(key), menu.exclusions));
      if (!allowed.length) continue;
      const costs = allowed.map(x => cost(x, key, result, order, dishes));
      const best = Math.min(...costs);
      const pool = allowed.filter((_, i) => costs[i] === best);
      const pick = pool[Math.floor(rng() * pool.length)];
      result[key] = { id: pick.id, name: pick.name };
    }
    return result;
  }

  function fillMenu({ dishes = [], menu, rng = Math.random }) {
    return { ...menu, plan: fill({ dishes, menu, plan: menu.plan, keys: slotKeys(menu), rng }) };
  }

  function newMenu({ dishes = [], days, startDate, firstMeal = 'comida', exclusions = [], rng = Math.random }) {
    return fillMenu({ dishes, menu: { startDate, firstMeal, days, plan: {}, exclusions }, rng });
  }

  // Quita los huecos indicados y los vuelve a rellenar con otro plato distinto en ese día.
  function replaceKeys({ dishes, menu, keys, rng }) {
    const valid = keys.filter(k => slotKeys(menu).includes(k));
    const cleared = { ...menu.plan };
    const avoid = [];
    for (const key of valid) {
      if (!menu.plan[key]) continue;
      delete cleared[key];
      if (menu.plan[key].id) avoid.push({ scope: 'day', day: dayOfKey(key), dishId: menu.plan[key].id });
    }
    const ctx = { ...menu, exclusions: [...menu.exclusions, ...avoid] };
    const filled = fill({ dishes, menu: ctx, plan: cleared, keys: valid, rng });
    for (const key of valid) if (!filled[key] && menu.plan[key]) filled[key] = menu.plan[key];
    return { ...menu, plan: filled };
  }

  function rerollSlot({ dishes = [], menu, day, slot, rng = Math.random }) {
    return replaceKeys({ dishes, menu, keys: [slotKey(day, slot)], rng });
  }

  function regenerateDay({ dishes = [], menu, day, rng = Math.random }) {
    return replaceKeys({ dishes, menu, keys: SLOTS.map(s => slotKey(day, s)), rng });
  }

  // Añade una exclusión, quita los platos del menú que afecta y los sustituye.
  function excludeAndReplace({ dishes = [], menu, exclusion, rng = Math.random }) {
    const exclusions = [...menu.exclusions, exclusion];
    const cleared = { ...menu.plan };
    const affected = [];
    for (const key of Object.keys(menu.plan)) {
      const dish = dishes.find(x => x.id === menu.plan[key].id);
      if (!dish || isAllowed(dish, dayOfKey(key), exclusions)) continue;
      delete cleared[key];
      affected.push(key);
    }
    const next = { ...menu, exclusions };
    return { ...next, plan: fill({ dishes, menu: next, plan: cleared, keys: affected, rng }) };
  }

  // Comidas del menú que no tienen plato, en orden
  function emptySlots(menu) {
    return menu ? slotKeys(menu).filter(k => !menu.plan[k]) : [];
  }

  const api = { WEIGHTS, NEAR, SLOTS, slotKey, slotKeys, emptySlots, isAllowed, newMenu, fillMenu, rerollSlot, regenerateDay, excludeAndReplace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
