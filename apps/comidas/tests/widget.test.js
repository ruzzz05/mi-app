// Widget de iPhone (Scriptable): qué comida toca, calculado a partir del documento de la nube (lógica pura)
const W = globalThis.MenuWidget;
const P = globalThis.Planner;
const at = (d, h) => new Date(2026, 10, d, h, 0, 0);   // noviembre de 2026
const doc = menu => ({ fields: { updatedAt: { integerValue: '5' }, json: { stringValue: JSON.stringify({ dishes: [], menu, list: {}, seedPurged: true }) } } });
const menu = (plan, extra) => ({ startDate: '2026-11-06', firstMeal: 'comida', days: 3, plan, exclusions: [], ...extra });
const full = { '0-comida': { id: 'a', name: 'Lentejas' }, '0-cena': { id: 'b', name: 'Tortilla' }, '1-comida': { id: 'c', name: 'Pollo' }, '1-cena': { id: 'd', name: 'Sopa' }, '2-comida': { id: 'e', name: 'Arroz' }, '2-cena': { id: 'f', name: 'Ensalada' } };

test('widget menu: antes de las 17:00 toca la comida y despues viene la cena de hoy', () => {
  const m = W.model(doc(menu(full)), at(6, 12), P);
  assert.eq(m.status, 'active');
  assert.eq(m.meal, 'Comida');
  assert.eq(m.day, 'Día 1 de 3');
  assert.eq(m.dishes, ['Lentejas']);
  assert.eq(m.later, 'Cena · Tortilla');
});

test('widget menu: desde las 17:00 toca la cena y despues la comida de manana', () => {
  const m = W.model(doc(menu(full)), at(6, 20), P);
  assert.eq(m.meal, 'Cena');
  assert.eq(m.dishes, ['Tortilla']);
  assert.eq(m.later, 'Mañana · Comida · Pollo');
});

test('widget menu: los segundos platos van con el principal', () => {
  const m = W.model(doc(menu(full, { extras: { '0-comida': [{ id: null, name: 'Pan' }] } })), at(6, 12), P);
  assert.eq(m.dishes, ['Lentejas', 'Pan']);
});

test('widget menu: la ultima cena no tiene nada despues', () => {
  const m = W.model(doc(menu(full)), at(8, 20), P);
  assert.eq(m.dishes, ['Ensalada']);
  assert.eq(m.later, null);
});

test('widget menu: una comida sin plato lo dice', () => {
  const m = W.model(doc(menu({ ...full, '0-comida': { empty: true } })), at(6, 12), P);
  assert.eq(m.dishes, []);
});

test('widget menu: sin menu, sin empezar o terminado se explica en una frase', () => {
  assert.eq(W.model(doc(null), at(6, 12), P).text, 'Todavía no tienes menú');
  assert.eq(W.model(doc(menu(full)), at(5, 12), P).text, 'Tu menú empieza el 6 de noviembre');
  assert.eq(W.model(doc(menu(full)), at(9, 12), P).text, 'Tu menú ha terminado');
  assert.eq(W.model(doc(null), at(6, 12), P).status, 'none');
});

test('widget menu: los errores de sesión de Firebase se dicen en claro', () => {
  assert.eq(W.errorText('INVALID_LOGIN_CREDENTIALS'), 'Usuario o contraseña incorrectos');
  assert.eq(W.errorText('TOKEN_EXPIRED'), 'La sesión ha caducado. Abre el script en Scriptable para entrar otra vez');
  assert.eq(W.sessionLost('TOKEN_EXPIRED'), true);
  assert.eq(W.sessionLost('INVALID_PASSWORD'), false);
  assert.eq(W.errorText(''), 'Error de sesión');
});

test('widget menu: un documento vacio o roto no da nada que enseñar', () => {
  assert.eq(W.model(null, at(6, 12), P), null);
  assert.eq(W.model({ fields: {} }, at(6, 12), P), null);
  assert.eq(W.model({ fields: { json: { stringValue: 'roto{' } } }, at(6, 12), P), null);
});
