// Copia de seguridad en Firebase, sin iniciar sesión: cada instalación usa una identidad anónima
// y guarda su estado en users/{identidad}. Si falla (sin conexión, sin permisos…) la app sigue
// funcionando con los datos del propio móvil y lo reintenta más tarde.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const C = window.Comidas;
const P = window.Planner;
const PUSH_DELAY = 1500; // espera a que dejes de tocar cosas antes de subir

let ref = null;
let ready = false;
let dirty = false;
let timer = null;

// Una sola conexión a la vez: dos lecturas simultáneas del mismo documento hacen fallar a Firestore.
let connecting = null;
function connect() {
  if (ready) return Promise.resolve(true);
  if (!connecting) connecting = doConnect().finally(() => { connecting = null; });
  return connecting;
}

async function doConnect() {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    ref = doc(getFirestore(app), 'users', auth.currentUser.uid);

    const snap = await getDoc(ref);
    const remote = snap.exists() ? snap.data() : null;
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
  await setDoc(ref, data);
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
