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
    dishes: [], draft: null, menu: null, list: { removed: [], extras: [], checked: {} }, seedPurged: true, updatedAt: 0
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
  const state = { dishes: [dish('a', ['x'])], draft: null, menu: { days: 2 }, list: { removed: ['x'], extras: [], checked: {} }, seedPurged: true, updatedAt: 1700000000000 };
  assert.eq(Planner.migrateState(JSON.parse(JSON.stringify(state))), state);
});

// =========================================================
// Limpieza (una sola vez) de las recetas de ejemplo antiguas
// =========================================================
const stored = (dishes, extra = {}) => ({ dishes, draft: null, menu: null, ...extra });

test('migrateState elimina una receta de ejemplo antigua sin modificar', () => {
  const s = Planner.migrateState(stored([
    { id: 'r', name: 'Ramen', ingredients: [] },
    { id: 'e', name: 'Ensalada de Pasta', ingredients: [{ name: 'lechuga', qty: 1 }, { name: 'atun', qty: 1 }, { name: 'cebolla morada', qty: 1 }, { name: 'huevo', qty: 1 }, { name: 'tomate', qty: 1 }] }
  ]));
  assert.eq(s.dishes, []);
  assert.eq(s.seedPurged, true);
});

test('migrateState reconoce tambien los ejemplos de la primera version y los de texto', () => {
  const s = Planner.migrateState(stored([
    { id: 'l', name: ' lentejas ', ingredients: ['lentejas', 'zanahoria', 'cebolla', 'chorizo'] },
    { id: 's', name: 'Salmón a la plancha', ingredients: ['salmón', 'limón', 'ensalada'] }
  ]));
  assert.eq(s.dishes, []);
});

test('migrateState conserva una receta de ejemplo que el usuario ha editado', () => {
  const s = Planner.migrateState(stored([
    { id: 'r', name: 'Ramen', ingredients: [{ name: 'fideos', qty: 2 }] },
    { id: 'p', name: 'Pasta con Atun', ingredients: [{ name: 'pasta', qty: 3 }] }
  ]));
  assert.eq(s.dishes.map(d => d.id), ['r', 'p']);
});

test('migrateState conserva las recetas propias aunque haya ejemplos mezclados', () => {
  const s = Planner.migrateState(stored([
    { id: 'r', name: 'Ramen', ingredients: [] },
    { id: 'm', name: 'Mi tortilla', ingredients: [{ name: 'huevos', qty: 3 }] }
  ]));
  assert.eq(s.dishes.map(d => d.id), ['m']);
});

test('migrateState solo limpia una vez: despues una receta llamada Ramen se respeta', () => {
  const s = Planner.migrateState(stored([{ id: 'r', name: 'Ramen', ingredients: [] }], { seedPurged: true }));
  assert.eq(s.dishes.map(d => d.id), ['r']);
});

test('migrateState deja como texto libre los huecos del menu que usaban una receta eliminada', () => {
  const plan = { '0-comida': { id: 'r', name: 'Ramen' }, '0-cena': { id: 'm', name: 'Mi tortilla' } };
  const s = Planner.migrateState(stored(
    [{ id: 'r', name: 'Ramen', ingredients: [] }, { id: 'm', name: 'Mi tortilla', ingredients: [{ name: 'huevos', qty: 3 }] }],
    { menu: { startDate: '2026-11-06', firstMeal: 'comida', days: 1, exclusions: [], plan } }
  ));
  assert.eq(s.menu.plan['0-comida'], { id: null, name: 'Ramen' });
  assert.eq(s.menu.plan['0-cena'], { id: 'm', name: 'Mi tortilla' });
});

test('migrateState hace lo mismo con el borrador y quita exclusiones de recetas eliminadas', () => {
  const s = Planner.migrateState(stored(
    [{ id: 'r', name: 'Ramen', ingredients: [] }],
    { draft: { startDate: '2026-11-06', firstMeal: 'comida', days: 1, exclusions: [{ scope: 'menu', dishId: 'r' }], plan: { '0-comida': { id: 'r', name: 'Ramen' } } } }
  ));
  assert.eq(s.draft.plan['0-comida'], { id: null, name: 'Ramen' });
  assert.eq(s.draft.exclusions, []);
});

test('migrateState conserva updatedAt y lo pone a 0 si no existe', () => {
  assert.eq(Planner.migrateState({ dishes: [], updatedAt: 123 }).updatedAt, 123);
  assert.eq(Planner.migrateState({ dishes: [] }).updatedAt, 0);
});

// =========================================================
// Etiquetas de ingredientes y ingredientes sin cantidad en el formulario
// =========================================================
test('knownIngredients junta los ingredientes de todas las recetas sin repetir', () => {
  const ds = [dish('a', ['Pollo', 'tomate']), dish('b', ['pollo', 'Arroz'])];
  assert.eq(Planner.knownIngredients(ds).map(i => i.name), ['Arroz', 'Pollo', 'tomate']);
});

