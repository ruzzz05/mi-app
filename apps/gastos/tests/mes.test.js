// Estadísticas del mes con presupuesto, agrupar por día, categorías, CSV y pagos por revisar (lógica pura)
const M = Planner;
const ex = (amount, date, extra = {}) => ({ id: date + amount, merchant: 'X', category: 'Otros', amount, date, ...extra });

test('monthStats del mes en curso: gastado, queda, porcentaje, ritmo y previsión', () => {
  const s = M.monthStats([ex(300, '2026-11-05'), ex(100, '2026-11-20'), ex(999, '2026-10-30')], '2026-11', 1000, '2026-11-20');
  assert.eq([s.spent, s.left, s.pct, s.days, s.perDay, s.forecast, s.closed, s.restDays], [400, 600, 40, 20, 20, 600, false, 10]);
});

test('monthStats de un mes pasado: cerrado, sin previsión y con todos los días del mes', () => {
  const s = M.monthStats([ex(930, '2026-10-30')], '2026-10', 1000, '2026-11-20');
  assert.eq([s.spent, s.left, s.days, s.perDay, s.forecast, s.closed, s.restDays], [930, 70, 31, 30, null, true, 0]);
});

test('monthStats si te pasas del presupuesto: queda en negativo y el porcentaje no pasa de 100', () => {
  const s = M.monthStats([ex(1200, '2026-11-10')], '2026-11', 1000, '2026-11-20');
  assert.eq([s.left, s.pct, s.over], [-200, 100, true]);
});

test('monthStats sin gastos y con el primer día del mes', () => {
  const s = M.monthStats([], '2026-11', 1000, '2026-11-01');
  assert.eq([s.spent, s.left, s.pct, s.perDay, s.forecast], [0, 1000, 0, 0, 0]);
});

test('los pagos por revisar no cuentan en las cifras hasta confirmarlos', () => {
  const list = [ex(100, '2026-11-05'), ex(50, '2026-11-06', { pending: true })];
  assert.eq(M.monthStats(list, '2026-11', 1000, '2026-11-20').spent, 100);
  assert.eq(M.dailySeries(M.confirmed(list), '2026-11')[5], 0);
  assert.eq(M.pendingList(list).length, 1);
  assert.eq(M.confirmed(list).length, 1);
});

test('groupByDay agrupa por día, del más reciente al más antiguo, con etiqueta y total', () => {
  const g = M.groupByDay([ex(10, '2026-11-20'), ex(5, '2026-11-20'), ex(7, '2026-11-19'), ex(3, '2026-11-12')], '2026-11-20');
  assert.eq(g.map(x => [x.label, x.total, x.items.length]), [['Hoy', 15, 2], ['Ayer', 7, 1], ['12 nov', 3, 1]]);
});

test('groupByDay ignora los pagos por revisar', () => {
  assert.eq(M.groupByDay([ex(10, '2026-11-20', { pending: true })], '2026-11-20'), []);
});

test('categoryRows reparte el mes por categoría con su presupuesto, del que más gasta al que menos', () => {
  const list = [ex(300, '2026-11-02', { category: 'Supermercado' }), ex(50, '2026-11-03', { category: 'Ocio' }), ex(20, '2026-10-03', { category: 'Ocio' })];
  const r = M.categoryRows(list, '2026-11', { Supermercado: 400, Ocio: 100, Otros: 50 });
  assert.eq(r.map(x => [x.category, x.spent, x.budget, x.pct, x.over]), [['Supermercado', 300, 400, 75, false], ['Ocio', 50, 100, 50, false], ['Otros', 0, 50, 0, false]]);
});

test('categoryRows marca las categorías que pasan de su presupuesto y topa el porcentaje en 100', () => {
  const r = M.categoryRows([ex(130, '2026-11-02', { category: 'Ocio' })], '2026-11', { Ocio: 100 });
  assert.eq([r[0].pct, r[0].over], [100, true]);
});

