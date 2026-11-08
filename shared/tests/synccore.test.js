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

// ---------- Aviso de sincronización (el punto de la cabecera) ----------
const MIN = 60 * 1000, HOUR = 60 * MIN;
const st = o => S.statusOf({ online: true, now: NOW, ...o });

test('relativeTime: un momento, minutos, horas y días', () => {
  assert.eq(S.relativeTime(NOW - 20 * 1000, NOW), 'hace un momento');
  assert.eq(S.relativeTime(NOW - MIN, NOW), 'hace 1 min');
  assert.eq(S.relativeTime(NOW - 59 * MIN, NOW), 'hace 59 min');
  assert.eq(S.relativeTime(NOW - HOUR, NOW), 'hace 1 h');
  assert.eq(S.relativeTime(NOW - 5 * HOUR - 30 * MIN, NOW), 'hace 5 h');
  assert.eq(S.relativeTime(NOW - 24 * HOUR, NOW), 'hace 1 día');
  assert.eq(S.relativeTime(NOW - 3 * 24 * HOUR, NOW), 'hace 3 días');
});

test('relativeTime: una hora futura (reloj adelantado) cuenta como "hace un momento"; sin hora, vacío', () => {
  assert.eq(S.relativeTime(NOW + HOUR, NOW), 'hace un momento');
  assert.eq(S.relativeTime(0, NOW), '');
  assert.eq(S.relativeTime(undefined, NOW), '');
});

test('statusOf: sincronizado con la hora de la última sincronización', () => {
  const r = st({ lastSyncAt: NOW - 5 * MIN });
  assert.eq([r.state, r.label], ['ok', 'Sincronizado']);
  assert.eq(r.detail, 'Última sincronización: hace 5 min');
});

test('statusOf: cambios sin subir', () => {
  const r = st({ dirty: true, lastSyncAt: NOW - HOUR });
  assert.eq([r.state, r.label], ['pending', 'Cambios sin subir']);
  assert.ok(r.detail.includes('hace 1 h'));
});

test('statusOf: sin conexión, con y sin cambios pendientes', () => {
  const a = st({ online: false, dirty: true, lastSyncAt: NOW - HOUR });
  assert.eq([a.state, a.label], ['offline', 'Sin conexión']);
  assert.ok(a.detail.includes('cambios'), a.detail);
  const b = st({ online: false, lastSyncAt: NOW - HOUR });
  assert.eq(b.state, 'offline');
  assert.ok(b.detail.includes('hace 1 h'), b.detail);
});

test('statusOf: error al sincronizar, con el motivo y avisando de que los cambios siguen guardados', () => {
  const r = st({ error: 'Firestore respondió 403', dirty: true, lastSyncAt: NOW - HOUR });
  assert.eq([r.state, r.label], ['error', 'Error al sincronizar']);
  assert.ok(r.detail.includes('Firestore respondió 403'));
  assert.ok(r.detail.includes('guardados en este dispositivo'));
  assert.eq(st({ error: 'x' }).detail.includes('guardados'), false);   // sin cambios pendientes no se dice
});

test('statusOf: sincronizando', () => {
  const r = st({ syncing: true, dirty: true, error: 'x' });
  assert.eq([r.state, r.label], ['syncing', 'Sincronizando…']);
});

test('statusOf: sin conexión manda sobre sincronizando, error y pendiente', () => {
  assert.eq(st({ online: false, syncing: true, error: 'x', dirty: true }).state, 'offline');
});

test('statusOf: error manda sobre pendiente; pendiente sobre sincronizado', () => {
  assert.eq(st({ error: 'x', dirty: true }).state, 'error');
  assert.eq(st({ dirty: true, lastSyncAt: NOW - MIN }).state, 'pending');
});

test('statusOf: sin ninguna sincronización todavía', () => {
  const r = st({});
  assert.eq([r.state, r.label], ['unknown', 'Sin sincronizar todavía']);
  assert.ok(r.detail.length > 0);
});
