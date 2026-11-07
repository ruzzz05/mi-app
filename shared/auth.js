// Puerta de entrada de la app: ninguna página se ve sin una sesión iniciada (usuario + contraseña).
// Va en el <head> de cada página, antes que nada. Oculta la página al instante, carga Firebase Auth
// y muestra el login encima hasta que hay sesión. La sesión se guarda en el navegador.
// Expone window.MiAuth (ready, auth, username, signOut). Pruebas de la lógica: shared/tests.
(function () {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const PENDING_PREFIX = 'pending-sync.'; // otras apps marcan aquí que tienen cambios sin subir
  const base = new URL('.', document.currentScript.src);

  // 1. Ocultar ya, antes de cualquier espera
  const hide = document.createElement('style');
  hide.id = 'auth-hide';
  hide.textContent = 'html{visibility:hidden}';
  document.head.appendChild(hide);

  let resolveReady;
  const MiAuth = window.MiAuth = {
    ready: new Promise(r => { resolveReady = r; }),
    auth: null,
    username: null,
    signOut: null
  };

  function hasPending() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith(PENDING_PREFIX)) return true;
      }
    } catch (e) { /* sin almacenamiento */ }
    return false;
  }

  let overlay = null;

  function reveal(user, core) {
    MiAuth.username = core.emailToUsername(user.email);
    if (overlay) { overlay.remove(); overlay = null; }
    hide.remove();
    resolveReady(user);
  }

  const STYLE = `
    .auth-overlay{position:fixed;inset:0;z-index:99999;visibility:visible;display:flex;align-items:center;
      justify-content:center;padding:24px;background:var(--bg,#f4f4f4);color:var(--ink,#0a0a0a);
      font-family:var(--sans,system-ui,sans-serif)}
    .auth-card{width:100%;max-width:360px;background:var(--surface,#fff);border:1px solid var(--line,#dcdcdc);
      border-radius:var(--radius,14px);box-shadow:var(--shadow,none);padding:28px 22px}
    .auth-card h1{font-family:var(--serif,inherit);font-size:28px;margin:0 0 6px}
    .auth-card p{margin:0 0 16px;font-size:14px;color:var(--ink-2,#4a4a4a)}
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

  function showOverlay(note) {
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

  function showBlocked(message) {
    const card = showOverlay(message);
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'auth-go';
    go.textContent = 'Reintentar';
    go.addEventListener('click', () => location.reload());
    card.appendChild(go);
  }

  function showLogin(sdk, core, auth) {
    const anonymous = !!(auth.currentUser && auth.currentUser.isAnonymous);
    const card = showOverlay(anonymous ? 'Crea tu cuenta para conservar tus datos.' : 'Entra con tu cuenta para continuar.');
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

  async function start() {
    let core, sdk, auth;
    try {
      const [, cfg, app, a] = await Promise.all([
        import(new URL('authcore.js', base)),
        import(new URL('firebase-config.js', base)),
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js')
      ]);
      core = window.MiAuthCore;
      sdk = a;
      auth = a.getAuth(app.initializeApp(cfg.firebaseConfig));
      MiAuth.auth = auth;
      await auth.authStateReady();
    } catch (ex) {
      console.warn('No se pudo comprobar la sesión:', ex);
      showBlocked('No se pudo comprobar tu sesión. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }

    MiAuth.signOut = async function () {
      if (hasPending() && !confirm('Tienes cambios sin subir a la nube. Si cierras sesión y entra otra cuenta en este dispositivo se perderán. ¿Cerrar sesión igualmente?')) return false;
      await sdk.signOut(auth);
      location.reload();
      return true;
    };

    if (auth.currentUser && !auth.currentUser.isAnonymous) reveal(auth.currentUser, core);
    else showLogin(sdk, core, auth);
  }

  start();
})();
