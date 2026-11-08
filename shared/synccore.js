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

  // "hace 5 min", "hace 2 h", "hace 3 días". Vacío si no hay hora; una hora futura (reloj adelantado) cuenta como ahora.
  function relativeTime(ts, now) {
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const diff = Math.max(0, now - ts);
    const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
    if (diff < MIN) return 'hace un momento';
    if (diff < HOUR) return 'hace ' + Math.floor(diff / MIN) + ' min';
    if (diff < DAY) return 'hace ' + Math.floor(diff / HOUR) + ' h';
    const days = Math.floor(diff / DAY);
    return 'hace ' + days + (days === 1 ? ' día' : ' días');
  }

  // Qué enseña el punto de sincronización de la cabecera. Prioridad: sin conexión, sincronizando,
  // error, cambios sin subir, sincronizado, sin sincronizar todavía.
  function statusOf({ online = true, syncing = false, error = '', dirty = false, lastSyncAt = 0, now }) {
    const last = relativeTime(lastSyncAt, now);
    const lastText = last ? 'Última sincronización: ' + last : 'Todavía no se ha sincronizado en este dispositivo.';
    if (!online) {
      return {
        state: 'offline', label: 'Sin conexión',
        detail: dirty ? 'Tienes cambios sin subir; se subirán solos cuando vuelva la conexión. ' + lastText : 'No hay conexión. ' + lastText
      };
    }
    if (syncing) return { state: 'syncing', label: 'Sincronizando…', detail: 'Subiendo y comprobando tus datos.' };
    if (error) {
      return {
        state: 'error', label: 'Error al sincronizar',
        detail: error + (dirty ? ' Tus cambios siguen guardados en este dispositivo.' : '') + ' ' + lastText
      };
    }
    if (dirty) return { state: 'pending', label: 'Cambios sin subir', detail: 'Se subirán en unos segundos. ' + lastText };
    if (last) return { state: 'ok', label: 'Sincronizado', detail: lastText };
    return { state: 'unknown', label: 'Sin sincronizar todavía', detail: lastText };
  }

  const api = { relativeTime, statusOf, SYNC_INTERVAL_MS, shouldReadRemote, ownerAction, decideDoc, toFirestoreFields, fromFirestoreDoc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SyncCore = Object.assign(root.SyncCore || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
