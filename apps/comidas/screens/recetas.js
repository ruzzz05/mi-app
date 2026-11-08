// Pantalla Recetas: lista y formulario de platos con ingredientes (con etiquetas de los ya usados).
(() => {
  const C = window.Comidas;
  const P = window.Planner;
  const { $, esc } = C;

  const summary = dish => {
    const list = P.ingredientsOf(dish);
    return list.length
      ? list.map(i => i.name).join(', ')
      : 'Sin ingredientes';
  };

  function render(el) {
    const dishes = [...C.state.dishes].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    el.innerHTML = `
      <div class="screen-head">
        <h2>Recetas</h2>
        <button class="btn" type="button" data-act="new">Nueva receta</button>
      </div>
      ${dishes.length
        ? dishes.map(d => `
            <button class="card-row" type="button" data-act="edit" data-id="${d.id}">
              <span>${esc(d.name)}<small>${esc(summary(d))}</small></span>
            </button>`).join('')
        : `<div class="hero"><h2>Escribe tus recetas</h2>
            <p>Añade todas las que sepas, con sus ingredientes. Con ellas la app montará tu menú.</p>
            <button class="btn big" type="button" data-act="new">Añadir la primera</button></div>`}`;

    el.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      openForm(b.dataset.act === 'edit' ? b.dataset.id : null);
    };
  }

  const rowHtml = (name = '') => `
    <div class="ing-row">
      <input class="field ing-name" type="text" placeholder="Ingrediente" value="${esc(name)}" autocomplete="off">
      <button class="icon-btn" type="button" data-remove aria-label="Quitar ingrediente">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>
    </div>`;

  function openForm(id) {
    const dish = id ? C.state.dishes.find(d => d.id === id) : null;
    const rows = dish && dish.ingredients.length ? dish.ingredients : [{ name: '' }];
    const tags = P.knownIngredients(C.state.dishes);

    C.openSheet(dish ? 'Editar receta' : 'Nueva receta', `
      <label class="form-label" for="dish-name">Nombre</label>
      <input id="dish-name" class="field" type="text" autocomplete="off" value="${dish ? esc(dish.name) : ''}">
      <label class="form-label">Ingredientes</label>
      ${tags.length ? `<div id="ing-tags" class="chips">${tags.map(t =>
        `<button class="chip" type="button" data-tag="${esc(t.key)}" data-name="${esc(t.name)}">${esc(t.name)}</button>`).join('')}</div>` : ''}
      <div id="ing-rows">${rows.map(r => rowHtml(r.name)).join('')}</div>
      <button id="ing-add" class="btn ghost" type="button" style="margin-top:10px;width:100%">Añadir ingrediente</button>
      <div class="sheet-actions">
        ${dish ? '<button id="dish-delete" class="btn danger" type="button">Eliminar</button>' : ''}
        <button id="dish-save" class="btn" type="button">Guardar</button>
      </div>`);

    const box = $('ing-rows');
    $('ing-add').onclick = () => {
      box.insertAdjacentHTML('beforeend', rowHtml());
      box.lastElementChild.querySelector('.ing-name').focus();
    };
    const names = () => [...box.querySelectorAll('.ing-name')].map(i => i.value);
    // Oculta las etiquetas de ingredientes que ya están en la receta.
    const syncTags = () => {
      const used = new Set(names().map(P.norm));
      document.querySelectorAll('#ing-tags [data-tag]').forEach(b => { b.hidden = used.has(b.dataset.tag); });
    };
    box.onclick = e => {
      const rm = e.target.closest('[data-remove]');
      if (rm) { rm.closest('.ing-row').remove(); syncTags(); }
    };
    box.oninput = syncTags;
    const tagBox = $('ing-tags');
    if (tagBox) tagBox.onclick = e => {
      const b = e.target.closest('[data-tag]');
      if (!b) return;
      const empty = [...box.querySelectorAll('.ing-name')].find(i => !i.value.trim());
      if (empty) empty.value = b.dataset.name;
      else box.insertAdjacentHTML('beforeend', rowHtml(b.dataset.name));
      syncTags();
    };
    syncTags();

    $('dish-save').onclick = () => {
      const name = $('dish-name').value.trim();
      if (!name) { C.toast('La receta necesita un nombre'); return; }
      const ingredients = P.buildIngredients(names(), dish);
      if (dish) {
        dish.name = name;
        dish.ingredients = ingredients;
        ['menu', 'draft'].forEach(k => {
          const m = C.state[k];
          if (m) Object.values(m.plan).forEach(e => { if (e.id === dish.id) e.name = name; });
        });
      } else {
        C.state.dishes.push(P.normalizeDish({ name, ingredients }));
      }
      C.save(); C.closeSheet(); C.render();
    };

    if (dish) {
      $('dish-delete').onclick = () => {
        if (!confirm(`¿Eliminar "${dish.name}"? Si está en el menú, se sustituirá por otra.`)) return;
        C.dropDish(dish.id);
        C.save(); C.closeSheet(); C.render();
      };
    }
  }

  C.register('recetas', { render });
})();
