// Suscripciones con fecha de fin y datos para los gráficos (lógica pura)
const F = Planner;
const mk = (o = {}) => ({ id: 's', name: 'Disney+', amount: 10, period: 'month', anchor: '2026-01-15', ...o });

// ---- fecha de fin ("until": último día en que la suscripción sigue vigente)
test('isActive: pausada o terminada no cuentan; sin fecha de fin sigue activa', () => {
  assert.eq(F.isActive(mk(), '2026-06-01'), true);
  assert.eq(F.isActive(mk({ paused: true }), '2026-06-01'), false);
  assert.eq(F.isActive(mk({ until: '2026-11-30' }), '2026-11-30'), true);
  assert.eq(F.isActive(mk({ until: '2026-11-30' }), '2026-12-01'), false);
});

test('nextCharge devuelve null si el siguiente cobro cae después de la fecha de fin', () => {
  const s = mk({ until: '2026-11-30' });
  assert.eq(F.nextCharge(s, '2026-11-10'), '2026-11-15');
  assert.eq(F.nextCharge(s, '2026-11-16'), null);
});

test('el cobro del mismo día de la fecha de fin todavía se hace', () => {
  assert.eq(F.nextCharge(mk({ until: '2026-11-15' }), '2026-11-15'), '2026-11-15');
});

test('upcomingCharges ignora las suscripciones terminadas', () => {
  const up = F.upcomingCharges([mk({ until: '2026-11-30' }), mk({ id: 'b', name: 'B', anchor: '2026-12-02' })], '2026-12-01', 30);
  assert.eq(up.map(u => u.sub.name), ['B']);
});

test('subscriptionTotals con fecha de hoy no suma las terminadas', () => {
  const subs = [mk({ amount: 10 }), mk({ id: 'b', amount: 20, until: '2026-11-30' })];
  assert.eq(F.subscriptionTotals(subs, '2026-12-05'), { monthly: 10, yearly: 120, count: 1 });
  assert.eq(F.subscriptionTotals(subs, '2026-11-05').count, 2);
});

test('remainingCharges cuenta los cobros que quedan hasta la fecha de fin', () => {
  assert.eq(F.remainingCharges(mk({ until: '2026-11-30', anchor: '2026-08-15' }), '2026-09-20'), 2); // 15 oct y 15 nov
  assert.eq(F.remainingCharges(mk(), '2026-09-20'), null); // sin fin: no se puede contar
});

// ---- datos para los gráficos
test('daysInMonth', () => {
  assert.eq(F.daysInMonth('2026-02'), 28);
  assert.eq(F.daysInMonth('2024-02'), 29);
  assert.eq(F.daysInMonth('2026-12'), 31);
});

test('dailySeries da el total de cada día del mes', () => {
  const s = F.dailySeries([
    { amount: 10, date: '2026-02-01' }, { amount: 5, date: '2026-02-01' }, { amount: 7, date: '2026-02-28' }, { amount: 99, date: '2026-03-01' }
  ], '2026-02');
  assert.eq(s.length, 28);
  assert.eq([s[0], s[1], s[27]], [15, 0, 7]);
});

test('lastMonths devuelve n meses terminando en el indicado, con ceros', () => {
  const r = F.lastMonths([{ amount: 10, date: '2026-01-05' }, { amount: 4, date: '2025-12-31' }], '2026-02', 3);
  assert.eq(r, [{ month: '2025-12', total: 4 }, { month: '2026-01', total: 10 }, { month: '2026-02', total: 0 }]);
});

test('chargesInMonth lista los cobros de suscripciones del mes, respetando pausa y fin', () => {
  const subs = [
    mk({ id: 'a', name: 'A', anchor: '2026-01-15' }),
    mk({ id: 'b', name: 'B', anchor: '2026-01-20', until: '2026-11-30' }),
    mk({ id: 'c', name: 'C', anchor: '2026-01-10', paused: true }),
    mk({ id: 'd', name: 'D', anchor: '2027-01-10' })
  ];
  const dec = F.chargesInMonth(subs, '2026-12');
  assert.eq(dec.map(c => [c.sub.name, c.date]), [['A', '2026-12-15']]);
  const nov = F.chargesInMonth(subs, '2026-11');
  assert.eq(nov.map(c => [c.sub.name, c.date]), [['A', '2026-11-15'], ['B', '2026-11-20']]);
});

test('chargesInMonth con cobro anual solo aparece en su mes', () => {
  const y = mk({ period: 'year', anchor: '2025-05-02' });
  assert.eq(F.chargesInMonth([y], '2026-05').length, 1);
  assert.eq(F.chargesInMonth([y], '2026-06').length, 0);
});

test('projectMonth estima el cierre de mes por el ritmo diario', () => {
  assert.eq(F.projectMonth(100, '2026-02-14'), 200); // 7,14€/día * 28
  assert.eq(F.projectMonth(100, '2026-02-28'), 100);
  assert.eq(F.projectMonth(0, '2026-02-10'), 0);
});

test('shiftMonth avanza y retrocede meses', () => {
  assert.eq(F.shiftMonth('2026-01', -1), '2025-12');
  assert.eq(F.shiftMonth('2026-12', 1), '2027-01');
});
