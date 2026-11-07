// Sincronizacion con la nube: que copia gana y como se guarda (sin red, solo logica)
const withData = (extra = {}) => Planner.migrateState({ dishes: [{ id: 'a', name: 'Arroz', ingredients: ['arroz'] }], ...extra });
const emptyS = (updatedAt = 0) => ({ ...Planner.migrateState(null), updatedAt });
const remoteOf = (updatedAt, state = withData()) => ({ updatedAt, json: JSON.stringify(state) });

test('isEmptyState: un estado nuevo esta vacio', () => {
  assert.eq(Planner.isEmptyState(Planner.migrateState(null)), true);
});

test('isEmptyState: con recetas, menu, borrador o lista propia no esta vacio', () => {
  assert.eq(Planner.isEmptyState(withData()), false);
  assert.eq(Planner.isEmptyState({ ...emptyS(), menu: { days: 1 } }), false);
  assert.eq(Planner.isEmptyState({ ...emptyS(), draft: { days: 1 } }), false);
  assert.eq(Planner.isEmptyState({ ...emptyS(), list: { removed: [], extras: [{ key: 'x', name: 'x', qty: 1 }], checked: {} } }), false);
  assert.eq(Planner.isEmptyState({ ...emptyS(), list: { removed: ['x'], extras: [], checked: {} } }), false);
});

test('decideSync: sin copia en la nube y sin datos locales no hace nada', () => {
  assert.eq(Planner.decideSync({ local: emptyS(), remote: null }), 'none');
});

test('decideSync: sin copia en la nube y con datos locales los sube', () => {
  assert.eq(Planner.decideSync({ local: { ...withData(), updatedAt: 0 }, remote: null }), 'upload');
});

test('decideSync: gana la copia mas reciente', () => {
  assert.eq(Planner.decideSync({ local: { ...withData(), updatedAt: 100 }, remote: remoteOf(200) }), 'adopt');
  assert.eq(Planner.decideSync({ local: { ...withData(), updatedAt: 300 }, remote: remoteOf(200) }), 'upload');
  assert.eq(Planner.decideSync({ local: { ...withData(), updatedAt: 200 }, remote: remoteOf(200) }), 'none');
});

test('decideSync: un dispositivo sin datos recupera siempre lo de la nube', () => {
  assert.eq(Planner.decideSync({ local: emptyS(999), remote: remoteOf(1) }), 'adopt');
});

test('decideSync: una copia de la nube ilegible no pisa los datos locales', () => {
  assert.eq(Planner.decideSync({ local: { ...withData(), updatedAt: 1 }, remote: { updatedAt: 500, json: '{roto' } }), 'upload');
  assert.eq(Planner.decideSync({ local: emptyS(), remote: { updatedAt: 500, json: '{roto' } }), 'none');
});

test('serializeState guarda solo los datos de la app y la marca de tiempo', () => {
  const r = Planner.serializeState({ ...withData(), updatedAt: 42, extra: 'no' }, 99);
  assert.eq(r.updatedAt, 42);
  assert.eq(Object.keys(JSON.parse(r.json)).sort(), ['dishes', 'draft', 'list', 'menu', 'seedPurged']);
});

test('serializeState usa la hora actual si el estado nunca se habia guardado', () => {
  assert.eq(Planner.serializeState({ ...withData(), updatedAt: 0 }, 99).updatedAt, 99);
});

test('deserializeRemote devuelve el mismo estado con su marca de tiempo', () => {
  const original = { ...withData({ menu: { startDate: '2026-11-06', firstMeal: 'comida', days: 1, exclusions: [], plan: {} } }), updatedAt: 77 };
  assert.eq(Planner.deserializeRemote(Planner.serializeState(original, 1)), original);
});

test('deserializeRemote normaliza datos antiguos y rechaza copias rotas o vacias', () => {
  const s = Planner.deserializeRemote({ updatedAt: 5, json: JSON.stringify({ dishes: [{ id: 'a', name: 'A', ingredients: ['x'] }] }) });
  assert.eq(s.dishes[0].ingredients, [{ name: 'x', qty: 1 }]);
  assert.eq(Planner.deserializeRemote({ updatedAt: 5, json: '{roto' }), null);
  assert.eq(Planner.deserializeRemote({ updatedAt: 5 }), null);
  assert.eq(Planner.deserializeRemote(null), null);
});

