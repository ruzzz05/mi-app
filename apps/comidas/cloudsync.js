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

  const api = { isEmptyState, serializeState, deserializeRemote, decideSync, toFirestoreFields, fromFirestoreDoc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
