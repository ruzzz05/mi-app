// Pantalla Menú: crear y editar el menú. Un menú nuevo queda activo al crearlo (no hay paso de confirmar).
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

  const which = () => (C.state.menu ? 'menu' : null);

  function render(el) {
    el.onclick = null;
    C.promoteDraft();
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
        return `<button class="slot" type="button" data-act="slot" data-day="${d}" data-slot="${s}">
          <span class="label">${LABEL[s]}</span>
          <span class="name ${e ? '' : 'empty'}">${e ? esc(e.name) : 'Sin plato'}</span>
        </button>`;
      }).join('');
      days.push(`<div class="day"><h3><span>${dayLabel(m.startDate, d)}</span>
        <button class="mini" type="button" data-act="regen-day" data-day="${d}">Regenerar día</button></h3>${slots}</div>`);
    }

    el.innerHTML = `
      <div class="screen-head"><h2>Tu menú</h2></div>
      <p class="sub">${m.days} ${m.days === 1 ? 'día' : 'días'} desde ${dayLabel(m.startDate, 0).toLowerCase()}.</p>
      <div class="toolbar">
        <button class="btn ghost" type="button" data-act="fill">Rellenar huecos</button>
        <button class="btn ghost" type="button" data-act="new">Menú nuevo</button>
      </div>
      ${days.join('')}`;

    const ctx = () => ({ dishes: C.state.dishes, menu: C.state[w] });
    const set = menu => { C.state[w] = menu; C.save(); C.render(); };

    el.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      const day = +b.dataset.day;
      if (a === 'slot') openSlot(w, day, b.dataset.slot);
      else if (a === 'regen-day') set(P.regenerateDay({ ...ctx(), day }));
      else if (a === 'fill') { set(P.fillMenu(ctx())); C.toast('Huecos rellenados'); }
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
    C.openSheet(`${dayLabel(m.startDate, d)} · ${LABEL[slot]}`, `
      <input id="pick-input" class="field" type="text" placeholder="Busca o escribe un plato" autocomplete="off">
      <div id="pick-list" style="margin-top:14px"></div>
      <div class="sheet-actions">
        ${cur ? '<button id="pick-remove" class="btn danger" type="button">Quitar</button>' : ''}
        <button id="pick-use" class="btn" type="button">Usar texto escrito</button>
      </div>`);

    const input = $('pick-input');
    const list = $('pick-list');
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
      set({ ...m, plan: { ...m.plan, [key]: { id: dish.id, name: dish.name } } });
    };

    $('pick-use').onclick = () => {
      const text = input.value.trim();
      if (!text) { C.toast('Escribe un plato primero'); return; }
      const known = C.state.dishes.find(x => x.name.toLowerCase() === text.toLowerCase());
      set({ ...m, plan: { ...m.plan, [key]: known ? { id: known.id, name: known.name } : { id: null, name: text } } });
    };

    if (cur) {
      $('pick-remove').onclick = () => { const plan = { ...m.plan }; delete plan[key]; set({ ...m, plan }); };
    }
  }

  C.register('menu', { render });
})();
