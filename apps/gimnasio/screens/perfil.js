// Perfil: calendario de entrenos, esfuerzo por grupo muscular y comparación por ejercicio.
// Todo se calcula en el móvil a partir del historial (Gym.*).
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const { h } = A;
  const CAT = A.catalog;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let chosenEx = '';  // ejercicio elegido en la comparación (se recuerda mientras la app está abierta)

  const fmt = n => (Number.isFinite(n) ? String(Math.round(n * 10) / 10).replace('.', ',') : '0');
  const parse = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
  const shortDay = day => parse(day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const longDay = day => {
    const s = parse(day).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const minutes = sec => `${Math.max(1, Math.round(sec / 60))} min`;
  const doneCount = s => s.exercises.reduce((n, ex) => n + ex.sets.filter(x => x.done).length, 0);

  function svg(tag, attrs, ...kids) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    kids.flat().forEach(k => { if (k != null) el.append(k.nodeType ? k : document.createTextNode(String(k))); });
    return el;
  }

  // ---------- Detalle y borrado de un entreno ----------
  const hhmm = ms => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  function removeSession(s) {
    const name = s.routineName || 'Entreno';
    A.confirmSheet({
      title: `¿Borrar el entreno «${name}» del ${shortDay(G.dayOf(s.startedAt))}?`, text: 'Se quitará también de tus estadísticas.',
      okLabel: 'Borrar entreno', act: 'delete-ok', danger: true,
      onOk: () => { A.deleteSession(s.id); A.toast('Entreno borrado'); A.render(); }
    });
  }

  function sessionCard(s) {
    return h('div', { class: 'routine' },
      h('h3', null, s.routineName || 'Entreno'),
      h('small', null, `${doneCount(s)} series · ${s.durationSec ? minutes(s.durationSec) : 'sin duración'} · ${fmt(G.sessionVolume(s))} kg de volumen`),
      h('div', { class: 'detail-list' }, s.exercises.map(ex => h('div', null,
        h('strong', null, A.exerciseName(ex.exId)), ': ',
        ex.sets.map(x => `${fmt(x.reps)}×${fmt(x.weight)} kg`).join(' · ')))),
      h('div', { class: 'routine-actions' },
        h('button', { class: 'mini danger', type: 'button', onclick: () => removeSession(s) }, 'Borrar entreno')));
  }

  // ---------- Calendario ----------
  function dayDetail(day, sessions) {
    const list = sessions.filter(s => !s.deleted && G.dayOf(s.startedAt) === day && doneCount(s) > 0);
    A.openSheet(longDay(day), list.length ? list.map(sessionCard) : h('p', { class: 'empty-msg' }, 'No entrenaste este día.'));
  }

  // ---------- Lista de entrenos (con su papelera) ----------
  const HIST_PAGE = 8;
  let histShown = HIST_PAGE;   // cuántos se enseñan; "Ver más" los amplía

  function historial(sessions) {
    const list = sessions.filter(s => !s.deleted && doneCount(s) > 0).sort((x, y) => y.startedAt - x.startedAt);
    if (!list.length) return null;
    const rows = list.slice(0, histShown).map(s => h('div', { class: 'hist-row' },
      h('button', {
        class: 'hist-main', type: 'button',
        onclick: () => A.openSheet(longDay(G.dayOf(s.startedAt)), sessionCard(s))
      }, h('b', null, s.routineName || 'Entreno'),
        h('small', null, `${shortDay(G.dayOf(s.startedAt))} · ${hhmm(s.startedAt)} · ${doneCount(s)} series${s.durationSec ? ' · ' + minutes(s.durationSec) : ''}`)),
      h('button', {
        class: 'icon-btn hist-del', type: 'button', 'aria-label': `Borrar el entreno ${s.routineName || ''} del ${shortDay(G.dayOf(s.startedAt))}`,
        title: 'Borrar entreno', onclick: () => removeSession(s)
      }, htmlIcon())));
    return h('div', null,
      h('p', { class: 'eyebrow' }, 'Mis entrenos'),
      rows,
      list.length > histShown
        ? h('button', { class: 'mini', type: 'button', onclick: () => { histShown += HIST_PAGE; A.render(); } }, `Ver más (${list.length - histShown})`)
        : null,
      h('p', { class: 'hint' }, 'Toca un entreno para ver sus series. La papelera lo borra.'));
  }

  function htmlIcon() {
    const w = document.createElement('span');
    w.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>';
    return w.firstChild;
  }

  function calendar(sessions) {
    const today = G.dayOf(Date.now());
    const cells = G.calendarCells(sessions, today, 52);
    const grid = h('div', { class: 'cal', role: 'grid', 'aria-label': 'Calendario de entrenos' },
      cells.map(c => h('button', {
        class: 'cal-cell lv' + c.level + (c.day > today ? ' future' : ''), type: 'button',
        title: `${shortDay(c.day)}: ${c.sets} series`, 'aria-label': `${shortDay(c.day)}: ${c.sets} series`,
        disabled: c.day > today,
        onclick: () => dayDetail(c.day, sessions)
      })));
    const wrap = h('div', { class: 'cal-wrap' }, grid);
    requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; }); // lo más reciente a la vista
    return wrap;
  }

  // ---------- Esfuerzo por músculo ----------
  function muscles(sessions) {
    const thisWeek = G.mondayOf(G.dayOf(Date.now()));
    const now = G.weeklyMuscleSets(sessions, CAT.exercises, thisWeek);
    const before = G.weeklyMuscleSets(sessions, CAT.exercises, G.addDays(thisWeek, -7));
    const keys = [...new Set([...Object.keys(now), ...Object.keys(before)])]
      .sort((a, b) => (now[b] || 0) - (now[a] || 0) || (before[b] || 0) - (before[a] || 0));
    if (!keys.length) return h('p', { class: 'empty-msg' }, 'Aún no hay series hechas en las dos últimas semanas.');
    const max = Math.max(...keys.map(k => Math.max(now[k] || 0, before[k] || 0)), 1);
    return h('div', null, keys.map(k => h('div', { class: 'mus-row' },
      h('div', { class: 'mus-top' }, h('span', null, CAT.muscles[k] || k),
        h('span', { class: 'mus-num' }, `${fmt(now[k] || 0)} `, h('small', null, `(semana pasada ${fmt(before[k] || 0)})`))),
      h('div', { class: 'bar' }, h('i', { class: 'bar-now', style: `width:${((now[k] || 0) / max) * 100}%` })),
      h('div', { class: 'bar' }, h('i', { class: 'bar-before', style: `width:${((before[k] || 0) / max) * 100}%` })))));
  }

  // ---------- Gráficas por ejercicio ----------
  function lineChart(points, unit) {
    const W = 320, H = 130, padX = 26, padY = 18;
    if (!points.length) return h('p', { class: 'hint' }, 'Sin datos.');
    const ys = points.map(p => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo === hi) { lo -= 1; hi += 1; }
    const sx = i => (points.length === 1 ? W / 2 : padX + i * (W - 2 * padX) / (points.length - 1));
    const sy = y => H - padY - ((y - lo) / (hi - lo)) * (H - 2 * padY);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
    const last = points.length - 1;
    return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Evolución en ${unit}` },
      svg('path', { d: path, class: 'chart-line', fill: 'none' }),
      points.map((p, i) => svg('circle', { cx: sx(i).toFixed(1), cy: sy(p.y).toFixed(1), r: 3.5, class: 'chart-dot' })),
      svg('text', { x: sx(0), y: H - 3, class: 'chart-lbl', 'text-anchor': points.length === 1 ? 'middle' : 'start' }, shortDay(points[0].day)),
      last > 0 ? svg('text', { x: sx(last), y: H - 3, class: 'chart-lbl', 'text-anchor': 'end' }, shortDay(points[last].day)) : null,
      svg('text', { x: sx(last), y: Math.max(11, sy(points[last].y) - 7), class: 'chart-val', 'text-anchor': last === 0 ? 'middle' : 'end' },
        `${fmt(points[last].y)} ${unit}`));
  }

  function exerciseStats(sessions) {
    const withData = new Set();
    for (const s of sessions) {
      if (s.deleted) continue;
      for (const ex of s.exercises || []) if (ex.sets.some(x => x.done)) withData.add(ex.exId);
    }
    if (!withData.size) return h('p', { class: 'empty-msg' }, 'Termina un entreno para comparar tus ejercicios día a día.');
    const options = [...withData].sort((a, b) => A.exerciseName(a).localeCompare(A.exerciseName(b), 'es'));
    if (!withData.has(chosenEx)) chosenEx = options[0];

    const out = h('div', null);
    const draw = () => {
      const hist = G.exerciseHistory(sessions, chosenEx);
      A.mount(out,
        h('p', { class: 'hint' }, `${hist.length} día${hist.length === 1 ? '' : 's'} con este ejercicio`),
        h('h4', { class: 'chart-title' }, 'Peso máximo'), lineChart(hist.map(p => ({ day: p.day, y: p.maxWeight })), 'kg'),
        h('h4', { class: 'chart-title' }, 'Volumen total'), lineChart(hist.map(p => ({ day: p.day, y: p.volume })), 'kg'),
        h('h4', { class: 'chart-title' }, '1RM estimado'), lineChart(hist.map(p => ({ day: p.day, y: p.est1RM })), 'kg'));
    };
    const select = h('select', {
      class: 'field', 'aria-label': 'Ejercicio a comparar',
      onchange: e => { chosenEx = e.target.value; draw(); }
    }, options.map(id => h('option', { value: id, selected: id === chosenEx }, A.exerciseName(id))));
    draw();
    return h('div', null, select, out);
  }

  // ---------- Salud: últimos días (datos de la pulsera) ----------
  function salud() {
    const hist = A.health.history();
    const head = h('p', { class: 'eyebrow' }, 'Salud: últimos días');
    if (!hist) {
      return h('div', null, head, h('p', { class: 'empty-msg' }, 'Conecta con Google en la pantalla Hoy para ver aquí tu sueño, tu pulso en reposo, tu VFC y tus pasos.'));
    }
    const chart = (title, key, unit, round) => {
      const pts = hist[key].filter(p => p.value !== null).map(p => ({ day: p.day, y: round ? Math.round(p.value) : Math.round(p.value * 10) / 10 }));
      const avg = pts.length ? pts.reduce((a, p) => a + p.y, 0) / pts.length : null;
      return h('div', null,
        h('h4', { class: 'chart-title' }, title + (avg === null ? '' : ` · media ${fmt(avg)} ${unit}`)),
        pts.length ? lineChart(pts, unit) : h('p', { class: 'hint' }, hist.errors[key] ? 'No se pudo leer: ' + hist.errors[key] : 'Sin datos en estos días.'));
    };
    return h('div', null, head,
      chart('Sueño', 'sleep', 'h', false),
      chart('Pulso en reposo', 'rhr', 'lpm', true),
      chart('VFC (variabilidad)', 'hrv', 'ms', true),
      chart('Pasos', 'steps', 'pasos', true),
      h('p', { class: 'hint' }, `Últimos 14 días. Actualizado a las ${new Date(hist.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`));
  }

  // ---------- Pantalla ----------
  function render(el) {
    const sessions = A.allSessions();
    const real = sessions.filter(s => !s.deleted && doneCount(s) > 0);
    const weekStart = G.mondayOf(G.dayOf(Date.now()));
    const thisWeek = real.filter(s => G.dayOf(s.startedAt) >= weekStart);

    A.health.refresh(); // si hay permiso vigente y los datos de salud tienen más de 30 minutos
    A.mount(el,
      h('div', { class: 'screen-head' }, h('h2', null, 'Perfil')),
      h('div', { class: 'tiles' },
        h('div', { class: 'tile' }, h('strong', null, real.length), h('span', null, 'entrenos')),
        h('div', { class: 'tile' }, h('strong', null, thisWeek.length), h('span', null, 'esta semana')),
        h('div', { class: 'tile' }, h('strong', null, thisWeek.reduce((n, s) => n + doneCount(s), 0)), h('span', null, 'series esta semana'))),
      h('p', { class: 'eyebrow' }, 'Calendario'),
      calendar(sessions),
      h('p', { class: 'hint' }, 'Toca un día para ver qué hiciste.'),
      historial(sessions),
      h('p', { class: 'eyebrow' }, 'Esfuerzo por músculo (series por semana)'),
      muscles(sessions),
      h('p', { class: 'eyebrow' }, 'Evolución por ejercicio'),
      exerciseStats(sessions),
      salud());
  }

  A.register('perfil', { render });
})();
