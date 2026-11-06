const ids = plan => Object.values(plan).map(e => e.id);
const menuNo = dishId => ({ scope: 'menu', dishId });
const dayNo = (day, dishId) => ({ scope: 'day', day, dishId });
const entry = id => ({ id, name: id.toUpperCase() });
const make = (d, extra = {}) => Planner.newMenu({
  dishes: d, days: 7, startDate: '2026-01-05', firstMeal: 'comida', rng: firstRng, ...extra
});

// =========================================================
// Huecos del menu
// =========================================================
test('slotKeys de 3 dias tiene 6 huecos, de 0-comida a 2-cena', () => {
  const keys = Planner.slotKeys({ days: 3 });
  assert.eq(keys.length, 6);
  assert.eq([keys[0], keys[5]], ['0-comida', '2-cena']);
});

test('slotKeys empezando por la cena no incluye la comida del primer dia', () => {
  const keys = Planner.slotKeys({ days: 3, firstMeal: 'cena' });
  assert.eq(keys.length, 5);
  assert.ok(!keys.includes('0-comida'));
  assert.eq(keys[0], '0-cena');
});

// =========================================================
// Crear y rellenar el menu
// =========================================================
test('newMenu rellena todos los huecos (7 dias x comida y cena)', () => {
  const menu = make(dishes(...'abcdefgh'));
  assert.eq(Object.keys(menu.plan).length, 14);
  assert.ok(menu.plan['0-comida'] && menu.plan['6-cena']);
});

test('newMenu conserva los datos del menu', () => {
  const menu = make(dishes('a', 'b'), { days: 2, startDate: '2026-03-09', firstMeal: 'cena', exclusions: [menuNo('x')] });
  assert.eq([menu.days, menu.startDate, menu.firstMeal], [2, '2026-03-09', 'cena']);
  assert.eq(menu.exclusions, [menuNo('x')]);
});

test('newMenu de 1 dia empezando por la cena tiene un solo hueco', () => {
  const menu = make(dishes('a', 'b'), { days: 1, firstMeal: 'cena' });
  assert.eq(Object.keys(menu.plan), ['0-cena']);
});

test('newMenu de 14 dias tiene 28 huecos', () => {
  assert.eq(Object.keys(make(dishes(...'abcdefgh'), { days: 14, rng: Math.random }).plan).length, 28);
});

test('newMenu sin platos deja el plan vacio sin errores', () => {
  assert.eq(make([]).plan, {});
});

test('newMenu no repite plato mientras queden platos sin usar', () => {
  const menu = make(dishes(...'abcdefghijklmn'), { rng: Math.random });
  assert.eq(new Set(ids(menu.plan)).size, 14);
});

test('newMenu repite platos solo cuando hay menos platos que huecos', () => {
  const menu = make(dishes('a', 'b', 'c'), { rng: Math.random });
  assert.eq(Object.keys(menu.plan).length, 14);
  assert.ok(ids(menu.plan).every(id => ['a', 'b', 'c'].includes(id)));
});

test('fillMenu respeta los huecos que ya tenian plato', () => {
  const menu = Planner.fillMenu({
    dishes: dishes('a', 'b', 'c'),
    menu: menuOf({ '2-cena': { id: 'x', name: 'Pizza manual' } }),
    rng: firstRng
  });
  assert.eq(menu.plan['2-cena'], { id: 'x', name: 'Pizza manual' });
  assert.eq(Object.keys(menu.plan).length, 14);
});

test('fillMenu no modifica el menu recibido', () => {
  const original = menuOf({ '0-comida': entry('a') });
  Planner.fillMenu({ dishes: dishes('a', 'b'), menu: original, rng: firstRng });
  assert.eq(original, menuOf({ '0-comida': entry('a') }));
});

// =========================================================
// Exclusiones
// =========================================================
test('newMenu no usa un plato excluido de todo el menu', () => {
  const menu = make(dishes('a', 'b', 'c'), { exclusions: [menuNo('a')], rng: Math.random });
  assert.ok(!ids(menu.plan).includes('a'));
  assert.eq(Object.keys(menu.plan).length, 14);
});

test('newMenu no usa un plato excluido solo ese dia, pero si otros dias', () => {
  const menu = make(dishes('a', 'b'), { exclusions: [dayNo(2, 'a')], rng: Math.random });
  assert.eq([menu.plan['2-comida'].id, menu.plan['2-cena'].id], ['b', 'b']);
  assert.ok(ids(menu.plan).includes('a'));
});

