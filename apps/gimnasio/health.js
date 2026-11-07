// Pasos y calorías de hoy desde Google Health (camino sin servidor): el navegador pide un token a
// Google Identity Services (dura ~1 h, hay que pedirlo con un toque) y consulta la API con él.
// A.health.state() dice en qué punto está; Hoy se repinta solo cuando cambia.
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const H = window.HealthCore;
  const CFG = window.GoogleHealthConfig || {};
  const SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
  const API = 'https://health.googleapis.com/v4/users/me/dataTypes/';
  const TOKEN_KEY = 'gimnasio.google.token';
  const CACHE_KEY = 'gimnasio.hoy';
  const CONNECTED_KEY = 'gimnasio.google.connected'; // ya diste permiso alguna vez: la ventana no pide confirmar

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };

  let loading = false;
  let lastError = '';

  const today = () => G.dayOf(Date.now());
  const token = () => { const t = store.get(TOKEN_KEY); return H.tokenValid(t, Date.now()) ? t.token : null; };
  const changed = () => { if (A.current() === 'hoy') A.render(); };

  // ---------- Inicio de sesión de Google (Google Identity Services) ----------
  let gsiPromise = null;
  function loadGsi() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (!gsiPromise) {
      gsiPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = resolve;
        s.onerror = () => { gsiPromise = null; reject(new Error('No se pudo cargar el inicio de sesión de Google (¿sin conexión?)')); };
        document.head.append(s);
      });
    }
    return gsiPromise;
  }

  function requestToken() {
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CFG.clientId,
        scope: SCOPE,
        callback: r => (r.error
          ? reject(new Error(r.error_description || r.error))
          : resolve({ token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 })),
        error_callback: e => reject(new Error(e && e.type === 'popup_closed'
          ? 'Cerraste la ventana de Google antes de terminar'
          : 'No se pudo abrir la ventana de Google' + (e && e.type ? ' (' + e.type + ')' : '')))
      });
      client.requestAccessToken({ prompt: store.get(CONNECTED_KEY) ? '' : 'consent' });
    });
  }

  // ---------- Consulta de la API ----------
  async function post(type, accessToken, body) {
    const res = await fetch(API + type + '/dataPoints:rollUp', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch (e) { /* sin detalle */ }
      const err = new Error(msg || 'Google respondió ' + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function fetchToday(accessToken) {
    const body = Object.assign({ windowSize: '86400s' }, { range: H.todayRange(Date.now()) });
    const [steps, total] = await Promise.all([post('steps', accessToken, body), post('total-calories', accessToken, body)]);
    let active = null;
    try { active = H.sumRollup(await post('active-energy-burned', accessToken, body)); }
    catch (e) { if (e.status === 401) throw e; } // las calorías activas son opcionales
    return { steps: H.sumRollup(steps), total: H.sumRollup(total), active };
  }

  async function refresh(opts) {
    const accessToken = token();
    if (!accessToken || loading) return;
    const force = !!(opts && opts.force);
    // Tras un error no se reintenta solo (repintar la pantalla volvería a pedir y a fallar sin fin):
    // hace falta pulsar "Reintentar"
    if (!force && lastError) return;
    if (!force && H.summaryFresh(store.get(CACHE_KEY), today(), Date.now())) return;
    loading = true;
    lastError = '';
    changed();
    try {
      const data = await fetchToday(accessToken);
      store.set(CACHE_KEY, Object.assign({ day: today(), at: Date.now() }, data));
    } catch (err) {
      if (err.status === 401) store.del(TOKEN_KEY); // el permiso caducó: toca volver a conectar
      else lastError = err.message || String(err);
      console.warn('Google Health:', err);
    } finally {
      loading = false;
      changed();
    }
  }

  // Debe llamarse desde un toque (abre la ventana de Google)
  async function connect() {
    lastError = '';
    try {
      await loadGsi();
      const t = await requestToken();
      store.set(TOKEN_KEY, t);
      store.set(CONNECTED_KEY, true);
      await refresh({ force: true });
    } catch (err) {
      lastError = err.message || String(err);
      console.warn('Google Health:', err);
      changed();
    }
  }

  // kind: sin-config | cargando | error | datos | caducado (hay permiso guardado de otra vez) | sin-conectar
  function state() {
    const cache = store.get(CACHE_KEY);
    const summary = cache && cache.day === today() ? cache : null;
    let kind;
    if (!CFG.clientId) kind = 'sin-config';
    else if (loading) kind = 'cargando';
    else if (lastError) kind = 'error';
    else if (token()) kind = summary ? 'datos' : 'cargando';
    else kind = store.get(CONNECTED_KEY) ? 'caducado' : 'sin-conectar';
    return { kind, error: lastError, summary, connected: !!token() };
  }

  A.health = { state, connect, refresh, preload: () => { if (CFG.clientId) loadGsi().catch(() => {}); } };
})();
