// Hoy: cómo estás hoy (recuperación con los datos de la pulsera), el entreno de hoy y los pasos y calorías.
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const { h } = A;

  const fmt = n => (n == null ? '—' : Math.round(n).toLocaleString('es-ES'));
  const longDate = () => {
    const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const hhmm = ms => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hm = min => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
  const SCOPE_NAMES = { sleep: 'sueño', metrics: 'pulso y variabilidad' };

  // ---------- Entreno de hoy ----------
  function workoutCard() {
    if (A.hasActive()) {
      return h('div', { class: 'banner' }, h('span', null, 'Tienes un entreno en curso'),
        h('button', { class: 'btn small', type: 'button', onclick: A.resumeWorkout }, 'Retomar'));
    }
    const t = G.todaySummary(A.allSessions(), G.dayOf(Date.now()));
    if (!t.count) {
      return h('div', { class: 'routine' },
        h('h3', null, 'Hoy aún no has entrenado'),
        h('div', { class: 'routine-actions' },
          h('button', { class: 'btn small', type: 'button', onclick: () => A.go('rutinas') }, 'Elegir una rutina')));
    }
    const min = Math.max(1, Math.round(t.durationSec / 60));
    return h('div', { class: 'routine' },
      h('h3', null, t.names.join(' · ')),
      h('small', null, `${t.sets} series · ${t.durationSec ? min + ' min · ' : ''}${Math.round(t.volume).toLocaleString('es-ES')} kg de volumen`));
  }

  // ---------- Recuperación ----------
  function recoveryCard(st) {
    if (st.kind === 'sin-config' || st.kind === 'sin-conectar' || st.kind === 'caducado') return null;

    const needSleep = st.missing.includes(A.health.SCOPES[1]), needMetrics = st.missing.includes(A.health.SCOPES[2]);
    const lack = [needSleep ? SCOPE_NAMES.sleep : null, needMetrics ? SCOPE_NAMES.metrics : null].filter(Boolean);
    const permiso = lack.length ? h('div', { class: 'routine' },
      h('h3', null, 'Faltan permisos para la recuperación'),
      h('small', null, `Google aún no te ha dado acceso a: ${lack.join(' y ')}. Pulsa para ampliarlos (y deja marcadas todas las casillas).`),
      h('div', { class: 'routine-actions' }, h('button', { class: 'btn small', type: 'button', onclick: () => A.health.connect() }, 'Ampliar permisos'))) : null;

    const rec = A.health.recovery();
    const failed = Object.entries(st.healthErrors || {}).map(([k, m]) => `${{ sleep: 'sueño', rhr: 'pulso', hrv: 'VFC', steps: 'pasos' }[k] || k}: ${m}`);
    const errors = failed.length ? h('p', { class: 'hint err' }, 'No se pudo leer ' + failed.join(' · ')) : null;

    if (!rec) {
      return h('div', null, permiso,
        h('div', { class: 'routine' }, h('h3', null, 'Recuperación'),
          h('small', null, st.kind === 'cargando' ? 'Calculando…' : 'Todavía no hay datos de esta noche. Duerme con la pulsera puesta y abre la app por la mañana.')),
        errors);
    }

    const parts = [];
    parts.push(h('div', { class: 'rec-line' }, h('span', null, 'Sueño'),
      h('b', null, rec.night ? hm(rec.night.minutesAsleep) : 'sin datos de esta noche')));
    parts.push(h('div', { class: 'rec-line' }, h('span', null, 'Pulso en reposo'),
      h('b', null, rec.rhr ? `${fmt(rec.rhr.value)} lpm` : '—'),
      rec.rhrBase ? h('small', null, `tu media ${fmt(rec.rhrBase.mean)}`) : null));
    parts.push(h('div', { class: 'rec-line' }, h('span', null, 'VFC'),
      h('b', null, rec.hrv ? `${fmt(rec.hrv.value)} ms` : '—'),
      rec.hrvBase ? h('small', null, `tu media ${fmt(rec.hrvBase.mean)}`) : null));

    const s = rec.score;
    return h('div', null, permiso,
      h('div', { class: 'recovery' + (s ? '' : ' empty') },
        h('div', { class: 'rec-head' },
          h('div', { class: 'rec-score' }, s ? s.score : '—', h('small', null, ' / 100')),
          h('div', { class: 'rec-label' }, h('b', null, s ? s.label : 'Sin puntuación'),
            s && s.provisional ? h('small', null, 'Provisional: faltan días para tu referencia personal (pulso y VFC).') : null)),
        s ? h('div', { class: 'bar' }, h('i', { class: 'bar-now', style: `width:${s.score}%` })) : null,
        parts),
      errors,
      h('p', { class: 'hint' }, 'Orientativo: calculado con tus datos, no es un dato médico.'));
  }

  // ---------- Pasos y calorías ----------
  function healthCard(st) {
    const head = h('p', { class: 'eyebrow' }, 'Pasos y calorías de hoy');

    if (st.kind === 'sin-config') {
      return h('div', null, head, h('div', { class: 'routine' },
        h('h3', null, 'Falta conectar con Google'),
        h('small', null, 'Hay que crear el acceso en Google Cloud y poner su clientId en apps/gimnasio/google-config.js. Los pasos están en el README.')));
    }

    const s = st.summary;
    const tiles = h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('strong', null, fmt(s && s.steps)), h('span', null, 'pasos')),
      h('div', { class: 'tile' }, h('strong', null, fmt(s && s.total)), h('span', null, 'kcal totales')),
      h('div', { class: 'tile' }, h('strong', null, fmt(s && s.active)), h('span', null, 'kcal activas')));

    let status;
    if (st.kind === 'cargando') {
      status = h('p', { class: 'hint' }, 'Actualizando…');
    } else if (st.kind === 'datos') {
      status = h('div', { class: 'toolbar' },
        h('span', { class: 'hint' }, `Actualizado a las ${hhmm(s.at)}`),
        h('button', { class: 'mini', type: 'button', onclick: () => A.health.refresh({ force: true }) }, 'Actualizar'));
    } else if (st.kind === 'error') {
      status = h('div', null,
        h('p', { class: 'hint err' }, 'No se pudieron cargar los datos: ' + st.error),
        h('button', { class: 'btn small', type: 'button', onclick: () => (st.connected ? A.health.refresh({ force: true }) : A.health.connect()) }, 'Reintentar'));
    } else {
      status = h('div', null,
        st.kind === 'caducado' ? h('p', { class: 'hint' }, 'El permiso de Google caducó. Vuelve a conectar para actualizar los datos.') : null,
        h('button', { class: 'btn small', type: 'button', onclick: () => A.health.connect() },
          st.kind === 'caducado' ? 'Volver a conectar' : 'Conectar con Google'));
    }
    return h('div', null, head, tiles, status);
  }

  A.register('hoy', {
    render(el) {
      const st = A.health.state();
      A.mount(el,
        h('div', { class: 'screen-head' }, h('h2', null, 'Hoy')),
        h('p', { class: 'sub' }, longDate()),
        recoveryCard(st),
        workoutCard(),
        healthCard(st));
      A.health.preload();
      A.health.refresh(); // solo consulta si hay permiso vigente y los datos están caducados
    }
  });
})();
