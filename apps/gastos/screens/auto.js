// Pantalla Automático: los pagos con Apple Pay que llegan solos (el Atajo de iOS abre la app con el pago)
// esperan aquí a que confirmes su categoría. Hasta entonces no cuentan en el resumen.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { esc, eur } = G;

  const URL_BASE = 'https://ruzzz05.github.io/mi-app/apps/gastos/';

  function render(el) {
    const list = P.pendingList(G.state.expenses);
    el.innerHTML = `
      <div class="screen-title">Pagos con Apple Pay</div>
      <div class="stat">
        <b>Cómo se configura</b>
        <ol class="steps">
          <li>En la app Atajos, crea una automatización con el disparador <i>Transacción</i> (Wallet) que se ejecute sin preguntar.</li>
          <li>Acción <i>Abrir URL</i> con esta dirección, sustituyendo los huecos por las variables <i>Importe</i> y <i>Comercio</i>:</li>
        </ol>
        <code class="url">${URL_BASE}?pago=[Importe]&amp;comercio=[Comercio]</code>
        <small>Cada pago se abre en la app y queda aquí por revisar.</small>
      </div>
      <div class="secx"><h3>Por revisar (${list.length})</h3><small>Confirma la categoría</small></div>
      <div class="lst">${list.map(p => `<div class="pend">
        <span class="ico" style="--k:${G.colorOf(p.category)}">${esc(p.merchant[0].toUpperCase())}</span>
        <div class="tx"><b>${esc(p.merchant)}</b>
          <select data-cat="${esc(p.id)}" aria-label="Categoría de ${esc(p.merchant)}">${G.CATEGORIES.map(c => `<option ${c === p.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <span class="ma">${eur(p.amount)}</span>
        <button class="check" type="button" data-confirm="${esc(p.id)}" aria-label="Confirmar ${esc(p.merchant)}">✓</button>
      </div>`).join('') || '<p class="empty-msg">Todo revisado. Los pagos nuevos aparecerán aquí.</p>'}</div>`;

    el.onclick = e => {
      const ok = e.target.closest('[data-confirm]');
      if (!ok) return;
      const sel = el.querySelector(`[data-cat="${ok.dataset.confirm}"]`);
      G.state.expenses = P.confirmPending(G.state.expenses, ok.dataset.confirm, sel && sel.value);
      G.save(); G.render(); G.toast('Pago apuntado');
    };
  }

  G.register('auto', { render });
})();
