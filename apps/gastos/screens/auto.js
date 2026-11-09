// Pantalla Automático: los pagos con Apple Pay que llegan solos (el Atajo de iOS abre la app con el pago)
// esperan aquí a que confirmes su categoría. Hasta entonces no cuentan en el resumen.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { esc, eur } = G;

  // El texto y la dirección del Atajo son de cada cuenta (G.inboxInfo, lo rellena inbox.js): llevan la clave de su
  // buzón, que es el secreto. La clave de la API de Firebase que va en la dirección no lo es (está en la web pública).
  const WAIT = 'Cargando los datos de tu cuenta… (la primera vez hace falta conexión)';

  function render(el) {
    const list = P.pendingList(G.state.expenses);
    const info = G.inboxInfo;
    el.innerHTML = `
      <div class="screen-title">Pagos con Apple Pay</div>
      <details class="stat tut">
        <summary>Cómo se configura (una sola vez)</summary>
        <ol class="steps">
          <li>En Atajos, ve a <i>Automatización</i> y pulsa +. Elige <i>Transacción</i>, marca tus tarjetas y activa <i>Ejecutar inmediatamente</i>.</li>
          <li>Primera acción, <i>Texto</i>, con esto (toca para copiarlo; después cambia [Importe] y [Comercio] por las variables <i>Importe</i> y <i>Comercio</i>):</li>
        </ol>
        <code id="tut-body" class="url" data-copy>${esc(info ? info.body : WAIT)}</code>
        <ol class="steps" start="3">
          <li>Segunda acción, <i>Obtener contenido de URL</i>, método <i>POST</i>, esta dirección (toca para copiarla):</li>
        </ol>
        <code id="tut-url" class="url" data-copy>${esc(info ? info.url : WAIT)}</code>
        <ol class="steps" start="4">
          <li>En esa acción: cabecera <i>Content-Type</i> = <i>application/json</i> y <i>Cuerpo de la solicitud</i> = <i>Archivo</i>, eligiendo el Texto anterior.</li>
        </ol>
        <small>Cada pago llega solo a la nube y la app lo apunta al abrirla. Si el comercio no se reconoce, queda aquí por revisar. El texto y la dirección son solo de tu cuenta: no los compartas.</small>
      </details>
      <div class="secx"><h3>Por revisar (${list.length})</h3><small>Confirma la categoría</small></div>
      <div class="lst">${list.map(p => `<div class="pend">
        <span class="ico" style="--k:${G.colorOf(p.category)}">${esc(p.merchant[0].toUpperCase())}</span>
        <div class="tx"><b>${esc(p.merchant)}</b>
          <select data-cat="${esc(p.id)}" aria-label="Categoría de ${esc(p.merchant)}">${G.CATEGORIES.map(c => `<option ${c === p.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <span class="ma">${eur(p.amount)}</span>
        <button class="check" type="button" data-confirm="${esc(p.id)}" aria-label="Confirmar ${esc(p.merchant)}">✓</button>
      </div>`).join('') || '<p class="empty-msg">Todo revisado. Los pagos nuevos aparecerán aquí.</p>'}</div>`;

    el.onclick = e => {
      const copy = e.target.closest('[data-copy]');
      if (copy && G.inboxInfo && navigator.clipboard) {
        navigator.clipboard.writeText(copy.textContent).then(() => G.toast('Copiado'), () => G.toast('No se pudo copiar'));
        return;
      }
      const ok = e.target.closest('[data-confirm]');
      if (!ok) return;
      const sel = el.querySelector(`[data-cat="${ok.dataset.confirm}"]`);
      const list = P.confirmPending(G.state.expenses, ok.dataset.confirm, sel && sel.value);
      const done = list.find(x => x.id === ok.dataset.confirm);
      // La categoría confirmada vale para todos los gastos de ese comercio
      G.state.expenses = done ? P.setMerchantCategory(list, done.merchant, done.category) : list;
      G.save(); G.render(); G.toast('Pago apuntado');
    };
  }

  G.register('auto', { render });
})();
