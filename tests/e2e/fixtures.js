// Utilidades de los tests de pantalla.
// - Sirve los archivos locales como si vinieran de https://ruzzz05.github.io/mi-app/ (el resto de
//   direcciones, como Firebase, van a internet de verdad).
// - Inicia sesión con la cuenta de pruebas (la crea si no existe). Credenciales en
//   tests/e2e/credenciales.local.json (no se sube al repositorio).
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGIN = 'https://ruzzz05.github.io';
const PREFIX = '/mi-app/';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.jpg': 'image/jpeg'
};

const credentials = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'credenciales.local.json'), 'utf8'));

// Archivo local que corresponde a una URL de la web (o null si no es de nuestra web)
function localFile(url) {
  const u = new URL(url);
  if (u.origin !== ORIGIN || !u.pathname.startsWith(PREFIX)) return null;
  let rel = decodeURIComponent(u.pathname.slice(PREFIX.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, rel);
  return file.startsWith(ROOT) ? file : null;
}

const offlineContexts = new WeakSet();

// Corta o devuelve la red. Sin red, el servidor local también rechaza las peticiones (como una red caída de verdad):
// así solo abre la app lo que el service worker tenga en su caché.
async function setOffline(context, off) {
  if (off) offlineContexts.add(context); else offlineContexts.delete(context);
  await context.setOffline(off);
}

async function serveLocal(context) {
  await context.route(`${ORIGIN}${PREFIX}**`, route => {
    if (offlineContexts.has(context)) return route.abort('internetdisconnected');
    const file = localFile(route.request().url());
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: 'no existe' });
    return route.fulfill({
      status: 200,
      body: fs.readFileSync(file),
      headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }
    });
  });
}

// Hay sesión de Firebase y ya no está la pantalla de login encima.
const signedIn = () => !!(window.MiAuth && window.MiAuth.auth && window.MiAuth.auth.currentUser) && !document.querySelector('.auth-overlay');

// Entra en la app indicada ('apps/comidas/index.html'). Si no hay sesión, inicia sesión o crea la cuenta.
async function openApp(page, appPath) {
  const { usuario, clave } = credentials();
  await page.goto(appPath);
  const user = page.locator('#auth-user');
  const state = await Promise.race([
    user.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'login'),
    page.waitForFunction(signedIn, null, { timeout: 30000 }).then(() => 'app')
  ]);
  if (state === 'app') return;

  const submit = async mode => {
    await page.locator(`.auth-tabs [data-mode="${mode}"]`).click();
    await user.fill(usuario);
    await page.locator('#auth-pass').fill(clave);
    await page.locator('.auth-go').click();
    return Promise.race([
      page.waitForFunction(signedIn, null, { timeout: 20000 }).then(() => true),
      page.waitForFunction(() => { const e = document.querySelector('.auth-error'); return e && e.textContent.trim(); }, null, { timeout: 20000 }).then(() => false)
    ]);
  };
  if (!(await submit('login'))) {                         // la cuenta no existe todavía: se crea
    if (!(await submit('register'))) {
      throw new Error('No se pudo entrar ni crear la cuenta: ' + await page.locator('.auth-error').textContent());
    }
  }
}

// PNG de color liso (para probar la subida de fotos sin depender de archivos del disco)
function makePng(w, h, [r, g, b] = [220, 60, 40]) {
  const zlib = require('zlib');
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Borra en Firestore todo lo de la cuenta de pruebas (estado, fotos, gimnasio) usando su propia sesión.
async function wipeRemote(page) {
  await page.evaluate(async () => {
    const A = window.MiAuth;
    const token = await A.auth.currentUser.getIdToken();
    const uid = A.auth.currentUser.uid;
    const root = `https://firestore.googleapis.com/v1/projects/mi-app-490b5/databases/(default)/documents/users/${uid}`;
    const call = (method, url) => fetch(url, { method, headers: { Authorization: 'Bearer ' + token } });
    for (const sub of ['fotos', 'gymlogs', 'gym', 'gastos']) {
      const res = await call('GET', `${root}/${sub}?pageSize=100`);
      if (!res.ok) continue;
      const { documents = [] } = await res.json();
      for (const d of documents) await call('DELETE', `https://firestore.googleapis.com/v1/${d.name}`);
    }
    await call('DELETE', root);
  });
}

// Empieza de cero: entra, borra todo lo guardado en la nube y en el navegador y vuelve a abrir la app.
async function freshStart(page, appPath) {
  await openApp(page, appPath);
  await wipeRemote(page);
  await page.evaluate(async () => {
    const keep = Object.keys(localStorage).filter(k => /firebase|auth|session|mi-app\.user/i.test(k));
    const saved = Object.fromEntries(keep.map(k => [k, localStorage.getItem(k)]));
    localStorage.clear();
    Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
    await new Promise(r => { const q = indexedDB.deleteDatabase('comidas-fotos'); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  });
  await openApp(page, appPath);
}

const test = base.test.extend({
  context: async ({ context }, use) => { await serveLocal(context); await use(context); }
});

module.exports = { test, expect: base.expect, setOffline, openApp, freshStart, wipeRemote, makePng, serveLocal, localFile, ORIGIN, PREFIX };
