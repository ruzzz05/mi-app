// Qué copia gana al sincronizar con la nube y cómo se guarda (sin red ni DOM).
// La conexión con Firebase está aparte, en cloud.js. Se prueba en apps/comidas/tests.
(function (root) {
  const R = root.Planner; // recipes.js debe cargarse antes

  // Sin recetas, menú, borrador ni cambios en la lista: no hay nada que guardar ni que perder.
  function isEmptyState(s) {
    const l = s.list || {};
    return !(s.dishes && s.dishes.length) && !s.menu && !s.draft &&
      !(l.removed && l.removed.length) && !(l.extras && l.extras.length) && !Object.keys(l.checked || {}).length;
  }

  // Lo que se sube: { updatedAt, json }. El estado se guarda como texto para no depender
  // de las restricciones de Firestore con claves y arrays anidados.
  function serializeState(state, now) {
    const { dishes, draft, menu, list, seedPurged } = state;
    return { updatedAt: state.updatedAt || now, json: JSON.stringify({ dishes, draft, menu, list, seedPurged }) };
  }

  // De la copia de la nube al estado de la app; null si está rota o vacía.
  function deserializeRemote(remote) {
    if (!remote || typeof remote.json !== 'string') return null;
    let parsed;
    try { parsed = JSON.parse(remote.json); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...R.migrateState(parsed), updatedAt: remote.updatedAt || 0 };
  }

  // 'upload' (la local gana), 'adopt' (gana la de la nube) o 'none'.
  function decideSync({ local, remote }) {
    const hasRemote = !!deserializeRemote(remote);
    const empty = isEmptyState(local);
    if (!hasRemote) return empty ? 'none' : 'upload';
    if (empty) return 'adopt';
    if (remote.updatedAt > local.updatedAt) return 'adopt';
    if (remote.updatedAt < local.updatedAt) return 'upload';
    return 'none';
  }

  // Traducción al formato de la API REST de Firestore (y de vuelta).
  function toFirestoreFields(data) {
    return { fields: { updatedAt: { integerValue: String(data.updatedAt) }, json: { stringValue: data.json } } };
  }

  function fromFirestoreDoc(doc) {
    const f = doc && doc.fields;
    if (!f || !f.updatedAt || !f.json) return null;
    const updatedAt = Number(f.updatedAt.integerValue);
    if (!Number.isFinite(updatedAt) || typeof f.json.stringValue !== 'string') return null;
    return { updatedAt, json: f.json.stringValue };
  }

  // Como mucho una lectura de la nube cada 24 h, salvo que no haya datos locales, no haya
  // constancia de una lectura anterior (o el reloj esté adelantado) o se fuerce.
  const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

  function shouldReadRemote({ local, lastSyncAt, now, force }) {
    if (force || isEmptyState(local)) return true;
    if (!Number.isFinite(lastSyncAt) || lastSyncAt <= 0 || lastSyncAt > now) return true;
    return now - lastSyncAt >= SYNC_INTERVAL_MS;
  }

  // Los datos locales pertenecen a una cuenta: 'claim' (aún sin dueño), 'keep' (misma cuenta)
  // o 'wipe' (otra cuenta: no se deben subir a ésta).
  function ownerAction(storedOwner, uid) {
    if (!storedOwner) return 'claim';
    return storedOwner === uid ? 'keep' : 'wipe';
  }

  const api = { isEmptyState, serializeState, deserializeRemote, decideSync, toFirestoreFields, fromFirestoreDoc, SYNC_INTERVAL_MS, shouldReadRemote, ownerAction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
