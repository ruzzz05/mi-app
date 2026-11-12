// Widget de iPhone (Scriptable): lo que enseña, calculado a partir del documento de la nube (lógica pura)
const W = globalThis.GastosWidget;
const P = globalThis.Planner;
const now = new Date(2026, 10, 9, 10, 0, 0);   // 9 de noviembre de 2026
const doc = o => ({ fields: { updatedAt: { integerValue: '5' }, json: { stringValue: JSON.stringify({ expenses: [], subs: [], budget: 1000, categories: ['Otros'], ...o }) } } });
const exp = (id, amount, date, extra) => ({ id, amount, date, category: 'Otros', ...extra });
const sub = (name, amount, anchor, extra) => ({ id: name, name, amount, period: 'month', anchor, ...extra });

test('widget: lo que queda del presupuesto, sin contar los pagos por revisar ni otros meses', () => {
  const m = W.model(doc({ expenses: [exp('a', 660.4, '2026-11-03'), exp('b', 50, '2026-11-04', { pending: true }), exp('c', 99, '2026-10-30')] }), now, P);
  assert.eq(m.title, 'Te quedan');
  assert.eq(m.amount, '340 €');
  assert.eq(m.over, false);
  assert.eq(m.pct, 66.04);
  assert.eq(m.detail, '660 € de 1.000 €');
  assert.eq(m.pending, '1 por revisar');
});

test('widget: si te pasas del presupuesto lo dice y la barra se queda llena', () => {
  const m = W.model(doc({ budget: 100, expenses: [exp('a', 130, '2026-11-03')] }), now, P);
  assert.eq(m.title, 'Te has pasado');
  assert.eq(m.amount, '30 €');
  assert.eq(m.over, true);
  assert.eq(m.pct, 100);
  assert.eq(m.pending, null);
});

test('widget: sin presupuesto puesto usa el de por defecto', () => {
  const m = W.model(doc({ budget: 0 }), now, P);
  assert.eq(m.amount, P.euros(P.DEFAULT_MONTH_BUDGET, 0));
});

test('widget: el próximo cobro es el más cercano, con Hoy, Mañana o los días que faltan', () => {
  const next = subs => W.model(doc({ subs }), now, P).next;
  assert.eq(next([sub('Netflix', 13.99, '2026-11-10'), sub('Spotify', 10.99, '2026-11-20')]), 'Mañana · Netflix 13,99 €');
  assert.eq(next([sub('Gimnasio', 35, '2026-10-09')]), 'Hoy · Gimnasio 35,00 €');
  assert.eq(next([sub('iCloud', 2.99, '2026-10-14')]), 'En 5 días · iCloud 2,99 €');
});

test('widget: sin suscripciones activas no hay próximo cobro', () => {
  assert.eq(W.model(doc({}), now, P).next, null);
  assert.eq(W.model(doc({ subs: [sub('Netflix', 13.99, '2026-11-10', { paused: true })] }), now, P).next, null);
});

test('widget: los errores de sesión de Firebase se dicen en claro', () => {
  assert.eq(W.errorText('INVALID_LOGIN_CREDENTIALS'), 'Usuario o contraseña incorrectos');
  assert.eq(W.errorText('INVALID_PASSWORD'), 'Usuario o contraseña incorrectos');
  assert.eq(W.errorText('EMAIL_NOT_FOUND'), 'Usuario o contraseña incorrectos');
  assert.eq(W.errorText('TOKEN_EXPIRED'), 'La sesión ha caducado. Abre el script en Scriptable para entrar otra vez');
  assert.eq(W.errorText('TOO_MANY_ATTEMPTS_TRY_LATER : bloqueado'), 'Demasiados intentos. Prueba más tarde');
  assert.eq(W.errorText('Otra cosa'), 'Otra cosa');
  assert.eq(W.errorText(''), 'Error de sesión');
});

test('widget: un documento vacío o roto no da nada que enseñar', () => {
  assert.eq(W.model(null, now, P), null);
  assert.eq(W.model({ fields: {} }, now, P), null);
  assert.eq(W.model({ fields: { json: { stringValue: 'roto{' } } }, now, P), null);
});
