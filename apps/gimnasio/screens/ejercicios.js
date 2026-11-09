// Piezas de interfaz sobre ejercicios, compartidas por el editor y el entreno:
// la ficha (imágenes, músculos, instrucciones), el buscador del catálogo y el bloque de series.
(() => {
  const A = window.GymApp;
  const { h } = A;
  const CAT = A.catalog;

  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const muscleLabel = m => CAT.muscles[m] || m;
  const MAX_VALUE = 1000;

  // Series recién añadidas (entran animadas) y clave de cada ejercicio para animar el reordenado.
  // Van en WeakMap: nada de esto se guarda en los datos.
  const fresh = new WeakMap();
  const keys = new WeakMap();
  let keySeq = 0;
  const keyOf = o => { if (!keys.has(o)) keys.set(o, 'k' + (++keySeq)); return keys.get(o); };
  const toNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_VALUE) : 0;
  };

  const imageUrl = path => CAT.imageBase + path.split('/').map(encodeURIComponent).join('/');

  // ---------- Ficha ----------
  // back: función opcional; si se pasa, la ficha muestra "Volver" (lo usa el buscador)
  function openExercise(id, back) {
    const e = A.exercise(id);
    if (!e) { A.toast('Ejercicio no encontrado'); return; }
    const imgs = e.images.map(p => h('img', {
      class: 'ex-img', src: imageUrl(p), alt: e.name, loading: 'lazy', crossorigin: 'anonymous',
      onerror: ev => ev.target.replaceWith(h('div', { class: 'ex-img missing' }, e.name))
    }));
    A.openSheet(e.name, [
      back ? h('button', { class: 'mini', type: 'button', onclick: back }, '← Volver') : null,
      h('div', { class: 'ex-imgs' }, imgs.length ? imgs : h('div', { class: 'ex-img missing' }, 'Sin imagen')),
      h('p', { class: 'sub' }, e.nameEn),
      h('div', { class: 'chips' },
        e.primaryMuscles.map(m => h('span', { class: 'chip on static' }, muscleLabel(m))),
        e.secondaryMuscles.map(m => h('span', { class: 'chip static' }, muscleLabel(m))),
        e.equipment ? h('span', { class: 'chip static' }, CAT.equipment[e.equipment] || e.equipment) : null),
      e.instructions.length ? h('ol', { class: 'ex-steps' }, e.instructions.map(t => h('li', null, t))) : null,
      CAT.attribution ? h('p', { class: 'hint' }, 'Imágenes ' + CAT.attribution) : null
    ]);
  }

  // ---------- Buscador del catálogo ----------
  const pickState = { query: '', muscle: '', equip: '' };
  const PAGE = 60;

  function pickExercise(onPick) {
    const list = h('div', { class: 'pick-list' });
    const info = h('p', { class: 'hint' });

    function renderList() {
      const q = norm(pickState.query.trim());
      const found = CAT.exercises.filter(e =>
        (!q || norm(e.name).includes(q) || norm(e.nameEn).includes(q)) &&
        (!pickState.muscle || e.primaryMuscles.includes(pickState.muscle) || e.secondaryMuscles.includes(pickState.muscle)) &&
        (!pickState.equip || e.equipment === pickState.equip));
      list.replaceChildren(...found.slice(0, PAGE).map(e => h('div', { class: 'pick-row' },
        h('button', {
          class: 'card-row', type: 'button',
          onclick: () => { pickState.query = ''; A.closeSheet(); onPick(e.id); }
        }, h('span', null, e.name, h('small', null, e.primaryMuscles.map(muscleLabel).join(', ')))),
        h('button', { class: 'mini', type: 'button', onclick: () => openExercise(e.id, () => pickExercise(onPick)) }, 'Ver'))));
      info.textContent = found.length === 0 ? 'No hay ejercicios con esa búsqueda.'
        : found.length > PAGE ? `Mostrando ${PAGE} de ${found.length}. Afina la búsqueda para ver más.`
        : `${found.length} ejercicio${found.length === 1 ? '' : 's'}`;
    }

    const select = (current, firstLabel, entries, onChange) => h('select', { class: 'field', onchange: e => onChange(e.target.value) },
      h('option', { value: '' }, firstLabel),
      entries.map(([k, label]) => h('option', { value: k, selected: k === current }, label)));

    // Buscador y filtros fijos arriba; solo la lista se desliza
    A.openSheet('Añadir ejercicio', h('div', { class: 'pick-wrap' },
      h('input', {
        class: 'field', type: 'search', placeholder: 'Buscar ejercicio…', value: pickState.query,
        'aria-label': 'Buscar ejercicio', oninput: e => { pickState.query = e.target.value; renderList(); }
      }),
      h('div', { class: 'pick-filters' },
        select(pickState.muscle, 'Todos los músculos', Object.entries(CAT.muscles), v => { pickState.muscle = v; renderList(); }),
        select(pickState.equip, 'Todo el equipo', Object.entries(CAT.equipment), v => { pickState.equip = v; renderList(); })),
      info, list), { tall: true });
    renderList();
  }

  // ---------- Bloque de un ejercicio con sus series ----------
  // ex se modifica en el sitio. onChange(): cambió un valor (guardar, sin repintar).
  // onStructure(tipo): 'up' | 'down' | 'remove' | 'sets' (cambió la lista: repintar).
  function exerciseBlock({ ex, index, count, withDone, onChange, onStructure }) {
    const rows = ex.sets.map((s, i) => {
      const row = h('div', { class: 'set-row' + (withDone ? ' with-done' : '') + (s.done ? ' done' : '') + (fresh.has(s) ? ' anim-new' : '') });
      fresh.delete(s);
      const check = withDone ? h('button', {
        class: 'check' + (s.done ? ' on' : ''), type: 'button',
        'aria-label': 'Serie hecha', 'aria-pressed': String(!!s.done),
        onclick: ev => {
          s.done = !s.done;
          ev.currentTarget.classList.toggle('on', s.done);
          ev.currentTarget.setAttribute('aria-pressed', String(s.done));
          row.classList.toggle('done', s.done);
          onChange();
        }
      }, '✓') : null;
      row.append(
        h('span', { class: 'set-n' }, i + 1),
        h('input', {
          class: 'field num', type: 'text', inputmode: 'numeric', 'data-f': 'reps', value: s.reps, autocomplete: 'off',
          'aria-label': `Repeticiones de la serie ${i + 1}`, oninput: e => { s.reps = toNum(e.target.value); onChange(); }
        }),
        h('span', { class: 'unit' }, 'reps'),
        h('input', {
          class: 'field num', type: 'text', inputmode: 'decimal', 'data-f': 'weight', value: String(s.weight).replace('.', ','), autocomplete: 'off',
          'aria-label': `Peso de la serie ${i + 1}`, oninput: e => { s.weight = toNum(e.target.value); onChange(); }
        }),
        h('span', { class: 'unit' }, 'kg'),
        check,
        h('button', {
          class: 'icon-btn small', type: 'button', 'aria-label': 'Quitar serie',
          onclick: () => { ex.sets.splice(i, 1); onStructure('sets'); }
        }, '×'));
      return row;
    });

    return h('div', { class: 'ex-block eblock', 'data-k': keyOf(ex) },
      h('div', { class: 'ex-head' },
        h('button', { class: 'ex-name', type: 'button', onclick: () => openExercise(ex.exId) }, A.exerciseName(ex.exId)),
        h('div', { class: 'ex-ctrl' },
          h('button', { type: 'button', 'aria-label': 'Subir ejercicio', disabled: index === 0, onclick: () => onStructure('up') }, '↑'),
          h('button', { type: 'button', 'aria-label': 'Bajar ejercicio', disabled: index === count - 1, onclick: () => onStructure('down') }, '↓'),
          h('button', { type: 'button', 'aria-label': 'Quitar ejercicio', onclick: () => onStructure('remove') }, '×'))),
      rows,
      h('button', {
        class: 'mini', type: 'button', 'data-act': 'add-set',
        onclick: () => {
          const last = ex.sets[ex.sets.length - 1];
          const ns = { reps: last ? last.reps : 10, weight: last ? last.weight : 0, done: false };
          ex.sets.push(ns);
          fresh.set(ns, true);
          onStructure('sets');
        }
      }, '+ Serie'));
  }

  A.openExercise = openExercise;
  A.pickExercise = pickExercise;
  A.exerciseBlock = exerciseBlock;
  A.toNum = toNum;
  A.keyOf = keyOf;
})();
