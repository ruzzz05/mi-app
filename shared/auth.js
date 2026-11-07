// Puerta de entrada de la app: ninguna página se ve sin una sesión iniciada (usuario + contraseña).
// Va en el <head> de cada página, antes que nada. Carga Firebase Auth y muestra el login encima
// hasta que hay sesión. La sesión se guarda en el navegador.
//
// Nunca deja la pantalla en blanco o en negro:
//  - Sin sesión conocida en este dispositivo, una pantalla "Cargando…" (con el paso y los segundos)
//    tapa la página mientras se comprueba. Si tarda más del límite, pasa al login (o a "Reintentar"
//    si ni siquiera ha cargado Firebase).
//  - Si ya se inició sesión aquí, la página se muestra al instante y se comprueba en segundo plano
//    (iOS puede tardar en abrir donde Firebase guarda la sesión).
// Es solo de interfaz: lo que protege los datos son las reglas de Firestore.
//
// Expone window.MiAuth (ready, auth, username, signOut). Para los tests (shared/tests/gate.test.html)
// se puede definir antes window.MiAuthTest = { loadSdk, timeoutMs, reload }.
(function () {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const PENDING_PREFIX = 'pending-sync.'; // otras apps marcan aquí que tienen cambios sin subir
  const SESSION_KEY = 'miapp.session';    // nombre de la última cuenta que inició sesión aquí (no es ningún secreto)
  const hooks = window.MiAuthTest || {};
  const TIMEOUT_MS = hooks.timeoutMs || 8000;
  const base = new URL('.', document.currentScript.src);

  const remember = name => {
    try { if (name) localStorage.setItem(SESSION_KEY, name); else localStorage.removeItem(SESSION_KEY); }
    catch (e) { /* sin almacenamiento */ }
  };
  let stored = null;
  try { stored = localStorage.getItem(SESSION_KEY); } catch (e) { /* sin almacenamiento */ }

  let resolveReady;
  const MiAuth = window.MiAuth = {
    ready: new Promise(r => { resolveReady = r; }),
    auth: null,
    username: stored,
    signOut: null
  };

  let overlay = null;
  let settled = false;      // ya se mostró el login o la página
  let step = 'sdk';         // 'sdk' (cargando Firebase) | 'session' (leyendo la sesión)
  const t0 = Date.now();
  const STEP_TEXT = { sdk: 'Cargando Firebase', session: 'Comprobando la sesión' };
  const seconds = () => Math.round((Date.now() - t0) / 1000);

  function hasPending() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith(PENDING_PREFIX)) return true;
      }
    } catch (e) { /* sin almacenamiento */ }
    return false;
  }

  function reveal(user, core) {
    MiAuth.username = core.emailToUsername(user.email);
    remember(MiAuth.username);
    settled = true;
    if (overlay) { overlay.remove(); overlay = null; }
    resolveReady(user);
  }

  const STYLE = `
    .auth-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;
      justify-content:center;padding:24px;background:var(--bg,#f4f4f4);color:var(--ink,#0a0a0a);
      font-family:var(--sans,system-ui,sans-serif)}
    .auth-card{width:100%;max-width:360px;background:var(--surface,#fff);border:1px solid var(--line,#dcdcdc);
      border-radius:var(--radius,14px);box-shadow:var(--shadow,none);padding:28px 22px}
    .auth-card h1{font-family:var(--serif,inherit);font-size:28px;margin:0 0 6px}
    .auth-card p{margin:0 0 16px;font-size:14px;color:var(--ink-2,#4a4a4a)}
    .auth-card .auth-detail{margin:12px 0 0;font-size:12px;color:var(--ink-3,#8a8a8a)}
    .auth-tabs{display:flex;gap:8px;margin-bottom:16px}
    .auth-tabs button{flex:1;min-height:40px;border:1px solid var(--line,#dcdcdc);border-radius:999px;
      background:transparent;color:var(--ink-2,#4a4a4a);font:inherit;font-weight:600}
    .auth-tabs button.on{background:var(--btn-bg,#0a0a0a);color:var(--btn-ink,#fff);border-color:var(--btn-bg,#0a0a0a)}
    .auth-card label{display:block;font-size:13px;color:var(--ink-2,#4a4a4a);margin:12px 0 6px}
    .auth-card input{width:100%;box-sizing:border-box;min-height:46px;padding:0 14px;font:inherit;font-size:16px;
      color:var(--ink,#0a0a0a);background:var(--bg,#f4f4f4);border:1px solid var(--line,#dcdcdc);border-radius:10px}
    .auth-card .auth-go{width:100%;min-height:48px;margin-top:20px;border:0;border-radius:999px;font:inherit;
      font-weight:700;background:var(--btn-bg,#0a0a0a);color:var(--btn-ink,#fff)}
    .auth-card .auth-go:disabled{opacity:.6}
    .auth-error{min-height:20px;margin:12px 0 0;font-size:13px;color:#d70015}`;

  // Pantalla completa opaca: tapa la página. Devuelve la tarjeta donde se pone el contenido.
  function showOverlay(note) {
    if (overlay) overlay.remove();
    if (!document.getElementById('auth-style')) {
      const st = document.createElement('style');
      st.id = 'auth-style';
      st.textContent = STYLE;
      document.head.appendChild(st);
    }
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = '<div class="auth-card"><h1>Mi App</h1><p class="auth-note"></p></div>';
    document.documentElement.appendChild(overlay);
    const card = overlay.firstChild;
    card.querySelector('.auth-note').textContent = note;
    return card;
  }

  function addDetail(card) {
    const d = document.createElement('p');
    d.className = 'auth-detail';
    d.textContent = STEP_TEXT[step] + ' · ' + seconds() + ' s';
    card.appendChild(d);
    return d;
  }

  // "Cargando…" mientras no se sabe si hay sesión; el detalle se actualiza cada segundo
  function showLoading() {
    const card = showOverlay('Cargando…');
    const detail = addDetail(card);
    const tick = setInterval(() => {
      if (settled || !detail.isConnected) { clearInterval(tick); return; }
      detail.textContent = STEP_TEXT[step] + ' · ' + seconds() + ' s';
    }, 1000);
  }

  function showBlocked(message) {
    const card = showOverlay(message);
    addDetail(card);
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'auth-go';
    go.textContent = 'Reintentar';
    go.addEventListener('click', () => (hooks.reload || (() => location.reload()))());
    card.appendChild(go);
  }

  function showLogin(sdk, core, auth, note) {
    settled = true;
    remember(null); // no hay sesión: que la próxima vez empiece con la pantalla de carga
    const anonymous = !!(auth.currentUser && auth.currentUser.isAnonymous);
    const card = showOverlay(note || (anonymous ? 'Crea tu cuenta para conservar tus datos.' : 'Entra con tu cuenta para continuar.'));
    let mode = anonymous ? 'register' : 'login';

    card.insertAdjacentHTML('beforeend', `
      <div class="auth-tabs">
        <button type="button" data-mode="login">Entrar</button>
        <button type="button" data-mode="register">Crear cuenta</button>
      </div>
      <form novalidate>
        <label for="auth-user">Usuario</label>
        <input id="auth-user" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false">
        <label for="auth-pass">Contraseña</label>
        <input id="auth-pass" name="password" type="password">
        <p class="auth-error" role="alert"></p>
        <button class="auth-go" type="submit"></button>
      </form>`);

    const form = card.querySelector('form');
    const user = form.elements.username;
    const pass = form.elements.password;
    const err = card.querySelector('.auth-error');
    const go = card.querySelector('.auth-go');

    function setMode(m) {
      mode = m;
      card.querySelectorAll('.auth-tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
      go.textContent = m === 'login' ? 'Entrar' : 'Crear cuenta';
      pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      err.textContent = '';
    }
    card.querySelectorAll('.auth-tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    setMode(mode);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = core.validateUsername(user.value) || (mode === 'register' ? core.validatePassword(pass.value) : '') || '';
      if (err.textContent) return;
      if (mode === 'login' && !pass.value) { err.textContent = 'Escribe tu contraseña.'; return; }
      go.disabled = true;
      try {
        const email = core.usernameToEmail(user.value);
        if (mode === 'login') {
          await sdk.signInWithEmailAndPassword(auth, email, pass.value);
        } else if (auth.currentUser && auth.currentUser.isAnonymous) {
          // Conserva el mismo uid, y con él los datos que ya hay en la nube
          await sdk.linkWithCredential(auth.currentUser, sdk.EmailAuthProvider.credential(email, pass.value));
        } else {
          await sdk.createUserWithEmailAndPassword(auth, email, pass.value);
        }
        await auth.currentUser.getIdToken(true); // las reglas de Firestore ven así el proveedor nuevo
        reveal(auth.currentUser, core);
      } catch (ex) {
        console.warn('Error de cuenta:', ex);
        err.textContent = core.authErrorMessage(ex && ex.code);
        go.disabled = false;
      }
    });
  }

  // Carga de verdad: nuestro authcore + config y el SDK de Firebase Auth
  async function loadSdkFromNetwork() {
    const [, cfg, app, a] = await Promise.all([
      import(new URL('authcore.js', base)),
      import(new URL('firebase-config.js', base)),
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js')
    ]);
    return { core: window.MiAuthCore, sdk: a, auth: a.getAuth(app.initializeApp(cfg.firebaseConfig)) };
  }

  let loaded = null; // { core, sdk, auth } cuando Firebase ya ha cargado

  async function start() {
    try {
      loaded = await (hooks.loadSdk || loadSdkFromNetwork)();
      MiAuth.auth = loaded.auth;
      MiAuth.signOut = async function () {
        if (hasPending() && !confirm('Tienes cambios sin subir a la nube. Si cierras sesión y entra otra cuenta en este dispositivo se perderán. ¿Cerrar sesión igualmente?')) return false;
        remember(null);
        await loaded.sdk.signOut(loaded.auth);
        (hooks.reload || (() => location.reload()))();
        return true;
      };
      step = 'session';
      await loaded.auth.authStateReady();
    } catch (ex) {
      console.warn('No se pudo comprobar la sesión:', ex);
      if (stored) return; // ya se inició sesión aquí: la página sigue visible y funciona con lo guardado
      settled = true;
      showBlocked('No se pudo comprobar tu sesión. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }

    const { core, sdk, auth } = loaded;
    if (auth.currentUser && !auth.currentUser.isAnonymous) reveal(auth.currentUser, core);
    else if (!settled) showLogin(sdk, core, auth); // si el límite de tiempo ya mostró el login, no se repite
  }

  // Si tarda demasiado, mejor algo que se pueda usar que una pantalla en negro
  setTimeout(() => {
    if (settled || stored) return; // con sesión conocida la página ya se ve
    if (loaded) {
      // Firebase cargó pero la sesión no responde: se puede entrar de nuevo; si la sesión llega
      // más tarde, el login se quita solo.
      showLogin(loaded.sdk, loaded.core, loaded.auth, 'No se pudo comprobar tu sesión a tiempo. Entra de nuevo.');
      loaded.auth.onAuthStateChanged(u => { if (u && !u.isAnonymous) reveal(u, loaded.core); });
    } else {
      showBlocked('Está tardando demasiado en cargar. Comprueba la conexión e inténtalo de nuevo.');
    }
  }, TIMEOUT_MS);

  if (!stored) showLoading(); // sin sesión conocida: tapar la página ya, con algo visible
  start();
})();
