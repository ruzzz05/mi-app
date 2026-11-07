// Lógica de sincronización común a todas las apps (sin red ni DOM)
const S = window.SyncCore;
const NOW = 1000 * 24 * 3600 * 1000;
const DAY = S ? S.SYNC_INTERVAL_MS : 0;

test('shouldReadRemote: lee si se fuerza o si no hay datos locales', () => {
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: NOW - 1000, now: NOW, force: true }), true);
  assert.eq(S.shouldReadRemote({ isEmpty: true, lastSyncAt: NOW - 1000, now: NOW }), true);
});

test('shouldReadRemote: no lee si la última lectura es de hace menos de 24 h', () => {
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: NOW - 1000, now: NOW }), false);
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: NOW - DAY + 1, now: NOW }), false);
});

test('shouldReadRemote: lee a las 24 h, sin constancia previa o con el reloj adelantado', () => {
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: NOW - DAY, now: NOW }), true);
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: NaN, now: NOW }), true);
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: 0, now: NOW }), true);
  assert.eq(S.shouldReadRemote({ isEmpty: false, lastSyncAt: NOW + 5000, now: NOW }), true);
});

test('ownerAction: sin dueño se reclama, misma cuenta se conserva, otra cuenta se borra', () => {
  assert.eq(S.ownerAction(null, 'u1'), 'claim');
  assert.eq(S.ownerAction('', 'u1'), 'claim');
  assert.eq(S.ownerAction('u1', 'u1'), 'keep');
  assert.eq(S.ownerAction('u1', 'u2'), 'wipe');
});

const remote = (updatedAt, json = '{}') => ({ updatedAt, json });

test('decideDoc: sin copia en la nube, sube si hay algo y no hace nada si está vacío', () => {
  assert.eq(S.decideDoc({ localEmpty: false, localUpdatedAt: 5, remote: null }), 'upload');
  assert.eq(S.decideDoc({ localEmpty: true, localUpdatedAt: 0, remote: null }), 'none');
});

test('decideDoc: local vacío adopta la nube; gana la más reciente; empate no hace nada', () => {
  assert.eq(S.decideDoc({ localEmpty: true, localUpdatedAt: 0, remote: remote(3) }), 'adopt');
  assert.eq(S.decideDoc({ localEmpty: false, localUpdatedAt: 5, remote: remote(9) }), 'adopt');
  assert.eq(S.decideDoc({ localEmpty: false, localUpdatedAt: 9, remote: remote(5) }), 'upload');
  assert.eq(S.decideDoc({ localEmpty: false, localUpdatedAt: 5, remote: remote(5) }), 'none');
});

test('decideDoc: una copia rota en la nube (sin json) cuenta como que no hay copia', () => {
  assert.eq(S.decideDoc({ localEmpty: false, localUpdatedAt: 5, remote: { updatedAt: 99 } }), 'upload');
});

test('toFirestoreFields / fromFirestoreDoc: ida y vuelta, y documentos rotos dan null', () => {
  const data = { updatedAt: 1730000000000, json: '{"a":"ñ"}' };
  assert.eq(S.fromFirestoreDoc(S.toFirestoreFields(data)), data);
  assert.eq(S.fromFirestoreDoc(null), null);
  assert.eq(S.fromFirestoreDoc({ fields: {} }), null);
  assert.eq(S.fromFirestoreDoc({ fields: { updatedAt: { integerValue: 'abc' }, json: { stringValue: 'x' } } }), null);
});