test('deserializeRemote respeta los acentos y simbolos de los nombres', () => {
  const s = withData();
  s.dishes[0].name = 'Crema de calabacín & "queso" ñ';
  assert.eq(Planner.deserializeRemote(Planner.serializeState({ ...s, updatedAt: 1 }, 1)).dishes[0].name, 'Crema de calabacín & "queso" ñ');
});

// ---- Formato de Firestore (API REST) ----
test('toFirestoreFields convierte la copia al formato de Firestore', () => {
  assert.eq(Planner.toFirestoreFields({ updatedAt: 1700000000123, json: '{"a":1}' }), {
    fields: { updatedAt: { integerValue: '1700000000123' }, json: { stringValue: '{"a":1}' } }
  });
});

test('fromFirestoreDoc lee un documento de Firestore', () => {
  const doc = { name: 'projects/p/databases/(default)/documents/users/u', fields: { updatedAt: { integerValue: '1700000000123' }, json: { stringValue: '{"a":1}' } } };
  assert.eq(Planner.fromFirestoreDoc(doc), { updatedAt: 1700000000123, json: '{"a":1}' });
});

test('fromFirestoreDoc devuelve null si falta el documento o algun campo', () => {
  assert.eq(Planner.fromFirestoreDoc(null), null);
  assert.eq(Planner.fromFirestoreDoc({}), null);
  assert.eq(Planner.fromFirestoreDoc({ fields: { updatedAt: { integerValue: '5' } } }), null);
  assert.eq(Planner.fromFirestoreDoc({ fields: { json: { stringValue: '{}' } } }), null);
});

test('fromFirestoreDoc rechaza una marca de tiempo que no es un numero', () => {
  assert.eq(Planner.fromFirestoreDoc({ fields: { updatedAt: { integerValue: 'abc' }, json: { stringValue: '{}' } } }), null);
});

test('ida y vuelta por el formato de Firestore conserva acentos y comillas', () => {
  const s = withData(); s.dishes[0].name = 'Crema de calabacín & "queso" ñ';
  const sent = Planner.serializeState({ ...s, updatedAt: 42 }, 1);
  assert.eq(Planner.deserializeRemote(Planner.fromFirestoreDoc(JSON.parse(JSON.stringify(Planner.toFirestoreFields(sent))))).dishes[0].name, 'Crema de calabacín & "queso" ñ');
});

// ---- Cuando leer de la nube y de quien son los datos locales ----
const NOW = 1_000_000_000_000;
const D = Planner.SYNC_INTERVAL_MS;

test('SYNC_INTERVAL_MS son 24 horas', () => {
  assert.eq(D, 86400000);
});

test('shouldReadRemote: con datos y sincronizado hace poco no lee', () => {
  assert.eq(Planner.shouldReadRemote({ local: withData(), lastSyncAt: NOW - 1000, now: NOW }), false);
});

test('shouldReadRemote: a las 24 horas justas lee, un instante antes no', () => {
  assert.eq(Planner.shouldReadRemote({ local: withData(), lastSyncAt: NOW - D, now: NOW }), true);
  assert.eq(Planner.shouldReadRemote({ local: withData(), lastSyncAt: NOW - D + 1, now: NOW }), false);
});

test('shouldReadRemote: sin fecha de ultima lectura valida lee', () => {
  [undefined, null, 0, NaN, -5].forEach(v =>
    assert.eq(Planner.shouldReadRemote({ local: withData(), lastSyncAt: v, now: NOW }), true, 'lastSyncAt ' + v));
});

test('shouldReadRemote: con el reloj adelantado (ultima lectura en el futuro) lee', () => {
  assert.eq(Planner.shouldReadRemote({ local: withData(), lastSyncAt: NOW + 5000, now: NOW }), true);
});

test('shouldReadRemote: sin datos locales lee siempre', () => {
  assert.eq(Planner.shouldReadRemote({ local: emptyS(), lastSyncAt: NOW - 1000, now: NOW }), true);
});

test('shouldReadRemote: force obliga a leer', () => {
  assert.eq(Planner.shouldReadRemote({ local: withData(), lastSyncAt: NOW - 1000, now: NOW, force: true }), true);
});

test('ownerAction: sin dueño guardado lo reclama, el mismo lo mantiene, otro borra', () => {
  assert.eq(Planner.ownerAction(null, 'u1'), 'claim');
  assert.eq(Planner.ownerAction('', 'u1'), 'claim');
  assert.eq(Planner.ownerAction('u1', 'u1'), 'keep');
  assert.eq(Planner.ownerAction('u2', 'u1'), 'wipe');
});
