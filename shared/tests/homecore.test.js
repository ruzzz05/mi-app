// Portada: el dato del día de cada app, sacado de lo que cada una guarda en el móvil (lógica pura)
const H = HomeCore;
const at = (h) => new Date(2026, 10, 9, h, 0, 0);   // 9 de noviembre de 2026
const gastos = o => JSON.stringify({ expenses: [], subs: [], budget: 1000, updatedAt: 5, ...o });
const menu = { startDate: '2026-11-09', firstMeal: 'comida', days: 2, exclusions: [], plan: { '0-comida': { id: null, name: 'Lentejas' }, '0-cena': { empty: true } } };
const comidas = m => JSON.stringify({ dishes: [], menu: m, seedPurged: true });

test('gastos: lo que queda del presupuesto este mes, sin contar los pagos por revisar', () => {
  const raw = gastos({ expenses: [{ id: 'a', amount: 660.4, date: '2026-11-03', category: 'Otros' }, { id: 'b', amount: 50, date: '2026-11-04', category: 'Otros', pending: true }, { id: 'c', amount: 99, date: '2026-10-30', category: 'Otros' }] });
  assert.eq(H.notes({ gastos: raw, now: at(10) }).gastos, 'Te quedan 340 € este mes');
});

test('gastos: si te pasas lo dice, y sin datos no dice nada', () => {
  const raw = gastos({ budget: 100, expenses: [{ id: 'a', amount: 130, date: '2026-11-03', category: 'Otros' }] });
  assert.eq(H.notes({ gastos: raw, now: at(10) }).gastos, 'Te has pasado 30 € este mes');
  assert.eq(H.notes({ gastos: null, now: at(10) }).gastos, null);
  assert.eq(H.notes({ gastos: 'roto{', now: at(10) }).gastos, null);
  assert.eq(H.notes({ gastos: JSON.stringify({ expenses: [], subs: [] }), now: at(10) }).gastos, null);
});

test('comidas: qué toca ahora según el menú', () => {
  assert.eq(H.notes({ comidas: comidas(menu), now: at(13) }).comidas, 'Comida: Lentejas');
  assert.eq(H.notes({ comidas: comidas(menu), now: at(20) }).comidas, null);            // cena dejada vacía
  assert.eq(H.notes({ comidas: comidas(null), now: at(13) }).comidas, null);            // sin menú
  assert.eq(H.notes({ comidas: comidas({ ...menu, startDate: '2026-11-01' }), now: at(13) }).comidas, null); // menú terminado
  assert.eq(H.notes({ comidas: 'roto{', now: at(13) }).comidas, null);
});

test('gimnasio: avisa del entreno en curso', () => {
  const active = JSON.stringify({ id: 'x', startedAt: 1, routineName: 'Pierna', exercises: [] });
  assert.eq(H.notes({ gymActive: active, now: at(10) }).gimnasio, 'Entreno en curso: Pierna');
  assert.eq(H.notes({ gymActive: JSON.stringify({ id: 'x', startedAt: 1, exercises: [] }), now: at(10) }).gimnasio, 'Entreno en curso');
  assert.eq(H.notes({ gymActive: null, now: at(10) }).gimnasio, null);
  assert.eq(H.notes({ gymActive: '{}', now: at(10) }).gimnasio, null);
});
