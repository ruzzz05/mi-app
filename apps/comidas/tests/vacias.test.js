// Comidas dejadas vacías a propósito: no se rellenan solas ni cuentan en nada
const VACIA = { id: null, name: '', empty: true };
const dishesV = ['a', 'b', 'c', 'd'].map(id => dish(id, [id + '-ing']));
const withEmpty = () => menuOf({ '0-comida': { id: 'a', name: 'A' }, '0-cena': VACIA }, { days: 2 });

test('emptySlots no cuenta como hueco una comida dejada vacía a propósito', () => {
  assert.eq(Planner.emptySlots(withEmpty()), ['1-comida', '1-cena']);
});

test('fillMenu rellena los huecos de verdad pero respeta la comida dejada vacía', () => {
  const filled = Planner.fillMenu({ dishes: dishesV, menu: withEmpty(), rng: seededRng(5) });
  assert.eq(filled.plan['0-cena'], VACIA);
  assert.eq(Planner.emptySlots(filled), []);
  assert.ok(filled.plan['1-comida'] && filled.plan['1-cena']);
});

test('Hoy trata la comida vacía como "sin plato": ni actual ni próxima', () => {
  const m = menuOf({ '0-comida': VACIA, '0-cena': VACIA, '1-comida': { id: 'a', name: 'A' } }, { days: 2 });
  const v1 = Planner.todayView({ menu: m, now: new Date(2026, 0, 5, 10) });
  assert.eq(v1.status, 'active');
  assert.eq(v1.current, null);
  assert.eq(v1.upcoming[0].entry, null);      // la cena de hoy, vacía
  const v2 = Planner.todayView({ menu: m, now: new Date(2026, 0, 6, 10) });
  assert.eq(v2.current, { id: 'a', name: 'A' });
});

test('la lista de la compra no cuenta nada de una comida vacía', () => {
  const m = menuOf({ '0-comida': VACIA, '1-comida': { id: 'a', name: 'A' } }, { days: 2 });
  const items = Planner.buildShoppingList({ dishes: dishesV, menu: m, list: Planner.emptyList() });
  assert.eq(items.map(i => i.key), ['a-ing']);
});

test('la marca de vacía se conserva al guardar y volver a cargar el estado', () => {
  const state = { dishes: dishesV, draft: null, menu: withEmpty(), list: Planner.emptyList(), seedPurged: true, updatedAt: 1 };
  const again = Planner.migrateState(JSON.parse(JSON.stringify(state)));
  assert.eq(again.menu.plan['0-cena'], VACIA);
});

test('regenerar o excluir platos no toca una comida vacía', () => {
  const next = Planner.excludeAndReplace({ dishes: dishesV, menu: withEmpty(), exclusion: { scope: 'menu', dishId: 'a' }, rng: seededRng(2) });
  assert.eq(next.plan['0-cena'], VACIA);
});
