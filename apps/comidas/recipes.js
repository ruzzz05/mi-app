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

  // Ingredientes usados en cualquier receta, sin repetir (por clave), ordenados: son las etiquetas.
  function knownIngredients(dishes) {
    const seen = new Map();
    dishes.forEach(d => ingredientsOf(d).forEach(i => { if (!seen.has(i.key)) seen.set(i.key, i.name); }));
    return [...seen].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  // Del formulario (solo nombres) a ingredientes { name, qty }. La cantidad ya no se edita:
  // se conserva la que tuviera la receta y, si es nuevo, vale 1.
  function buildIngredients(names, prevDish) {
    const prev = prevDish ? ingredientsOf(prevDish) : [];
    return names.map(n => String(n).trim()).filter(Boolean).map(name => {
      const old = prev.find(i => i.key === norm(name));
      return { name, qty: old ? old.qty : 1 };
    });
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

  // Recetas de ejemplo que cargaron versiones antiguas de la app. Solo sirven para limpiarlas
  // (una vez) de los datos ya guardados; la app ya no trae ninguna receta de serie.
  const OLD_EXAMPLES = [
    ['Sopa con Tiburones', []], ['Arroz con pollo', []],
    ['Ensalada de Pasta', ['lechuga', 'atun', 'cebolla morada', 'huevo', 'tomate']],
    ['Fajitas Pollo con Arroz', []], ['Ensalada de Garbanzo', ['atun', 'cebolla', 'tomate']],
    ['Pasta con Atun', []], ['Ramen', []], ['Pure de Patatas con Pavo', []],
    ['Pure de calabaza con picatostes', []], ['Bocata de Pollo con Lechuga y tomate', []],
    ['Sopa de garbanzos con Arroz', []], ['Pasta con Pollo', []], ['Tosta de Huevo con Complemento', []],
    ['Ensalada Campera', ['patata', 'huevo', 'atun', 'cebolla']], ['Cazuela de Patatas', ['Caldo de Paella']],
    ['Lentejas', ['lentejas', 'zanahoria', 'cebolla', 'chorizo']],
    ['Pasta con tomate', ['pasta', 'tomate triturado', 'cebolla', 'queso rallado']],
    ['Tortilla de patatas', ['huevos', 'patatas', 'cebolla']], ['Pollo al horno', ['pollo', 'patatas', 'limón']],
    ['Ensalada mixta', ['lechuga', 'tomate', 'atún', 'aceitunas']],
    ['Arroz con verduras', ['arroz', 'pimiento', 'zanahoria', 'guisantes']],
    ['Salmón a la plancha', ['salmón', 'limón', 'ensalada']], ['Salmón a la plancha', ['salmón', 'limón', 'lechuga']],
    ['Crema de calabacín', ['calabacín', 'patata', 'cebolla', 'queso crema']]
  ];
  const fingerprint = (name, names) => norm(name) + '|' + names.map(norm).sort().join(',');
  const EXAMPLE_PRINTS = new Set(OLD_EXAMPLES.map(([n, i]) => fingerprint(n, i)));

  // Es una receta de ejemplo sin tocar: mismo nombre, mismos ingredientes y todos con cantidad 1.
  function isOldExample(dish) {
    const list = ingredientsOf(dish);
    return list.every(i => i.qty === 1) && EXAMPLE_PRINTS.has(fingerprint(dish.name, list.map(i => i.name)));
  }

  // Lleva cualquier estado guardado (o ninguno) a la forma actual. Una sola vez (seedPurged)
  // elimina las recetas de ejemplo antiguas que no se hayan editado; los huecos del menú que las
  // usaban se quedan como texto libre para no perder lo planificado.
  function migrateState(raw) {
    const s = raw || {};
    const purged = new Set();
    let dishes = (s.dishes || []).map(normalizeDish);
    if (raw && !s.seedPurged) {
      dishes = dishes.filter(d => { if (isOldExample(d)) { purged.add(d.id); return false; } return true; });
    }
    const clean = menu => {
      if (!menu || !purged.size) return menu || null;
      const plan = {};
      Object.keys(menu.plan || {}).forEach(k => {
        const e = menu.plan[k];
        plan[k] = purged.has(e.id) ? { id: null, name: e.name } : e;
      });
      return { ...menu, plan, exclusions: (menu.exclusions || []).filter(ex => !purged.has(ex.dishId)) };
    };
    return {
      dishes,
      draft: clean(s.draft),
      menu: clean(s.menu),
      list: s.list || { ...emptyList(), checked: s.checked || {} },
      seedPurged: true,
      updatedAt: s.updatedAt || 0
    };
  }

  const api = { norm, newId, emptyList, parseQty, formatQty, ingredientsOf, normalizeDish, knownIngredients, buildIngredients, mainIngredient, migrateState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
