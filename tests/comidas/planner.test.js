// Datos de ejemplo
const dish = (id, ingredients = []) => ({ id, name: id.toUpperCase(), ingredients });
const dishes = (...ids) => ids.map(id => dish(id));
const firstRng = () => 0; // determinista: siempre el primer candidato
const ids = plan => Object.values(plan).map(e => e.id);

// =========================================================
// 1. Generación automática de la semana
// =========================================================
test('generateWeek rellena los 14 huecos (7 dias x comida y cena)', () => {
  const plan = Planner.generateWeek({ dishes: dishes('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), rng: firstRng });
  assert.eq(Object.keys(plan).length, 14);
  assert.ok(plan['0-comida'] && plan['6-cena'], 'faltan lunes-comida o domingo-cena');
});

test('generateWeek no repite plato mientras queden platos sin usar', () => {
  const plan = Planner.generateWeek({ dishes: dishes(...'abcdefghijklmn'), rng: Math.random });
  assert.eq(new Set(ids(plan)).size, 14);
});

test('generateWeek repite platos solo cuando hay menos platos que huecos', () => {
  const plan = Planner.generateWeek({ dishes: dishes('a', 'b', 'c'), rng: Math.random });
  assert.eq(Object.keys(plan).length, 14);
  assert.ok(ids(plan).every(id => ['a', 'b', 'c'].includes(id)));
});

test('generateWeek respeta los huecos que ya tenian plato', () => {
  const plan = Planner.generateWeek({
    dishes: dishes('a', 'b', 'c'),
    plan: { '2-cena': { id: 'x', name: 'Pizza manual' } },
    rng: firstRng
  });
  assert.eq(plan['2-cena'], { id: 'x', name: 'Pizza manual' });
  assert.eq(Object.keys(plan).length, 14);
});

test('generateWeek no modifica el plan recibido', () => {
  const original = { '0-comida': { id: 'a', name: 'A' } };
  Planner.generateWeek({ dishes: dishes('a', 'b'), plan: original, rng: firstRng });
  assert.eq(original, { '0-comida': { id: 'a', name: 'A' } });
});

test('generateWeek sin platos devuelve el plan sin cambios', () => {
  const plan = Planner.generateWeek({ dishes: [], plan: {}, rng: firstRng });
  assert.eq(plan, {});
});

// =========================================================
// 2. Exclusiones: "esta semana / este dia no quiero eso"
// =========================================================
const weekNo = dishId => ({ scope: 'week', dishId });
const dayNo = (day, dishId) => ({ scope: 'day', day, dishId });

test('generateWeek no usa un plato excluido toda la semana', () => {
  const plan = Planner.generateWeek({
    dishes: dishes('a', 'b', 'c'), exclusions: [weekNo('a')], rng: Math.random
  });
  assert.ok(!ids(plan).includes('a'), 'aparecio el plato excluido');
  assert.eq(Object.keys(plan).length, 14);
});

test('generateWeek no usa un plato excluido solo ese dia, pero si otros dias', () => {
  const plan = Planner.generateWeek({
    dishes: dishes('a', 'b'), exclusions: [dayNo(2, 'a')], rng: Math.random
  });
  assert.eq([plan['2-comida'].id, plan['2-cena'].id], ['b', 'b']);
  assert.ok(ids(plan).includes('a'), 'a deberia aparecer otros dias');
});

test('generateWeek excluye por ingrediente (platos que lo contengan)', () => {
  const list = [dish('pasta', ['pasta', 'tomate']), dish('ensalada', ['lechuga', 'tomate']), dish('arroz', ['arroz'])];
  const plan = Planner.generateWeek({
    dishes: list, exclusions: [{ scope: 'week', ingredient: 'Tomate' }], rng: Math.random
  });
  assert.eq([...new Set(ids(plan))], ['arroz']);
});

test('generateWeek deja el hueco vacio si todos los platos estan excluidos', () => {
  const plan = Planner.generateWeek({
    dishes: dishes('a'), exclusions: [dayNo(0, 'a')], rng: firstRng
  });
  assert.ok(!plan['0-comida'] && !plan['0-cena'], 'el lunes deberia quedar vacio');
  assert.ok(plan['1-comida'], 'el martes si se rellena');
});

test('excludeAndReplace sustituye los platos ya planificados que quedan excluidos', () => {
  const full = Planner.generateWeek({ dishes: dishes('a', 'b', 'c'), rng: firstRng });
  const { plan } = Planner.excludeAndReplace({
    dishes: dishes('a', 'b', 'c'), plan: full, exclusions: [], exclusion: weekNo('a'), rng: firstRng
  });
  assert.ok(!ids(plan).includes('a'), 'sigue apareciendo a');
  assert.eq(Object.keys(plan).length, 14, 'deberia seguir lleno');
});

test('excludeAndReplace no toca los huecos que no estaban afectados', () => {
  const before = { '0-comida': { id: 'a', name: 'A' }, '0-cena': { id: 'b', name: 'B' } };
  const { plan } = Planner.excludeAndReplace({
    dishes: dishes('a', 'b', 'c'), plan: before, exclusions: [], exclusion: weekNo('a'), rng: firstRng
  });
  assert.eq(plan['0-cena'], { id: 'b', name: 'B' });
  assert.ok(plan['0-comida'].id !== 'a');
});

test('excludeAndReplace con exclusion de dia solo afecta a ese dia', () => {
  const before = {
    '1-comida': { id: 'a', name: 'A' },
    '2-comida': { id: 'a', name: 'A' }
  };
  const { plan } = Planner.excludeAndReplace({
    dishes: dishes('a', 'b'), plan: before, exclusions: [], exclusion: dayNo(2, 'a'), rng: firstRng
  });
  assert.eq(plan['1-comida'].id, 'a');
  assert.eq(plan['2-comida'].id, 'b');
});

test('excludeAndReplace devuelve las exclusiones acumuladas sin mutar las originales', () => {
  const prev = [weekNo('x')];
  const { exclusions } = Planner.excludeAndReplace({
    dishes: dishes('a', 'b'), plan: {}, exclusions: prev, exclusion: weekNo('a'), rng: firstRng
  });
  assert.eq(exclusions, [weekNo('x'), weekNo('a')]);
  assert.eq(prev, [weekNo('x')]);
});

test('excludeAndReplace vacia el hueco si no hay alternativa valida', () => {
  const { plan } = Planner.excludeAndReplace({
    dishes: dishes('a'), plan: { '0-comida': { id: 'a', name: 'A' } },
    exclusions: [], exclusion: dayNo(0, 'a'), rng: firstRng
  });
  assert.ok(!plan['0-comida']);
});

// =========================================================
// 3. Edicion: cambiar un hueco o regenerar un dia
// =========================================================
test('rerollSlot da un plato distinto al que habia', () => {
  const plan = { '1-cena': { id: 'a', name: 'A' } };
  const next = Planner.rerollSlot({ dishes: dishes('a', 'b', 'c'), plan, day: 1, slot: 'cena', rng: firstRng });
  assert.ok(next['1-cena'].id !== 'a', 'deberia cambiar');
});

test('rerollSlot respeta las exclusiones', () => {
  const plan = { '1-cena': { id: 'a', name: 'A' } };
  const next = Planner.rerollSlot({
    dishes: dishes('a', 'b', 'c'), plan, exclusions: [weekNo('b')], day: 1, slot: 'cena', rng: firstRng
  });
  assert.eq(next['1-cena'].id, 'c');
});

test('rerollSlot mantiene el plato si no hay alternativa', () => {
  const plan = { '1-cena': { id: 'a', name: 'A' } };
  const next = Planner.rerollSlot({ dishes: dishes('a'), plan, day: 1, slot: 'cena', rng: firstRng });
  assert.eq(next['1-cena'], { id: 'a', name: 'A' });
});

test('rerollSlot solo cambia ese hueco y no muta el plan original', () => {
  const plan = { '0-comida': { id: 'a', name: 'A' }, '1-cena': { id: 'b', name: 'B' } };
  const next = Planner.rerollSlot({ dishes: dishes('a', 'b', 'c'), plan, day: 1, slot: 'cena', rng: firstRng });
  assert.eq(next['0-comida'], { id: 'a', name: 'A' });
  assert.eq(plan['1-cena'], { id: 'b', name: 'B' });
});

test('regenerateDay cambia los dos platos del dia y deja el resto igual', () => {
  const plan = {
    '0-comida': { id: 'a', name: 'A' }, '0-cena': { id: 'b', name: 'B' },
    '1-comida': { id: 'c', name: 'C' }
  };
  const next = Planner.regenerateDay({ dishes: dishes('a', 'b', 'c', 'd', 'e'), plan, day: 0, rng: firstRng });
  assert.ok(!['a', 'b'].includes(next['0-comida'].id), 'comida igual que antes');
  assert.ok(!['a', 'b'].includes(next['0-cena'].id), 'cena igual que antes');
  assert.eq(next['1-comida'], { id: 'c', name: 'C' });
});

test('regenerateDay respeta las exclusiones del dia', () => {
  const next = Planner.regenerateDay({
    dishes: dishes('a', 'b', 'c', 'd'), plan: {}, exclusions: [dayNo(3, 'a'), dayNo(3, 'b')], day: 3, rng: firstRng
  });
  assert.ok(!['a', 'b'].includes(next['3-comida'].id));
  assert.ok(!['a', 'b'].includes(next['3-cena'].id));
});

// =========================================================
// 4. Lista de la compra interactiva
// =========================================================
const planOf = (...entries) => Object.fromEntries(entries.map(([k, id, name]) => [k, { id, name }]));
const recipes = [
  dish('pasta', ['Pasta', 'Tomate']),
  dish('ensalada', ['Lechuga', 'tomate'])
];
const names = items => items.map(i => i.name);

test('buildShoppingList reune los ingredientes de las recetas planificadas', () => {
  const items = Planner.buildShoppingList({
    dishes: recipes, plan: planOf(['0-comida', 'pasta', 'PASTA']), list: Planner.emptyList()
  });
  assert.eq(names(items), ['Pasta', 'Tomate']);
});

test('buildShoppingList suma la cantidad si el mismo plato se repite', () => {
  const items = Planner.buildShoppingList({
    dishes: recipes,
    plan: planOf(['0-comida', 'pasta', 'PASTA'], ['2-cena', 'pasta', 'PASTA']),
    list: Planner.emptyList()
  });
  assert.eq(items.find(i => i.key === 'pasta').qty, 2);
});

test('buildShoppingList une ingredientes iguales de recetas distintas e indica de cuales vienen', () => {
  const items = Planner.buildShoppingList({
    dishes: recipes,
    plan: planOf(['0-comida', 'pasta', 'PASTA'], ['0-cena', 'ensalada', 'ENSALADA']),
    list: Planner.emptyList()
  });
  const tomate = items.find(i => i.key === 'tomate');
  assert.eq(tomate.qty, 2);
  assert.eq(tomate.recipes, ['PASTA', 'ENSALADA']);
  assert.eq(items.length, 3);
});

test('buildShoppingList ignora entradas de texto libre o platos que ya no existen', () => {
  const items = Planner.buildShoppingList({
    dishes: recipes,
    plan: { '0-comida': { id: null, name: 'Bocata' }, '0-cena': { id: 'borrado', name: 'X' } },
    list: Planner.emptyList()
  });
  assert.eq(items, []);
});

test('removeFromList oculta un ingrediente de la lista', () => {
  const plan = planOf(['0-comida', 'pasta', 'PASTA']);
  const list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  assert.eq(names(Planner.buildShoppingList({ dishes: recipes, plan, list })), ['Pasta']);
});

test('lo quitado sigue oculto aunque el plan cambie', () => {
  const list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  const otherPlan = planOf(['3-cena', 'ensalada', 'ENSALADA']);
  assert.eq(names(Planner.buildShoppingList({ dishes: recipes, plan: otherPlan, list })), ['Lechuga']);
});

test('removeFromList no muta la lista original', () => {
  const list = Planner.emptyList();
  Planner.removeFromList(list, 'tomate');
  assert.eq(list, Planner.emptyList());
});

test('restoreToList vuelve a mostrar un ingrediente quitado', () => {
  const plan = planOf(['0-comida', 'pasta', 'PASTA']);
  let list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  list = Planner.restoreToList(list, 'tomate');
  assert.eq(names(Planner.buildShoppingList({ dishes: recipes, plan, list })), ['Pasta', 'Tomate']);
});

test('addToList anade un producto manual aunque no venga de ninguna receta', () => {
  const list = Planner.addToList(Planner.emptyList(), 'Leche');
  const items = Planner.buildShoppingList({ dishes: recipes, plan: {}, list });
  assert.eq(items.length, 1);
  assert.eq([items[0].name, items[0].qty, items[0].manual], ['Leche', 1, true]);
});

test('addToList de algo que ya viene de una receta suma cantidad sin duplicar', () => {
  const plan = planOf(['0-comida', 'pasta', 'PASTA']);
  const list = Planner.addToList(Planner.emptyList(), ' TOMATE ');
  const items = Planner.buildShoppingList({ dishes: recipes, plan, list });
  assert.eq(items.filter(i => i.key === 'tomate').length, 1);
  assert.eq(items.find(i => i.key === 'tomate').qty, 2);
});

test('addToList de algo que habias quitado lo vuelve a mostrar', () => {
  const plan = planOf(['0-comida', 'pasta', 'PASTA']);
  let list = Planner.removeFromList(Planner.emptyList(), 'tomate');
  list = Planner.addToList(list, 'Tomate');
  const items = Planner.buildShoppingList({ dishes: recipes, plan, list });
  assert.eq(items.filter(i => i.key === 'tomate').length, 1);
});

test('addToList ignora nombres vacios', () => {
  assert.eq(Planner.addToList(Planner.emptyList(), '   '), Planner.emptyList());
});

test('toggleChecked marca y desmarca un producto', () => {
  const plan = planOf(['0-comida', 'pasta', 'PASTA']);
  let list = Planner.toggleChecked(Planner.emptyList(), 'pasta');
  let items = Planner.buildShoppingList({ dishes: recipes, plan, list });
  assert.eq(items.find(i => i.key === 'pasta').checked, true);
  list = Planner.toggleChecked(list, 'pasta');
  items = Planner.buildShoppingList({ dishes: recipes, plan, list });
  assert.eq(items.find(i => i.key === 'pasta').checked, false);
});
