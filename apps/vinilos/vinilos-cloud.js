// Discos añadidos desde la app. Se guardan en Firestore (vinilos/coleccion): los puede LEER cualquier
// cuenta con sesión, pero solo los puede ESCRIBIR el dueño (lo imponen las reglas de Firestore con su
// UID; el botón de añadir solo se enseña al dueño, pero eso es solo comodidad).
// Para no consultar Firebase en cada apertura, la nube se lee como mucho una vez cada 24 h (y al
// añadir se lee ese documento antes de escribirlo, para no pisar lo que haya).
import { firebaseConfig } from '../../shared/firebase-config.js';

const V = window.VinilosCore;
const S = window.SyncCore;
const M = window.MiAuth;
const CFG = window.VinilosConfig || {};
const CACHE_KEY = 'vinilos.extras';     // copia del documento: { updatedAt, json }
const SYNC_KEY = 'vinilos.lastSync';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
};

const url = () =>
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/vinilos/coleccion`;

async function request(method, body) {
  const token = await M.auth.currentUser.getIdToken();
  const res = await fetch(method === 'PATCH' ? url() + '?updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=json' : url(), {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404) return null; // todavía no hay ninguno añadido
  if (!res.ok) {
    throw new Error(res.status === 403
      ? 'Firestore respondió 403 (¿faltan las reglas nuevas, o tu cuenta no es la del dueño?)'
      : 'Firestore respondió ' + res.status);
  }
  return res.json();
}

const readRemote = async () => S.fromFirestoreDoc(await request('GET'));

function cached() {
  try { return JSON.parse(store.get(CACHE_KEY)); } catch (e) { return null; }
}
const albumsOf = doc => (doc ? V.parseExtras(doc.json) : []);
const keep = doc => { if (doc) store.set(CACHE_KEY, JSON.stringify(doc)); };

// Discos añadidos que ya se conocen en este móvil (sin red)
function getCached() { return albumsOf(cached()); }

// Lee la nube solo si toca (cada 24 h) o si se fuerza. Devuelve la lista, o null si no se ha leído.
async function refresh(opts) {
  await M.ready;
  const lastSyncAt = Number(store.get(SYNC_KEY));
  if (!S.shouldReadRemote({ isEmpty: false, lastSyncAt, now: Date.now(), force: !!(opts && opts.force) })) return null;
  const doc = await readRemote();
  keep(doc);
  store.set(SYNC_KEY, String(Date.now()));
  return albumsOf(doc);
}

// Lee el documento y aplica el cambio sobre lo que haya (así no se pierde nada de otro dispositivo)
async function change(fn) {
  await M.ready;
  if (!isOwner()) throw new Error('Solo el dueño puede cambiar la colección.');
  const next = fn(albumsOf(await readRemote()));
  const doc = { updatedAt: Date.now(), json: JSON.stringify({ albums: next }) };
  await request('PATCH', S.toFirestoreFields(doc));
  keep(doc);
  store.set(SYNC_KEY, String(Date.now()));
  return next;
}

function isOwner() {
  try { return V.isOwner(M.auth.currentUser.uid, CFG.ownerUid); } catch (e) { return false; }
}

window.VinilosCloud = {
  ready: M.ready,
  isOwner,
  getCached,
  refresh,
  add: album => change(list => (list.some(a => a.id === album.id) ? list : list.concat(album)))
};

// Botón "Sincronizar ahora": lee la colección de la nube aunque no toque todavía
const syncBtn = document.getElementById('sync-now');
if (syncBtn) syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  try {
    const list = await refresh({ force: true });
    if (list && window.vinilosSetExtras) window.vinilosSetExtras(list);
  } catch (err) { console.warn('Vinilos (nube):', err); }
  finally { syncBtn.disabled = false; }
});

// La página se pinta con lo que ya hay en el móvil y se completa con la nube si toca
if (window.vinilosSetExtras) {
  window.vinilosSetExtras(getCached());
  refresh().then(list => { if (list) window.vinilosSetExtras(list); }).catch(err => console.warn('Vinilos (nube):', err));
  M.ready.then(() => { if (window.vinilosOwnerChanged) window.vinilosOwnerChanged(isOwner()); });
}
