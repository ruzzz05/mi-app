// Copia de seguridad en Firebase ligada a la cuenta con la que has iniciado sesión (shared/auth.js).
// El estado se guarda en users/{uid}. Si falla (sin conexión, sin permisos…) la app sigue
// funcionando con los datos del propio móvil y lo reintenta más tarde.
//
// Para no consultar Firebase en cada apertura, la nube solo se LEE como mucho una vez cada 24 h
// (o si no hay datos en el móvil, o con "Sincronizar ahora"). Los cambios se suben al editar.
//
// El documento se lee y se guarda con la API REST de Firestore (con el token de la sesión): la
// librería de Firestore falla de forma interna al cargar otra página en la misma sesión, y así
// además se carga mucho menos código.
import { firebaseConfig } from '../../shared/firebase-config.js';

const C = window.Comidas;
const P = window.Planner;
const A = window.MiAuth;
const PUSH_DELAY = 1500; // espera a que dejes de tocar cosas antes de subir
const OWNER_KEY = 'comidas.owner';           // uid de la cuenta a la que pertenecen los datos del móvil
const PENDING_KEY = 'pending-sync.comidas';  // '1' mientras haya cambios sin subir (lo mira auth.js al cerrar sesión)
const lastSyncKey = uid => 'comidas.lastSync.' + uid;

// localStorage puede no estar disponible (modo privado): entonces se actúa como "nunca sincronizado"
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
};

let ready = false;
let dirty = store.get(PENDING_KEY) === '1';
let timer = null;
let lastError = ''; // último fallo con la nube, para decírtelo al pulsar "Sincronizar ahora"

const uid = () => A.auth.currentUser.uid;

const docUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${uid()}`;

async function request(method, url, body) {
  const token = await A.auth.currentUser.getIdToken();
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404) return null; // todavía no hay copia en la nube
  if (!res.ok) throw new Error('Firestore respondió ' + res.status);
  return res.json();
}

const readRemote = async () => P.fromFirestoreDoc(await request('GET', docUrl()));

const writeRemote = data =>
  request('PATCH', docUrl() + '?updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=json', P.toFirestoreFields(data));

// Fotos de recetas: un documento por foto en users/{uid}/fotos/{id}, aparte del estado para no
// acercarse al límite de 1 MiB. photos.js las pide y las sube a través de Photos.remote.
const photoUrl = id => `${docUrl()}/fotos/${id}`;
if (window.Photos) {
  window.Photos.remote = {
    async get(id) {
      if (!(await connect())) throw new Error('sin conexión');
      return P.photoFromFirestore(await request('GET', photoUrl(id)));
    },
    async put(id, dataUrl) {
      if (!(await connect())) throw new Error('sin conexión');
      await request('PATCH', photoUrl(id) + '?updateMask.fieldPaths=data', P.photoToFirestore(dataUrl));
    },
    async del(id) {
      if (!(await connect())) throw new Error('sin conexión');
      await request('DELETE', photoUrl(id));
    }
  };
}

// Los datos del móvil pertenecen a una cuenta; si ahora entra otra, no se suben a la nueva.
function checkOwner() {
  const action = P.ownerAction(store.get(OWNER_KEY), uid());
  if (action === 'wipe') {
    clearTimeout(timer);
    dirty = false;
    store.del(PENDING_KEY);
    C.clearLocal();
  }
  if (action !== 'keep') store.set(OWNER_KEY, uid());
}

// Lee la nube y decide qué copia gana
async function sync() {
  const remote = await readRemote();
  const action = P.decideSync({ local: C.state, remote });
  if (action === 'adopt') {
    C.adoptState(P.deserializeRemote(remote));
    dirty = false;
    store.del(PENDING_KEY);
    C.toast('Datos recuperados de la nube');
  } else if (action === 'upload') {
    await push();
  }
  store.set(lastSyncKey(uid()), String(Date.now()));
}

// Una sola conexión a la vez. force:true obliga a leer la nube aunque no toque.
let connecting = null;
function connect(opts) {
  const force = !!(opts && opts.force);
  if (ready && !force) return Promise.resolve(true);
  if (!connecting) connecting = doConnect(force).finally(() => { connecting = null; });
  return connecting;
}

async function doConnect(force) {
  try {
    await A.ready; // no se resuelve hasta que hay sesión
    checkOwner();
    const lastSyncAt = Number(store.get(lastSyncKey(uid())));
    if (P.shouldReadRemote({ local: C.state, lastSyncAt, now: Date.now(), force })) await sync();
    ready = true;
    return true;
  } catch (err) {
    lastError = String(err && err.message || err);
    console.warn('Nube no disponible por ahora:', err);
    return false;
  }
}

async function push() {
  const data = P.serializeState(C.state, Date.now());
  if (!C.state.updatedAt) { C.state.updatedAt = data.updatedAt; C.save({ touch: false }); }
  await writeRemote(data);
  dirty = false;
  store.del(PENDING_KEY);
}

// Devuelve true si no queda nada pendiente (no había nada o se subió) y false si falló.
async function flush() {
  if (window.Photos) window.Photos.flushPending();   // fotos que quedaron sin subir (no espera ni condiciona la subida del estado)
  if (!dirty) return true;
  if (!(await connect())) return false;
  try { await push(); return true; }
  catch (err) { dirty = true; lastError = String(err && err.message || err); console.warn('No se pudo subir:', err); return false; }
}

C.onSave = () => {
  dirty = true;
  store.set(PENDING_KEY, '1');
  clearTimeout(timer);
  timer = setTimeout(flush, PUSH_DELAY);
};

C.syncNow = async () => {
  C.toast('Sincronizando…', 3000);
  // Si la sesión no responde (p. ej. el móvil tarda en leerla), que se diga en vez de quedarse mudo
  const session = await Promise.race([A.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]);
  if (!session) {
    C.toast('La sesión no responde (' + A.diag() + '). Cierra la app del todo y vuelve a abrirla.', 9000);
    return;
  }
  const connected = await connect({ force: true });
  const ok = connected && await flush();
  if (ok) C.toast('Sincronizado');
  else C.toast(connected ? 'No se pudo subir: ' + lastError : 'No se pudo conectar: ' + (lastError || 'sin conexión'), 9000);
};

window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

const syncBtn = document.getElementById('sync-now');
if (syncBtn) syncBtn.addEventListener('click', () => {
  syncBtn.disabled = true;
  C.syncNow().finally(() => { syncBtn.disabled = false; });
});

// Al abrir: comprobar la cuenta y, si toca, leer; y subir lo que se quedó pendiente
connect().then(ok => { if (ok) flush(); });
