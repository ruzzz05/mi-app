// Crear y editar una rutina. Se trabaja sobre un borrador: no cambia nada hasta pulsar "Guardar".
(() => {
  const A = window.GymApp;
  const G = window.Gym;
  const { h } = A;

  let draft = null;    // { id, name, exercises: [{ exId, sets: [{ reps, weight }] }] }
  let original = '';   // para saber si hay cambios sin guardar

  const clone = o => JSON.parse(JSON.stringify(o));

  // routineId vacío = rutina nueva
  A.editRoutine = routineId => {
    const found = routineId ? A.state.routines.find(r => r.id === routineId) : null;
    draft = found ? clone(found) : { id: G.uid(), name: '', exercises: [] };
    original = JSON.stringify(draft);
    A.go('editar');
  };

  function leave() {
    const out = () => { draft = null; A.go('rutinas'); };
    if (JSON.stringify(draft) === original) { out(); return; }
    A.confirmSheet({ title: 'Hay cambios sin guardar', text: '¿Salir sin guardarlos?', okLabel: 'Salir sin guardar', act: 'leave-ok', danger: true, cancelLabel: 'Seguir editando', onOk: out });
  }

  function save() {
    if (!draft.exercises.length) { A.toast('Añade al menos un ejercicio'); return; }
    const routine = {
      id: draft.id,
      name: draft.name.trim().slice(0, 60) || 'Rutina sin nombre',
      updatedAt: Date.now(),
      exercises: draft.exercises.map(ex => ({
        exId: ex.exId,
        sets: ex.sets.map(s => ({ reps: A.toNum(s.reps), weight: A.toNum(s.weight) }))
      }))
    };
    const i = A.state.routines.findIndex(r => r.id === routine.id);
    if (i >= 0) A.state.routines[i] = routine; else A.state.routines.push(routine);
    A.save();
    draft = null;
    A.toast('Rutina guardada');
    A.go('rutinas');
  }

  function render(el) {
    if (!draft) { A.go('rutinas'); return; }
    const isNew = !A.state.routines.some(r => r.id === draft.id);

    const blocks = draft.exercises.map((ex, i) => A.exerciseBlock({
      ex, index: i, count: draft.exercises.length, withDone: false,
      onChange: () => {},
      onStructure: kind => {
        if (kind === 'up' && i > 0) draft.exercises.splice(i - 1, 0, draft.exercises.splice(i, 1)[0]);
        else if (kind === 'down' && i < draft.exercises.length - 1) draft.exercises.splice(i + 1, 0, draft.exercises.splice(i, 1)[0]);
        else if (kind === 'remove') draft.exercises.splice(i, 1);
        A.render();
      }
    }));

    A.mount(el, 
      h('div', { class: 'screen-head' },
        h('button', { class: 'mini', type: 'button', onclick: leave }, '← Rutinas'),
        h('h2', null, isNew ? 'Nueva rutina' : 'Editar rutina')),
      h('label', { class: 'form-label', for: 'routine-name' }, 'Nombre'),
      h('input', {
        id: 'routine-name', class: 'field', type: 'text', maxlength: 60, placeholder: 'Ej. Pecho y tríceps', value: draft.name,
        oninput: e => { draft.name = e.target.value; }
      }),
      h('label', { class: 'form-label' }, 'Ejercicios'),
      blocks.length ? blocks : h('p', { class: 'empty-msg' }, 'Aún no has añadido ejercicios.'),
      h('div', { class: 'toolbar' },
        h('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => A.pickExercise(exId => {
            draft.exercises.push({ exId, sets: [1, 2, 3].map(() => ({ reps: 10, weight: 0 })) });
            A.render();
          })
        }, '+ Añadir ejercicio')),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn', type: 'button', onclick: save }, 'Guardar rutina')));
  }

  A.register('editar', { render });
})();
