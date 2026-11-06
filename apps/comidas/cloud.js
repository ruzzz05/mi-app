// Copia de seguridad en Firebase, sin iniciar sesión: cada instalación usa una identidad anónima
// y guarda su estado en users/{identidad}. Si falla (sin conexión, sin permisos…) la app sigue
// funcionando con los datos del propio móvil y lo reintenta más tarde.
//
// La identidad usa la librería de Auth de Firebase. El documento se lee y se guarda con la API
// REST de Firestore (con el token de esa identidad): la librería de Firestore falla de forma
// interna al cargar otra página en la misma sesión, y así además se carga mucho menos código.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const C = window.Comidas;
const P = window.Planner;
const PUSH_DELAY = 1500; // espera a que dejes de tocar cosas antes de subir

let auth = null;
let ready = false;
let dirty = false;
let timer = null;

const docUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${auth.currentUser.uid}`;

async function request(method, url, body) {
  const token = await auth.currentUser.getIdToken();
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

// Una sola conexión a la vez
let connecting = null;
function connect() {
  if (ready) return Promise.resolve(true);
  if (!connecting) connecting = doConnect().finally(() => { connecting = null; });
  return connecting;
}

async function doConnect() {
  try {
    auth = getAuth(initializeApp(firebaseConfig));
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);

    const remote = await readRemote();
    const action = P.decideSync({ local: C.state, remote });
    if (action === 'adopt') {
      C.adoptState(P.deserializeRemote(remote));
      C.toast('Datos recuperados de la nube');
    } else if (action === 'upload') {
      await push();
    }
    ready = true;
    return true;
  } catch (err) {
    console.warn('Nube no disponible por ahora:', err);
    return false;
  }
}

async function push() {
  const data = P.serializeState(C.state, Date.now());
  if (!C.state.updatedAt) { C.state.updatedAt = data.updatedAt; C.save({ touch: false }); }
  await writeRemote(data);
  dirty = false;
}

async function flush() {
  if (!dirty) return;
  if (!(await connect())) return;
  try { await push(); } catch (err) { dirty = true; console.warn('No se pudo subir:', err); }
}

C.onSave = () => {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(flush, PUSH_DELAY);
};
window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

connect();