test('newMenu excluye por ingrediente (platos que lo contengan)', () => {
  const list = [dish('pasta', ['pasta', 'tomate']), dish('ensalada', ['lechuga', 'Tomate']), dish('arroz', ['arroz'])];
  const menu = make(list, { exclusions: [{ scope: 'menu', ingredient: ' TOMATE ' }], rng: Math.random });
  assert.eq([...new Set(ids(menu.plan))], ['arroz']);
});

test('newMenu deja el hueco vacio si todos los platos estan excluidos ese dia', () => {
  const menu = make(dishes('a'), { exclusions: [dayNo(0, 'a')] });
  assert.ok(!menu.plan['0-comida'] && !menu.plan['0-cena']);
  assert.ok(menu.plan['1-comida']);
});

test('excludeAndReplace sustituye los platos planificados que quedan excluidos', () => {
  const d = dishes('a', 'b', 'c');
  const next = Planner.excludeAndReplace({ dishes: d, menu: make(d), exclusion: menuNo('a'), rng: firstRng });
  assert.ok(!ids(next.plan).includes('a'));
  assert.eq(Object.keys(next.plan).length, 14);
});

test('excludeAndReplace no toca los huecos que no estaban afectados', () => {
  const menu = menuOf({ '0-comida': entry('a'), '0-cena': entry('b') });
  const next = Planner.excludeAndReplace({ dishes: dishes('a', 'b', 'c'), menu, exclusion: menuNo('a'), rng: firstRng });
  assert.eq(next.plan['0-cena'], entry('b'));
  assert.ok(next.plan['0-comida'].id !== 'a');
});

test('excludeAndReplace con exclusion de dia solo afecta a ese dia', () => {
  const menu = menuOf({ '1-comida': entry('a'), '2-comida': entry('a') });
  const next = Planner.excludeAndReplace({ dishes: dishes('a', 'b'), menu, exclusion: dayNo(2, 'a'), rng: firstRng });
  assert.eq(next.plan['1-comida'].id, 'a');
  assert.eq(next.plan['2-comida'].id, 'b');
});

test('excludeAndReplace acumula exclusiones sin mutar las originales', () => {
  const menu = menuOf({}, { exclusions: [menuNo('x')] });
  const next = Planner.excludeAndReplace({ dishes: dishes('a', 'b'), menu, exclusion: menuNo('a'), rng: firstRng });
  assert.eq(next.exclusions, [menuNo('x'), menuNo('a')]);
  assert.eq(menu.exclusions, [menuNo('x')]);
});

test('excludeAndReplace vacia el hueco si no hay alternativa valida', () => {
  const menu = menuOf({ '0-comida': entry('a') });
  const next = Planner.excludeAndReplace({ dishes: dishes('a'), menu, exclusion: dayNo(0, 'a'), rng: firstRng });
  assert.ok(!next.plan['0-comida']);
});

// =========================================================
// Edicion: cambiar un hueco o regenerar un dia
// =========================================================
test('rerollSlot da un plato distinto al que habia', () => {
  const menu = menuOf({ '1-cena': entry('a') });
  const next = Planner.rerollSlot({ dishes: dishes('a', 'b', 'c'), menu, day: 1, slot: 'cena', rng: firstRng });
  assert.ok(next.plan['1-cena'].id !== 'a');
});

test('rerollSlot respeta las exclusiones', () => {
  const menu = menuOf({ '1-cena': entry('a') }, { exclusions: [menuNo('b')] });
  const next = Planner.rerollSlot({ dishes: dishes('a', 'b', 'c'), menu, day: 1, slot: 'cena', rng: firstRng });
  assert.eq(next.plan['1-cena'].id, 'c');
});

test('rerollSlot mantiene el plato si no hay alternativa', () => {
  const menu = menuOf({ '1-cena': entry('a') });
  const next = Planner.rerollSlot({ dishes: dishes('a'), menu, day: 1, slot: 'cena', rng: firstRng });
  assert.eq(next.plan['1-cena'], entry('a'));
});

test('rerollSlot solo cambia ese hueco y no muta el menu original', () => {
  const menu = menuOf({ '0-comida': entry('a'), '1-cena': entry('b') });
  const next = Planner.rerollSlot({ dishes: dishes('a', 'b', 'c'), menu, day: 1, slot: 'cena', rng: firstRng });
  assert.eq(next.plan['0-comida'], entry('a'));
  assert.eq(menu.plan['1-cena'], entry('b'));
});

test('regenerateDay cambia los dos platos del dia y deja el resto igual', () => {
  const menu = menuOf({ '0-comida': entry('a'), '0-cena': entry('b'), '1-comida': entry('c') });
  const next = Planner.regenerateDay({ dishes: dishes('a', 'b', 'c', 'd', 'e'), menu, day: 0, rng: firstRng });
  assert.ok(!['a', 'b'].includes(next.plan['0-comida'].id));
  assert.ok(!['a', 'b'].includes(next.plan['0-cena'].id));
  assert.eq(next.plan['1-comida'], entry('c'));
});

