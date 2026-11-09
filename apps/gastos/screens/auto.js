// Pantalla Automático: los pagos con Apple Pay que llegan solos (el Atajo de iOS abre la app con el pago)
// esperan aquí a que confirmes su categoría. Hasta entonces no cuentan en el resumen.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { esc, eur } = G;

  // La clave de la API de Firebase no es secreta (va en la web pública); el secreto es TU_CLAVE, que solo está en el Atajo y en las reglas de Firestore.
  const INBOX_URL = 'https://firestore.googleapis.com/v1/projects/mi-app-490b5/databases/(default)/documents/gastosInbox?key=AIzaSyCnFhLS9YxR1MnSDwwrKteWaW0CpMuqgdM';

  function render(el) {
    const list = P.pendingList(G.state.expenses);
    el.innerHTML = `
      <div class="screen-title">Pagos con Apple Pay</div>
      <div class="stat">
        <b>Cómo se configura (una sola vez)</b>
        <ol class="steps">
          <li>En Atajos, ve a <i>Automatización</i> y pulsa +. Elige <i>Transacción</i>, marca tus tarjetas y activa <i>Ejecutar inmediatamente</i>.</li>
          <li>Primera acción, <i>Texto</i>, con esto (sustituye TU_CLAVE y arrastra las variables <i>Importe</i> y <i>Comercio</i> a su sitio):</li>
        </ol>
        <code class="url">{"fields":{"k":{"stringValue":"TU_CLAVE"},"amount":{"stringValue":"[Importe]"},"merchant":{"stringValue":"[Comercio]"}}}</code>
        <ol class="steps" start="3">
          <li>Segunda acción, <i>Obtener contenido de URL</i>, método <i>POST</i>, esta dirección:</li>
        </ol>
        <code class="url">${INBOX_URL}</code>
        <ol class="steps" start="4">
          <li>En esa acción: cabecera <i>Content-Type</i> = <i>application/json</i> y <i>Cuerpo de la solicitud</i> = <i>Archivo</i>, eligiendo el Texto anterior.</li>
        </ol>
        <small>Cada pago llega solo a la nube y la app lo apunta al abrirla. Si el comercio no se reconoce, queda aquí por revisar.</small>
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
