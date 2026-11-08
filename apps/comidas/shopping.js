// Lista de la compra del menú (sin DOM). Se prueba en apps/comidas/tests.
// list = { removed: [claves ocultas], extras: [{ key, name, qty }], checked: { clave: true } }
(function (root) {
  const R = root.Planner; // recipes.js y planner.js deben cargarse antes
  const SLOT_ORDER = ['comida', 'cena'];
  const keyOrder = key => {
    const [day, slot] = key.split('-');
    return parseInt(day, 10) * 10 + Math.max(0, SLOT_ORDER.indexOf(slot));
  };

  // Ingredientes de los platos del menú. Un plato que aparece varias veces cuenta cada vez.
  // Si se pasa `now`, las comidas que ya han pasado no cuentan (ver Planner.pastSlotKeys).
  function buildShoppingList({ dishes = [], menu = null, list = R.emptyList(), now = null }) {
    const map = new Map();
    const bump = (key, name, qty, recipe, manual) => {
      const item = map.get(key) || { key, name, qty: 0, recipes: [], manual };
      item.qty += qty;
      if (recipe && !item.recipes.includes(recipe)) item.recipes.push(recipe);
      map.set(key, item);
    };

    const plan = menu ? menu.plan : {};
    const past = now && menu ? new Set(R.pastSlotKeys(menu, now)) : null;
    Object.keys(plan).sort((a, b) => keyOrder(a) - keyOrder(b)).forEach(k => {
      if (past && past.has(k)) return;
      // Plato principal y segundos platos de la comida; los de texto libre no tienen ingredientes
      [plan[k], ...R.extrasOf(menu, k)].forEach(entry => {
        const dish = dishes.find(x => x.id === entry.id);
        if (!dish) return;
        R.ingredientsOf(dish).forEach(ing => {
          if (!list.removed.includes(ing.key)) bump(ing.key, ing.name, ing.qty, dish.name, false);
        });
      });
    });
    list.extras.forEach(ex => bump(ex.key, ex.name, ex.qty, null, true));

    return [...map.values()]
      .map(item => ({ ...item, checked: !!list.checked[item.key] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  // Quitar un producto manual lo borra; quitar uno de un plato lo oculta.
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
    const key = R.norm(clean);
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

  const api = { buildShoppingList, removeFromList, restoreToList, addToList, toggleChecked };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
