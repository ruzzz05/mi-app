// Buzón en la nube: el Atajo de iOS escribe cada pago con tarjeta en Firestore y aquí se recogen al abrir
// la app: se guardan en el móvil y se borran del buzón. Si falla (sin sesión, sin conexión…) no pasa nada:
// los pagos esperan en la nube hasta la próxima vez.
//   users/{uid}/gastosInbox/{id} -> el buzón de cada cuenta. El Atajo escribe sin sesión, con la clave de la cuenta.
//   users/{uid}/gastos/inbox     -> esa clave (campo k). La crea la app la primera vez; las reglas de Firestore la comprueban.
//   gastosInbox/{id}             -> el buzón antiguo común: solo lo recoge la cuenta dueña (config.js).
import { firebaseConfig } from '../../shared/firebase-config.js';

const G = window.Gastos;
const P = window.Planner;
const M = window.MiAuth;
const ROOT = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/`;
const KEY_STORE = 'gastos.inboxKey.';   // + uid: la clave del buzón, para enseñar el Atajo también sin conexión
let running = false;

const uid = () => M.auth.currentUser.uid;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
};

async function call(method, url, body) {
  const token = await M.auth.currentUser.getIdToken();
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) throw new Error('Firestore respondió ' + res.status);
  return method === 'DELETE' ? null : res.json();
}

// Deja a la vista de la pantalla Automático el texto y la dirección del Atajo de esta cuenta
function publish(key) {
  G.inboxInfo = { key, body: P.shortcutBody(key), url: P.shortcutUrl(firebaseConfig.projectId, uid(), firebaseConfig.apiKey) };
  // Si la pantalla ya está pintada solo se cambian esos dos textos: repintarla entera borraría la categoría
  // que se esté eligiendo en un pago por revisar
  const put = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  put('tut-body', G.inboxInfo.body);
  put('tut-url', G.inboxInfo.url);
}

// La clave del buzón de la cuenta: la de la nube si existe; si no, se crea y se guarda
async function ensureKey() {
  const local = store.get(KEY_STORE + uid());
  if (P.isInboxKey(local)) publish(local);
  try {
    const url = ROOT + `users/${uid()}/gastos/inbox`;
    const doc = await call('GET', url);
    const remote = doc && doc.fields && doc.fields.k && doc.fields.k.stringValue;
    let key = remote;
    if (!P.isInboxKey(remote)) {
      key = P.isInboxKey(local) ? local : P.inboxKeyFrom(crypto.getRandomValues(new Uint8Array(12)));
      await call('PATCH', url, { fields: { k: { stringValue: key } } });
    }
    store.set(KEY_STORE + uid(), key);
    if (!G.inboxInfo || G.inboxInfo.key !== key) publish(key);
  } catch (e) { /* se reintenta en la próxima apertura */ }
}

async function collect() {
  if (running || !M || !M.auth || !M.auth.currentUser) return;
  running = true;
  try {
    // El buzón de la cuenta y, solo para la dueña, el antiguo común
    const sources = P.inboxSources((window.GastosConfig || {}).inboxOwnerUid, uid());
    const lists = await Promise.all(sources.map(src => call('GET', ROOT + src + '?pageSize=100')));
    const documents = lists.flatMap(l => (l && l.documents) || []);
    if (!documents.length) return;
    const known = new Set(G.state.expenses.map(e => e.id));
    const fresh = documents.map(P.fromInboxDoc).filter(e => e && !known.has(e.id));
    if (fresh.length) {
      G.addIncoming(fresh);
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
  ensureKey();
  await G.cloudReady;
  collect();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) collect(); });
})();
