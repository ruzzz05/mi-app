// Entreno en curso. Se trabaja sobre una COPIA de la rutina (Gym.startSession): cambiar el orden,
// las series o los pesos aquí nunca toca la rutina original. El entreno se guarda en el móvil en
// cada cambio, así sobrevive a una recarga o a que el sistema cierre la app; el tiempo se calcula
// con la hora de inicio, no con un contador.
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const { h } = A;
  const ACTIVE = 'gimnasio.active';

  let session = null;
  let timerId = null;

  const read = () => {
    try {
      const s = JSON.parse(localStorage.getItem(ACTIVE));
      return s && s.id && s.startedAt && Array.isArray(s.exercises) ? s : null;
    } catch (e) { return null; }
  };
  const persist = () => { try { localStorage.setItem(ACTIVE, JSON.stringify(session)); } catch (e) { /* sin almacenamiento */ } };
  const stopTimer = () => { clearInterval(timerId); timerId = null; };
  const clear = () => {
    try { localStorage.removeItem(ACTIVE); } catch (e) { /* sin almacenamiento */ }
    session = null;
    stopTimer();
  };

  const clock = sec => {
    const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
    const p = n => String(n).padStart(2, '0');
    return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
  };

  A.hasActive = () => !!read();

  A.startRoutine = routineId => {
    if (read()) { A.toast('Ya tienes un entreno en curso'); session = read(); A.go('usar'); return; }
    const routine = A.state.routines.find(r => r.id === routineId);
    if (!routine) return;
    session = G.startSession(routine, Date.now());
    persist();
    A.go('usar');
  };

  A.resumeWorkout = () => { session = read(); if (session) A.go('usar'); };

  // Al abrir la app con un entreno sin terminar, se vuelve a él
  A.afterStart = () => (read() ? 'usar' : 'rutinas');

  function discard() {
    if (!confirm('¿Descartar este entreno? No se guardará nada.')) return;
    clear();
    A.go('rutinas');
  }

  function finish() {
    const hasDone = session.exercises.some(ex => ex.sets.some(s => s.done));
    if (!hasDone) {
      if (confirm('No has marcado ninguna serie como hecha. ¿Descartar el entreno?')) { clear(); A.go('rutinas'); }
      return;
    }
    const pending = session.exercises.reduce((n, ex) => n + ex.sets.filter(s => !s.done).length, 0);
    if (pending && !confirm(`Quedan ${pending} series sin marcar y no se guardarán. ¿Terminar el entreno?`)) return;
    A.recordSession(G.finishSession(session, Date.now()));
    clear();
    A.toast('Entreno guardado');
    A.go('perfil');
  }

  function render(el) {
    if (!session) session = read();
    if (!session) { A.go('rutinas'); return; }

    const timer = h('span', { class: 'timer' }, clock(G.elapsedSec(session.startedAt, Date.now())));
    stopTimer();
    timerId = setInterval(() => {
      if (!timer.isConnected || A.current() !== 'usar' || !session) { stopTimer(); return; }
      timer.textContent = clock(G.elapsedSec(session.startedAt, Date.now()));
    }, 1000);

    const blocks = session.exercises.map((ex, i) => A.exerciseBlock({
      ex, index: i, count: session.exercises.length, withDone: true,
      onChange: persist,
      onStructure: kind => {
        if (kind === 'up' && i > 0) session.exercises.splice(i - 1, 0, session.exercises.splice(i, 1)[0]);
        else if (kind === 'down' && i < session.exercises.length - 1) session.exercises.splice(i + 1, 0, session.exercises.splice(i, 1)[0]);
        else if (kind === 'remove') {
          if (ex.sets.some(s => s.done) && !confirm('Este ejercicio tiene series hechas. ¿Quitarlo del entreno?')) return;
          session.exercises.splice(i, 1);
        }
        persist();
        A.render();
      }
    }));

    A.mount(el, 
      h('div', { class: 'run-head' }, h('strong', null, session.routineName || 'Entreno'), timer),
      h('p', { class: 'hint' }, 'Se guarda solo: puedes salir de la app y volver, el tiempo sigue contando. La rutina original no cambia.'),
      blocks.length ? blocks : h('p', { class: 'empty-msg' }, 'No hay ejercicios en este entreno.'),
      h('div', { class: 'toolbar' },
        h('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => A.pickExercise(exId => {
            session.exercises.push({ exId, sets: [1, 2, 3].map(() => ({ reps: 10, weight: 0, done: false })) });
            persist();
            A.render();
          })
        }, '+ Añadir ejercicio')),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn', type: 'button', onclick: finish }, 'Terminar entreno'),
        h('button', { class: 'btn danger', type: 'button', onclick: discard }, 'Descartar')));
  }

  A.register('usar', { render });
})();