test('categoryRows incluye categorías con gasto aunque no tengan presupuesto', () => {
  const r = M.categoryRows([ex(10, '2026-11-02', { category: 'Salud' })], '2026-11', {});
  assert.eq([r[0].category, r[0].spent, r[0].budget, r[0].pct], ['Salud', 10, 0, 0]);
});

test('toCSV escribe cabecera y una fila por gasto con ; y coma decimal', () => {
  const csv = M.toCSV([ex(12.5, '2026-11-02', { merchant: 'Mercadona', category: 'Supermercado' })]);
  assert.eq(csv.split('\n'), ['fecha;comercio;categoria;importe', '2026-11-02;Mercadona;Supermercado;12,50']);
});

test('toCSV protege comillas y puntos y coma dentro del comercio y no incluye pendientes', () => {
  const csv = M.toCSV([ex(1, '2026-11-02', { merchant: 'Bar "El; Sol"' }), ex(2, '2026-11-03', { pending: true })]);
  assert.eq(csv.split('\n').length, 2);
  assert.ok(csv.includes('"Bar ""El; Sol"""'));
});

test('confirmPending quita la marca de pendiente y permite cambiar la categoría', () => {
  const list = [ex(5, '2026-11-02', { id: 'a', pending: true, category: 'Otros' })];
  const out = M.confirmPending(list, 'a', 'Ocio');
  assert.eq([out[0].pending, out[0].category], [undefined, 'Ocio']);
  assert.eq(M.confirmPending(list, 'zzz', 'Ocio'), list);
});

test('DEFAULT_BUDGETS tiene presupuesto para las categorías de serie', () => {
  ['Supermercado', 'Restaurantes', 'Transporte', 'Suscripciones', 'Ocio', 'Salud', 'Hogar', 'Otros'].forEach(c => assert.ok(M.DEFAULT_BUDGETS[c] > 0, c));
  assert.ok(M.DEFAULT_MONTH_BUDGET > 0);
});

// ---- Pagos que llegan por la dirección (Atajos de iOS abre la app con el pago)
const TS = Date.UTC(2026, 10, 21, 12);
test('fromQuery convierte ?pago=&comercio= en un gasto por revisar', () => {
  const e = M.fromQuery('?pago=12,50&comercio=Mercadona', TS);
  assert.eq([e.amount, e.merchant, e.date, e.pending, e.source, e.category], [12.5, 'Mercadona', '2026-11-21', true, 'auto', 'Supermercado']);
});

test('fromQuery decodifica espacios y símbolos del comercio y acepta el importe con €', () => {
  const e = M.fromQuery('?pago=3%2C20%20%E2%82%AC&comercio=Caf%C3%A9%20Sol', TS);
  assert.eq([e.amount, e.merchant], [3.2, 'Café Sol']);
});

test('fromQuery sin comercio usa el nombre genérico', () => {
  assert.eq(M.fromQuery('?pago=5', TS).merchant, 'Pago con tarjeta');
});

test('fromQuery devuelve null si no hay pago o no es un importe', () => {
  assert.eq(M.fromQuery('', TS), null);
  assert.eq(M.fromQuery('?comercio=X', TS), null);
  assert.eq(M.fromQuery('?pago=abc', TS), null);
  assert.eq(M.fromQuery('?pago=0', TS), null);
});

// ---- Importes en euros con punto de miles también en 4 cifras
test('euros pone punto de miles desde 4 cifras y coma decimal', () => {
  assert.eq(M.euros(1000, 0), '1.000 €');
  assert.eq(M.euros(1234.5, 2), '1.234,50 €');
  assert.eq(M.euros(1234567.891, 2), '1.234.567,89 €');
  assert.eq(M.euros(0.5, 2), '0,50 €');
  assert.eq(M.euros(999, 0), '999 €');
});

test('euros redondea y respeta el signo', () => {
  assert.eq(M.euros(-5.4, 0), '-5 €');
  assert.eq(M.euros(899.6, 0), '900 €');
  assert.eq(M.euros(-1500, 2), '-1.500,00 €');
});
