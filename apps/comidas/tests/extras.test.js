// Segundo plato (o más) en una misma comida: menu.extras = { "<dia>-<comida|cena>": [{ id, name }] }
const sopa = { id: 'sopa', name: 'SOPA' };
const pechugas = { id: 'pechugas', name: 'PECHUGAS' };
const baseMenu = () => menuOf({ '0-cena': sopa, '1-comida': entry('a') }, { days: 3 });
const withPechugas = () => Planner.addExtra(baseMenu(), '0-cena', pechugas);

test('extrasOf: un menú sin extras (o sin menú) da lista vacía', () => {
  assert.eq(Planner.extrasOf(baseMenu(), '0-cena'), []);
  assert.eq(Planner.extrasOf(null, '0-cena'), []);
});

test('addExtra añade un plato a esa comida sin tocar el plato principal', () => {
  const m = withPechugas();
  assert.eq(Planner.extrasOf(m, '0-cena'), [pechugas]);
  assert.eq(m.plan['0-cena'], sopa);
  assert.eq(Planner.extrasOf(m, '1-comida'), []);
});

test('addExtra no modifica el menú original', () => {
  const m = baseMenu();
  Planner.addExtra(m, '0-cena', pechugas);
  assert.eq(m.extras, undefined);
});

test('addExtra admite texto libre (sin id) y limpia espacios', () => {
  const m = Planner.addExtra(baseMenu(), '0-cena', { id: null, name: '  Pan con tomate ' });
  assert.eq(Planner.extrasOf(m, '0-cena'), [{ id: null, name: 'Pan con tomate' }]);
});

test('addExtra ignora nombres vacíos y huecos que no existen en el menú', () => {
  const m = baseMenu();
  assert.eq(Planner.addExtra(m, '0-cena', { id: null, name: '   ' }), m);
  assert.eq(Planner.addExtra(m, '9-cena', pechugas), m);
});

test('addExtra no repite el plato principal ni otro extra', () => {
  const m = withPechugas();
  assert.eq(Planner.extrasOf(Planner.addExtra(m, '0-cena', sopa), '0-cena'), [pechugas]);
  assert.eq(Planner.extrasOf(Planner.addExtra(m, '0-cena', pechugas), '0-cena'), [pechugas]);
  const libre = Planner.addExtra(m, '0-cena', { id: null, name: 'Pan' });
  assert.eq(Planner.extrasOf(Planner.addExtra(libre, '0-cena', { id: null, name: ' pan ' }), '0-cena').length, 2);
});

test('removeExtra quita ese plato y deja limpio el menú si no queda ninguno', () => {
  const m = Planner.removeExtra(withPechugas(), '0-cena', 0);
  assert.eq(Planner.extrasOf(m, '0-cena'), []);
  assert.eq(m.extras, {});
});

test('removeExtra con varios quita solo el indicado', () => {
  const m = Planner.addExtra(withPechugas(), '0-cena', { id: null, name: 'Pan' });
  assert.eq(Planner.extrasOf(Planner.removeExtra(m, '0-cena', 0), '0-cena'), [{ id: null, name: 'Pan' }]);
});

test('cambiar el plato principal (rerollSlot) conserva el segundo plato', () => {
  const ds = [dish('sopa', ['x']), dish('otro', ['y']), dish('pechugas', ['z'])];
  const m = withPechugas();
  const next = Planner.rerollSlot({ dishes: ds, menu: m, day: 0, slot: 'cena', rng: firstRng });
  assert.eq(Planner.extrasOf(next, '0-cena'), [pechugas]);
});

test('dropDishFromExtras quita ese plato de todas las comidas', () => {
  let m = Planner.addExtra(withPechugas(), '1-comida', pechugas);
  m = Planner.addExtra(m, '1-comida', { id: null, name: 'Pan' });
  const next = Planner.dropDishFromExtras(m, 'pechugas');
  assert.eq(Planner.extrasOf(next, '0-cena'), []);
  assert.eq(Planner.extrasOf(next, '1-comida'), [{ id: null, name: 'Pan' }]);
  assert.eq(Object.keys(next.extras), ['1-comida']);
});

test('migrateState conserva los extras del menú', () => {
  const s = Planner.migrateState({ dishes: [dish('sopa', ['x'])], menu: withPechugas(), seedPurged: true });
  assert.eq(Planner.extrasOf(s.menu, '0-cena'), [pechugas]);
});

// ---------- Lista de la compra ----------
const ds2 = [dish('sopa', ['Caldo', 'Fideos']), dish('pechugas', ['Pollo', 'Limón']), dish('a', ['Caldo'])];

test('la compra suma los ingredientes del segundo plato', () => {
  const items = Planner.buildShoppingList({ dishes: ds2, menu: withPechugas(), list: Planner.emptyList() });
  assert.eq(items.map(i => i.name), ['Caldo', 'Fideos', 'Limón', 'Pollo']);
  assert.eq(items.find(i => i.key === 'pollo').recipes, ['PECHUGAS']);
});

test('la compra suma ingredientes repetidos entre plato principal, extra y otras comidas', () => {
  const m = Planner.addExtra(baseMenu(), '0-cena', { id: 'a', name: 'A' });
  const caldo = Planner.buildShoppingList({ dishes: ds2, menu: m, list: Planner.emptyList() }).find(i => i.key === 'caldo');
  assert.eq(caldo.qty, 3);   // sopa + extra A + comida del día 1 (A)
});

test('la compra ignora extras de texto libre y los de una comida que ya pasó', () => {
  const libre = Planner.addExtra(baseMenu(), '0-cena', { id: null, name: 'Pan' });
  assert.eq(Planner.buildShoppingList({ dishes: ds2, menu: libre, list: Planner.emptyList() }).some(i => i.key === 'pan'), false);
  const m = withPechugas();   // empieza lun 5-ene-2026; la cena del día 0 pasa al terminar el día
  const antes = Planner.buildShoppingList({ dishes: ds2, menu: m, list: Planner.emptyList(), now: new Date(2026, 0, 5, 12) });
  const despues = Planner.buildShoppingList({ dishes: ds2, menu: m, list: Planner.emptyList(), now: new Date(2026, 0, 6, 9) });
  assert.ok(antes.some(i => i.key === 'pollo'));
  assert.eq(despues.some(i => i.key === 'pollo'), false);
});

// ---------- Vista de Hoy ----------
test('todayView incluye los extras de la comida actual y de las próximas', () => {
  const m = Planner.addExtra(withPechugas(), '1-comida', { id: null, name: 'Pan' });
  const v = Planner.todayView({ menu: m, now: new Date(2026, 0, 5, 18) });   // cena del día 0
  assert.eq(v.meal, 'cena');
  assert.eq(v.currentExtras, [pechugas]);
  const v2 = Planner.todayView({ menu: m, now: new Date(2026, 0, 5, 10) });  // comida del día 0, la cena queda "después"
  assert.eq(v2.currentExtras, []);
  assert.eq(v2.upcoming[0].extras, [pechugas]);
});

test('todayView sin extras da listas vacías', () => {
  const v = Planner.todayView({ menu: baseMenu(), now: new Date(2026, 0, 5, 10) });
  assert.eq(v.currentExtras, []);
  assert.eq(v.upcoming.map(u => u.extras), [[]]);
});
