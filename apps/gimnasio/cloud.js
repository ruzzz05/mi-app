// Copia en Firebase ligada a la cuenta con la que has iniciado sesión (shared/auth.js).
//   users/{uid}/gym/config        -> tus rutinas (la copia más reciente gana, como en Mi-Menu)
//   users/{uid}/gymlogs/{AAAA-MM} -> los entrenos de cada mes (se fusionan por id: dos móviles
//                                    que añaden entrenos el mismo mes no se pisan)
// Si falla (sin conexión, sin permisos…) la app sigue funcionando con los datos del propio móvil y
// lo reintenta más tarde. La nube solo se LEE como mucho una vez cada 24 h (o si no hay datos en el
// móvil, o con "Sincronizar ahora"); al guardar un mes se lee ese mes antes de escribirlo para no
// perder los entrenos de otro móvil. Se usa la API REST de Firestore con el token de la sesión.
import { firebaseConfig } from '../../shared/firebase-config.js';

const A = window.GymApp;
const G = window.Gym;
const S = window.SyncCore;
const M = window.MiAuth;
const PUSH_DELAY = 1500;
const OWNER_KEY = 'gimnasio.owner';           // uid de la cuenta a la que pertenecen los datos del móvil
const PENDING_KEY = 'pending-sync.gimnasio';  // lo que falta por subir (lo mira auth.js al cerrar sesión)
const lastSyncKey = uid => 'gimnasio.lastSync.' + uid;
const MONTH_RE = /^\d{4}-\d{2}$/;

// localStorage puede no estar disponible (modo privado): entonces se actúa como "nunca sincronizado"
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
};

// ---------- Cambios pendientes de subir ----------
function loadPending() {
  try {
    const p = JSON.parse(store.get(PENDING_KEY));
    return { config: !!p.config, months: new Set((p.months || []).filter(k => MONTH_RE.test(k))) };
  } catch (e) { return { config: false, months: new Set() }; }
}
let pending = loadPending();
const hasPending = () => pending.config || pending.months.size > 0;
function savePending() {
  if (hasPending()) store.set(PENDING_KEY, JSON.stringify({ config: pending.config, months: [...pending.months] }));
  else store.del(PENDING_KEY);
}

let ready = false;
let timer = null;
let lastError = ''; // último fallo con la nube, para decírtelo al pulsar "Sincronizar ahora"

const uid = () => M.auth.currentUser.uid;
const base = () =>
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${uid()}`;

async function request(method, url, body) {
  const token = await M.auth.currentUser.getIdToken();
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404) return null; // todavía no hay copia en la nube
  if (!res.ok) throw new Error('Firestore respondió ' + res.status);
  return res.json();
}

const getDoc = async path => S.fromFirestoreDoc(await request('GET', `${base()}/${path}`));
const putDoc = (path, data) =>
  request('PATCH', `${base()}/${path}?updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=json`, S.toFirestoreFields(data));

// ---------- Lectura de lo que hay en la nube (tolerante con documentos rotos) ----------
function parseJson(doc) {
  if (!doc) return null;
  try { const v = JSON.parse(doc.json); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
}
const parseConfig = doc => {
  const v = parseJson(doc);
  return v && Array.isArray(v.routines) ? { updatedAt: doc.updatedAt, routines: v.routines.filter(G.isValidRoutine) } : null;
};
const parseMonth = doc => {
  const v = parseJson(doc);
  return v && Array.isArray(v.sessions) ? { updatedAt: doc.updatedAt, sessions: v.sessions.filter(G.isValidSession) } : null;
};

async function listMonths() {
  const out = {};
  let token = '';
  do {
    const res = await request('GET', `${base()}/gymlogs?pageSize=100${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    for (const doc of (res && res.documents) || []) {
      const key = String(doc.name).split('/').pop();
      const month = MONTH_RE.test(key) ? parseMonth(S.fromFirestoreDoc(doc)) : null;
      if (month) out[key] = month;
    }
    token = res && res.nextPageToken;
  } while (token);
  return out;
}

// ---------- Escritura ----------
function setLocalMonth(key, merged) {
  A.state.logs[key] = { updatedAt: merged.updatedAt, sessions: merged.sessions };
  A.save({ touch: false });
}

async function pushConfig() {
  if (!A.state.updatedAt) { A.state.updatedAt = Date.now(); A.save({ touch: false }); }
  await putDoc('gym/config', { updatedAt: A.state.updatedAt, json: JSON.stringify({ routines: A.state.routines }) });
  pending.config = false;
  savePending();
}

