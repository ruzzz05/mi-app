// Núcleo de la interfaz de Gastos: datos guardados en el móvil, navegación, hoja inferior y avisos.
// Cada pantalla se registra con Gastos.register(nombre, { render }).
(() => {
  const P = window.Planner;
  const KEY = 'gastos.v1';
  const NAMES = ['resumen', 'subs', 'ajustes'];
  const CATEGORIES = ['Supermercado', 'Restaurantes', 'Transporte', 'Suscripciones', 'Ocio', 'Salud', 'Hogar', 'Otros'];

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return { expenses: Array.isArray(s && s.expenses) ? s.expenses : [], subs: Array.isArray(s && s.subs) ? s.subs : [], updatedAt: (s && s.updatedAt) || 0 };
    } catch (e) { return { expenses: [], subs: [], updatedAt: 0 }; }
  }

  const screens = {};
  let current = null;
  let toastTimer;

  const G = window.Gastos = {
    state: load(), $, esc, eur, todayISO, CATEGORIES,

    save() {
      G.state.updatedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(G.state)); } catch (e) { G.toast('No se pudo guardar en el móvil'); }
    },

    toast(msg, ms) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.add('show');
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
      current = name;
      NAMES.forEach(n => $('screen-' + n).classList.toggle('hidden', n !== name));
      document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
      $('fab').classList.toggle('hidden', name === 'ajustes');
      G.render();
      const sc = document.querySelector('.scroller');
      if (sc) sc.scrollTop = 0;
    },

    render() { if (current && screens[current]) screens[current].render($('screen-' + current)); },

    addExpense(e) {
      G.state.expenses = [e, ...G.state.expenses];
      G.save();
    },

    // Hoja para apuntar un gasto a mano
    openExpenseSheet() {
      const subs = G.state.subs;
      G.openSheet('Nuevo gasto', `
        <input id="ex-amount" class="field amount-in" type="text" inputmode="decimal" placeholder="0,00 €" autocomplete="off">
        <input id="ex-merchant" class="field" type="text" placeholder="¿Dónde? (Mercadona, Netflix…)" autocomplete="off">
        <div class="chips" id="ex-cats">${CATEGORIES.map(c => `<button type="button" class="chip-btn" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <div class="sheet-actions"><button id="ex-save" class="btn" type="button">Guardar</button></div>`);
      let cat = null;
      const mark = () => document.querySelectorAll('#ex-cats .chip-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
      $('ex-cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; mark(); } };
      $('ex-merchant').oninput = () => { if (!cat) { const g = P.guessCategory($('ex-merchant').value); if (g !== 'Otros') { cat = g; mark(); } } };
      $('ex-save').onclick = () => {
        const amount = P.parseAmount($('ex-amount').value);
        if (amount === null) { G.toast('Escribe un importe'); return; }
        const merchant = $('ex-merchant').value.trim() || 'Gasto';
        const match = P.matchSubscription({ merchant }, subs);
        G.addExpense({ id: P.newId(), amount, merchant, date: todayISO(), category: cat || (match ? 'Suscripciones' : P.guessCategory(merchant)), source: 'manual' });
        G.closeSheet(); G.render(); G.toast('Gasto guardado');
      };
      setTimeout(() => $('ex-amount').focus(), 50);
    },

    start() {
      $('sheet-close').onclick = G.closeSheet;
      $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) G.closeSheet(); });
      document.querySelectorAll('.tabbar button').forEach(b => { b.onclick = () => G.go(b.dataset.screen); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') G.closeSheet(); });
      $('fab').onclick = G.openExpenseSheet;
      G.go('resumen');
    }
  };
})();
