// Pantalla Menú: crear y editar el menú. Un menú nuevo queda activo al crearlo (no hay paso de confirmar)
// y las comidas sin plato se rellenan solas (no hay botón de rellenar ni de regenerar).
(() => {
  const C = window.Comidas;
  const P = window.Planner;
  const { $, esc } = C;
  const LABEL = { comida: 'Comida', cena: 'Cena' };

  // "2026-11-06" + 2 días -> "Domingo, 8 nov"
  function dayLabel(startISO, add) {
    const [y, m, d] = startISO.split('-').map(Number);
    const s = new Date(y, m - 1, d + add).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Antes el menú nuevo era un borrador que había que confirmar. Si queda alguno guardado (en el móvil
  // o recuperado de la nube), pasa a ser el menú activo.
  C.promoteDraft = () => {
    if (!C.state.draft) return;
    if (!C.state.menu) { C.state.menu = C.state.draft; C.state.list = P.emptyList(); }
    C.state.draft = null;
    C.save();
  };

  // Las comidas sin plato se rellenan solas con platos de tu lista (los que ya hay no se tocan)
  C.ensureFilled = () => {
    const m = C.state.menu;
    if (!m || !C.state.dishes.length || !P.emptySlots(m).length) return;
    const next = P.fillMenu({ dishes: C.state.dishes, menu: m });
    if (P.emptySlots(next).length === P.emptySlots(m).length) return;   // no hay nada que poner (p. ej. por exclusiones)
    C.state.menu = next;
    C.save();
  };

  const which = () => (C.state.menu ? 'menu' : null);

  function render(el) {
    el.onclick = null;
    C.promoteDraft();
    C.ensureFilled();
    if (!C.state.dishes.length) {
      el.innerHTML = `<div class="hero"><h2>Primero, tus recetas</h2>
        <p>Para crear un menú necesito conocer los platos que sabes preparar.</p>
        <button class="btn big" type="button" data-go="recetas">Añadir recetas</button></div>`;
      el.onclick = e => { if (e.target.closest('[data-go]')) C.go('recetas'); };
      return;
    }
    const w = which();
    if (w) renderPlan(el, w); else renderCreate(el);
  }

  // ---------- Crear ----------
  function renderCreate(el) {
    const now = new Date();
    const prop = P.proposeStart(now);
    const today = P.toISODate(now);
    const pre = prop.date !== today ? 'tomorrow-comida' : (prop.firstMeal === 'cena' ? 'today-cena' : 'today-comida');
    const opts = [
      ['today-comida', 'Hoy, el día completo'],
      ['today-cena', 'Hoy, desde la cena'],
      ['tomorrow-comida', 'Mañana'],
      ['other', 'Otro día']
    ];

    el.innerHTML = `
      <div class="screen-head"><h2>Crear menú</h2></div>
      <label class="form-label" for="days">¿Cuántos días?</label>
      <input id="days" class="field" type="number" inputmode="numeric" min="1" max="14" value="7">
      <label class="form-label">¿Cuándo empieza?</label>
      ${opts.map(([v, t]) => `
        <label class="opt"><input type="radio" name="start" value="${v}" ${v === pre ? 'checked' : ''}><span>${t}${v === pre ? ' <em>(sugerido)</em>' : ''}</span></label>`).join('')}
      <div id="other-box" class="hidden">
        <input id="other-date" class="field" type="date" value="${today}">
        <select id="other-meal" class="field" style="margin-top:8px">
          <option value="comida">Empezar por la comida</option>
          <option value="cena">Empezar por la cena</option>
        </select>
      </div>
      <button id="create" class="btn big" type="button" style="width:100%;margin-top:20px">Crear menú</button>`;

    el.onchange = e => {
      if (e.target.name === 'start') $('other-box').classList.toggle('hidden', e.target.value !== 'other');
    };
    $('create').onclick = () => {
      const days = parseInt($('days').value, 10);
      if (!(days >= 1 && days <= 14)) { C.toast('Elige entre 1 y 14 días'); return; }
      const choice = el.querySelector('input[name="start"]:checked').value;
      let startDate, firstMeal = 'comida';
      if (choice === 'today-comida') startDate = today;
      else if (choice === 'today-cena') { startDate = today; firstMeal = 'cena'; }
      else if (choice === 'tomorrow-comida') startDate = P.toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      else {
        startDate = $('other-date').value;
        firstMeal = $('other-meal').value;
        if (!startDate) { C.toast('Elige una fecha'); return; }
      }
      const menu = P.newMenu({ dishes: C.state.dishes, days, startDate, firstMeal });
      if (!Object.keys(menu.plan).length) { C.toast('No he podido montar el menú'); return; }
      C.state.menu = menu;
      C.state.draft = null;
      C.state.list = P.emptyList();
      C.save(); C.go('hoy'); C.toast('Menú creado');
    };
  }

  // ---------- Ver y editar ----------
  function renderPlan(el, w) {
    const m = C.state[w];
    const keys = P.slotKeys(m);

    const days = [];
    for (let d = 0; d < m.days; d++) {
      const slots = P.SLOTS.filter(s => keys.includes(P.slotKey(d, s))).map(s => {
        const e = m.plan[P.slotKey(d, s)];
        const has = e && !e.empty;
        const extras = P.extrasOf(m, P.slotKey(d, s));
        return `<button class="slot" type="button" data-act="slot" data-day="${d}" data-slot="${s}">
          <span class="label">${LABEL[s]}</span>
          <span class="name ${has ? '' : 'empty'}">${has ? esc(e.name) : 'Sin plato'}${extras.length
            ? `<small class="extras">+ ${extras.map(x => esc(x.name)).join(' + ')}</small>` : ''}</span>
        </button>`;
      }).join('');
      days.push(`<div class="day"><h3><span>${dayLabel(m.startDate, d)}</span></h3>${slots}</div>`);
    }

    el.innerHTML = `
      <div class="screen-head"><h2>Tu menú</h2>
        <button class="new-menu-btn" type="button" data-act="new" aria-label="Menú nuevo" title="Menú nuevo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      <p class="sub">${m.days} ${m.days === 1 ? 'día' : 'días'} desde ${dayLabel(m.startDate, 0).toLowerCase()}.</p>
      ${days.join('')}`;

    el.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      const day = +b.dataset.day;
      if (a === 'slot') openSlot(w, day, b.dataset.slot);
      else if (a === 'new') {
        if (confirm('¿Crear un menú nuevo? Se perderá el actual y los cambios de la lista de la compra.')) {
          C.state.menu = null; C.state.list = P.emptyList(); C.save(); C.render();
        }
      }
    };
  }

  // ---------- Acciones sobre un hueco ----------
  function openSlot(w, d, slot) {
    const m = C.state[w];
    const key = P.slotKey(d, slot);
    const cur = m.plan[key];
    const set = menu => { C.state[w] = menu; C.save(); C.closeSheet(); C.render(); };
    const extras = P.extrasOf(m, key);
    C.openSheet(`${dayLabel(m.startDate, d)} · ${LABEL[slot]}`, `
      <div id="extras-box">
        ${extras.map((x, i) => `<div class="extra-row"><span>+ ${esc(x.name)}</span>
          <button class="icon-btn" type="button" data-rm-extra="${i}" aria-label="Quitar ${esc(x.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button></div>`).join('')}
        <button id="add-extra" class="btn ghost" type="button" style="width:100%;margin-bottom:14px">Añadir otro plato a esta comida</button>
      </div>
      ${cur && cur.empty
        ? `<button id="pick-random" class="remove-btn neutral" type="button">Poner un plato al azar</button>
        <p class="hint remove-hint">Esta comida está vacía a propósito.</p>`
        : cur ? `<button id="pick-remove" class="remove-btn" type="button">Quitar «${esc(cur.name)}»</button>
        <p class="hint remove-hint">Se cambia por otro de tus platos.</p>` : ''}
      <input id="pick-input" class="field" type="text" placeholder="O busca o escribe otro plato" autocomplete="off">
      <div id="pick-list" style="margin-top:14px"></div>
      <div class="sheet-actions">
        <button id="pick-use" class="btn" type="button">Usar texto escrito</button>
      </div>`);

    $('extras-box').onclick = e => {
      const rm = e.target.closest('[data-rm-extra]');
      if (rm) { set(P.removeExtra(m, key, +rm.dataset.rmExtra)); C.toast('Plato quitado de esta comida'); return; }
      if (e.target.closest('#add-extra')) openExtra(w, d, slot);
    };

    const input = $('pick-input');
    const list = $('pick-list');
    const paint = () => {
      const q = input.value.trim().toLowerCase();
      const found = C.state.dishes.filter(x => x.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      // La primera opción siempre es dejar la comida vacía
      const none = `<button class="card-row pick-empty" type="button" data-empty="1">Dejar vacía<small>Sin plato en esta comida</small></button>`;
      list.innerHTML = none + (found.length
        ? found.map(x => `<button class="card-row" type="button" data-id="${x.id}">${esc(x.name)}</button>`).join('')
        : '<p class="empty-msg">Sin coincidencias. Puedes usar el texto escrito.</p>');
    };
    input.oninput = paint; paint();
    list.onclick = e => {
      if (e.target.closest('[data-empty]')) {
        set({ ...m, plan: { ...m.plan, [key]: { id: null, name: '', empty: true } } });
        C.toast('Comida dejada vacía');
        return;
      }
      const r = e.target.closest('[data-id]');
      if (!r) return;
      const dish = C.state.dishes.find(x => x.id === r.dataset.id);
      set({ ...m, plan: { ...m.plan, [key]: { id: dish.id, name: dish.name } } });
    };

    $('pick-use').onclick = () => {
      const text = input.value.trim();
      if (!text) { C.toast('Escribe un plato primero'); return; }
      const known = C.state.dishes.find(x => x.name.toLowerCase() === text.toLowerCase());
      set({ ...m, plan: { ...m.plan, [key]: known ? { id: known.id, name: known.name } : { id: null, name: text } } });
    };

    if (cur && cur.empty) {
      $('pick-random').onclick = () => {
        const plan = { ...m.plan }; delete plan[key];
        const next = P.fillMenu({ dishes: C.state.dishes, menu: { ...m, plan } });
        const now = next.plan[key];
        set(next);
        C.toast(now ? `Puesto: ${now.name}` : 'No hay platos para poner');
      };
    } else if (cur) {
      $('pick-remove').onclick = () => {
        const next = P.rerollSlot({ dishes: C.state.dishes, menu: m, day: d, slot });
        const now = next.plan[key];
        set(next);
        C.toast(now && now.name !== cur.name ? `Cambiado por ${now.name}` : 'No hay otro plato para cambiarlo');
      };
    }
  }

  // ---------- Añadir otro plato a una comida (además del principal) ----------
  function openExtra(w, d, slot) {
    const m = C.state[w];
    const key = P.slotKey(d, slot);
    const add = dish => {
      const next = P.addExtra(m, key, dish);
      if (next === m) { C.toast('Ya está en esta comida'); return; }
      C.state[w] = next; C.save(); C.closeSheet(); C.render();
      C.toast(`Añadido: ${dish.name}`);
    };
    C.openSheet(`${dayLabel(m.startDate, d)} · ${LABEL[slot]} · Otro plato`, `
      <input id="extra-input" class="field" type="text" placeholder="Busca o escribe un plato" autocomplete="off">
      <div id="extra-list" style="margin-top:14px"></div>
      <div class="sheet-actions"><button id="extra-use" class="btn" type="button">Usar texto escrito</button></div>`);
    const input = $('extra-input');
    const list = $('extra-list');
    const paint = () => {
      const q = input.value.trim().toLowerCase();
      const found = C.state.dishes.filter(x => x.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      list.innerHTML = found.length
        ? found.map(x => `<button class="card-row" type="button" data-id="${x.id}">${esc(x.name)}</button>`).join('')
        : '<p class="empty-msg">Sin coincidencias. Puedes usar el texto escrito.</p>';
    };
    input.oninput = paint; paint();
    list.onclick = e => {
      const r = e.target.closest('[data-id]');
      if (!r) return;
      const dish = C.state.dishes.find(x => x.id === r.dataset.id);
      add({ id: dish.id, name: dish.name });
    };
    $('extra-use').onclick = () => {
      const text = input.value.trim();
      if (!text) { C.toast('Escribe un plato primero'); return; }
      const known = C.state.dishes.find(x => x.name.toLowerCase() === text.toLowerCase());
      add(known ? { id: known.id, name: known.name } : { id: null, name: text });
    };
  }

  C.register('menu', { render });
})();
