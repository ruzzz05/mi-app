// Pantalla Compra: lista automática del menú, modificable.
(() => {
  const C = window.Comidas;
  const P = window.Planner;
  const { $, esc } = C;

  // Las comidas que ya han pasado no cuentan: sus ingredientes dejan de hacer falta
  const items = () => P.buildShoppingList({ dishes: C.state.dishes, menu: C.state.menu, list: C.state.list, now: new Date() });
  const pastMeals = () => {
    const m = C.state.menu;
    return m ? P.pastSlotKeys(m, new Date()).filter(k => m.plan[k] && m.plan[k].id).length : 0;
  };
  const setList = list => { C.state.list = list; C.save(); C.render(); };
  let boughtOpen = false; // el bloque "Comprados" recuerda si estaba desplegado

  function render(el) {
    const all = items();
    const removed = C.state.list.removed;

    const rowHtml = it => `
      <div class="buy ${it.checked ? 'done' : ''}">
        <label class="buy-main">
          <input type="checkbox" data-check="${esc(it.key)}" ${it.checked ? 'checked' : ''}>
          <span class="buy-text">
            <span class="buy-name">${esc(it.name)}</span>
            <small>${it.recipes.length ? esc(it.recipes.join(', ')) : 'Añadido a mano'}</small>
          </span>
          ${it.qty === 1 ? '' : `<span class="qty">×${P.formatQty(it.qty)}</span>`}
        </label>
        <button class="icon-btn" type="button" data-remove="${esc(it.key)}" aria-label="Quitar ${esc(it.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>`;
    const rows = all.filter(it => !it.checked).map(rowHtml).join('');
    const bought = all.filter(it => it.checked);

    el.innerHTML = `
      <div class="screen-head"><h2>Compra</h2></div>
      ${C.state.menu ? '' : '<p class="sub">Crea un menú y aquí aparecerá la lista de la semana.</p>'}
      ${pastMeals() ? `<p class="sub">No cuento ${pastMeals()} ${pastMeals() === 1 ? 'comida que ya ha pasado' : 'comidas que ya han pasado'}.</p>` : ''}
      <div class="add-row">
        <input id="add-name" class="field" type="text" placeholder="Añadir producto" autocomplete="off">
        <input id="add-qty" class="field qty-in" type="text" inputmode="decimal" value="1" aria-label="Cantidad">
        <button id="add-btn" class="btn" type="button" aria-label="Añadir producto">+</button>
      </div>
      <div class="toolbar">
        <button class="btn" type="button" data-act="copy">Copiar lista</button>
        <button class="btn ghost" type="button" data-act="uncheck">Desmarcar todo</button>
      </div>
      ${bought.length ? `<details class="bought" ${boughtOpen ? 'open' : ''}><summary>Comprados (${bought.length})</summary>
        ${bought.map(rowHtml).join('')}</details>` : ''}
      ${rows || `<p class="empty-msg">${bought.length ? 'Todo comprado.' : 'La lista está vacía.'}</p>`}
      ${removed.length ? `<details class="removed"><summary>Quitados (${removed.length})</summary>
        ${removed.map(k => `<button class="card-row" type="button" data-restore="${esc(k)}">${esc(k)}<small>Volver a poner</small></button>`).join('')}
      </details>` : ''}`;

    const add = () => {
      const name = $('add-name').value.trim();
      if (!name) return;
      const raw = $('add-qty').value;
      const qty = raw.trim() === '' ? 1 : P.parseQty(raw);
      if (qty === null) { C.toast('Cantidad no válida'); return; }
      setList(P.addToList(C.state.list, name, qty));
      $('add-name').focus();
    };
    const dt = el.querySelector('details.bought');
    if (dt) dt.addEventListener('toggle', () => { boughtOpen = dt.open; });
    $('add-btn').onclick = add;
    $('add-name').onkeydown = e => { if (e.key === 'Enter') add(); };

    el.onchange = e => {
      const cb = e.target.closest('[data-check]');
      if (cb) setList(P.toggleChecked(C.state.list, cb.dataset.check));
    };
    el.onclick = async e => {
      const rm = e.target.closest('[data-remove]');
      const rs = e.target.closest('[data-restore]');
      const act = e.target.closest('[data-act]');
      if (rm) { setList(P.removeFromList(C.state.list, rm.dataset.remove)); C.toast('Quitado de la lista'); }
      else if (rs) setList(P.restoreToList(C.state.list, rs.dataset.restore));
      else if (act && act.dataset.act === 'uncheck') setList({ ...C.state.list, checked: {} });
      else if (act && act.dataset.act === 'copy') {
        const todo = items().filter(it => !it.checked);
        if (!todo.length) { C.toast('No hay nada que copiar'); return; }
        const text = todo.map(it => `- ${it.name}${it.qty === 1 ? '' : ' x' + P.formatQty(it.qty)}`).join('\n');
        try { await navigator.clipboard.writeText(text); C.toast('Lista copiada'); }
        catch (err) { C.toast('No se pudo copiar'); }
      }
    };
  }

  C.register('compra', { render });
})();