// known: lo que ya se sabe de la nube para ese mes (null = no existe); sin pasarlo se lee antes de escribir
async function pushMonth(key, known) {
  const local = A.state.logs[key];
  if (!local) { pending.months.delete(key); savePending(); return; }
  const remote = known === undefined ? parseMonth(await getDoc('gymlogs/' + key)) : known;
  const merged = G.mergeMonthLogs(local, remote);
  if (G.hasNewer(remote, local)) { setLocalMonth(key, merged); A.render(); } // entrenos de otro móvil
  await putDoc('gymlogs/' + key, { updatedAt: merged.updatedAt || Date.now(), json: JSON.stringify({ sessions: merged.sessions }) });
  pending.months.delete(key);
  savePending();
}

async function pushPending(knownMonths) {
  if (pending.config) await pushConfig();
  for (const key of [...pending.months]) await pushMonth(key, knownMonths ? (knownMonths[key] || null) : undefined);
}

// ---------- Sincronización completa (lee la nube) ----------
async function sync() {
  let adopted = false;

  const rawConfig = await getDoc('gym/config');
  const config = parseConfig(rawConfig);
  const action = S.decideDoc({
    localEmpty: A.state.routines.length === 0 && !A.state.updatedAt,
    localUpdatedAt: A.state.updatedAt,
    remote: config ? rawConfig : null
  });
  if (action === 'adopt') {
    A.state.routines = config.routines;
    A.state.updatedAt = config.updatedAt;
    A.save({ touch: false });
    adopted = true;
  } else if (action === 'upload') {
    pending.config = true;
  }

  const remoteMonths = await listMonths();
  for (const key of new Set([...Object.keys(A.state.logs), ...Object.keys(remoteMonths)])) {
    const local = A.state.logs[key];
    const remote = remoteMonths[key] || null;
    if (G.hasNewer(remote, local)) { setLocalMonth(key, G.mergeMonthLogs(local, remote)); adopted = true; }
    if (G.hasNewer(local, remote)) pending.months.add(key);
  }
  savePending();

  if (adopted) { A.render(); A.toast('Datos recuperados de la nube'); }
  store.set(lastSyncKey(uid()), String(Date.now())); // la lectura ya está hecha
  // Si la subida falla no se tira la conexión: queda pendiente y flush() lo dirá y lo reintentará
  try { await pushPending(remoteMonths); }
  catch (err) { lastError = String(err && err.message || err); console.warn('No se pudo subir:', err); }
}

// Los datos del móvil pertenecen a una cuenta; si ahora entra otra, no se suben a la nueva.
function checkOwner() {
  const action = S.ownerAction(store.get(OWNER_KEY), uid());
  if (action === 'wipe') {
    clearTimeout(timer);
    pending = { config: false, months: new Set() };
    savePending();
    A.clearLocal();
  }
  if (action !== 'keep') store.set(OWNER_KEY, uid());
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
    await M.ready; // no se resuelve hasta que hay sesión
    checkOwner();
    const isEmpty = A.state.routines.length === 0 && !A.state.updatedAt && Object.keys(A.state.logs).length === 0;
    const lastSyncAt = Number(store.get(lastSyncKey(uid())));
    if (S.shouldReadRemote({ isEmpty, lastSyncAt, now: Date.now(), force })) await sync();
    ready = true;
    return true;
  } catch (err) {
    lastError = String(err && err.message || err);
    console.warn('Nube no disponible por ahora:', err);
    return false;
  }
}

// Devuelve true si no queda nada pendiente (no había nada o se subió) y false si falló.
async function flush() {
  if (!hasPending()) return true;
  if (!(await connect())) return false;
  try { await pushPending(); return true; }
  catch (err) { lastError = String(err && err.message || err); console.warn('No se pudo subir:', err); return false; }
}

A.onSave = changes => {
  if (changes.config) pending.config = true;
  changes.months.forEach(k => pending.months.add(k));
  savePending();
  clearTimeout(timer);
  timer = setTimeout(flush, PUSH_DELAY);
};

A.syncNow = async () => {
  A.toast('Sincronizando…', 3000);
  // Si la sesión no responde (p. ej. el móvil tarda en leerla), que se diga en vez de quedarse mudo
  const session = await Promise.race([M.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]);
  if (!session) {
    A.toast('La sesión no responde (' + M.diag() + '). Cierra la app del todo y vuelve a abrirla.', 9000);
    return;
  }
  const connected = await connect({ force: true });
  const ok = connected && await flush();
  if (ok) A.toast('Sincronizado');
  else A.toast(connected ? 'No se pudo subir: ' + lastError : 'No se pudo conectar: ' + (lastError || 'sin conexión'), 9000);
};

window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

const syncBtn = document.getElementById('sync-now');
if (syncBtn) syncBtn.addEventListener('click', () => {
  syncBtn.disabled = true;
  A.syncNow().finally(() => { syncBtn.disabled = false; });
});

// Al abrir: comprobar la cuenta y, si toca, leer; y subir lo que se quedó pendiente
connect().then(ok => { if (ok) flush(); });
