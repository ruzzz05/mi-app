// Gastos y suscripciones (lógica pura, sin DOM)
const G = Planner;
const sub = (o = {}) => ({ id: 's', name: 'Netflix', amount: 12, period: 'month', anchor: '2026-01-15', ...o });

// ---- fechas
test('addMonths conserva el día y ajusta a fin de mes', () => {
  assert.eq(G.addMonths('2026-01-15', 1), '2026-02-15');
  assert.eq(G.addMonths('2026-01-31', 1), '2026-02-28');
  assert.eq(G.addMonths('2024-01-31', 1), '2024-02-29');
  assert.eq(G.addMonths('2026-11-30', 3), '2027-02-28');
});

test('addDays cruza meses y años', () => {
  assert.eq(G.addDays('2026-12-30', 3), '2027-01-02');
  assert.eq(G.daysBetween('2026-01-01', '2026-01-31'), 30);
});

// ---- coste de una suscripción
test('monthlyCost y yearlyCost normalizan por periodo', () => {
  assert.eq(G.yearlyCost(sub({ amount: 10, period: 'month' })), 120);
  assert.eq(G.monthlyCost(sub({ amount: 120, period: 'year' })), 10);
  assert.eq(G.yearlyCost(sub({ amount: 5, period: 'week' })), 260);
  assert.eq(G.monthlyCost(sub({ amount: 6, period: 'week' })), 26);
});

test('subscriptionTotals suma solo las activas', () => {
  const t = G.subscriptionTotals([sub({ amount: 10 }), sub({ id: 'b', amount: 120, period: 'year' }), sub({ id: 'c', amount: 99, paused: true })]);
  assert.eq(t, { monthly: 20, yearly: 240, count: 2 });
});

// ---- próximo cobro
test('nextCharge mensual: hoy cuenta, y se salta los meses pasados', () => {
  assert.eq(G.nextCharge(sub(), '2026-01-15'), '2026-01-15');
  assert.eq(G.nextCharge(sub(), '2026-03-20'), '2026-04-15');
  assert.eq(G.nextCharge(sub({ anchor: '2026-01-31' }), '2026-02-10'), '2026-02-28');
  assert.eq(G.nextCharge(sub({ anchor: '2026-01-31' }), '2026-03-01'), '2026-03-31');
});

test('nextCharge semanal y anual', () => {
  assert.eq(G.nextCharge(sub({ period: 'week', anchor: '2026-01-05' }), '2026-01-20'), '2026-01-26');
  assert.eq(G.nextCharge(sub({ period: 'year', anchor: '2025-03-10' }), '2026-03-11'), '2027-03-10');
});

test('nextCharge con anchor futuro es el propio anchor', () => {
  assert.eq(G.nextCharge(sub({ anchor: '2026-06-01' }), '2026-01-01'), '2026-06-01');
});

test('upcomingCharges: solo activas, dentro de los días pedidos y ordenadas', () => {
  const subs = [
    sub({ id: 'a', name: 'A', anchor: '2026-02-20' }),
    sub({ id: 'b', name: 'B', anchor: '2026-02-12' }),
    sub({ id: 'c', name: 'C', anchor: '2026-02-12', paused: true }),
    sub({ id: 'd', name: 'D', anchor: '2026-05-01' })
  ];
  const up = G.upcomingCharges(subs, '2026-02-10', 14);
  assert.eq(up.map(u => [u.sub.name, u.date, u.days]), [['B', '2026-02-12', 2], ['A', '2026-02-20', 10]]);
});

// ---- detectar suscripciones en los gastos
const exp = (merchant, amount, date) => ({ id: merchant + date, merchant, amount, date });

test('detectSubscriptions encuentra cobros mensuales repetidos', () => {
  const found = G.detectSubscriptions([
    exp('NETFLIX.COM', 12.99, '2026-01-03'), exp('Netflix.com', 12.99, '2026-02-03'), exp('netflix.com', 12.99, '2026-03-04'),
    exp('Mercadona', 30, '2026-01-05'), exp('Mercadona', 52, '2026-02-01')
  ], []);
  assert.eq(found.length, 1);
  assert.eq([found[0].period, found[0].amount, found[0].anchor, found[0].count], ['month', 12.99, '2026-04-04', 3]);
});

test('detectSubscriptions exige importes parecidos y al menos dos cobros', () => {
  assert.eq(G.detectSubscriptions([exp('Bar', 3, '2026-01-01'), exp('Bar', 9, '2026-02-01')], []), []);
  assert.eq(G.detectSubscriptions([exp('Spotify', 10, '2026-01-01')], []), []);
});

test('detectSubscriptions ignora las que ya están dadas de alta', () => {
  const found = G.detectSubscriptions([exp('Spotify', 10, '2026-01-01'), exp('Spotify', 10, '2026-02-01')], [sub({ name: 'spotify' })]);
  assert.eq(found, []);
});

test('detectSubscriptions detecta semanal y anual', () => {
  const w = G.detectSubscriptions([exp('Gym', 5, '2026-01-05'), exp('Gym', 5, '2026-01-12'), exp('Gym', 5, '2026-01-19')], []);
  assert.eq(w[0].period, 'week');
  const y = G.detectSubscriptions([exp('Dominio', 14, '2024-05-02'), exp('Dominio', 14, '2025-05-02')], []);
  assert.eq([y[0].period, y[0].anchor], ['year', '2026-05-02']);
});

