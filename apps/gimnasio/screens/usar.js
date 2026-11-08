// Entreno en curso, con lista desplegable: solo el ejercicio actual está abierto (con sus series para
// escribir peso y repeticiones); los demás aparecen plegados. Se trabaja sobre una COPIA de la rutina
// (Gym.startSession): cambiar el orden, las series o los pesos aquí nunca toca la rutina original. El
// entreno se guarda en el móvil en cada cambio, así sobrevive a una recarga o a que el sistema cierre
// la app; el tiempo se calcula con la hora de inicio, no con un contador.
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const { h } = A;
  const ACTIVE = 'gimnasio.active';

  let session = null;
  let timerId = null;
  let openIdx = 0;   // ejercicio abierto de la lista

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
  const svg = d => { const w = document.createElement('span'); w.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; return w.firstChild; };

  A.hasActive = () => !!read();

  A.startRoutine = routineId => {
    if (read()) { A.toast('Ya tienes un entreno en curso'); session = read(); A.go('usar'); return; }
    const routine = A.state.routines.find(r => r.id === routineId);
    if (!routine) return;
    session = G.startSession(routine, Date.now());
    openIdx = 0;
    persist();
    A.go('usar');
  };

  A.resumeWorkout = () => { session = read(); openIdx = 0; if (session) A.go('usar'); };

  // Al abrir la app con un entreno sin terminar, se vuelve a él
  A.afterStart = () => (read() ? 'usar' : 'hoy');

  function discard() {
    A.confirmSheet({
      title: '¿Descartar este entreno?', text: 'No se guardará nada.', okLabel: 'Descartar', act: 'discard-ok', danger: true,
      onOk: () => { clear(); A.go('rutinas'); }
    });
  }

  function finish() {
    const hasDone = session.exercises.some(ex => ex.sets.some(s => s.done));
    if (!hasDone) {
      A.confirmSheet({
        title: 'No has marcado ninguna serie', text: '¿Descartar el entreno?', okLabel: 'Descartar', act: 'discard-ok', danger: true, cancelLabel: 'Seguir entrenando',
        onOk: () => { clear(); A.go('rutinas'); }
      });
      return;
    }
    const pending = session.exercises.reduce((n, ex) => n + ex.sets.filter(s => !s.done).length, 0);
    const save = () => {
      A.recordSession(G.finishSession(session, Date.now()));
      clear();
      A.toast('Entreno guardado');
      A.go('perfil');
    };
    if (!pending) { save(); return; }
    A.confirmSheet({
      title: `Quedan ${pending} series sin marcar`, text: 'No se guardarán. ¿Terminar el entreno?', okLabel: 'Terminar entreno', act: 'finish-ok', cancelLabel: 'Seguir entrenando', onOk: save
    });
  }

  const isDone = ex => ex.sets.length > 0 && ex.sets.every(s => s.done);

  function render(el) {
    if (!session) session = read();
    if (!session) { A.go('rutinas'); return; }
    if (openIdx >= session.exercises.length) openIdx = Math.max(0, session.exercises.length - 1);

    const timer = h('span', { class: 'timer' }, clock(G.elapsedSec(session.startedAt, Date.now())));
    stopTimer();
    timerId = setInterval(() => {
      if (!timer.isConnected || A.current() !== 'usar' || !session) { stopTimer(); return; }
      timer.textContent = clock(G.elapsedSec(session.startedAt, Date.now()));
    }, 1000);

    const total = session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const done = session.exercises.reduce((n, ex) => n + ex.sets.filter(s => s.done).length, 0);

    const rows = session.exercises.map((ex, i) => {
      if (i !== openIdx) {
        const hechas = ex.sets.filter(s => s.done).length;
        return h('button', { class: 'arow', type: 'button', onclick: () => { openIdx = i; A.render(); } },
          h('span', { class: 'st' + (isDone(ex) ? ' f' : '') }, isDone(ex) ? '✓' : i + 1),
          h('span', { class: 'tx' }, h('b', null, A.exerciseName(ex.exId)), h('small', null, `${hechas} de ${ex.sets.length} series`)),
          svg('<path d="M6 9l6 6 6-6"/>'));
      }
      return A.exerciseBlock({
        ex, index: i, count: session.exercises.length, withDone: true,
        onChange: persist,
        onStructure: kind => {
          if (kind === 'up' && i > 0) { session.exercises.splice(i - 1, 0, session.exercises.splice(i, 1)[0]); openIdx = i - 1; }
          else if (kind === 'down' && i < session.exercises.length - 1) { session.exercises.splice(i + 1, 0, session.exercises.splice(i, 1)[0]); openIdx = i + 1; }
          else if (kind === 'remove') {
            const drop = () => { session.exercises.splice(i, 1); openIdx = Math.min(openIdx, session.exercises.length - 1); persist(); A.render(); };
            if (ex.sets.some(s => s.done)) {
              A.confirmSheet({ title: '¿Quitar este ejercicio?', text: 'Tiene series hechas.', okLabel: 'Quitar', act: 'remove-ok', danger: true, onOk: drop });
              return;
            }
            drop();
            return;
          }
          persist();
          A.render();
        }
      });
    });

    A.mount(el,
      h('div', { class: 'head' }, h('div', { class: 'rn' }, session.routineName || 'Entreno', h('small', null, `${done} de ${total} series`)), timer),
      h('p', { class: 'run-hint' }, 'Se guarda solo: puedes salir de la app y volver, el tiempo sigue contando. La rutina original no cambia.'),
      h('div', { class: 'segs' }, session.exercises.map((ex, i) => h('i', { class: isDone(ex) ? 'f' : i === openIdx ? 'c' : '' }))),
      h('div', { class: 'acc' }, rows.length ? rows : h('p', { class: 'empty-msg' }, 'No hay ejercicios en este entreno.')),
      h('button', { id: 'run-discard', class: 'link-bad', type: 'button', onclick: discard }, 'Descartar entreno'),
      h('div', { class: 'run-bar' },
        h('button', { id: 'run-finish', class: 'btn', type: 'button', onclick: finish }, 'Terminar entreno'),
        h('button', {
          id: 'run-add', class: 'sq', type: 'button', 'aria-label': 'Añadir ejercicio', title: 'Añadir ejercicio',
          onclick: () => A.pickExercise(exId => {
            session.exercises.push({ exId, sets: [1, 2, 3].map(() => ({ reps: 10, weight: 0, done: false })) });
            openIdx = session.exercises.length - 1;
            persist();
            A.render();
          })
        }, svg('<path d="M12 5v14M5 12h14"/>'))));
  }

  A.register('usar', { render });
})();
