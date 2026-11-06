// Lista de la compra del menu: ingredientes con cantidad, sumados por cada aparicion del plato
const planOf = (...entries) => Object.fromEntries(entries.map(([k, id]) => [k, { id, name: id.toUpperCase() }]));
const recipes = [
  dish('pasta', ['Pasta', 'Tomate']),
  dish('ensalada', ['Lechuga', 'tomate'])
];
const menuWith = plan => menuOf(plan);
const build = (plan, list = Planner.emptyList(), d = recipes) =>
  Planner.buildShoppingList({ dishes: d, menu: plan === null ? null : menuWith(plan), list });
const names = items => items.map(i => i.name);

test('buildShoppingList reune los ingredientes de los platos del menu', () => {
  assert.eq(names(build(planOf(['0-comida', 'pasta']))), ['Pasta', 'Tomate']);
});

test('un plato que se repite en el menu cuenta su ingrediente tantas veces como aparece', () => {
  const items = build(planOf(['0-comida', 'pasta'], ['2-cena', 'pasta'], ['4-comida', 'pasta']));
  assert.eq(items.find(i => i.key === 'pasta').qty, 3);
});

test('la cantidad del ingrediente se multiplica por las apariciones (con decimales)', () => {
  const d = [dish('pollo-arroz', [{ name: 'pollo', qty: 1.5 }, { name: 'arroz', qty: 2 }])];
  const items = build(planOf(['0-comida', 'pollo-arroz'], ['1-cena', 'pollo-arroz']), Planner.emptyList(), d);
  assert.eq(items.find(i => i.key === 'pollo').qty, 3);
  assert.eq(items.find(i => i.key === 'arroz').qty, 4);
});

test('buildShoppingList une ingredientes iguales de platos distintos e indica de cuales vienen', () => {
  const items = build(planOf(['0-comida', 'pasta'], ['0-cena', 'ensalada']));
  const tomate = items.find(i => i.key === 'tomate');
  assert.eq(tomate.qty, 2);
  assert.eq(tomate.recipes, ['PASTA', 'ENSALADA']);
  assert.eq(items.length, 3);
});

test('buildShoppingList ignora texto libre y platos que ya no existen', () => {
  const plan = { '0-comida': { id: null, name: 'Bocata' }, '0-cena': { id: 'borrado', name: 'X' } };
  assert.eq(build(plan), []);
});

test('sin menu la lista solo tiene lo anadido a mano', () => {
  const list = Planner.addToList(Planner.emptyList(), 'Leche');
  assert.eq(names(build(null, list)), ['Leche']);
});

test('removeFromList oculta un ingrediente y sigue oculto aunque el menu cambie', () => {
  const list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  assert.eq(names(build(planOf(['0-comida', 'pasta']), list)), ['Pasta']);
  assert.eq(names(build(planOf(['3-cena', 'ensalada']), list)), ['Lechuga']);
});

test('removeFromList no muta la lista original', () => {
  const list = Planner.emptyList();
  Planner.removeFromList(list, 'tomate');
  assert.eq(list, Planner.emptyList());
});

test('restoreToList vuelve a mostrar un ingrediente quitado', () => {
  let list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  list = Planner.restoreToList(list, 'tomate');
  assert.eq(names(build(planOf(['0-comida', 'pasta']), list)), ['Pasta', 'Tomate']);
});

test('addToList anade un producto manual con cantidad 1 por defecto', () => {
  const items = build({}, Planner.addToList(Planner.emptyList(), 'Leche'));
  assert.eq([items[0].name, items[0].qty, items[0].manual], ['Leche', 1, true]);
});

test('addToList admite una cantidad y la suma si se anade otra vez', () => {
  let list = Planner.addToList(Planner.emptyList(), 'Leche', 1.5);
  list = Planner.addToList(list, ' leche ', 2);
  assert.eq(build({}, list)[0].qty, 3.5);
});

test('addToList de algo que ya viene de un plato suma sin duplicar', () => {
  const items = build(planOf(['0-comida', 'pasta']), Planner.addToList(Planner.emptyList(), ' TOMATE '));
  assert.eq(items.filter(i => i.key === 'tomate').length, 1);
  assert.eq(items.find(i => i.key === 'tomate').qty, 2);
});

test('addToList de algo que habias quitado lo vuelve a mostrar', () => {
  let list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  list = Planner.addToList(list, 'Tomate');
  const items = build(planOf(['0-comida', 'pasta']), list);
  assert.eq(items.filter(i => i.key === 'tomate').length, 1);
});

test('addToList ignora nombres vacios', () => {
  assert.eq(Planner.addToList(Planner.emptyList(), '   '), Planner.emptyList());
});

test('toggleChecked marca y desmarca un producto', () => {
  let list = Planner.toggleChecked(Planner.emptyList(), 'pasta');
  assert.eq(build(planOf(['0-comida', 'pasta']), list).find(i => i.key === 'pasta').checked, true);
  list = Planner.toggleChecked(list, 'pasta');
  assert.eq(build(planOf(['0-comida', 'pasta']), list).find(i => i.key === 'pasta').checked, false);
});