test('regenerateDay respeta las exclusiones del dia', () => {
  const menu = menuOf({}, { exclusions: [dayNo(3, 'a'), dayNo(3, 'b')] });
  const next = Planner.regenerateDay({ dishes: dishes('a', 'b', 'c', 'd'), menu, day: 3, rng: firstRng });
  assert.ok(!['a', 'b'].includes(next.plan['3-comida'].id));
  assert.ok(!['a', 'b'].includes(next.plan['3-cena'].id));
});

test('regenerateDay en un menu que empieza por la cena no crea la comida del primer dia', () => {
  const menu = menuOf({ '0-cena': entry('a') }, { firstMeal: 'cena' });
  const next = Planner.regenerateDay({ dishes: dishes('a', 'b', 'c'), menu, day: 0, rng: firstRng });
  assert.ok(!next.plan['0-comida']);
  assert.ok(next.plan['0-cena'].id !== 'a');
});

// =========================================================
// Menu con sentido: puntuacion por ingredientes
// =========================================================
const withMain = (id, main, extra = []) => dish(id, [{ name: main, qty: 2 }, ...extra]);

test('newMenu evita juntar platos con el mismo ingrediente principal', () => {
  const list = [
    withMain('p1', 'pollo'), withMain('p2', 'pollo'), withMain('p3', 'pollo'),
    withMain('q1', 'atun'), withMain('q2', 'pasta'), withMain('q3', 'huevo')
  ];
  for (let seed = 1; seed <= 30; seed++) {
    const menu = make(list, { days: 2, rng: seededRng(seed) });
    const pollos = ids(menu.plan).filter(id => id.startsWith('p')).length;
    assert.ok(pollos <= 1, `semilla ${seed}: ${pollos} platos de pollo en 4 comidas`);
  }
});

test('newMenu prefiere un plato sin ingredientes compartidos con el anterior', () => {
  const list = [withMain('p1', 'pollo', ['arroz']), withMain('p2', 'pollo', ['patata']), withMain('p3', 'atun', ['tomate'])];
  const menu = make(list, { days: 1, rng: firstRng });
  assert.eq([menu.plan['0-comida'].id, menu.plan['0-cena'].id], ['p1', 'p3']);
});

test('repetir un plato pesa mas que compartir ingredientes', () => {
  const menu = make([dish('a', ['x']), dish('b', ['x'])], { days: 1, rng: firstRng });
  assert.eq([menu.plan['0-comida'].id, menu.plan['0-cena'].id], ['a', 'b']);
});

test('platos sin ingredientes se pueden elegir sin errores', () => {
  const menu = make([dish('a'), dish('b'), dish('c')], { rng: seededRng(7) });
  assert.eq(Object.keys(menu.plan).length, 14);
  assert.ok(Object.values(menu.plan).every(e => e.id && e.name));
});

test('con platos de sobra, comidas contiguas nunca comparten ingrediente principal', () => {
  const groups = ['pollo', 'atun', 'pasta', 'huevo', 'lenteja', 'arroz'];
  const list = groups.flatMap(g => [1, 2, 3, 4].map(n => withMain(`${g}${n}`, g, [`extra-${g}${n}`])));
  const byId = Object.fromEntries(list.map(d => [d.id, d]));
  for (let seed = 1; seed <= 50; seed++) {
    const menu = make(list, { rng: seededRng(seed) });
    const keys = Planner.slotKeys({ days: 7 });
    for (let i = 1; i < keys.length; i++) {
      const a = Planner.mainIngredient(byId[menu.plan[keys[i - 1]].id]);
      const b = Planner.mainIngredient(byId[menu.plan[keys[i]].id]);
      assert.ok(a !== b, `semilla ${seed}: ${keys[i - 1]} y ${keys[i]} comparten ${a}`);
    }
  }
});

test('regenerar un dia tambien evita el principal de las comidas vecinas', () => {
  const list = [withMain('p1', 'pollo'), withMain('p2', 'pollo'), withMain('q1', 'atun'), withMain('r1', 'pasta')];
  const menu = menuOf({ '0-cena': entry('p1'), '1-cena': entry('r1') });
  for (let seed = 1; seed <= 20; seed++) {
    const next = Planner.regenerateDay({ dishes: list, menu, day: 1, rng: seededRng(seed) });
    assert.ok(next.plan['1-comida'].id !== 'p2', `semilla ${seed}: pollo pegado al pollo de la cena anterior`);
  }
});
