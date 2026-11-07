// Reglas de sincronización con la nube comunes a todas las apps (sin red ni DOM).
// Las usan apps/comidas/cloudsync.js y apps/gimnasio/cloud.js. Se prueba en shared/tests.
(function (root) {
  // Como mucho una lectura de la nube cada 24 h, salvo que no haya datos locales, no haya
  // constancia de una lectura anterior (o el reloj esté adelantado) o se fuerce.
  const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

  function shouldReadRemote({ isEmpty, lastSyncAt, now, force }) {
    if (force || isEmpty) return true;
    if (!Number.isFinite(lastSyncAt) || lastSyncAt <= 0 || lastSyncAt > now) return true;
    return now - lastSyncAt >= SYNC_INTERVAL_MS;
  }

  // Los datos locales pertenecen a una cuenta: 'claim' (aún sin dueño), 'keep' (misma cuenta)
  // o 'wipe' (otra cuenta: no se deben subir a ésta).
  function ownerAction(storedOwner, uid) {
    if (!storedOwner) return 'claim';
    return storedOwner === uid ? 'keep' : 'wipe';
  }

  // Qué copia de un documento gana: 'upload' (la local), 'adopt' (la de la nube) o 'none'.
  // remote = { updatedAt, json } o null. Una copia sin json cuenta como que no hay copia.
  function decideDoc({ localEmpty, localUpdatedAt, remote }) {
    const hasRemote = !!(remote && typeof remote.json === 'string');
    if (!hasRemote) return localEmpty ? 'none' : 'upload';
    if (localEmpty) return 'adopt';
    if (remote.updatedAt > localUpdatedAt) return 'adopt';
    if (remote.updatedAt < localUpdatedAt) return 'upload';
    return 'none';
  }

  // Traducción al formato de la API REST de Firestore (y de vuelta). El contenido va como texto
  // para no depender de las restricciones de Firestore con claves y arrays anidados.
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

  const api = { SYNC_INTERVAL_MS, shouldReadRemote, ownerAction, decideDoc, toFirestoreFields, fromFirestoreDoc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SyncCore = Object.assign(root.SyncCore || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
