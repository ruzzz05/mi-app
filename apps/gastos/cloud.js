// Copia de Gastos en Firebase, ligada a la cuenta con la que has iniciado sesión (shared/auth.js).
//   users/{uid}/gastos/data -> todos tus datos (gastos, suscripciones, presupuesto y categorías) en un solo documento
// Al abrir la app se lee la nube (1 lectura) y gana la copia más reciente; cada cambio se sube a los pocos segundos.
// Si falla (sin conexión, sin permisos…) la app sigue con los datos del móvil y lo reintenta luego.
import { firebaseConfig } from '../../shared/firebase-config.js';

const G = window.Gastos;
const P = window.Planner;
const S = window.SyncCore;
const M = window.MiAuth;
const PUSH_DELAY = 1500;
const OWNER_KEY = 'gastos.owner';          // uid de la cuenta a la que pertenecen los datos del móvil
const PENDING_KEY = 'pending-sync.gastos'; // hay cambios sin subir (lo mira auth.js al cerrar sesión)

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
};

let timer = null;
let pending = store.get(PENDING_KEY) === '1';
let connected = false;
let warned = false;

const uid = () => M.auth.currentUser.uid;
const docUrl = () => `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${uid()}/gastos/data`;

async function request(method, url, body) {
  const token = await M.auth.currentUser.getIdToken();
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404) return null; // todavía no hay copia
  if (!res.ok) throw new Error('Firestore respondió ' + res.status);
  return res.json();
}

const snapshot = () => ({ expenses: G.state.expenses, subs: G.state.subs, budget: G.state.budget, categories: G.state.categories });
const isEmpty = () => !G.state.expenses.length && !G.state.subs.length && !G.state.updatedAt;

async function push() {
  if (!G.state.updatedAt) { G.state.updatedAt = Date.now(); G.save({ touch: false }); }
  await request('PATCH', `${docUrl()}?updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=json`,
    S.toFirestoreFields({ updatedAt: G.state.updatedAt, json: JSON.stringify(snapshot()) }));
  pending = false;
  store.del(PENDING_KEY);
}

function warn(err) {
  console.warn('Gastos: nube no disponible por ahora:', err);
  if (!warned) { warned = true; G.toast('No se pudo sincronizar. Tus datos siguen en el móvil.'); }
}

async function flush() {
  if (!pending || !connected) return;
  try { await push(); } catch (err) { warn(err); }
}

// Una lectura de la nube y decidir qué copia gana
async function connect() {
  try {
    const session = await Promise.race([M.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]);
    if (!session) return;
    // Los datos del móvil son de una cuenta; si ahora entra otra, no se suben a la nueva.
    const action = S.ownerAction(store.get(OWNER_KEY), uid());
    if (action === 'wipe') { pending = false; store.del(PENDING_KEY); G.reset(); }
    if (action !== 'keep') store.set(OWNER_KEY, uid());

    const raw = S.fromFirestoreDoc(await request('GET', docUrl()));
    const remote = raw && P.parseCloudState(raw.json) ? raw : null;
    const what = S.decideDoc({ localEmpty: isEmpty(), localUpdatedAt: G.state.updatedAt, remote });
    if (what === 'adopt') {
      const data = P.parseCloudState(remote.json);
      Object.assign(G.state, data, { updatedAt: remote.updatedAt });
      G.save({ touch: false }); G.render();
      G.toast('Datos recuperados de la nube');
    } else if (what === 'upload') pending = true;
    connected = true;
    await flush();
  } catch (err) { warn(err); }
}

G.onSave = () => {
  pending = true;
  store.set(PENDING_KEY, '1');
  clearTimeout(timer);
  timer = setTimeout(flush, PUSH_DELAY);
};

window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

// Al abrir: leer la nube y, cuando termine (bien o mal), dejar paso al buzón de pagos
connect().finally(() => G.cloudDone());
