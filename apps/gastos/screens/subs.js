// Pantalla Suscripciones: lo que pagas cada mes/año, qué día te cobran, hasta cuándo dura
// y las que detecta solas en tus gastos.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { $, esc, eur } = G;

  const PERIOD = { week: 'semana', month: 'mes', year: 'año' };
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dayLabel = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`; };
  const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  const save = list => { G.state.subs = list; G.save(); G.render(); };

  // "Se cobra el día 15 de cada mes", "Se cobra cada lunes", "Se cobra el 2 de mayo de cada año"
  function whenText(period, anchor) {
    if (!anchor) return '';
    const [, m, d] = anchor.split('-').map(Number);
    if (period === 'week') return `Se cobra cada ${WEEKDAYS[new Date(anchor + 'T00:00:00').getDay()]}`;
    if (period === 'year') return `Se cobra el ${d} de ${MONTHS[m - 1]} de cada año`;
    return `Se cobra el día ${d} de cada mes`;
  }

  // Hoja para crear o editar. `base` puede venir de una suscripción detectada.
  function openSub(base) {
    const sub = base || { name: '', amount: '', period: 'month', anchor: G.todayISO() };
    const editing = !!(base && base.id);
    G.openSheet(editing ? 'Editar suscripción' : 'Nueva suscripción', `
      <input id="sb-name" class="field" type="text" placeholder="Nombre (Netflix, gimnasio…)" value="${esc(sub.name)}" autocomplete="off">
      <input id="sb-amount" class="field" type="text" inputmode="decimal" placeholder="Importe" value="${sub.amount === '' ? '' : String(sub.amount).replace('.', ',')}" autocomplete="off">
      <select id="sb-period" class="field" aria-label="Cada cuánto se cobra">${Object.keys(PERIOD).map(k => `<option value="${k}" ${sub.period === k ? 'selected' : ''}>Cada ${PERIOD[k]}</option>`).join('')}</select>
      <label class="lbl">Próximo cobro<input id="sb-date" class="field" type="date" value="${esc(sub.anchor)}"></label>
      <p id="sb-when" class="hint"></p>
      <label class="lbl">Deja de cobrarse el<input id="sb-until" class="field" type="date" value="${esc(sub.until || '')}"></label>
      <p class="hint">Último día en que sigue vigente. Si no caduca, déjalo vacío. <button id="sb-clear" class="link" type="button">Quitar fecha</button></p>
      <div class="sheet-actions">
        ${editing ? `<button id="sb-pause" class="btn ghost" type="button">${sub.paused ? 'Reactivar' : 'Pausar'}</button><button id="sb-del" class="btn danger" type="button">Borrar</button>` : ''}
        <button id="sb-save" class="btn" type="button">Guardar</button>
      </div>`);
    const hint = () => { $('sb-when').textContent = whenText($('sb-period').value, $('sb-date').value); };
    $('sb-period').onchange = hint; $('sb-date').onchange = hint; hint();
    $('sb-clear').onclick = () => { $('sb-until').value = ''; };
    $('sb-save').onclick = () => {
      const name = $('sb-name').value.trim();
      const amount = P.parseAmount($('sb-amount').value);
      const anchor = $('sb-date').value;
      const until = $('sb-until').value;
      if (!name) { G.toast('Falta el nombre'); return; }
      if (amount === null) { G.toast('Importe no válido'); return; }
      if (!anchor) { G.toast('Falta el día del próximo cobro'); return; }
      if (until && until < anchor) { G.toast('La fecha de fin es anterior al próximo cobro'); return; }
      const next = { id: sub.id || P.newId(), name, amount, period: $('sb-period').value, anchor, ...(until ? { until } : {}), ...(sub.paused ? { paused: true } : {}) };
      save(editing ? G.state.subs.map(s => (s.id === sub.id ? next : s)) : [...G.state.subs, next]);
      G.closeSheet();
    };
    if (editing) {
      $('sb-pause').onclick = () => { save(G.state.subs.map(s => (s.id === sub.id ? { ...s, paused: !s.paused } : s))); G.closeSheet(); };
      $('sb-del').onclick = async () => {
        if (!await window.AppConfirm({ title: `¿Borrar «${sub.name}»?`, text: 'Los gastos que ya se apuntaron de esta suscripción se quedan.', okLabel: 'Borrar' })) return;
        G.closeSheet();
        window.Anim.remove(document.querySelector(`.subrow[data-edit="${sub.id}"]`), () => { save(G.state.subs.filter(s => s.id !== sub.id)); G.toast('Suscripción borrada'); });
      };
    }
  }

  function render(el) {
    const today = G.todayISO();
    const subs = G.state.subs;
    const t = P.subscriptionTotals(subs, today);
    const m = P.subsMonthTotals(subs, today);
    const detected = P.detectSubscriptions(G.state.expenses, subs);
    const ended = subs.filter(s => s.until && s.until < today);
    const live = subs.filter(s => !ended.includes(s));
    const sorted = [...live].sort((a, b) => (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || P.nextCharge(a, today).localeCompare(P.nextCharge(b, today)));

    const detail = s => {
      if (s.paused) return 'Pausada';
      let out = `Próximo cobro ${dayLabel(P.nextCharge(s, today))}`;
      if (s.until) {
        const left = P.remainingCharges(s, today);
        out += `<br><span class="row-end">Termina el ${dayLabel(s.until)}${left === 1 ? ' · último cobro' : left ? ` · ${left} cobros más` : ''}</span>`;
      }
      return out;
    };
    const row = (s, endedRow) => `<button class="subrow ${s.paused || endedRow ? 'dim' : ''}" type="button" data-edit="${esc(s.id)}">
      <span class="ico" style="--k:${G.colorOf('Suscripciones')}">${esc(s.name[0].toUpperCase())}</span>
      <span class="tx"><b>${esc(s.name)}</b><small>${endedRow ? 'Terminó el ' + dayLabel(s.until) : detail(s)}</small></span>
      <span class="ma">${eur(s.amount)}<small>/${PERIOD[s.period]}</small></span></button>`;

    el.innerHTML = `
      <section class="sub-hero">
        <small>Suscripciones al mes</small>
        <div class="big">${eur(t.monthly)}</div>
        <small>${eur(t.yearly)} al año · ${t.count} activa${t.count === 1 ? '' : 's'}</small>
        <small>Este mes: ${eur(m.total)} · te falta ${eur(m.pending)}${m.pendingCount ? ` (${m.pendingCount} cobro${m.pendingCount === 1 ? '' : 's'})` : ''}</small>
      </section>

      ${detected.length ? `<div class="found-box"><b>He encontrado cobros repetidos</b>
        ${detected.map((d, i) => `<div class="found"><div class="tx"><b>${esc(d.name)}</b><small>${eur(d.amount)} cada ${PERIOD[d.period]} · ${d.count} cobros</small></div>
          <button class="btn small" type="button" data-adopt="${i}">Añadir</button></div>`).join('')}</div>` : ''}

      <div class="secx"><h3>Tus suscripciones</h3><button id="sb-add" class="btn small" type="button">+ Añadir</button></div>
      ${sorted.length ? `<div class="lst">${sorted.map(s => row(s, false)).join('')}</div>`
        : '<p class="empty-msg">Aún no hay suscripciones. Añade Netflix, Spotify, el gimnasio…</p>'}
      ${ended.length ? `<details class="ended"><summary>Terminadas (${ended.length})</summary><div class="lst">${ended.map(s => row(s, true)).join('')}</div></details>` : ''}`;

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
