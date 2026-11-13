// Widget de Mi-Menu para el iPhone, versión Rosa noche (la paleta de la app). Misma lógica que comidas-widget.js; solo cambian los colores.
// enseña qué toca comer (o cenar) ahora según tu menú y qué viene después.
// Lee tu copia de la nube (users/{uid}) con tu cuenta de Mi App y decide qué toca con la misma lógica que
// la app (recipes.js, planner.js y schedule.js, que se bajan de la web publicada).
// La primera vez hay que ejecutarlo dentro de Scriptable para iniciar sesión: la contraseña no se guarda,
// solo la llave de sesión que devuelve Firebase, en el llavero del iPhone.
// Instrucciones: apps/comidas/widget/README.md

// ---------- Lógica pura (se prueba en apps/comidas/tests/widget.test.html) ----------
const MenuWidget = (() => {
  const LABEL = { comida: 'Comida', cena: 'Cena' };
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const names = (entry, extras) => [entry, ...extras].filter(Boolean).map(e => e.name);

  // doc = documento de Firestore tal cual llega; now = Date; P = lógica de Mi-Menu (Planner).
  // Devuelve lo que pinta el widget, o null si no hay datos que valgan.
  function model(doc, now, P) {
    const json = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
    let raw = null;
    try { raw = typeof json === 'string' ? JSON.parse(json) : null; } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return null;
    const v = P.todayView({ menu: P.migrateState(raw).menu, now });
    if (v.status === 'none') return { status: 'none', text: 'Todavía no tienes menú' };
    if (v.status === 'notStarted') {
      const [, m, d] = v.startDate.split('-').map(Number);
      return { status: 'notStarted', text: `Tu menú empieza el ${d} de ${MONTHS[m - 1]}` };
    }
    if (v.status === 'finished') return { status: 'finished', text: 'Tu menú ha terminado' };
    const next = v.upcoming[0];
    const when = next && (next.dayOffset === 1 ? 'Mañana · ' : '') + LABEL[next.meal];
    const what = next && names(next.entry, next.extras).join(' + ');
    return {
      status: 'active',
      meal: LABEL[v.meal],
      day: `Día ${v.dayNumber} de ${v.totalDays}`,
      dishes: names(v.current, v.currentExtras),
      later: next ? `${when} · ${what || 'sin plato'}` : null
    };
  }

  const BAD_LOGIN = 'Usuario o contraseña incorrectos';
  const EXPIRED = 'La sesión ha caducado. Abre el script en Scriptable para entrar otra vez';
  const ERRORS = {
    INVALID_LOGIN_CREDENTIALS: BAD_LOGIN, INVALID_PASSWORD: BAD_LOGIN, EMAIL_NOT_FOUND: BAD_LOGIN, INVALID_EMAIL: BAD_LOGIN,
    TOKEN_EXPIRED: EXPIRED, INVALID_REFRESH_TOKEN: EXPIRED, USER_NOT_FOUND: EXPIRED, USER_DISABLED: EXPIRED,
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos. Prueba más tarde'
  };
  // El código que devuelve Firebase (a veces con texto detrás: "CODIGO : explicación") dicho en claro
  const errorCode = message => String(message || '').split(':')[0].trim();
  const errorText = message => ERRORS[errorCode(message)] || String(message || '') || 'Error de sesión';
  const sessionLost = message => ERRORS[errorCode(message)] === EXPIRED;

  return { model, errorText, sessionLost };
})();
globalThis.MenuWidget = MenuWidget;

