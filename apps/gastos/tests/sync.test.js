// Buzón solo para su dueño, fusión de dos dispositivos y corregir un gasto (lógica pura)
const Y = Planner;
const ye = (id, date, extra = {}) => ({ id, amount: 1, merchant: 'X', category: 'Otros', date, ...extra });
const yst = (o = {}) => ({ expenses: [], subs: [], budget: 1000, categories: ['Ocio', 'Otros'], removed: [], ...o });

test('el buzón de pagos solo lo recoge la cuenta dueña', () => {
  assert.eq(Y.canCollectInbox('abc', 'abc'), true);
  assert.eq(Y.canCollectInbox('abc', 'otra'), false);
  assert.eq(Y.canCollectInbox('', 'abc'), false);
  assert.eq(Y.canCollectInbox(undefined, undefined), false);
});

test('cada cuenta recoge su propio buzón; la dueña, además, el buzón antiguo', () => {
  assert.eq(Y.inboxSources('abc', 'abc'), ['users/abc/gastosInbox', 'gastosInbox']);
  assert.eq(Y.inboxSources('abc', 'otra'), ['users/otra/gastosInbox']);
  assert.eq(Y.inboxSources('', 'otra'), ['users/otra/gastosInbox']);
});

test('la clave del buzón: 24 letras y cifras hexadecimales', () => {
  assert.eq(Y.isInboxKey('0f945f37b48a84aa8d37136c'), true);
  assert.eq(Y.isInboxKey('0f945f37'), false);
  assert.eq(Y.isInboxKey('ZZ945f37b48a84aa8d37136c'), false);
  assert.eq(Y.isInboxKey(null), false);
  assert.eq(Y.inboxKeyFrom([0, 15, 255, 16, 1, 2, 3, 4, 5, 6, 7, 8]), '000fff100102030405060708');
});

test('el texto y la dirección del Atajo llevan la clave y la cuenta de cada uno', () => {
  assert.eq(Y.shortcutBody('abc'), '{"fields":{"k":{"stringValue":"abc"},"amount":{"stringValue":"[Importe]"},"merchant":{"stringValue":"[Comercio]"}}}');
  assert.eq(Y.shortcutUrl('mi-proy', 'u1', 'KEY'), 'https://firestore.googleapis.com/v1/projects/mi-proy/databases/(default)/documents/users/u1/gastosInbox?key=KEY');
});

test('trackRemoved apunta los ids que desaparecen y olvida los que vuelven', () => {
  assert.eq(Y.trackRemoved([], ['a', 'b'], ['b', 'c']), ['a']);
  assert.eq(Y.trackRemoved(['a', 'z'], ['b'], ['a', 'b']), ['z']);
  assert.eq(Y.trackRemoved(undefined, [], []), []);
  const many = Array.from({ length: 1200 }, (_, i) => 'x' + i);
  const out = Y.trackRemoved(many, ['nuevo'], []);
  assert.eq([out.length, out[out.length - 1]], [1000, 'nuevo']); // con tope: se quedan los últimos
});

test('mergeStates junta los gastos de los dos dispositivos sin perder ninguno', () => {
  const local = yst({ expenses: [ye('l1', '2026-11-08')], subs: [{ id: 's1', name: 'Netflix', amount: 10 }] });
  const remote = yst({ expenses: [ye('r1', '2026-11-09'), ye('r0', '2026-10-01')], subs: [{ id: 's2', name: 'Spotify', amount: 5 }] });
  const m = Y.mergeStates(local, remote, true);
  assert.eq(m.expenses.map(e => e.id), ['r1', 'l1', 'r0']); // del más reciente al más antiguo
  assert.eq(m.subs.map(s => s.id).sort(), ['s1', 's2']);
});

test('mergeStates: lo borrado en un dispositivo no vuelve desde el otro', () => {
  const local = yst({ expenses: [ye('a', '2026-11-08'), ye('b', '2026-11-08')], removed: ['c'] });
  const remote = yst({ expenses: [ye('b', '2026-11-08'), ye('c', '2026-11-07')], subs: [{ id: 's1', name: 'N', amount: 1 }], removed: ['a', 's9'] });
  const m = Y.mergeStates(local, remote, false);
  assert.eq(m.expenses.map(e => e.id), ['b']);
  assert.eq(m.removed.slice().sort(), ['a', 'c', 's9']);
});

test('mergeStates: si un gasto está en los dos, gana el de la copia más nueva; también presupuesto y categorías', () => {
  const local = yst({ expenses: [ye('a', '2026-11-08', { category: 'Ocio' })], budget: 800, categories: ['Ocio', 'Viajes', 'Otros'] });
  const remote = yst({ expenses: [ye('a', '2026-11-08', { category: 'Otros' })], budget: 1200 });
  const nube = Y.mergeStates(local, remote, true);
  assert.eq([nube.expenses[0].category, nube.budget, nube.categories.join()], ['Otros', 1200, 'Ocio,Otros']);
  const movil = Y.mergeStates(local, remote, false);
  assert.eq([movil.expenses[0].category, movil.budget, movil.categories.join()], ['Ocio', 800, 'Ocio,Viajes,Otros']);
});

test('mergeStates: un gasto con una categoría que ya no existe pasa a Otros', () => {
  const local = yst({ expenses: [ye('a', '2026-11-08', { category: 'Viajes' })], categories: ['Viajes', 'Otros'] });
  const m = Y.mergeStates(local, yst(), true);
  assert.eq(m.expenses[0].category, 'Otros');
});

test('parseCloudState conserva la lista de borrados', () => {
  assert.eq(Y.parseCloudState(JSON.stringify({ expenses: [], removed: ['a', 7, '', 'b'] })).removed, ['a', 'b']);
  assert.eq(Y.parseCloudState('{}').removed, []);
});

test('editExpense corrige importe, nombre y fecha; rechaza datos no válidos', () => {
  const list = [ye('a', '2026-11-08'), ye('b', '2026-11-08')];
  const out = Y.editExpense(list, 'a', { amount: 12.5, merchant: '  Bar Pepe ', date: '2026-11-01' });
  assert.eq([out[0].amount, out[0].merchant, out[0].date, out[1].merchant], [12.5, 'Bar Pepe', '2026-11-01', 'X']);
  assert.eq(list[0].amount, 1);
  assert.eq(Y.editExpense(list, 'a', { amount: 0, merchant: 'Bar', date: '2026-11-01' }), null);
  assert.eq(Y.editExpense(list, 'a', { amount: 5, merchant: '   ', date: '2026-11-01' }), null);
  assert.eq(Y.editExpense(list, 'a', { amount: 5, merchant: 'Bar', date: '2026-02-30' }), null);
  assert.eq(Y.editExpense(list, 'zz', { amount: 5, merchant: 'Bar', date: '2026-11-01' }), null);
});
