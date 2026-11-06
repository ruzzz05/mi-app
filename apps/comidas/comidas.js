(() => {
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const SLOTS = [{ id: 'comida', label: 'Comida' }, { id: 'cena', label: 'Cena' }];
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
    ['Salmón a la plancha', 'salmón, limón, ensalada'],
    ['Crema de calabacín', 'calabacín, patata, cebolla, queso crema']
  ].map(([name, ing]) => ({ id: uid(), name, ingredients: ing.split(',').map(s => s.trim()) }));

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* almacenamiento no disponible */ }
    return { dishes: SEED, plan: {}, checked: {} };
  }
  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  }
  save();

  const dishById = id => state.dishes.find(d => d.id === id);
  const slotKey = (d, s) => `${d}-${s}`;
  const parseIngredients = text => text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

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
  function renderWeek() {
    $('week').innerHTML = DAYS.map((day, d) => `
      <div class="day">
        <h3>${day}</h3>
        ${SLOTS.map(s => {
          const entry = state.plan[slotKey(d, s.id)];
          return `<button class="slot" type="button" data-day="${d}" data-slot="${s.id}">
            <span class="label">${s.label}</span>
            <span class="name ${entry ? '' : 'empty'}">${entry ? esc(entry.name) : 'Añadir'}</span>
          </button>`;
        }).join('')}
      </div>`).join('');

    $('week').querySelectorAll('.slot').forEach(b => {
      b.onclick = () => openPicker(+b.dataset.day, b.dataset.slot);
    });
  }

  function openPicker(d, s) {
    const key = slotKey(d, s);
    const label = SLOTS.find(x => x.id === s).label;
    const current = state.plan[key];

    openSheet(`${DAYS[d]} · ${label}`, `
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
      const matches = state.dishes
        .filter(x => x.name.toLowerCase().includes(q))
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
    }
  }

  $('btn-suggest').onclick = () => {
    if (!state.dishes.length) { toast('Añade platos primero'); return; }
    const used = new Set(Object.values(state.plan).map(e => e.id).filter(Boolean));
    let filled = 0;
    DAYS.forEach((_, d) => SLOTS.forEach(s => {
      const key = slotKey(d, s.id);
      if (state.plan[key]) return;
      let pool = state.dishes.filter(x => !used.has(x.id));
      if (!pool.length) { used.clear(); pool = state.dishes; }
      const dish = pool[Math.floor(Math.random() * pool.length)];
      used.add(dish.id);
      state.plan[key] = { id: dish.id, name: dish.name };
      filled++;
    }));
    save(); render();
    toast(filled ? `${filled} huecos rellenados` : 'No hay huecos libres');
  };

  $('btn-clear').onclick = () => {
    if (!Object.keys(state.plan).length) { toast('La semana ya está vacía'); return; }
    if (confirm('¿Vaciar toda la semana?')) {
      state.plan = {}; state.checked = {};
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
        // mantener el nombre actualizado en el plan
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
        save(); closeSheet(); render();
      };
    }
  }
  $('btn-new-dish').onclick = () => openDishForm(null);

  // ---------- Compra ----------
  function shoppingItems() {
    const map = new Map();
    Object.values(state.plan).forEach(entry => {
      const dish = entry.id ? dishById(entry.id) : null;
      if (!dish) return;
      dish.ingredients.forEach(ing => {
        const k = ing.toLowerCase();
        const cur = map.get(k) || { name: ing, qty: 0 };
        cur.qty++;
        map.set(k, cur);
      });
    });
    return [...map.entries()]
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function renderShopping() {
    const items = shoppingItems();
    if (!items.length) {
      $('shopping').innerHTML = '<p class="empty-msg">Planifica algunos platos con ingredientes y la lista aparecerá aquí.</p>';
      return;
    }
    $('shopping').innerHTML = items.map(it => `
      <label class="buy ${state.checked[it.key] ? 'done' : ''}">
        <input type="checkbox" data-key="${esc(it.key)}" ${state.checked[it.key] ? 'checked' : ''}>
        <span>${esc(it.name)}</span>
        ${it.qty > 1 ? `<span class="qty">×${it.qty}</span>` : ''}
      </label>`).join('');
    $('shopping').querySelectorAll('input').forEach(cb => {
      cb.onchange = () => {
        if (cb.checked) state.checked[cb.dataset.key] = true; else delete state.checked[cb.dataset.key];
        save(); renderShopping();
      };
    });
  }

  $('btn-uncheck').onclick = () => { state.checked = {}; save(); renderShopping(); };

  $('btn-copy').onclick = async () => {
    const items = shoppingItems().filter(it => !state.checked[it.key]);
    if (!items.length) { toast('No hay nada que copiar'); return; }
    const text = items.map(it => `- ${it.name}${it.qty > 1 ? ' x' + it.qty : ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Lista copiada');
    } catch (e) {
      toast('No se pudo copiar');
    }
  };

  // ---------- Render ----------
  function render() {
    renderWeek();
    renderDishes();
    renderShopping();
  }
  render();
})();
