// Interfaz de Comidas. Toda la lógica de planificación vive en planner.js (con tests).
(() => {
  const P = window.Planner;
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const SLOT_LABELS = { comida: 'Comida', cena: 'Cena' };
  const KEY = 'comidas.v1';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const $ = id => document.getElementById(id);

  // ---------- Datos ----------
  const SEED = [
    ['Lentejas', 'lentejas, zanahoria, cebolla, chorizo'],
    ['Pasta con tomate', 'pasta, tomate triturado, cebolla, queso rallado'],
    ['Tortilla de patatas', 'huevos, patatas, cebolla'],
    ['Pollo al horno', 'pollo, patatas, limón'],
    ['Ensalada mixta', 'lechuga, tomate, atún, aceitunas'],
    ['Arroz con verduras', 'arroz, pimiento, zanahoria, guisantes'],
    ['Salmón a la plancha', 'salmón, limón, lechuga'],
    ['Crema de calabacín', 'calabacín, patata, cebolla, queso crema']
  ].map(([name, ing]) => ({ id: uid(), name, ingredients: ing.split(',').map(s => s.trim()) }));

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* sin almacenamiento */ }
    if (!s) s = { dishes: SEED };
    s.plan = s.plan || {};
    s.exclusions = s.exclusions || [];
    // Migración de la versión anterior (checked suelto -> lista)
    s.list = s.list || { ...P.emptyList(), checked: s.checked || {} };
    delete s.checked;
    return s;
  }
  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ } };
  save();

  const dishById = id => state.dishes.find(d => d.id === id);
  const parseIngredients = text => text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const ctx = () => ({ dishes: state.dishes, plan: state.plan, exclusions: state.exclusions, rng: Math.random });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- Hoja inferior ----------
  const sheet = $('sheet');
  function openSheet(title, html) {
    $('sheet-title').textContent = title;
    $('sheet-body').innerHTML = html;
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }
  $('sheet-close').onclick = closeSheet;
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });

  // ---------- Pestañas ----------
  document.querySelectorAll('.segmented button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.segmented button').forEach(b => b.classList.toggle('active', b === btn));
      ['semana', 'platos', 'compra'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== btn.dataset.tab));
      render();
    };
  });

  // ---------- Semana ----------
  function exclusionLabel(ex) {
    const what = ex.dishId ? (dishById(ex.dishId) || { name: 'plato borrado' }).name : ex.ingredient;
    const when = ex.scope === 'week' ? 'semana' : DAYS[ex.day].toLowerCase();
    return `Sin ${what} · ${when}`;
  }

  function renderExclusions() {
    const box = $('exclusions');
    box.innerHTML = state.exclusions.map((ex, i) =>
      `<button class="chip" type="button" data-i="${i}" title="Quitar exclusión">${esc(exclusionLabel(ex))}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>`).join('');
    box.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => { state.exclusions.splice(+c.dataset.i, 1); save(); render(); toast('Exclusión quitada'); };
    });
  }

  function renderWeek() {
    renderExclusions();
    $('week').innerHTML = DAYS.map((day, d) => `
      <div class="day">
        <h3><span>${day}</span>
          <button class="mini" type="button" data-regen="${d}">Regenerar día</button>
        </h3>
        ${P.SLOTS.map(s => {
          const entry = state.plan[P.slotKey(d, s)];
          return `<button class="slot" type="button" data-day="${d}" data-slot="${s}">
            <span class="label">${SLOT_LABELS[s]}</span>
            <span class="name ${entry ? '' : 'empty'}">${entry ? esc(entry.name) : 'Añadir'}</span>
          </button>`;
        }).join('')}
      </div>`).join('');

    $('week').querySelectorAll('.slot').forEach(b => { b.onclick = () => openPicker(+b.dataset.day, b.dataset.slot); });
    $('week').querySelectorAll('[data-regen]').forEach(b => {
      b.onclick = () => {
        state.plan = P.regenerateDay({ ...ctx(), day: +b.dataset.regen });
        save(); render(); toast(`${DAYS[+b.dataset.regen]} regenerado`);
      };
    });
  }

  function openPicker(d, s) {
    const key = P.slotKey(d, s);
    const current = state.plan[key];

    openSheet(`${DAYS[d]} · ${SLOT_LABELS[s]}`, `
      ${current ? `
        <div class="actions-grid">
          <button id="act-reroll" class="btn ghost" type="button">Otro plato</button>
          ${current.id ? `
            <button id="act-no-week" class="btn ghost" type="button">No quiero este plato esta semana</button>
            <button id="act-no-day" class="btn ghost" type="button">No quiero este plato este día</button>` : ''}
        </div>
        <label class="form-label">Elegir otro a mano</label>` : ''}
      <input id="pick-input" class="field" type="text" placeholder="Busca o escribe un plato" autocomplete="off">
      <div id="pick-list" style="margin-top:14px"></div>
      <div class="sheet-actions">
        ${current ? '<button id="pick-remove" class="btn danger" type="button">Quitar</button>' : ''}
        <button id="pick-use" class="btn" type="button">Usar texto escrito</button>
      </div>`);

    const input = $('pick-input');
    const list = $('pick-list');

    function paint() {
      const q = input.value.trim().toLowerCase();
      const matches = state.dishes.filter(x => x.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      list.innerHTML = matches.length
        ? matches.map(x => `<button class="card-row" type="button" data-id="${x.id}">${esc(x.name)}</button>`).join('')
        : '<p class="empty-msg">Sin coincidencias. Puedes usar el texto escrito.</p>';
      list.querySelectorAll('.card-row').forEach(r => {
        r.onclick = () => {
          const dish = dishById(r.dataset.id);
          state.plan[key] = { id: dish.id, name: dish.name };
          save(); closeSheet(); render();
        };
      });
    }
    input.oninput = paint;
    paint();

    $('pick-use').onclick = () => {
      const text = input.value.trim();
      if (!text) { toast('Escribe un plato primero'); return; }
      const existing = state.dishes.find(x => x.name.toLowerCase() === text.toLowerCase());
      state.plan[key] = existing ? { id: existing.id, name: existing.name } : { id: null, name: text };
      save(); closeSheet(); render();
    };

    if (current) {
      $('pick-remove').onclick = () => { delete state.plan[key]; save(); closeSheet(); render(); };
      $('act-reroll').onclick = () => {
        const next = P.rerollSlot({ ...ctx(), day: d, slot: s });
        const changed = next[key].id !== current.id || next[key].name !== current.name;
        state.plan = next; save(); closeSheet(); render();
        toast(changed ? 'Plato cambiado' : 'No hay otro plato disponible');
      };
      if (current.id) {
        const exclude = scope => {
          const exclusion = scope === 'week' ? { scope, dishId: current.id } : { scope, day: d, dishId: current.id };
          const res = P.excludeAndReplace({ ...ctx(), exclusion });
          state.plan = res.plan; state.exclusions = res.exclusions;
          save(); closeSheet(); render();
          toast(scope === 'week' ? `Sin ${current.name} esta semana` : `Sin ${current.name} el ${DAYS[d].toLowerCase()}`);
        };
        $('act-no-week').onclick = () => exclude('week');
        $('act-no-day').onclick = () => exclude('day');
      }
    }
  }

  // Exclusión libre: un plato o un ingrediente, para la semana o un día
  $('btn-exclude').onclick = () => {
    openSheet('No quiero…', `
      <label class="form-label" for="ex-text">Plato o ingrediente</label>
      <input id="ex-text" class="field" type="text" placeholder="Por ejemplo: pasta, tomate, lentejas" autocomplete="off">
      <label class="form-label" for="ex-scope">¿Cuándo?</label>
      <select id="ex-scope" class="field">
        <option value="week">Toda la semana</option>
        ${DAYS.map((d, i) => `<option value="${i}">Solo el ${d.toLowerCase()}</option>`).join('')}
      </select>
      <div class="sheet-actions"><button id="ex-apply" class="btn" type="button">Excluir y reemplazar</button></div>`);
    $('ex-apply').onclick = () => {
      const text = $('ex-text').value.trim();
      if (!text) { toast('Escribe qué no quieres'); return; }
      const dish = state.dishes.find(x => x.name.toLowerCase() === text.toLowerCase());
      const what = dish ? { dishId: dish.id } : { ingredient: text };
      const v = $('ex-scope').value;
      const exclusion = v === 'week' ? { scope: 'week', ...what } : { scope: 'day', day: +v, ...what };
      const res = P.excludeAndReplace({ ...ctx(), exclusion });
      state.plan = res.plan; state.exclusions = res.exclusions;
      save(); closeSheet(); render(); toast('Exclusión aplicada');
    };
  };

  $('btn-generate').onclick = () => {
    if (!state.dishes.length) { toast('Añade platos primero'); return; }
    const before = Object.keys(state.plan).length;
    state.plan = P.generateWeek(ctx());
    const added = Object.keys(state.plan).length - before;
    save(); render();
    toast(added ? `${added} huecos rellenados` : 'No hay huecos que rellenar');
  };

  $('btn-clear').onclick = () => {
    if (!Object.keys(state.plan).length && !state.exclusions.length) { toast('La semana ya está vacía'); return; }
    if (confirm('¿Empezar una semana nueva? Se vaciarán el menú, las exclusiones y los cambios de la lista de la compra.')) {
      state.plan = {}; state.exclusions = []; state.list = P.emptyList();
      save(); render();
    }
  };

  // ---------- Platos ----------
  function renderDishes() {
    const dishes = [...state.dishes].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    $('dishes').innerHTML = dishes.length
      ? dishes.map(x => `
          <button class="card-row" type="button" data-id="${x.id}">
            <span>${esc(x.name)}<small>${x.ingredients.length ? esc(x.ingredients.join(', ')) : 'Sin ingredientes'}</small></span>
          </button>`).join('')
      : '<p class="empty-msg">Todavía no tienes platos. Añade el primero.</p>';
    $('dishes').querySelectorAll('.card-row').forEach(r => { r.onclick = () => openDishForm(r.dataset.id); });
  }

  function openDishForm(id) {
    const dish = id ? dishById(id) : null;
    openSheet(dish ? 'Editar plato' : 'Nuevo plato', `
      <label class="form-label" for="dish-name">Nombre</label>
      <input id="dish-name" class="field" type="text" autocomplete="off" value="${dish ? esc(dish.name) : ''}">
      <label class="form-label" for="dish-ing">Ingredientes (uno por línea o separados por comas)</label>
      <textarea id="dish-ing" class="field">${dish ? esc(dish.ingredients.join('\n')) : ''}</textarea>
      <div class="sheet-actions">
        ${dish ? '<button id="dish-delete" class="btn danger" type="button">Eliminar</button>' : ''}
        <button id="dish-save" class="btn" type="button">Guardar</button>
      </div>`);

    $('dish-save').onclick = () => {
      const name = $('dish-name').value.trim();
      if (!name) { toast('El plato necesita un nombre'); return; }
      const ingredients = parseIngredients($('dish-ing').value);
      if (dish) {
        dish.name = name; dish.ingredients = ingredients;
        Object.values(state.plan).forEach(e => { if (e.id === dish.id) e.name = name; });
      } else {
        state.dishes.push({ id: uid(), name, ingredients });
      }
      save(); closeSheet(); render();
    };
    if (dish) {
      $('dish-delete').onclick = () => {
        if (!confirm(`¿Eliminar "${dish.name}"? También se quitará de la semana.`)) return;
        state.dishes = state.dishes.filter(x => x.id !== dish.id);
        Object.keys(state.plan).forEach(k => { if (state.plan[k].id === dish.id) delete state.plan[k]; });
        state.exclusions = state.exclusions.filter(ex => ex.dishId !== dish.id);
        save(); closeSheet(); render();
      };
    }
  }
  $('btn-new-dish').onclick = () => openDishForm(null);

  // ---------- Compra ----------
  const currentItems = () => P.buildShoppingList({ dishes: state.dishes, plan: state.plan, list: state.list });

  function renderShopping() {
    const items = currentItems();
    const rows = items.map(it => `
      <div class="buy ${it.checked ? 'done' : ''}">
        <label class="buy-main">
          <input type="checkbox" data-check="${esc(it.key)}" ${it.checked ? 'checked' : ''}>
          <span class="buy-text">
            <span class="buy-name">${esc(it.name)}</span>
            <small>${it.recipes.length ? esc(it.recipes.join(', ')) : 'Añadido a mano'}</small>
          </span>
          ${it.qty > 1 ? `<span class="qty">×${it.qty}</span>` : ''}
        </label>
        <button class="icon-btn" type="button" data-remove="${esc(it.key)}" aria-label="Quitar ${esc(it.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>`).join('');

    const removed = state.list.removed;
    $('shopping').innerHTML =
      (rows || '<p class="empty-msg">Genera el menú o añade productos a mano y la lista aparecerá aquí.</p>') +
      (removed.length ? `
        <details class="removed">
          <summary>Quitados (${removed.length})</summary>
          ${removed.map(k => `<button class="card-row" type="button" data-restore="${esc(k)}">${esc(k)}<small>Volver a poner</small></button>`).join('')}
        </details>` : '');

    const sh = $('shopping');
    sh.querySelectorAll('[data-check]').forEach(cb => {
      cb.onchange = () => { state.list = P.toggleChecked(state.list, cb.dataset.check); save(); renderShopping(); };
    });
    sh.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = () => { state.list = P.removeFromList(state.list, b.dataset.remove); save(); renderShopping(); toast('Quitado de la lista'); };
    });
    sh.querySelectorAll('[data-restore]').forEach(b => {
      b.onclick = () => { state.list = P.restoreToList(state.list, b.dataset.restore); save(); renderShopping(); };
    });
  }

  function addManual() {
    const input = $('add-item');
    const name = input.value.trim();
    if (!name) return;
    state.list = P.addToList(state.list, name);
    input.value = '';
    save(); renderShopping();
    input.focus();
  }
  $('btn-add-item').onclick = addManual;
  $('add-item').addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); });

  $('btn-uncheck').onclick = () => { state.list = { ...state.list, checked: {} }; save(); renderShopping(); };

  $('btn-copy').onclick = async () => {
    const items = currentItems().filter(it => !it.checked);
    if (!items.length) { toast('No hay nada que copiar'); return; }
    const text = items.map(it => `- ${it.name}${it.qty > 1 ? ' x' + it.qty : ''}`).join('\n');
    try { await navigator.clipboard.writeText(text); toast('Lista copiada'); }
    catch (e) { toast('No se pudo copiar'); }
  };

  // ---------- Render ----------
  function render() {
    renderWeek();
    renderDishes();
    renderShopping();
  }
  render();
})();
