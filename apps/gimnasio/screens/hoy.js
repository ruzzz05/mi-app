// Hoy, en este orden: la sincronización con Google (pequeña), los pasos, la distancia y las calorías activas,
// el entreno de hoy y, al final, la recuperación (sueño, pulso en reposo y VFC con los datos de la pulsera).
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const { h } = A;

  const fmt = n => (n == null ? '—' : Math.round(n).toLocaleString('es-ES'));
  const km = n => (n == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','));
  const longDate = () => {
    const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const hhmm = ms => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hm = min => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
  const SCOPE_NAMES = { sleep: 'sueño', metrics: 'pulso y variabilidad' };

  // ---------- 1. Sincronización con Google (una línea) ----------
  function syncLine(st) {
    const s = st.summary;
    let dot = 'ok', text, action = null;
    if (st.kind === 'sin-config') { dot = 'off'; text = 'Falta conectar con Google: hay que crear el acceso y poner su clientId en google-config.js'; }
    else if (st.kind === 'cargando') { dot = 'load'; text = 'Actualizando…'; }
    else if (st.kind === 'datos') { text = `Google Health · actualizado a las ${hhmm(s.at)}`; action = ['Actualizar', () => A.health.refresh({ force: true })]; }
    else if (st.kind === 'error') { dot = 'off'; text = 'No se pudieron cargar los datos: ' + st.error; action = ['Reintentar', () => (st.connected ? A.health.refresh({ force: true }) : A.health.connect())]; }
    else if (st.kind === 'caducado') { dot = 'off'; text = 'El permiso de Google caducó'; action = ['Volver a conectar', () => A.health.connect()]; }
    else { dot = 'off'; text = 'Sin conectar con Google'; action = ['Conectar', () => A.health.connect()]; }
    return h('div', { id: 'gy-sync', class: 'sync' }, h('i', { class: dot }), h('span', null, text),
      action ? h('button', { type: 'button', onclick: action[1] }, action[0]) : null);
  }

  // ---------- 2. Pasos, distancia y calorías activas ----------
  function tiles(st) {
    const s = st.summary;
    return h('div', { class: 'tiles3' },
      h('div', null, h('b', null, fmt(s && s.steps)), h('small', null, 'pasos')),
      h('div', null, h('b', null, km(s && s.distance)), h('small', null, 'km')),
      h('div', null, h('b', null, fmt(s && s.active)), h('small', null, 'kcal activas')));
  }

  // ---------- 3. Entreno de hoy ----------
  function workoutCard() {
    if (A.hasActive()) {
      return h('div', { id: 'wk-card', class: 'wc' }, h('small', null, 'Entreno de hoy'), h('h3', null, 'Tienes un entreno en curso'),
        h('button', { class: 'btn small', type: 'button', onclick: A.resumeWorkout }, 'Retomar'));
    }
    const t = G.todaySummary(A.allSessions(), G.dayOf(Date.now()));
    if (!t.count) {
      return h('div', { id: 'wk-card', class: 'wc' }, h('small', null, 'Entreno de hoy'), h('h3', null, 'Hoy aún no has entrenado'),
        h('button', { class: 'btn small', type: 'button', 'data-go': 'rutinas', onclick: () => A.go('rutinas') }, 'Elegir una rutina'));
    }
    const min = Math.max(1, Math.round(t.durationSec / 60));
    return h('div', { id: 'wk-card', class: 'wc' }, h('small', null, 'Entreno de hoy'), h('h3', null, t.names.join(' · ')),
      h('small', null, `${t.sets} series · ${t.durationSec ? min + ' min · ' : ''}${Math.round(t.volume).toLocaleString('es-ES')} kg de volumen`));
  }

  // ---------- 4. Recuperación ----------
  function recoveryCard(st) {
    if (st.kind === 'sin-config' || st.kind === 'sin-conectar' || st.kind === 'caducado') return null;

    const needSleep = st.missing.includes(A.health.SCOPES[1]), needMetrics = st.missing.includes(A.health.SCOPES[2]);
    const lack = [needSleep ? SCOPE_NAMES.sleep : null, needMetrics ? SCOPE_NAMES.metrics : null].filter(Boolean);
    const permiso = lack.length ? h('div', { class: 'wc' },
      h('h3', null, 'Faltan permisos para la recuperación'),
      h('small', null, `Google aún no te ha dado acceso a: ${lack.join(' y ')}. Pulsa para ampliarlos (y deja marcadas todas las casillas).`),
      h('button', { class: 'btn small', type: 'button', onclick: () => A.health.connect() }, 'Ampliar permisos')) : null;

    const rec = A.health.recovery();
    const failed = Object.entries(st.healthErrors || {}).map(([k, m]) => `${{ sleep: 'sueño', rhr: 'pulso', hrv: 'VFC', steps: 'pasos' }[k] || k}: ${m}`);
    const errors = failed.length ? h('p', { class: 'hint err' }, 'No se pudo leer ' + failed.join(' · ')) : null;

    if (!rec) {
      return h('div', { class: 'stack' }, permiso,
        h('div', { class: 'wc' }, h('h3', null, 'Recuperación'),
          h('small', null, st.kind === 'cargando' ? 'Calculando…' : 'Todavía no hay datos de esta noche. Duerme con la pulsera puesta y abre la app por la mañana.')),
        errors);
    }

    const line = (label, value, base) => h('div', { class: 'rl' }, h('span', null, label), h('b', null, value), base ? h('small', null, base) : null);
    const s = rec.score;
    return h('div', { class: 'stack' }, permiso,
      h('div', { class: 'rec' + (s ? '' : ' empty') },
        h('div', { class: 'sc' },
          h('b', null, s ? s.score : '—'), h('small', null, ' / 100'),
          h('div', { class: 'lab' }, h('b', null, s ? s.label : 'Sin puntuación'), h('small', null, 'Recuperación'))),
        s ? h('div', { class: 'rbar' }, h('i', { style: `width:${s.score}%` })) : null,
        s && s.provisional ? h('small', null, 'Provisional: faltan días para tu referencia personal (pulso y VFC).') : null,
        h('div', null,
          line('Sueño', rec.night ? hm(rec.night.minutesAsleep) : 'sin datos de esta noche'),
          line('Pulso en reposo', rec.rhr ? `${fmt(rec.rhr.value)} lpm` : '—', rec.rhrBase ? `tu media ${fmt(rec.rhrBase.mean)}` : null),
          line('VFC', rec.hrv ? `${fmt(rec.hrv.value)} ms` : '—', rec.hrvBase ? `tu media ${fmt(rec.hrvBase.mean)}` : null))),
      errors,
      h('p', { class: 'hint' }, 'Orientativo: calculado con tus datos, no es un dato médico.'));
  }

  A.register('hoy', {
    render(el) {
      const st = A.health.state();
      A.mount(el,
        h('div', null, h('h2', { class: 'big-title' }, 'Hoy'), h('p', { class: 'sub' }, longDate())),
        syncLine(st),
        tiles(st),
        workoutCard(),
        recoveryCard(st));
      A.health.preload();
      A.health.refresh(); // solo consulta si hay permiso vigente y los datos están caducados
    }
  });
})();
