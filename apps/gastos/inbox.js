// Buzón en la nube: el Atajo de iOS escribe cada pago con tarjeta en Firestore (gastosInbox/{id}) y
// aquí se recogen al abrir la app: se guardan en el móvil y se borran del buzón. Si falla (sin sesión,
// sin conexión…) no pasa nada: los pagos esperan en la nube hasta la próxima vez.
import { firebaseConfig } from '../../shared/firebase-config.js';

const G = window.Gastos;
const P = window.Planner;
const M = window.MiAuth;
const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/gastosInbox`;
let running = false;

async function call(method, url) {
  const token = await M.auth.currentUser.getIdToken();
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('Firestore respondió ' + res.status);
  return method === 'GET' ? res.json() : null;
}

async function collect() {
  if (running || !M || !M.auth || !M.auth.currentUser) return;
  running = true;
  try {
    const { documents = [] } = await call('GET', BASE + '?pageSize=100');
    if (!documents.length) return;
    const known = new Set(G.state.expenses.map(e => e.id));
    const fresh = documents.map(P.fromInboxDoc).filter(e => e && !known.has(e.id)).map(G.normalize);
    if (fresh.length) {
      G.state.expenses = [...fresh, ...G.state.expenses];
      G.save(); G.render();
      G.toast(fresh.length === 1 ? 'Pago apuntado: ' + fresh[0].merchant : fresh.length + ' pagos apuntados');
    }
    // Ya guardados en el móvil (o inválidos): fuera del buzón
    await Promise.all(documents.map(d => call('DELETE', `https://firestore.googleapis.com/v1/${d.name}`)));
  } catch (e) { /* se reintenta en la próxima apertura */ }
  finally { running = false; }
}

(async () => {
  if (!M) return;
  const session = await Promise.race([M.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]);
  if (!session) return;
  collect();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) collect(); });
})();
