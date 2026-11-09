// Categoría recordada por comercio: se deduce de los gastos ya apuntados y se aplica a todos los suyos (lógica pura)
const R = Planner;
const rx = (merchant, category, date, extra = {}) => ({ id: merchant + date, amount: 1, merchant, category, date, ...extra });
const RCATS = ['Supermercado', 'Ocio', 'Suscripciones', 'Otros'];

test('recuerda la categoría del gasto más reciente del comercio, aunque solo haya uno', () => {
  assert.eq(R.rememberedCategory([rx('Bar Pepe', 'Ocio', '2026-11-01')], 'bar  pépe ', RCATS), 'Ocio');
  assert.eq(R.rememberedCategory([rx('Bar Pepe', 'Otros', '2026-10-01'), rx('Bar Pepe', 'Ocio', '2026-11-01')], 'Bar Pepe', RCATS), 'Ocio');
  assert.eq(R.rememberedCategory([rx('Bar Pepe', 'Ocio', '2026-11-01'), rx('Bar Pepe', 'Otros', '2026-11-01', { id: 'b' })], 'Bar Pepe', RCATS), 'Ocio');
});

test('no recuerda: comercio distinto, sin historial, genérico, categoría borrada, por revisar o cobro de suscripción', () => {
  assert.eq(R.rememberedCategory([rx('Bar Pepe', 'Ocio', '2026-11-01')], 'Bar Pepe Centro', RCATS), null);
  assert.eq(R.rememberedCategory([], 'Bar Pepe', RCATS), null);
  assert.eq(R.rememberedCategory([rx('Gasto', 'Ocio', '2026-11-01')], 'Gasto', RCATS), null);
  assert.eq(R.rememberedCategory([rx('Pago con tarjeta', 'Ocio', '2026-11-01')], 'pago con tarjeta', RCATS), null);
  assert.eq(R.rememberedCategory([rx('Bar Pepe', 'Viajes', '2026-11-01')], 'Bar Pepe', RCATS), null);
  assert.eq(R.rememberedCategory([rx('Bar Pepe', 'Ocio', '2026-11-01', { pending: true })], 'Bar Pepe', RCATS), null);
  assert.eq(R.rememberedCategory([rx('Netflix', 'Suscripciones', '2026-11-05', { source: 'sub' }), rx('Netflix', 'Ocio', '2026-10-05')], 'Netflix', RCATS), 'Ocio');
});

test('setMerchantCategory cambia todos los gastos del comercio y ningún otro', () => {
  const list = [rx('Bar Pepe', 'Otros', '2026-11-01'), rx('BAR PEPE', 'Ocio', '2026-09-01', { pending: true }), rx('Cine', 'Ocio', '2026-11-01')];
  const out = R.setMerchantCategory(list, 'bar pepe', 'Supermercado');
  assert.eq(out.map(e => e.category), ['Supermercado', 'Supermercado', 'Ocio']);
  assert.eq(out[1].pending, true);
  assert.eq(list[0].category, 'Otros'); // no modifica la lista original
  // los cobros automáticos de suscripciones siguen siendo suscripciones
  const subs = [rx('Netflix', 'Suscripciones', '2026-11-05', { source: 'sub' }), rx('Netflix', 'Otros', '2026-10-05')];
  assert.eq(R.setMerchantCategory(subs, 'Netflix', 'Ocio').map(e => e.category), ['Suscripciones', 'Ocio']);
  const gen = [rx('Gasto', 'Otros', '2026-11-01'), rx('Gasto', 'Ocio', '2026-11-02')];
  assert.eq(R.setMerchantCategory(gen, 'Gasto', 'Ocio').map(e => e.category), ['Otros', 'Ocio']);
});

test('applyRemembered: un pago de comercio conocido entra con su categoría y sin revisar', () => {
  const hist = [rx('Bar Pepe', 'Ocio', '2026-11-01')];
  const a = R.applyRemembered(hist, rx('Bar Pepe', 'Otros', '2026-11-09', { pending: true }), RCATS);
  assert.eq([a.category, 'pending' in a], ['Ocio', false]);
  const b = R.applyRemembered(hist, rx('Zara', 'Otros', '2026-11-09', { pending: true }), RCATS);
  assert.eq([b.category, b.pending], ['Otros', true]);
});