test('knownIngredients devuelve la clave normalizada y ordena sin distinguir tildes ni mayusculas', () => {
  const ds = [dish('a', ['Zanahoria', 'ácido', 'Cebolla'])];
  assert.eq(Planner.knownIngredients(ds), [
    { key: 'ácido', name: 'ácido' }, { key: 'cebolla', name: 'Cebolla' }, { key: 'zanahoria', name: 'Zanahoria' }
  ]);
});

test('knownIngredients sin recetas o sin ingredientes da lista vacia', () => {
  assert.eq(Planner.knownIngredients([]), []);
  assert.eq(Planner.knownIngredients([dish('a', [])]), []);
});

test('buildIngredients usa cantidad 1 para ingredientes nuevos y descarta vacios', () => {
  assert.eq(Planner.buildIngredients([' Pollo ', '', '  '], null), [{ name: 'Pollo', qty: 1 }]);
});

test('buildIngredients conserva la cantidad que ya tenia la receta (sin distinguir mayusculas)', () => {
  const prev = dish('a', [{ name: 'pollo', qty: 2.5 }, 'arroz']);
  assert.eq(Planner.buildIngredients(['Pollo', 'arroz', 'sal'], prev),
    [{ name: 'Pollo', qty: 2.5 }, { name: 'arroz', qty: 1 }, { name: 'sal', qty: 1 }]);
});

// =========================================================
// Buscador de recetas: por nombre y por ingredientes
// =========================================================
const busSopa = { id: 's', name: 'Sopa de pollo', ingredients: [{ name: 'Pollo', qty: 1 }, { name: 'Fideos', qty: 1 }] };
const busEnsalada = { id: 'e', name: 'Ensalada', ingredients: [{ name: 'Lechuga', qty: 1 }, { name: 'Limón', qty: 1 }, { name: 'Atún', qty: 1 }] };
const busArroz = { id: 'a', name: 'Arroz con pollo', ingredients: ['Arroz', 'Pollo', 'Pimiento'] };
const busTodas = [busSopa, busEnsalada, busArroz];
const busIds = list => list.map(d => d.id);

test('filterDishes sin texto (o solo espacios) devuelve todas las recetas en su orden', () => {
  assert.eq(busIds(Planner.filterDishes(busTodas, '')), ['s', 'e', 'a']);
  assert.eq(busIds(Planner.filterDishes(busTodas, '   ')), ['s', 'e', 'a']);
  assert.eq(busIds(Planner.filterDishes(busTodas, undefined)), ['s', 'e', 'a']);
});

test('filterDishes busca por el nombre de la receta', () => {
  assert.eq(busIds(Planner.filterDishes(busTodas, 'sopa')), ['s']);
  assert.eq(busIds(Planner.filterDishes(busTodas, 'ensal')), ['e']);   // basta una parte del nombre
});

test('filterDishes busca por el nombre de un ingrediente', () => {
  assert.eq(busIds(Planner.filterDishes(busTodas, 'lechuga')), ['e']);
  assert.eq(busIds(Planner.filterDishes(busTodas, 'pimiento')), ['a']);   // ingrediente escrito como texto
});

test('filterDishes junta las que coinciden por nombre o por ingrediente', () => {
  assert.eq(busIds(Planner.filterDishes(busTodas, 'pollo')), ['s', 'a']);   // nombre en una, ingrediente en ambas
});

test('filterDishes no distingue mayúsculas ni tildes', () => {
  assert.eq(busIds(Planner.filterDishes(busTodas, 'LIMON')), ['e']);
  assert.eq(busIds(Planner.filterDishes(busTodas, 'atun')), ['e']);
  assert.eq(busIds(Planner.filterDishes([{ id: 'x', name: 'Canelones', ingredients: [] }], 'cánelones')), ['x']);
});

test('filterDishes con varias palabras exige todas, cada una en el nombre o en algún ingrediente', () => {
  assert.eq(busIds(Planner.filterDishes(busTodas, 'pollo arroz')), ['a']);
  assert.eq(busIds(Planner.filterDishes(busTodas, 'sopa fideos')), ['s']);       // una en el nombre y otra en un ingrediente
  assert.eq(busIds(Planner.filterDishes(busTodas, 'pollo lechuga')), []);        // ninguna receta tiene las dos
});

test('filterDishes sin coincidencias devuelve lista vacía y no toca la lista original', () => {
  const busCopia = JSON.stringify(busTodas);
  assert.eq(Planner.filterDishes(busTodas, 'chocolate'), []);
  assert.eq(JSON.stringify(busTodas), busCopia);
});

test('filterDishes tolera recetas sin ingredientes y listas vacías', () => {
  assert.eq(busIds(Planner.filterDishes([{ id: 'v', name: 'Vacía' }], 'vac')), ['v']);
  assert.eq(Planner.filterDishes([], 'algo'), []);
});
