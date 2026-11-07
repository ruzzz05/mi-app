// Comidas que ya han pasado: no cuentan en la lista de la compra
const fecha = (y, m, d, h) => new Date(y, m - 1, d, h || 12, 0);
const menu3 = (extra) => menuOf({}, { days: 3, ...(extra || {}) });   // empieza el lunes 5-ene-2026 por la comida

test('pastSlotKeys: durante la comida actual no ha pasado ninguna', () => {
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 5, 10)), []);
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 5, 16)), []);
});

test('pastSlotKeys: la comida pasa cuando empieza la cena (17:00)', () => {
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 5, 17)), ['0-comida']);
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 5, 23)), ['0-comida']);
});

test('pastSlotKeys: la cena pasa al terminar el día', () => {
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 6, 9)), ['0-comida', '0-cena']);
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 6, 18)), ['0-comida', '0-cena', '1-comida']);
});

test('pastSlotKeys: antes de empezar el menú no ha pasado nada; al terminar han pasado todas', () => {
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 4, 20)), []);
  assert.eq(Planner.pastSlotKeys(menu3(), fecha(2026, 1, 8, 9)).length, 6);
  assert.eq(Planner.pastSlotKeys(null, fecha(2026, 1, 5, 9)), []);
});

test('pastSlotKeys: un menú que empieza por la cena no tiene la comida del primer día', () => {
  const m = menu3({ firstMeal: 'cena' });
  assert.eq(Planner.pastSlotKeys(m, fecha(2026, 1, 5, 10)), []);        // el primer día "toca" la cena
  assert.eq(Planner.pastSlotKeys(m, fecha(2026, 1, 6, 9)), ['0-cena']);
});

const pastRecipes = [dish('pasta', ['Pasta', 'Tomate']), dish('ensalada', ['Lechuga', 'tomate'])];
const planPast = planOf2(['0-comida', 'pasta'], ['0-cena', 'ensalada'], ['1-comida', 'pasta'], ['2-cena', 'ensalada']);
function planOf2(...entries) { return Object.fromEntries(entries.map(([k, id]) => [k, { id, name: id.toUpperCase() }])); }
const buildAt = (now, list) => Planner.buildShoppingList({ dishes: pastRecipes, menu: menu3({ plan: planPast }), list: list || Planner.emptyList(), now });
const qtyOf = (items, key) => (items.find(i => i.key === key) || {}).qty;

test('lista de la compra: sin la hora, cuenta todo el menú (como antes)', () => {
  const items = Planner.buildShoppingList({ dishes: pastRecipes, menu: menu3({ plan: planPast }), list: Planner.emptyList() });
  assert.eq(qtyOf(items, 'pasta'), 2);
  assert.eq(qtyOf(items, 'tomate'), 4);
});

test('lista de la compra: al pasar una comida bajan las cantidades de sus ingredientes', () => {
  // lunes 18:00: ya pasó la comida del lunes (pasta)
  const items = buildAt(fecha(2026, 1, 5, 18));
  assert.eq(qtyOf(items, 'pasta'), 1);    // quedaba una pasta más (martes)
  assert.eq(qtyOf(items, 'tomate'), 3);
  assert.eq(qtyOf(items, 'lechuga'), 2);
});

test('lista de la compra: el ingrediente desaparece cuando todas sus comidas han pasado', () => {
  // martes a las 18:00: pasaron lunes (comida y cena) y martes (comida); queda la cena del miércoles (ensalada)
  const items = buildAt(fecha(2026, 1, 6, 18));
  assert.eq(items.map(i => i.key).sort(), ['lechuga', 'tomate']);
  assert.eq(qtyOf(items, 'lechuga'), 1);
});

test('lista de la compra: lo añadido a mano y lo marcado como comprado no se ve afectado', () => {
  let list = Planner.addToList(Planner.emptyList(), 'Leche');
  list = Planner.toggleChecked(list, 'lechuga');
  const items = buildAt(fecha(2026, 1, 6, 18), list);
  assert.ok(items.some(i => i.key === 'leche' && i.manual));
  assert.eq(items.find(i => i.key === 'lechuga').checked, true);
});

test('lista de la compra: con el menú terminado solo queda lo añadido a mano', () => {
  const list = Planner.addToList(Planner.emptyList(), 'Leche');
  assert.eq(buildAt(fecha(2026, 1, 10, 9), list).map(i => i.key), ['leche']);
});

test('lista de la compra: antes de empezar el menú cuenta todo', () => {
  assert.eq(qtyOf(buildAt(fecha(2026, 1, 3, 9)), 'tomate'), 4);
});
