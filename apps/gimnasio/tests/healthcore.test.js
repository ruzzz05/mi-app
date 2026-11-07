// Lógica pura de la conexión con Google Health (sin red ni DOM)
const H = window.HealthCore;

test('todayRange: de la medianoche local de hoy a la de mañana', () => {
  const now = new Date(2026, 1, 10, 15, 30).getTime();
  const r = H.todayRange(now);
  assert.eq(new Date(r.startTime).getTime(), new Date(2026, 1, 10, 0, 0).getTime());
  assert.eq(new Date(r.endTime).getTime(), new Date(2026, 1, 11, 0, 0).getTime());
  assert.ok(/Z$|[+-]\d\d:\d\d$/.test(r.startTime), 'formato con zona horaria: ' + r.startTime);
});

test('sumRollup: suma los campos *Sum de todos los puntos (números o texto)', () => {
  assert.eq(H.sumRollup({ rollupDataPoints: [{ steps: { countSum: '1200' } }, { steps: { countSum: 345 } }] }), 1545);
  assert.eq(H.sumRollup({ rollupDataPoints: [{ totalCalories: { kcalSum: 1800.5 } }] }), 1800.5);
  assert.eq(H.sumRollup({ rollupDataPoints: [{ activeEnergyBurned: { caloriesSum: '250', otro: 5 } }] }), 250);
});

test('sumRollup: sin datos o con respuestas raras devuelve null, no NaN', () => {
  assert.eq(H.sumRollup({}), null);
  assert.eq(H.sumRollup({ rollupDataPoints: [] }), null);
  assert.eq(H.sumRollup(null), null);
  assert.eq(H.sumRollup({ rollupDataPoints: [{ steps: {} }, { steps: { countSum: 'abc' } }] }), null);
  assert.eq(H.sumRollup({ rollupDataPoints: [{ steps: { countSum: 0 } }] }), 0);
});

test('tokenValid: vale hasta un minuto antes de caducar', () => {
  const now = 1000000;
  assert.eq(H.tokenValid({ token: 'x', exp: now + 120000 }, now), true);
  assert.eq(H.tokenValid({ token: 'x', exp: now + 30000 }, now), false);
  assert.eq(H.tokenValid({ token: '', exp: now + 999999 }, now), false);
  assert.eq(H.tokenValid(null, now), false);
});

test('summaryFresh: mismo día y menos de 2 minutos', () => {
  const now = new Date(2026, 1, 10, 12, 0).getTime();
  assert.eq(H.summaryFresh({ day: '2026-02-10', at: now - 60000 }, '2026-02-10', now), true);
  assert.eq(H.summaryFresh({ day: '2026-02-10', at: now - 3 * 60000 }, '2026-02-10', now), false);
  assert.eq(H.summaryFresh({ day: '2026-02-09', at: now - 1000 }, '2026-02-10', now), false);
  assert.eq(H.summaryFresh(null, '2026-02-10', now), false);
});
