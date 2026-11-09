// Núcleo de la interfaz de Gastos: datos guardados en el móvil, navegación, mes que se está viendo,
// hoja inferior y avisos. Cada pantalla se registra con Gastos.register(nombre, { render }).
(() => {
  const P = window.Planner;
  const KEY = 'gastos.v1';
  const NAMES = ['resumen', 'subs', 'auto', 'ajustes'];
  const CAT_COLORS = { Supermercado: '#2FD08A', Restaurantes: '#FF8A5B', Transporte: '#5B9BFF', Suscripciones: '#B58CFF', Ocio: '#FFB547', Salud: '#5BD1E8', Hogar: '#F2C94C', Otros: '#7C8B99' };

  const EXTRA_COLORS = ['#FF6FA5', '#4DD4C1', '#9AD94A', '#FF9F6B', '#7E8CFF', '#E57BE5'];

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => P.euros(n, 2);
  const eur0 = n => P.euros(n, 0);
  const isoOf = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = () => isoOf(new Date());

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* datos rotos: se empieza de cero */ }
    s = s || {};
    const categories = Array.isArray(s.categories) && s.categories.includes('Otros') ? s.categories : P.DEFAULT_CATEGORIES.slice();
    return {
      expenses: Array.isArray(s.expenses) ? s.expenses : [],
      subs: Array.isArray(s.subs) ? s.subs : [],
      budget: s.budget > 0 ? s.budget : P.DEFAULT_MONTH_BUDGET,
      categories,
      updatedAt: s.updatedAt || 0
    };
  }

  let cloudDone;
  const screens = {};
  let current = null;
  let toastTimer;
  const now = new Date();
  const view = { y: now.getFullYear(), m: now.getMonth(), tab: 0 };   // mes que se enseña y pestaña del resumen

  const G = window.Gastos = {
    // Se cumple cuando la nube ya se ha leído (o ha fallado): el buzón de pagos espera a esto para no pisar datos
    cloudReady: new Promise(r => { cloudDone = r; }), cloudDone: () => cloudDone(),
    state: load(), $, esc, eur, eur0, todayISO, isoOf, CAT_COLORS, view,
    get CATEGORIES() { return G.state.categories; },
    // Las categorías propias toman un color de la rueda según su posición
    colorOf: c => CAT_COLORS[c] || EXTRA_COLORS[Math.max(0, G.state.categories.indexOf(c)) % EXTRA_COLORS.length],
    viewMonth: () => `${view.y}-${String(view.m + 1).padStart(2, '0')}`,
    isCurrentMonth: () => G.viewMonth() === todayISO().slice(0, 7),

    // touch:false = guardar sin cambiar la fecha de modificación ni avisar a la nube (datos que vienen de ella)
    save(opts) {
      const touch = !(opts && opts.touch === false);
      if (touch) G.state.updatedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(G.state)); } catch (e) { G.toast('No se pudo guardar en el móvil'); }
      G.updateBadge();
      if (touch && G.onSave) G.onSave();
    },

    // Deja los datos del móvil como nuevos (otra cuenta ha entrado)
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ } Object.assign(G.state, load()); G.render(); },

    // Puntito del rayo con los pagos que esperan a que los revises
    updateBadge() {
      const b = document.querySelector('#dock [data-screen="auto"] .badge');
      if (!b) return;
      const n = P.pendingList(G.state.expenses).length;
      b.textContent = String(n);
      b.hidden = n === 0;
    },

    toast(msg, ms) {
      const t = $('toast');
      t.textContent = msg;
      window.Anim.toast(t, ms);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
    },

    openSheet(title, html) {
      $('sheet-title').textContent = title;
      $('sheet-body').innerHTML = html;
      $('sheet').classList.add('open');
      $('sheet').setAttribute('aria-hidden', 'false');
    },
    closeSheet() { $('sheet').classList.remove('open'); $('sheet').setAttribute('aria-hidden', 'true'); },

    register(name, screen) { screens[name] = screen; },

    go(name) {
      const prev = current;
      current = name;
      NAMES.forEach(n => $('screen-' + n).classList.toggle('hidden', n !== name));
      document.querySelectorAll('#dock [data-screen]').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
      G.render();
      const sc = document.querySelector('.scroller');
      if (sc) sc.scrollTop = 0;
      window.Anim.enter($('screen-' + name), window.Anim.direction(NAMES.indexOf(prev), NAMES.indexOf(name)));
      if (G.tabInd) G.tabInd.place();
    },

    render() { if (current && screens[current]) screens[current].render($('screen-' + current)); G.updateBadge(); },

    addExpense(e) {
      G.state.expenses = [e, ...G.state.expenses];
      G.save();
    },

    // Hoja para apuntar un gasto a mano
    openExpenseSheet() {
      const subs = G.state.subs;
      G.openSheet('Nuevo gasto', `
        <input id="ex-amount" class="field amount-in" type="text" inputmode="decimal" placeholder="0,00 €" autocomplete="off" aria-label="Importe">
        <input id="ex-merchant" class="field" type="text" placeholder="¿Dónde? (Mercadona, Cine…)" autocomplete="off" aria-label="Dónde">
        <div class="cats" id="ex-cats">${G.CATEGORIES.map(c => `<button type="button" data-cat="${esc(c)}"><i style="background:${G.colorOf(c)}"></i>${esc(c)}</button>`).join('')}</div>
        <div class="sheet-actions"><button id="ex-save" class="btn big" type="button">Guardar gasto</button></div>`);
      let cat = null;
      const mark = () => document.querySelectorAll('#ex-cats [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
      $('ex-cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; mark(); } };
      $('ex-merchant').oninput = () => { if (!cat) { const g = P.guessCategory($('ex-merchant').value); if (g !== 'Otros') { cat = g; mark(); } } };
      $('ex-save').onclick = () => {
        const amount = P.parseAmount($('ex-amount').value);
        if (amount === null) { G.toast('Escribe un importe'); return; }
        const merchant = $('ex-merchant').value.trim() || 'Gasto';
        const match = P.matchSubscription({ merchant }, subs);
        G.addExpense({ id: P.newId(), amount, merchant, date: todayISO(), category: cat || (match ? 'Suscripciones' : P.guessCategory(merchant)), source: 'manual' });
        // El gasto es de hoy: se vuelve al mes actual para verlo
        const t = new Date(); view.y = t.getFullYear(); view.m = t.getMonth(); view.tab = 0;
        G.closeSheet(); G.go('resumen'); G.toast('Gasto guardado');
      };
      setTimeout(() => $('ex-amount').focus(), 50);
    },

    // Un pago nuevo de fuera: si ya estaba apuntado su cobro automático de suscripción, se quita ese
    addIncoming(list) {
      let ex = G.state.expenses;
      list.forEach(e => { ex = [G.normalize(e), ...P.withoutAutoCharge(ex, e, G.state.subs)]; });
      G.state.expenses = ex;
    },

    // Apunta como gasto los cobros de suscripciones que ya han tocado (una vez al abrir y al volver a la app)
    applySubs() {
      const r = P.dueCharges(G.state.subs, G.state.expenses, todayISO());
      if (!r.changed) return;
      const known = new Set(G.state.expenses.map(e => e.id));
      const fresh = r.expenses.filter(e => !known.has(e.id)).map(e => G.CATEGORIES.includes(e.category) ? e : { ...e, category: 'Otros' });
      G.state.subs = r.subs;
      G.state.expenses = [...fresh, ...G.state.expenses];
      G.save(); G.render();
      if (fresh.length) G.toast(fresh.length === 1 ? 'Suscripción apuntada: ' + fresh[0].merchant : fresh.length + ' suscripciones apuntadas');
    },

    // Un pago de fuera con una categoría que ya no existe pasa a 'Otros' y queda por revisar
    normalize(e) { return G.CATEGORIES.includes(e.category) ? e : { ...e, category: 'Otros', pending: true }; },

    // Un pago que llega con la dirección del Atajo (?pago=12,50&comercio=Mercadona) queda por revisar
    takePaymentFromUrl() {
      const e = P.fromQuery(location.search, Date.now());
      if (!e) return;
      G.addIncoming([e]);
      G.save();
      try { history.replaceState(null, '', location.pathname); } catch (err) { /* sin historial */ }
      G.toast('Pago por revisar: ' + e.merchant);
    },

    start() {
      $('sheet-close').onclick = G.closeSheet;
      $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) G.closeSheet(); });
      document.querySelectorAll('#dock [data-screen]').forEach(b => { b.onclick = () => G.go(b.dataset.screen); });
      G.tabInd = window.Anim.indicator($('dock'), '[data-screen]');
      document.addEventListener('keydown', e => { if (e.key === 'Escape') G.closeSheet(); });
      $('dock-add').onclick = G.openExpenseSheet;
      G.takePaymentFromUrl();
      G.go('resumen');
    }
  };
})();
