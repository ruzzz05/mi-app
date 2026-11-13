// Widget de Gastos para el iPhone. Se pega en la app Scriptable (no forma parte de la web):
// enseña lo que queda del presupuesto del mes y el próximo cobro de una suscripción.
// Lee tu copia de la nube (users/{uid}/gastos/data) con tu cuenta de Mi App y hace las cuentas con la
// misma lógica que la app (gastoscore.js, que se baja de la web publicada).
// La primera vez hay que ejecutarlo dentro de Scriptable para iniciar sesión: la contraseña no se guarda,
// solo la llave de sesión que devuelve Firebase, en el llavero del iPhone.
// Instrucciones: apps/gastos/widget/README.md

// ---------- Lógica pura (se prueba en apps/gastos/tests/widget.test.html) ----------
const GastosWidget = (() => {
  const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const whenLabel = days => (days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`);

  // doc = documento de Firestore tal cual llega; now = Date; P = lógica de Gastos (gastoscore.js).
  // Devuelve lo que pinta el widget, o null si no hay datos que valgan.
  function model(doc, now, P) {
    const json = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
    const s = typeof json === 'string' ? P.parseCloudState(json) : null;
    if (!s) return null;
    const today = isoOf(now);
    const budget = s.budget > 0 ? s.budget : P.DEFAULT_MONTH_BUDGET;
    const st = P.monthStats(s.expenses, today.slice(0, 7), budget, today);
    const charge = P.upcomingCharges(s.subs, today, 31)[0];
    const waiting = s.expenses.filter(e => e.pending).length;
    return {
      title: st.left < 0 ? 'Te has pasado' : 'Te quedan',
      amount: P.euros(Math.abs(st.left), 0),
      over: st.left < 0,
      pct: st.pct,
      detail: `${P.euros(st.spent, 0)} de ${P.euros(budget, 0)}`,
      next: charge ? `${whenLabel(charge.days)} · ${charge.sub.name} ${P.euros(charge.sub.amount, 2)}` : null,
      pending: waiting ? `${waiting} por revisar` : null
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
globalThis.GastosWidget = GastosWidget;

// ---------- Scriptable: sesión, red y dibujo (solo corre dentro de Scriptable) ----------
if (typeof ListWidget !== 'undefined') {
  const API_KEY = 'AIzaSyCnFhLS9YxR1MnSDwwrKteWaW0CpMuqgdM';   // la misma clave pública de shared/firebase-config.js
  const PROJECT = 'mi-app-490b5';
  const SITE = 'https://ruzzz05.github.io/mi-app/';
  const DOMAIN = '@mi-app.invalid';                              // shared/authcore.js
  const KEY_REFRESH = 'miapp.gastos.refresh', KEY_UID = 'miapp.gastos.uid';
  const PURPLE = new Color('#a855f7'), RED = new Color('#e5484d');
  const INK = new Color('#f5f5f5');
  const INK2 = new Color('#a1a1aa');
  const BG = new Color('#000000');
  const TRACK = new Color('#2a2438');

  const fm = FileManager.local();
  const cachePath = name => fm.joinPath(fm.cacheDirectory(), 'miapp-gastos-' + name);

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
      if (form && GastosWidget.sessionLost(raw)) { Keychain.remove(KEY_REFRESH); Keychain.remove(KEY_UID); }
      throw new Error(GastosWidget.errorText(raw));
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

  async function loadCore() {
    const { text } = await cached('core.js', async () => {
      const req = new Request(SITE + 'apps/gastos/gastoscore.js');
      const src = await req.loadString();
      if (req.response.statusCode !== 200) throw new Error('No se pudo bajar la lógica de Gastos');
      return src;
    });
    const m = { exports: {} };
    new Function('module', text)(m);
    return m.exports;
  }

  async function loadDoc() {
    const { text, fresh } = await cached('doc.json', async () => {
      const req = new Request(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${Keychain.get(KEY_UID)}/gastos/data`);
      req.headers = { Referer: SITE, Authorization: 'Bearer ' + await idToken() };
      const body = await req.loadString();
      if (req.response.statusCode === 404) return '{}';   // la cuenta aún no tiene copia de Gastos
      if (req.response.statusCode !== 200) throw new Error('La nube respondió ' + req.response.statusCode);
      return body;
    });
    return { doc: JSON.parse(text), fresh };
  }

  function bar(pct, color, width) {
    const h = 6, ctx = new DrawContext();
    ctx.size = new Size(width, h);
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    const pill = (w, c) => { const p = new Path(); p.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2); ctx.addPath(p); ctx.setFillColor(c); ctx.fillPath(); };
    pill(width, TRACK);
    if (pct > 0) pill(Math.max(h, width * pct / 100), color);
    return ctx.getImage();
  }

  function line(w, text, font, color) {
    const t = w.addText(text);
    t.font = font; t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
    return t;
  }

  function draw(m, fresh) {
    const wide = config.widgetFamily === 'medium' || config.widgetFamily === 'large';
    const w = new ListWidget();
    w.backgroundColor = BG;
    w.url = SITE + 'apps/gastos/index.html';
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    line(w, 'GASTOS' + (fresh ? '' : ' · sin conexión'), Font.semiboldSystemFont(10), PURPLE);
    w.addSpacer(6);
    line(w, m.title, Font.systemFont(12), INK2);
    line(w, m.amount, Font.boldSystemFont(wide ? 34 : 28), m.over ? RED : INK);
    w.addSpacer(6);
    w.addImage(bar(m.pct, m.over ? RED : PURPLE, wide ? 300 : 130)).imageSize = new Size(wide ? 300 : 130, 6);
    w.addSpacer(4);
    line(w, m.detail + (wide && m.pending ? ' · ' + m.pending : ''), Font.systemFont(10), INK2);
    w.addSpacer();
    line(w, m.next || 'Sin cobros próximos', Font.mediumSystemFont(11), INK);
    return w;
  }

  function message(text) {
    const w = new ListWidget();
    w.backgroundColor = BG;
    w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);   // un aviso se reintenta pronto
    line(w, 'GASTOS', Font.semiboldSystemFont(10), PURPLE);
    w.addSpacer(6);
    const t = w.addText(text);
    t.font = Font.systemFont(12); t.textColor = INK2;
    return w;
  }

  async function build() {
    try {
      if (!Keychain.contains(KEY_REFRESH) || !Keychain.contains(KEY_UID)) await login();
      const [P, { doc, fresh }] = await Promise.all([loadCore(), loadDoc()]);
      const m = GastosWidget.model(doc, new Date(), P);
      return m ? draw(m, fresh) : message('Aún no hay datos en la nube. Abre Gastos y apunta algo.');
    } catch (e) {
      return message(String(e && e.message ? e.message : e));
    }
  }

  // Dentro de Scriptable, con sesión ya iniciada: ver el widget o cerrar la sesión
  if (config.runsInApp && Keychain.contains(KEY_REFRESH)) {
    const a = new Alert();
    a.title = 'Widget de Gastos';
    a.addAction('Ver widget');
    a.addDestructiveAction('Cerrar sesión');
    if (await a.present() === 1) { Keychain.remove(KEY_REFRESH); Keychain.remove(KEY_UID); }
  }
  const widget = await build();
  if (config.runsInWidget) Script.setWidget(widget); else await widget.presentSmall();
  Script.complete();
}
