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
    return S.decideDoc({
      localEmpty: isEmptyState(local),
      localUpdatedAt: local.updatedAt,
      remote: deserializeRemote(remote) ? remote : null
    });
  }

  // Las reglas generales (qué copia gana, lecturas como mucho cada 24 h, dueño de los datos y el
  // formato de Firestore) están en shared/synccore.js, que se carga antes que este archivo.
  const S = root.SyncCore;
  const { toFirestoreFields, fromFirestoreDoc, ownerAction, SYNC_INTERVAL_MS } = S;

  const shouldReadRemote = ({ local, lastSyncAt, now, force }) =>
    S.shouldReadRemote({ isEmpty: isEmptyState(local), lastSyncAt, now, force });

  const api = { isEmptyState, serializeState, deserializeRemote, decideSync, toFirestoreFields, fromFirestoreDoc, SYNC_INTERVAL_MS, shouldReadRemote, ownerAction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
