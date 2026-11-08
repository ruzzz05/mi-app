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

  // Texto del buscador. Se borra al entrar en la pantalla o al crear una receta (para que se vea la nueva);
  // solo se mantiene si se refresca la lista por guardar o borrar una receta que ya existía.
  let query = '';
  let keepQuery = false;

  const cardHtml = d => `
    <button class="card-row" type="button" data-act="edit" data-id="${d.id}">
      ${d.photo ? `<img class="thumb" data-photo="${esc(d.photo)}" alt="">` : ''}
      <span>${esc(d.name)}<small>${esc(summary(d))}</small></span>
    </button>`;

  const listHtml = found => (found.length
    ? found.map(cardHtml).join('')
    : `<p class="empty-msg">Ninguna receta coincide con «${esc(query.trim())}».</p>`);

  function render(el) {
    if (!keepQuery) query = '';
    keepQuery = false;
    const dishes = [...C.state.dishes].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    el.innerHTML = `
      <div class="screen-head">
        <h2>Recetas</h2>
        <button class="btn" type="button" data-act="new">Nueva receta</button>
      </div>
      ${dishes.length
        ? `<input id="recipe-search" class="field search-field" type="search" placeholder="Buscar receta o ingrediente"
             aria-label="Buscar receta o ingrediente" autocomplete="off" value="${esc(query)}">
           <div id="recipe-list">${listHtml(P.filterDishes(dishes, query))}</div>`
        : `<div class="hero"><h2>Escribe tus recetas</h2>
            <p>Añade todas las que sepas, con sus ingredientes. Con ellas la app montará tu menú.</p>
            <button class="btn big" type="button" data-act="new">Añadir la primera</button></div>`}`;

    const search = $('recipe-search');
    if (search) {
      search.oninput = () => {
        query = search.value;
        $('recipe-list').innerHTML = listHtml(P.filterDishes(dishes, query));   // solo la lista: el campo conserva el foco
        C.hydratePhotos($('recipe-list'));
      };
    }
    C.hydratePhotos(el);
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
      <label class="form-label">Foto</label>
      <div class="photo-box">
        <img id="photo-img" class="photo-preview" alt="" ${dish && dish.photo ? `data-photo="${esc(dish.photo)}"` : ''}>
        <div class="photo-actions">
          <button id="photo-pick" class="btn ghost" type="button">Añadir foto</button>
          <button id="photo-clear" class="btn ghost hidden" type="button">Quitar foto</button>
        </div>
        <input id="photo-file" type="file" accept="image/*" hidden>
      </div>
      <label class="form-label">Ingredientes</label>
      ${tags.length ? `<div id="ing-tags" class="chips">${tags.map(t =>
        `<button class="chip" type="button" data-tag="${esc(t.key)}" data-name="${esc(t.name)}">${esc(t.name)}</button>`).join('')}</div>` : ''}
      <div id="ing-rows">${rows.map(r => rowHtml(r.name)).join('')}</div>
      <button id="ing-add" class="btn ghost" type="button" style="margin-top:10px;width:100%">Añadir ingrediente</button>
      <div class="sheet-actions">
        ${dish ? '<button id="dish-delete" class="btn danger" type="button">Eliminar</button>' : ''}
        <button id="dish-save" class="btn" type="button">Guardar</button>
      </div>`);

    C.hydratePhotos($('sheet-body'));

    // Foto: solo se guarda al pulsar Guardar (si cierras el formulario, no se cambia nada).
    let photoData = null;        // foto nueva ya reducida
    let photoRemoved = false;    // se pidió quitar la que tenía
    const hasPhoto = () => !!photoData || !!(dish && dish.photo && !photoRemoved);
    const syncPhotoButtons = () => {
      $('photo-pick').textContent = hasPhoto() ? 'Cambiar foto' : 'Añadir foto';
      $('photo-clear').classList.toggle('hidden', !hasPhoto());
    };
    $('photo-pick').onclick = () => $('photo-file').click();
    $('photo-file').onchange = e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      window.Photos.fromFile(file)
        .then(data => { photoData = data; photoRemoved = false; $('photo-img').src = data; syncPhotoButtons(); })
        .catch(err => C.toast(err.message || 'No se pudo usar esa foto'));
    };
    $('photo-clear').onclick = () => {
      photoData = null; photoRemoved = true;
      $('photo-img').removeAttribute('src');
      syncPhotoButtons();
    };
    syncPhotoButtons();

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
      let photoId = dish ? dish.photo || null : null;
      if (photoData) {                       // foto nueva: id nuevo, y la anterior se borra
        const fresh = P.newPhotoId();
        window.Photos.put(fresh, photoData);
        if (photoId) window.Photos.remove(photoId);
        photoId = fresh;
      } else if (photoRemoved && photoId) {
        window.Photos.remove(photoId);
        photoId = null;
      }
      if (dish) {
        dish.name = name;
        dish.ingredients = ingredients;
        Object.assign(dish, P.withPhoto(dish, photoId));
        if (!photoId) delete dish.photo;
        ['menu', 'draft'].forEach(k => {
          const m = C.state[k];
          if (!m) return;
          Object.values(m.plan).forEach(e => { if (e.id === dish.id) e.name = name; });
          Object.values(m.extras || {}).forEach(list => list.forEach(e => { if (e.id === dish.id) e.name = name; }));
        });
      } else {
        C.state.dishes.push(P.withPhoto(P.normalizeDish({ name, ingredients }), photoId));
      }
      keepQuery = !!dish;      // editar una receta: se mantiene el filtro; una nueva lo borra para que se vea
      C.save(); C.closeSheet(); C.render();
    };

    if (dish) {
      $('dish-delete').onclick = () => {
        if (!confirm(`¿Eliminar "${dish.name}"? Si está en el menú, se sustituirá por otra.`)) return;
        C.dropDish(dish.id);
        keepQuery = true;
        C.save(); C.closeSheet(); C.render();
      };
    }
  }

  C.register('recetas', { render });
})();
