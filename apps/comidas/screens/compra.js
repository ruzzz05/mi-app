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

  // Foto del ticket en una ventana flotante: se ve cada paso (preparar la foto, leerla con la IA,
  // buscar tus productos) y al final tú confirmas qué pasa a comprados.
  const STEPS = [['prepare', 'Preparando la foto'], ['read', 'Leyendo el ticket con Gemini'], ['match', 'Buscando tus productos']];
  const pause = ms => new Promise(r => setTimeout(r, ms)); // que cada paso se alcance a ver
  let scanId = 0;

  function progressHtml(photoUrl, current, failedAt, message) {
    const idx = STEPS.findIndex(s => s[0] === current);
    return `
      <div class="tk-photo">${photoUrl ? `<img src="${photoUrl}" alt="Foto del ticket">` : ''}</div>
      <ol class="tk-steps">${STEPS.map(([id, label], i) => {
        const state = failedAt === id ? 'error' : (idx > i || (current === 'done')) ? 'done' : idx === i ? 'active' : '';
        return `<li class="tk-step ${state}"><span class="tk-dot">${state === 'done' ? '✓' : state === 'error' ? '!' : ''}</span>${label}</li>`;
      }).join('')}</ol>
      ${message ? `<p class="tk-msg">${esc(message)}</p><button id="ticket-retry" class="btn" type="button">Reintentar</button>` : ''}`;
  }

  async function scanTicket(file) {
    const pending = P.pendingItems(items());
    if (!pending.length) { C.toast('No hay nada pendiente en la lista'); return; }
    const id = ++scanId;
    const alive = () => id === scanId && C.sheetOpen();
    const photoUrl = URL.createObjectURL(file);
    let current = 'prepare';
    const show = (cur, failedAt, message) => { current = cur; if (alive()) { $('sheet-body').innerHTML = progressHtml(photoUrl, cur, failedAt, message); if (message) $('ticket-retry').onclick = () => scanTicket(file); } };
    const fail = (at, message) => { if (alive()) show(at, at, message); };

    C.openSheet('Leyendo el ticket', '');
    show('prepare');
    let text;
    try {
      const limit = window.Ticket.timeoutMs || 45000;
      let timer;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), limit); });
      text = await Promise.race([
        window.Ticket.read(file, P.ticketPrompt(pending), step => { if (step !== current) show(step); }),
        timeout
      ]);
      clearTimeout(timer);
    } catch (err) {
      console.warn('Ticket:', err);
      fail(current === 'prepare' ? 'prepare' : 'read', err && err.message === 'timeout'
        ? 'Gemini tardó demasiado en responder. Comprueba la conexión e inténtalo de nuevo.'
        : 'No se pudo leer el ticket. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }
    if (!alive()) return; // cerraste la ventana: se descarta el resultado
    show('match');
    await pause(450);
    if (!alive()) return;
    const keys = P.parseTicketMatches(text, pending);
    show('done');
    await pause(300);
    if (!alive()) return;

    const row = it => `
      <label class="buy ticket-row">
        <span class="buy-main"><input type="checkbox" data-ticket="${esc(it.key)}" ${keys.includes(it.key) ? 'checked' : ''}>
        <span class="buy-name">${esc(it.name)}</span></span>
      </label>`;
    const found = pending.filter(it => keys.includes(it.key));
    const rest = pending.filter(it => !keys.includes(it.key));
    $('sheet-title').textContent = 'Confirmar ticket';
    $('sheet-body').innerHTML = `
      <p class="tk-result ${found.length ? 'ok' : 'none'}">${found.length
        ? `He encontrado ${found.length} de ${pending.length} productos de tu lista. Desmarca los que no sean correctos.`
        : 'No he encontrado ningún producto de tu lista en el ticket. Si compraste alguno, márcalo a mano.'}</p>
      ${found.map(row).join('')}
      ${rest.length ? `<details class="bought" ${found.length ? '' : 'open'}><summary>${found.length ? 'No aparecen en el ticket' : 'Tu lista'} (${rest.length})</summary>${rest.map(row).join('')}</details>` : ''}
      <button id="ticket-ok" class="btn" type="button">Marcar como comprados</button>`;
    $('ticket-ok').onclick = () => {
      const chosen = [...document.querySelectorAll('#sheet-body [data-ticket]:checked')].map(i => i.dataset.ticket);
      C.closeSheet();
      setList(P.markBought(C.state.list, chosen));
      C.toast(chosen.length ? `${chosen.length} marcados como comprados` : 'No se ha marcado nada');
    };
  }

  function render(el) {
    if (C.ensureFilled) C.ensureFilled(); // las comidas sin plato se rellenan solas
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
        <button class="btn ghost cam-btn" type="button" data-act="ticket" aria-label="Escanear ticket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
        </button>
        <input id="ticket-file" type="file" accept="image/*" capture="environment" hidden>
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
    $('ticket-file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) scanTicket(f); };
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
      else if (act && act.dataset.act === 'ticket') $('ticket-file').click();
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
