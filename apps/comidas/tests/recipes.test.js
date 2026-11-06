// =========================================================
// Cantidades
// =========================================================
test('parseQty acepta coma y punto decimal', () => {
  assert.eq(Planner.parseQty('1,5'), 1.5);
  assert.eq(Planner.parseQty('1.5'), 1.5);
  assert.eq(Planner.parseQty(' 2 '), 2);
});

test('parseQty rechaza texto, cero, negativos y vacio', () => {
  ['abc', '0', '-1', '', '   ', '1,5,2'].forEach(t => assert.eq(Planner.parseQty(t), null, `"${t}"`));
});

test('formatQty muestra coma decimal y sin ceros sobrantes', () => {
  assert.eq(Planner.formatQty(2), '2');
  assert.eq(Planner.formatQty(1.5), '1,5');
  assert.eq(Planner.formatQty(0.25), '0,25');
});

// =========================================================
// Ingredientes y platos
// =========================================================
test('ingredientsOf acepta texto y objetos y normaliza la clave', () => {
  const list = Planner.ingredientsOf({ ingredients: ['Tomate', { name: ' Pollo ', qty: 2 }] });
  assert.eq(list, [
    { key: 'tomate', name: 'Tomate', qty: 1 },
    { key: 'pollo', name: 'Pollo', qty: 2 }
  ]);
});

test('ingredientsOf descarta nombres vacios y platos sin ingredientes', () => {
  assert.eq(Planner.ingredientsOf({ ingredients: ['  ', { name: '', qty: 2 }] }), []);
  assert.eq(Planner.ingredientsOf({}), []);
});

test('normalizeDish convierte ingredientes de texto y conserva el id', () => {
  const d = Planner.normalizeDish({ id: 'x1', name: 'A', ingredients: ['x'] });
  assert.eq(d, { id: 'x1', name: 'A', ingredients: [{ name: 'x', qty: 1 }] });
});

test('normalizeDish crea un id si falta', () => {
  assert.ok(Planner.normalizeDish({ name: 'A' }).id);
});

test('mainIngredient es el de mayor cantidad y no hay principal si empatan', () => {
  assert.eq(Planner.mainIngredient(dish('p', [{ name: 'pollo', qty: 2 }, 'tomate'])), 'pollo');
  assert.eq(Planner.mainIngredient(dish('p', ['arroz', 'pollo'])), null);
  assert.eq(Planner.mainIngredient(dish('p', [{ name: 'a', qty: 2 }, { name: 'b', qty: 2 }, 'c'])), null);
  assert.eq(Planner.mainIngredient(dish('p', ['arroz'])), 'arroz');
  assert.eq(Planner.mainIngredient(dish('p', [])), null);
});

// =========================================================
// Migracion del estado guardado
// =========================================================
test('migrateState sin datos devuelve un estado vacio', () => {
  assert.eq(Planner.migrateState(null), {
    dishes: [], draft: null, menu: null, list: { removed: [], extras: [], checked: {} }
  });
});

test('migrateState normaliza platos antiguos, descarta el plan y conserva lo marcado', () => {
  const s = Planner.migrateState({
    dishes: [{ id: 'a', name: 'A', ingredients: ['x', 'y'] }],
    plan: { '0-comida': { id: 'a', name: 'A' } },
    checked: { x: true }
  });
  assert.eq(s.dishes, [{ id: 'a', name: 'A', ingredients: [{ name: 'x', qty: 1 }, { name: 'y', qty: 1 }] }]);
  assert.eq(s.menu, null);
  assert.eq(s.draft, null);
  assert.eq(s.list.checked, { x: true });
});

test('migrateState conserva un estado ya nuevo sin cambios', () => {
  const state = { dishes: [dish('a', ['x'])], draft: null, menu: { days: 2 }, list: { removed: ['x'], extras: [], checked: {} } };
  assert.eq(Planner.migrateState(JSON.parse(JSON.stringify(state))), state);
});