// ---------- Scriptable: sesión, red y dibujo (solo corre dentro de Scriptable) ----------
if (typeof ListWidget !== 'undefined') {
  const API_KEY = 'AIzaSyCnFhLS9YxR1MnSDwwrKteWaW0CpMuqgdM';   // la misma clave pública de shared/firebase-config.js
  const PROJECT = 'mi-app-490b5';
  const SITE = 'https://ruzzz05.github.io/mi-app/';
  const DOMAIN = '@mi-app.invalid';                              // shared/authcore.js
  const KEY_REFRESH = 'miapp.comidas.refresh', KEY_UID = 'miapp.comidas.uid';
  const ROSA = new Color('#f4a3c0');   // acento de la paleta Rosa noche (shared/palettecore.js)
  const INK = new Color('#fbeff4'), INK2 = new Color('#b592a3'), BG = new Color('#1c1318');

  const fm = FileManager.local();
  const cachePath = name => fm.joinPath(fm.cacheDirectory(), 'miapp-comidas-' + name);

  async function post(url, body, form) {
    const req = new Request(url);
    req.method = 'POST';
    // La clave de Firebase solo admite peticiones que digan venir de la web de Mi App (Referer)
    req.headers = { Referer: SITE, 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
    req.body = form ? body : JSON.stringify(body);
    const json = await req.loadJSON();
    if (json.error) {
      const raw = json.error.message || '';
      // Sesión caducada o cuenta borrada: se olvida la llave para que el script vuelva a pedir la cuenta
      if (form && MenuWidget.sessionLost(raw)) { Keychain.remove(KEY_REFRESH); Keychain.remove(KEY_UID); }
      throw new Error(MenuWidget.errorText(raw));
    }
    return json;
  }

  // Pide usuario y contraseña (solo dentro de Scriptable) y guarda la llave de sesión
  async function login() {
    if (!config.runsInApp) throw new Error('Abre el script en Scriptable para iniciar sesión');
    const a = new Alert();
    a.title = 'Mi App';
    a.message = 'Tu usuario y contraseña de Mi App';
    a.addTextField('Usuario');
    a.addSecureTextField('Contraseña');
    a.addAction('Entrar');
    a.addCancelAction('Cancelar');
    if (await a.present() === -1) throw new Error('Sin sesión');
    const email = a.textFieldValue(0).trim().toLowerCase() + DOMAIN;
    const r = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password: a.textFieldValue(1), returnSecureToken: true });
    Keychain.set(KEY_REFRESH, r.refreshToken);
    Keychain.set(KEY_UID, r.localId);
  }

  async function idToken() {
    const r = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
      'grant_type=refresh_token&refresh_token=' + encodeURIComponent(Keychain.get(KEY_REFRESH)), true);
    if (r.refresh_token) Keychain.set(KEY_REFRESH, r.refresh_token);
    return r.id_token;
  }

  // Texto de una dirección; si no hay red (o falla) vale la última copia guardada en el iPhone
  async function cached(name, load) {
    const path = cachePath(name);
    try {
      const text = await load();
      fm.writeString(path, text);
      return { text, fresh: true };
    } catch (e) {
      if (fm.fileExists(path)) return { text: fm.readString(path), fresh: false };
      throw e;
    }
  }

  // Lógica de la app (recipes.js, planner.js y schedule.js, en ese orden) bajada de la web publicada
  async function loadCore() {
    const { text } = await cached('core.json', async () => {
      const parts = [];
      for (const f of ['recipes', 'planner', 'schedule']) {
        const req = new Request(`${SITE}apps/comidas/${f}.js`);
        const src = await req.loadString();
        if (req.response.statusCode !== 200) throw new Error('No se pudo bajar la lógica de Mi-Menu');
        parts.push(src);
      }
      return JSON.stringify(parts);
    });
    // Cada archivo se evalúa aparte y deja su parte en globalThis.Planner
    JSON.parse(text).forEach(src => new Function('module', src)({ exports: {} }));
    return globalThis.Planner;
  }

  async function loadDoc() {
    const { text, fresh } = await cached('doc.json', async () => {
      const req = new Request(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${Keychain.get(KEY_UID)}`);
      req.headers = { Referer: SITE, Authorization: 'Bearer ' + await idToken() };
      const body = await req.loadString();
      if (req.response.statusCode === 404) return '{}';   // la cuenta aún no tiene copia de Mi-Menu
      if (req.response.statusCode !== 200) throw new Error('La nube respondió ' + req.response.statusCode);
      return body;
    });
    return { doc: JSON.parse(text), fresh };
  }

  function line(w, text, font, color, lines) {
    const t = w.addText(text);
    t.font = font; t.textColor = color; t.lineLimit = lines || 1; t.minimumScaleFactor = 0.6;
    return t;
  }

  function draw(m, fresh) {
    const wide = config.widgetFamily === 'medium' || config.widgetFamily === 'large';
    const w = new ListWidget();
    w.backgroundColor = BG;
    w.url = SITE + 'apps/comidas/index.html';
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    line(w, 'MI-MENU' + (fresh ? '' : ' · sin conexión'), Font.semiboldSystemFont(10), ROSA);
    w.addSpacer(6);
    if (m.status !== 'active') {
      line(w, m.text, Font.mediumSystemFont(15), INK, 3);
      return w;
    }
    line(w, m.meal + ' · ' + m.day, Font.systemFont(12), INK2);
    w.addSpacer(2);
    line(w, m.dishes.length ? m.dishes.join(' + ') : 'Sin plato', Font.boldSystemFont(wide ? 24 : 18), INK, wide ? 2 : 3);
    w.addSpacer();
    line(w, m.later ? 'Después: ' + m.later : 'Es la última comida del menú', Font.mediumSystemFont(11), INK2);
    return w;
  }

  function message(text) {
    const w = new ListWidget();
    w.backgroundColor = BG;
    w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);   // un aviso se reintenta pronto
    line(w, 'MI-MENU', Font.semiboldSystemFont(10), ROSA);
    w.addSpacer(6);
    const t = w.addText(text);
    t.font = Font.systemFont(12); t.textColor = INK2;
    return w;
  }

  async function build() {
    try {
      if (!Keychain.contains(KEY_REFRESH) || !Keychain.contains(KEY_UID)) await login();
      const [P, { doc, fresh }] = await Promise.all([loadCore(), loadDoc()]);
      const m = MenuWidget.model(doc, new Date(), P);
      return m ? draw(m, fresh) : message('Aún no hay datos en la nube. Abre Mi-Menu y crea tu menú.');
    } catch (e) {
      return message(String(e && e.message ? e.message : e));
    }
  }

  // Dentro de Scriptable, con sesión ya iniciada: ver el widget o cerrar la sesión
  if (config.runsInApp && Keychain.contains(KEY_REFRESH)) {
    const a = new Alert();
    a.title = 'Widget de Mi-Menu';
    a.addAction('Ver widget');
    a.addDestructiveAction('Cerrar sesión');
    if (await a.present() === 1) { Keychain.remove(KEY_REFRESH); Keychain.remove(KEY_UID); }
  }
  const widget = await build();
  if (config.runsInWidget) Script.setWidget(widget); else await widget.presentSmall();
  Script.complete();
}
