// Huecos del menú (comidas sin plato) y relleno automático
const dishesH = ['a', 'b', 'c', 'd'].map(id => dish(id, [id + '-ing']));

test('emptySlots: lista las comidas sin plato, en orden', () => {
  const m = menuOf({ '0-comida': { id: 'a', name: 'A' }, '1-cena': { id: 'b', name: 'B' } }, { days: 2 });
  assert.eq(Planner.emptySlots(m), ['0-cena', '1-comida']);
});

test('emptySlots: un menú completo no tiene huecos; sin menú no hay nada', () => {
  const full = Planner.newMenu({ dishes: dishesH, days: 3, startDate: '2026-01-05', rng: firstRng });
  assert.eq(Planner.emptySlots(full), []);
  assert.eq(Planner.emptySlots(null), []);
});

test('emptySlots respeta que el primer día empiece por la cena', () => {
  const m = menuOf({}, { days: 2, firstMeal: 'cena' });
  assert.eq(Planner.emptySlots(m), ['0-cena', '1-comida', '1-cena']);
});

test('rellenar los huecos de un menú los deja todos cubiertos si hay platos', () => {
  const m = menuOf({ '0-comida': { id: 'a', name: 'A' } }, { days: 3 });
  const filled = Planner.fillMenu({ dishes: dishesH, menu: m, rng: seededRng(7) });
  assert.eq(Planner.emptySlots(filled), []);
  assert.eq(filled.plan['0-comida'], { id: 'a', name: 'A' });   // lo que ya había no se toca
});

test('rerollSlot: quitar un plato lo cambia por otro distinto ese día y no deja hueco', () => {
  const m = Planner.newMenu({ dishes: dishesH, days: 2, startDate: '2026-01-05', rng: seededRng(3) });
  const before = m.plan['0-comida'];
  const after = Planner.rerollSlot({ dishes: dishesH, menu: m, day: 0, slot: 'comida', rng: seededRng(9) });
  assert.ok(after.plan['0-comida'], 'tiene que quedar un plato');
  assert.ok(after.plan['0-comida'].id !== before.id, 'tiene que ser otro plato');
  assert.eq(Planner.emptySlots(after), []);
});

test('rerollSlot: si no hay ningún otro plato, se queda el que estaba (nunca un hueco)', () => {
  const solo = [dish('a', ['x'])];
  const m = Planner.newMenu({ dishes: solo, days: 1, startDate: '2026-01-05', rng: firstRng });
  const after = Planner.rerollSlot({ dishes: solo, menu: m, day: 0, slot: 'comida', rng: firstRng });
  assert.eq(after.plan['0-comida'].id, 'a');
});
