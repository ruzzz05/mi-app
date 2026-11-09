// Lista de rutinas: usar, editar, borrar, compartir (archivo .json) e importar.
(() => {
  const A = window.GymApp;
  const { h } = A;

  const svg = d => { const w = document.createElement('span'); w.innerHTML = `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; return w.firstChild; };
  const ICON = {
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>'), share: svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>'),
    trash: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>')
  };
  const icon = d => svg(d);
  const summary = r => {
    const sets = r.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    return `${r.exercises.length} ejercicio${r.exercises.length === 1 ? '' : 's'} · ${sets} series`;
  };

  function remove(r) {
    A.confirmSheet({
      title: `¿Borrar la rutina «${r.name}»?`, text: 'Tus entrenos ya guardados no se tocan.', okLabel: 'Borrar', act: 'delete-ok', danger: true,
      onOk: () => window.Anim.remove(document.querySelector(`[data-rid="${r.id}"]`), () => { A.state.routines = A.state.routines.filter(x => x.id !== r.id); A.save(); A.toast('Rutina borrada'); A.render(); })
    });
  }

  // Menú de los tres puntos de una rutina
  function openMenu(r) {
    const item = (act, icon, text, fn, cls) => h('button', { class: 'opt-row' + (cls ? ' ' + cls : ''), type: 'button', 'data-act': act, onclick: fn }, icon, text);
    A.openSheet(r.name, [
      h('p', { class: 'sheet-text' }, summary(r)),
      item('edit', ICON.edit, 'Editar', () => { A.closeSheet(); A.editRoutine(r.id); }),
      item('share', ICON.share, 'Compartir como archivo', () => { A.closeSheet(); share(r); }),
      item('delete', ICON.trash, 'Borrar', () => remove(r), 'bad')
    ]);
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

  // Músculo principal de la rutina (el de su primer ejercicio), para la etiqueta de la tarjeta
  const mainMuscle = r => {
    const e = r.exercises[0] && A.exercise(r.exercises[0].exId);
    return e && e.primaryMuscles[0] ? (A.catalog.muscles[e.primaryMuscles[0]] || e.primaryMuscles[0]) : null;
  };
  const lastDone = r => {
    const last = A.allSessions().filter(s => !s.deleted && s.routineId === r.id).sort((x, y) => y.startedAt - x.startedAt)[0];
    if (!last) return 'Último: aún no la has hecho';
    const days = Math.floor((Date.now() - last.startedAt) / 86400000);
    return 'Último: ' + (days <= 0 ? 'hoy' : days === 1 ? 'ayer' : days < 7 ? `hace ${days} días` : days < 14 ? 'hace 1 semana' : `hace ${Math.floor(days / 7)} semanas`);
  };

  A.register('rutinas', {
    render(el) {
      const routines = A.state.routines;
      A.mount(el,
        h('div', { class: 'head' }, h('h2', { class: 'big-title' }, 'Rutinas'),
          h('div', { class: 'row2' },
            h('button', { id: 'rt-import', class: 'ib', type: 'button', 'aria-label': 'Importar rutina', title: 'Importar rutina', onclick: chooseFile }, icon('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>')),
            h('button', { id: 'rt-new', class: 'ib p', type: 'button', 'aria-label': 'Nueva rutina', title: 'Nueva rutina', onclick: () => A.editRoutine(null) }, icon('<path d="M12 5v14M5 12h14"/>')))),
        A.hasActive() ? h('div', { class: 'banner' }, h('span', null, 'Tienes un entreno en curso'),
          h('button', { class: 'btn small', type: 'button', onclick: A.resumeWorkout }, 'Retomar')) : null,
        routines.length ? routines.map(r => h('div', { class: 'rc', 'data-rid': r.id },
          h('div', { class: 'card' },
            mainMuscle(r) ? h('span', { class: 'chip' }, mainMuscle(r)) : null,
            h('h3', null, r.name),
            h('div', { class: 'meta' }, summary(r)),
            h('small', null, lastDone(r))),
          h('div', { class: 'rail' },
            h('button', { class: 'play', type: 'button', 'aria-label': `Empezar ${r.name}`, onclick: () => A.startRoutine(r.id) }, icon('<path d="M8 5l11 7-11 7z" fill="currentColor"/>')),
            h('button', { class: 'more', type: 'button', 'aria-label': `Más opciones de ${r.name}`, onclick: () => openMenu(r) }, '···'))))
          : h('p', { class: 'empty-msg' }, 'Todavía no tienes rutinas. Crea la primera con +.'));
    }
  });
})();
