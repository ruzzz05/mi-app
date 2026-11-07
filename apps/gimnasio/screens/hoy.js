// Hoy: pasos y calorías de la pulsera (Google Health) y cómo va el entreno de hoy.
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

  // ---------- Salud ----------
  function healthCard() {
    const st = A.health.state();
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
      A.mount(el,
        h('div', { class: 'screen-head' }, h('h2', null, 'Hoy')),
        h('p', { class: 'sub' }, longDate()),
        workoutCard(),
        healthCard());
      A.health.preload();
      A.health.refresh(); // solo consulta si hay permiso vigente y los datos tienen más de 10 minutos
    }
  });
})();
