// Lista de rutinas: usar, editar, borrar, compartir (archivo .json) e importar.
(() => {
  const A = window.GymApp;
  const { h } = A;

  const summary = r => {
    const sets = r.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    return `${r.exercises.length} ejercicio${r.exercises.length === 1 ? '' : 's'} · ${sets} series`;
  };

  function remove(r) {
    if (!confirm(`¿Borrar la rutina "${r.name}"? Tus entrenos ya guardados no se tocan.`)) return;
    A.state.routines = A.state.routines.filter(x => x.id !== r.id);
    A.save();
    A.render();
  }

  // ---------- Compartir plantillas ----------
  const MAX_FILE_BYTES = 200 * 1024;
  const slug = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rutina';

  // Con la hoja de compartir del móvil si existe; si no, descarga el archivo.
  async function share(r) {
    const text = JSON.stringify(window.Gym.exportRoutine(r), null, 2);
    const name = `rutina-${slug(r.name)}.json`;
    try {
      // Algunos móviles solo dejan compartir ciertos tipos de archivo: se prueba con otro si el primero no vale
      for (const type of ['application/json', 'text/plain']) {
        const file = new File([text], name, { type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: r.name });
          return;
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // la persona cerró la hoja de compartir
    }
    const url = URL.createObjectURL(new File([text], name, { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    A.toast('Archivo de la rutina descargado');
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { A.toast('Ese archivo es demasiado grande para ser una rutina', 4000); return; }
    let text;
    try { text = await file.text(); } catch (e) { A.toast('No se pudo leer el archivo', 4000); return; }
    const res = window.Gym.importRoutine(text, A.catalog.exercises.map(e => e.id));
    if (!res.ok) { A.toast(res.error, 5000); return; }
    const routine = res.routine;
    const names = new Set(A.state.routines.map(r => r.name));
    if (names.has(routine.name)) routine.name = routine.name.slice(0, 52) + ' (copia)';
    A.state.routines.push(routine);
    A.save();
    A.render();
    A.toast(res.dropped
      ? (res.dropped === 1
        ? 'Rutina importada. 1 ejercicio no existe en tu catálogo y se omitió'
        : `Rutina importada. ${res.dropped} ejercicios no existen en tu catálogo y se omitieron`)
      : 'Rutina importada', res.dropped ? 6000 : 2200);
  }

  function chooseFile() {
    const input = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
    input.addEventListener('change', async () => { await importFile(input.files[0]); input.remove(); });
    document.body.append(input);
    input.click();
  }

  A.importRoutineFile = importFile;

  A.register('rutinas', {
    render(el) {
      const routines = A.state.routines;
      A.mount(el, 
        h('div', { class: 'screen-head' }, h('h2', null, 'Rutinas')),
        A.hasActive() ? h('div', { class: 'banner' }, h('span', null, 'Tienes un entreno en curso'),
          h('button', { class: 'btn small', type: 'button', onclick: A.resumeWorkout }, 'Retomar')) : null,
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn', type: 'button', onclick: () => A.editRoutine(null) }, '+ Nueva rutina'),
          h('button', { class: 'btn ghost', type: 'button', onclick: chooseFile }, 'Importar rutina')),
        routines.length ? routines.map(r => h('div', { class: 'routine' },
          h('h3', null, r.name),
          h('small', null, summary(r)),
          h('div', { class: 'routine-actions' },
            h('button', { class: 'btn small', type: 'button', onclick: () => A.startRoutine(r.id) }, 'Usar'),
            h('button', { class: 'mini', type: 'button', onclick: () => A.editRoutine(r.id) }, 'Editar'),
            h('button', { class: 'mini', type: 'button', onclick: () => share(r) }, 'Compartir'),
            h('button', { class: 'mini danger', type: 'button', onclick: () => remove(r) }, 'Borrar'))))
          : h('p', { class: 'empty-msg' }, 'Todavía no tienes rutinas. Crea la primera con "Nueva rutina".'));
    }
  });
})();
