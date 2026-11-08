// Pantalla Suscripciones: lo que pagas cada mes/año, próximo cobro y las que detecta solas.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { $, esc, eur } = G;

  const PERIOD = { week: 'semana', month: 'mes', year: 'año' };
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dayLabel = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`; };

  function save(list) { G.state.subs = list; G.save(); G.render(); }

  // Hoja para crear o editar. `base` puede venir de una suscripción detectada.
  function openSub(base) {
    const sub = base || { name: '', amount: '', period: 'month', anchor: G.todayISO() };
    const editing = !!(base && base.id);
    G.openSheet(editing ? 'Editar suscripción' : 'Nueva suscripción', `
      <input id="sb-name" class="field" type="text" placeholder="Nombre (Netflix, gimnasio…)" value="${esc(sub.name)}" autocomplete="off">
      <input id="sb-amount" class="field" type="text" inputmode="decimal" placeholder="Importe" value="${sub.amount === '' ? '' : String(sub.amount).replace('.', ',')}" autocomplete="off">
      <select id="sb-period" class="field">${Object.keys(PERIOD).map(k => `<option value="${k}" ${sub.period === k ? 'selected' : ''}>Cada ${PERIOD[k]}</option>`).join('')}</select>
      <label class="lbl">Próximo cobro<input id="sb-date" class="field" type="date" value="${esc(sub.anchor)}"></label>
      <div class="sheet-actions">
        ${editing ? `<button id="sb-pause" class="btn ghost" type="button">${sub.paused ? 'Reactivar' : 'Pausar'}</button><button id="sb-del" class="btn danger" type="button">Borrar</button>` : ''}
        <button id="sb-save" class="btn" type="button">Guardar</button>
      </div>`);
    $('sb-save').onclick = () => {
      const name = $('sb-name').value.trim();
      const amount = P.parseAmount($('sb-amount').value);
      const anchor = $('sb-date').value;
      if (!name) { G.toast('Falta el nombre'); return; }
      if (amount === null) { G.toast('Importe no válido'); return; }
      if (!anchor) { G.toast('Falta la fecha del cobro'); return; }
      const next = { id: sub.id || P.newId(), name, amount, period: $('sb-period').value, anchor, ...(sub.paused ? { paused: true } : {}) };
      save(editing ? G.state.subs.map(s => (s.id === sub.id ? next : s)) : [...G.state.subs, next]);
      G.closeSheet();
    };
    if (editing) {
      $('sb-pause').onclick = () => { save(G.state.subs.map(s => (s.id === sub.id ? { ...s, paused: !s.paused } : s))); G.closeSheet(); };
      $('sb-del').onclick = () => { save(G.state.subs.filter(s => s.id !== sub.id)); G.closeSheet(); G.toast('Suscripción borrada'); };
    }
  }

  function render(el) {
    const today = G.todayISO();
    const subs = G.state.subs;
    const t = P.subscriptionTotals(subs);
    const detected = P.detectSubscriptions(G.state.expenses, subs);
    const sorted = [...subs].sort((a, b) => (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || P.nextCharge(a, today).localeCompare(P.nextCharge(b, today)));

    el.innerHTML = `
      <section class="hero">
        <div class="eyebrow">Suscripciones al mes</div>
        <div class="total">${eur(t.monthly)}</div>
        <div class="pills"><span class="pill">${eur(t.yearly)} al año</span><span class="pill">${t.count} activa${t.count === 1 ? '' : 's'}</span></div>
      </section>

      ${detected.length ? `<h3 class="sec">He encontrado cobros repetidos</h3>
        <div class="card">${detected.map((d, i) => `
          <div class="row"><span class="row-main"><b>${esc(d.name)}</b><small>${eur(d.amount)} cada ${PERIOD[d.period]} · ${d.count} cobros</small></span>
          <button class="btn small" type="button" data-adopt="${i}">Añadir</button></div>`).join('')}</div>` : ''}

      <div class="screen-head"><h3 class="sec" style="margin:0">Tus suscripciones</h3><button id="sb-add" class="btn small" type="button">+ Añadir</button></div>
      ${sorted.length ? `<div class="card">${sorted.map(s => {
        const next = P.nextCharge(s, today);
        return `<button class="row row-btn ${s.paused ? 'paused' : ''}" type="button" data-edit="${esc(s.id)}">
          <span class="row-main"><b>${esc(s.name)}</b><small>${s.paused ? 'Pausada' : 'Próximo cobro ' + dayLabel(next)} · ${eur(P.monthlyCost(s))}/mes</small></span>
          <span class="amt">${eur(s.amount)}<small>/${PERIOD[s.period]}</small></span></button>`;
      }).join('')}</div>` : '<p class="empty-msg">Aún no hay suscripciones. Añade Netflix, Spotify, el gimnasio…</p>'}`;

    $('sb-add').onclick = () => openSub(null);
    el.onclick = e => {
      const ad = e.target.closest('[data-adopt]');
      const ed = e.target.closest('[data-edit]');
      if (ad) { const d = detected[Number(ad.dataset.adopt)]; openSub({ name: d.name, amount: d.amount, period: d.period, anchor: d.anchor }); }
      else if (ed) openSub(G.state.subs.find(s => s.id === ed.dataset.edit));
    };
  }

  G.register('subs', { render });
})();
