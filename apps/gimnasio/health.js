// Salud desde Google Health (camino sin servidor): el navegador pide un token a Google Identity
// Services (dura ~1 h, hay que pedirlo con un toque) y consulta la API con él.
//   - Hoy: pasos y calorías de hoy, y la recuperación (sueño, pulso en reposo y VFC).
//   - Perfil: la evolución de los últimos días.
// Los datos se guardan solo en el móvil (nada de esto se sube a Firebase).
// A.health.state() dice en qué punto está; Hoy y Perfil se repintan solos cuando cambia.
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const H = window.HealthCore;
  const CFG = window.GoogleHealthConfig || {};
  const BASE = 'https://www.googleapis.com/auth/googlehealth.';
  const SCOPE_ACTIVITY = BASE + 'activity_and_fitness.readonly';
  const SCOPE_SLEEP = BASE + 'sleep.readonly';
  const SCOPE_METRICS = BASE + 'health_metrics_and_measurements.readonly';
  const SCOPES = [SCOPE_ACTIVITY, SCOPE_SLEEP, SCOPE_METRICS];
  const API = 'https://health.googleapis.com/v4/users/me/dataTypes/';
  const TOKEN_KEY = 'gimnasio.google.token';
  const CACHE_KEY = 'gimnasio.hoy';          // pasos y calorías de hoy
  const SALUD_KEY = 'gimnasio.salud';        // sueño, pulso, VFC y pasos de los últimos días
  const CONNECTED_KEY = 'gimnasio.google.connected'; // ya diste permiso alguna vez: la ventana no pide confirmar
  const HEALTH_FRESH_MS = 30 * 60 * 1000;    // la salud de los últimos días se vuelve a pedir pasados 30 minutos
  const DAYS = 14;                           // días de historial que se enseñan
  const BASELINE_DAYS = 14;                  // días anteriores que forman la referencia personal

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };

  let loading = false;
  let lastError = '';

  const today = () => G.dayOf(Date.now());
  const tokenObj = () => store.get(TOKEN_KEY);
  const token = () => { const t = tokenObj(); return H.tokenValid(t, Date.now()) ? t.token : null; };
  // Un token guardado antes de existir "scope" solo tenía el permiso de actividad
  const grantedScope = () => { const t = tokenObj(); return t && t.scope !== undefined ? t.scope : SCOPE_ACTIVITY; };
  const missing = () => H.missingScopes(grantedScope(), SCOPES);
  const changed = () => { if (A.current() === 'hoy' || A.current() === 'perfil') A.render(); };

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

  // prompt: '' (puede abrir una ventana), 'consent' (pide confirmar) o 'none' (sin ventana: solo funciona si ya diste permiso)
  function requestToken(prompt) {
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CFG.clientId,
        scope: SCOPES.join(' '),
        callback: r => (r.error
          ? reject(new Error(r.error_description || r.error))
          : resolve({ token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000, scope: r.scope || '' })),
        error_callback: e => reject(new Error(e && e.type === 'popup_closed'
          ? 'Cerraste la ventana de Google antes de terminar'
          : 'No se pudo abrir la ventana de Google' + (e && e.type ? ' (' + e.type + ')' : '')))
      });
      client.requestAccessToken({ prompt: prompt == null ? (store.get(CONNECTED_KEY) ? '' : 'consent') : prompt });
    });
  }

  // ---------- Consulta de la API ----------
  async function call(url, accessToken, init) {
    const res = await fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' } }, init));
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch (e) { /* sin detalle */ }
      const err = new Error(msg || 'Google respondió ' + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  const post = (type, accessToken, body) =>
    call(API + type + '/dataPoints:rollUp', accessToken, { method: 'POST', body: JSON.stringify(body) });
  // list devuelve del más reciente al más antiguo: pedir los últimos N no necesita filtros
  const list = (type, accessToken, n) => call(API + type + '/dataPoints?pageSize=' + n, accessToken, { method: 'GET' });

  async function fetchToday(accessToken) {
    const body = Object.assign({ windowSize: '86400s' }, { range: H.todayRange(Date.now()) });
    const [steps, total] = await Promise.all([post('steps', accessToken, body), post('total-calories', accessToken, body)]);
    let active = null;
    try { active = H.sumRollup(await post('active-energy-burned', accessToken, body)); }
    catch (e) { if (e.status === 401) throw e; } // las calorías activas son opcionales
    return { steps: H.sumRollup(steps), total: H.sumRollup(total), active };
  }

  // Sueño, pulso en reposo, VFC y pasos de los últimos días. Cada tipo falla por separado:
  // se enseña lo que se pueda y se dice qué ha fallado.
  async function fetchHealth(accessToken) {
    const lack = missing();
    const first = new Date(); first.setDate(first.getDate() - (DAYS - 1)); first.setHours(0, 0, 0, 0);
    const last = new Date(); last.setDate(last.getDate() + 1); last.setHours(0, 0, 0, 0);
    const hourly = { range: { startTime: first.toISOString(), endTime: last.toISOString() }, windowSize: '3600s' };

    const jobs = {
      sleep: lack.includes(SCOPE_SLEEP) ? null : () => list('sleep', accessToken, 16).then(H.sleepNights),
      rhr: lack.includes(SCOPE_METRICS) ? null : () => list('daily-resting-heart-rate', accessToken, 30).then(r => H.dailyValues(r, 'dailyRestingHeartRate', 'beatsPerMinute')),
      hrv: lack.includes(SCOPE_METRICS) ? null : () => list('daily-heart-rate-variability', accessToken, 30).then(r => H.dailyValues(r, 'dailyHeartRateVariability', 'averageHeartRateVariabilityMilliseconds')),
      steps: lack.includes(SCOPE_ACTIVITY) ? null : () => post('steps', accessToken, hourly).then(H.stepsByDay)
    };
    const days = {}, errors = {};
    await Promise.all(Object.entries(jobs).map(async ([key, job]) => {
      days[key] = {};
      if (!job) return;
      try { days[key] = await job(); }
      catch (e) { if (e.status === 401) throw e; errors[key] = e.message || String(e); }
    }));
    return { at: Date.now(), days, errors };
  }

  async function refresh(opts) {
    const accessToken = token();
    if (!accessToken || loading) return;
    const force = !!(opts && opts.force);
    // Tras un error no se reintenta solo (repintar la pantalla volvería a pedir y a fallar sin fin):
    // hace falta pulsar "Reintentar"
    if (!force && lastError) return;
    const salud = store.get(SALUD_KEY);
    const needToday = force || !H.summaryFresh(store.get(CACHE_KEY), today(), Date.now());
    const needHealth = force || !salud || Date.now() - Number(salud.at) >= HEALTH_FRESH_MS;
    if (!needToday && !needHealth) return;
    loading = true;
    lastError = '';
    changed();
    try {
      await Promise.all([
        needToday ? fetchToday(accessToken).then(d => store.set(CACHE_KEY, Object.assign({ day: today(), at: Date.now() }, d))) : null,
        needHealth ? fetchHealth(accessToken).then(d => store.set(SALUD_KEY, d)) : null
      ]);
    } catch (err) {
      if (err.status === 401) store.del(TOKEN_KEY); // el permiso caducó: toca volver a conectar
      else lastError = err.message || String(err);
      console.warn('Google Health:', err);
    } finally {
      loading = false;
      changed();
    }
  }

  // Debe llamarse desde un toque (abre la ventana de Google). Si faltan permisos nuevos, Google pide confirmarlos.
  async function connect() {
    lastError = '';
    try {
      await loadGsi();
      const t = await requestToken(missing().length ? 'consent' : undefined);
      store.set(TOKEN_KEY, t);
      store.set(CONNECTED_KEY, true);
      await refresh({ force: true });
    } catch (err) {
      lastError = err.message || String(err);
      console.warn('Google Health:', err);
      changed();
    }
  }

  // ---------- Sincronización automática ----------
  // Al abrir la app (y al volver a ella) se actualizan los datos sin pulsar nada. Si el token caducó
  // pero ya diste permiso alguna vez, se pide uno nuevo SIN ventana (prompt "none"); si Google no lo
  // concede así, queda el botón "Volver a conectar" (una ventana necesita un toque tuyo).
  const SILENT_EVERY_MS = 5 * 60 * 1000;
  let lastSilent = 0;

  async function silentConnect() {
    if (!store.get(CONNECTED_KEY) || token() || Date.now() - lastSilent < SILENT_EVERY_MS) return;
    lastSilent = Date.now();
    loading = true;
    changed();
    let t = null;
    try { await loadGsi(); t = await requestToken('none'); store.set(TOKEN_KEY, t); }
    catch (err) { console.warn('Google Health (sin ventana):', err); }
    loading = false;
    if (t) await refresh({ force: true }); else changed();
  }

  function autoSync() {
    if (!CFG.clientId) return;
    lastError = ''; // una apertura nueva siempre vuelve a intentarlo (una vez)
    if (token()) refresh(); else silentConnect();
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSync(); });

  // ---------- Lo que enseñan las pantallas ----------
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
    return { kind, error: lastError, summary, connected: !!token(), missing: missing(), healthErrors: (store.get(SALUD_KEY) || {}).errors || {} };
  }

  // Último valor de los dos últimos días (el pulso en reposo y la VFC a veces se calculan con retraso)
  function recent(values, day) {
    for (const d of H.lastDays(day, 2).reverse()) if (values && Number.isFinite(values[d])) return { day: d, value: values[d] };
    return null;
  }

  // Recuperación de hoy: puntuación + los datos que la forman. null si todavía no hay nada que enseñar.
  function recovery() {
    const salud = store.get(SALUD_KEY);
    if (!salud || !salud.days) return null;
    const day = today();
    const night = (salud.days.sleep || {})[day] || null;
    const rhr = recent(salud.days.rhr, day), hrv = recent(salud.days.hrv, day);
    const rhrBase = H.baseline(salud.days.rhr, day, BASELINE_DAYS), hrvBase = H.baseline(salud.days.hrv, day, BASELINE_DAYS);
    const score = H.recoveryScore({
      sleepMinutes: night ? night.minutesAsleep : null,
      hrv: hrv ? hrv.value : null, hrvBase, rhr: rhr ? rhr.value : null, rhrBase
    });
    if (!score && !night && !rhr && !hrv) return null;
    return { score, night, rhr, hrv, rhrBase, hrvBase, at: salud.at };
  }

  // Serie de los últimos días para las gráficas de Perfil: [{ day, value|null }, ...]
  function history() {
    const salud = store.get(SALUD_KEY);
    if (!salud || !salud.days) return null;
    const days = H.lastDays(today(), DAYS);
    const series = f => days.map(day => ({ day, value: f(day) }));
    const sleep = salud.days.sleep || {};
    return {
      at: salud.at, errors: salud.errors || {},
      sleep: series(d => (sleep[d] ? sleep[d].minutesAsleep / 60 : null)),
      rhr: series(d => (Number.isFinite((salud.days.rhr || {})[d]) ? salud.days.rhr[d] : null)),
      hrv: series(d => (Number.isFinite((salud.days.hrv || {})[d]) ? salud.days.hrv[d] : null)),
      steps: series(d => (Number.isFinite((salud.days.steps || {})[d]) ? salud.days.steps[d] : null))
    };
  }

  A.health = { state, connect, refresh, autoSync, recovery, history, SCOPES, preload: () => { if (CFG.clientId) loadGsi().catch(() => {}); } };

  autoSync(); // al abrir la app
})();