// ---- entrada automática desde Atajos
test('parseInbox convierte lo que manda el Atajo en un gasto', () => {
  const e = G.parseInbox({ amount: '12,50 €', merchant: '  MERCADONA  ', card: 'Visa', ts: Date.UTC(2026, 0, 5, 10) });
  assert.eq([e.amount, e.merchant, e.date, e.source], [12.5, 'MERCADONA', '2026-01-05', 'auto']);
});

test('parseInbox acepta formatos de importe habituales y rechaza basura', () => {
  assert.eq(G.parseInbox({ amount: '1.234,56', merchant: 'x', ts: 0 }).amount, 1234.56);
  assert.eq(G.parseInbox({ amount: '3.5', merchant: 'x', ts: 0 }).amount, 3.5);
  assert.eq(G.parseInbox({ amount: '-4,00', merchant: 'x', ts: 0 }).amount, 4);
  assert.eq(G.parseInbox({ amount: 'abc', merchant: 'x', ts: 0 }), null);
  assert.eq(G.parseInbox({ amount: '0', merchant: 'x', ts: 0 }), null);
  assert.eq(G.parseInbox(null), null);
});

test('parseInbox sin comercio usa un nombre genérico', () => {
  assert.eq(G.parseInbox({ amount: '5', ts: 0 }).merchant, 'Pago con tarjeta');
});

test('matchSubscription une un gasto con su suscripción por nombre', () => {
  const subs = [sub({ id: 'n', name: 'Netflix' }), sub({ id: 's', name: 'Spotify' })];
  assert.eq(G.matchSubscription({ merchant: 'NETFLIX.COM AMSTERDAM' }, subs).id, 'n');
  assert.eq(G.matchSubscription({ merchant: 'Mercadona' }, subs), null);
});

test('guessCategory reconoce comercios habituales y cae en Otros', () => {
  assert.eq(G.guessCategory('MERCADONA VALENCIA'), 'Supermercado');
  assert.eq(G.guessCategory('Spotify AB'), 'Suscripciones');
  assert.eq(G.guessCategory('Bar Pepe'), 'Otros');
});

// ---- resumen del mes
test('monthSummary suma por categoría y total', () => {
  const s = G.monthSummary([
    { amount: 10, category: 'Comida', date: '2026-02-01' }, { amount: 5, category: 'Comida', date: '2026-02-20' },
    { amount: 7, category: 'Ocio', date: '2026-02-03' }, { amount: 99, category: 'Ocio', date: '2026-03-01' }
  ], '2026-02');
  assert.eq(s.total, 22);
  assert.eq(s.byCategory, [{ category: 'Comida', total: 15 }, { category: 'Ocio', total: 7 }]);
});

// ---- buzón en la nube (el Atajo escribe en Firestore; la app lo recoge)
const docIn = (o = {}) => ({
  name: 'projects/p/databases/(default)/documents/gastosInbox/AbC123',
  createTime: '2026-01-05T10:00:00.5Z',
  fields: { k: { stringValue: 's' }, amount: { stringValue: '12,50' }, merchant: { stringValue: 'MERCADONA' }, ...o }
});

test('fromInboxDoc convierte un documento del buzón en un gasto ya apuntado si la categoría se adivina', () => {
  const e = G.fromInboxDoc(docIn());
  assert.eq(e.id, 'in-AbC123');
  assert.eq(e.amount, 12.5);
  assert.eq(e.merchant, 'MERCADONA');
  assert.eq(e.date, '2026-01-05');
  assert.eq(e.category, 'Supermercado');
  assert.eq(e.pending, undefined);
});

test('fromInboxDoc deja por revisar los comercios sin categoría clara', () => {
  const e = G.fromInboxDoc(docIn({ merchant: { stringValue: 'Bar Pepe' } }));
  assert.eq(e.category, 'Otros');
  assert.eq(e.pending, true);
});

test('fromInboxDoc rechaza documentos sin importe válido', () => {
  assert.eq(G.fromInboxDoc(docIn({ amount: { stringValue: 'abc' } })), null);
  assert.eq(G.fromInboxDoc({ name: 'x/y/z', fields: {} }), null);
  assert.eq(G.fromInboxDoc(null), null);
});

// ---- categorías propias
test('addCategory añade al final, recorta y rechaza vacías o repetidas (sin mirar mayúsculas ni tildes)', () => {
  const base = ['Ocio', 'Otros'];
  assert.eq(G.addCategory(base, '  Mascotas '), ['Ocio', 'Otros', 'Mascotas']);
  assert.eq(G.addCategory(base, ''), null);
  assert.eq(G.addCategory(base, '   '), null);
  assert.eq(G.addCategory(base, 'ocio'), null);
  assert.eq(G.addCategory(['Café'], 'cafe'), null);
  assert.eq(G.addCategory(base, 'x'.repeat(25)), null);
});

test('removeCategory pasa sus gastos a Otros y no deja quitar Otros', () => {
  const ex = [{ id: 'a', category: 'Ocio', amount: 5 }, { id: 'b', category: 'Salud', amount: 7 }];
  const r = G.removeCategory(['Ocio', 'Salud', 'Otros'], ex, 'Ocio');
  assert.eq(r.categories, ['Salud', 'Otros']);
  assert.eq(r.expenses.map(e => e.category), ['Otros', 'Salud']);
  assert.eq(G.removeCategory(['Ocio', 'Otros'], ex, 'Otros'), null);
});
