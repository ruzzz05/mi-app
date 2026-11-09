// Pantalla Resumen: el círculo con lo que te queda del presupuesto, las tres cifras del mes y, debajo,
// Movimientos (por día), Categorías (frente a su presupuesto) y Evolución (barras diarias).
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { $, esc, eur, eur0 } = G;

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  const ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;

  const movRow = e => `<div class="mv" data-edit="${esc(e.id)}">
    <span class="ico" style="--k:${G.colorOf(e.category)}">${esc((e.merchant || '?')[0].toUpperCase())}</span>
    <div class="tx"><b>${esc(e.merchant)}</b><small>${esc(e.category)}${e.source === 'auto' ? ' · automático' : e.source === 'sub' ? ' · suscripción' : ''}</small></div>
    <span class="ma">${eur(e.amount)}</span>
    <button class="x" type="button" data-del="${esc(e.id)}" aria-label="Borrar ${esc(e.merchant)}">×</button></div>`;

  // cat (opcional): solo los gastos de esa categoría
  function movementsView(month, today, cat) {
    const inMonth = G.state.expenses.filter(e => e.date.startsWith(month) && (!cat || e.category === cat));
    const groups = P.groupByDay(inMonth, today);
    if (!groups.length) return cat ? '<p class="empty-msg">Sin gastos de esta categoría este mes.</p>' : '<p class="empty-msg">Sin gastos este mes. Toca + para apuntar uno.</p>';
    return `<div class="lst">${groups.map(g => `<div class="dh"><span>${esc(g.label)}</span><span>${eur(g.total)}</span></div>${g.items.map(movRow).join('')}`).join('')}</div>`;
  }

  // Detalle de una categoría: los mismos movimientos por día, solo de ella, con botón para volver
  function categoryDetail(month, today, cat) {
    const total = P.categoryTotals(G.state.expenses, month, G.CATEGORIES).find(r => r.category === cat);
    return `<div class="cat-head"><button id="cat-back" class="ar" type="button" aria-label="Volver a las categorías">${ARROW_L}</button>
      <span class="ico" style="--k:${G.colorOf(cat)}">${esc(cat[0])}</span><b>${esc(cat)}</b><span id="cat-total" class="ma">${eur(total ? total.spent : 0)}</span></div>
      ${movementsView(month, today, cat)}`;
  }

  function categoriesView(month) {
    const rows = P.categoryTotals(G.state.expenses, month, G.CATEGORIES);
    return `<div class="lst">${rows.map(r => `<div class="catrow" data-cat="${esc(r.category)}" role="button" tabindex="0">
      <span class="ico" style="--k:${G.colorOf(r.category)}">${esc(r.category[0])}</span>
      <div class="tx"><b><span>${esc(r.category)}</span><span>${eur(r.spent)} <small>${r.pct}%</small></span></b>
      <div class="p" style="--k:${G.colorOf(r.category)}"><i style="width:${r.pct}%"></i></div></div></div>`).join('')}</div>`;
  }

  function evolutionView(month, stats, current, today) {
    const list = P.confirmed(G.state.expenses);
    const series = P.dailySeries(list, month);
    const limit = G.state.budget / series.length;
    const max = Math.max(limit * 1.4, ...series);
    const todayIdx = current ? Number(today.slice(8, 10)) - 1 : -1;
    return `<div class="evo-wrap"><div class="evo">${series.map((v, i) => `<span class="${i === todayIdx ? 't' : v > limit ? 'over' : ''}" style="height:${Math.max(2, Math.round(v / max * 100))}%"></span>`).join('')}<i class="line" style="bottom:${Math.round(limit / max * 100)}%"></i></div>
      <div class="evn"><span>1</span><span>Límite diario ${eur0(limit)}</span><span>${series.length}</span></div>
      <p class="note">${current ? `A este ritmo cerrarás en <b>${eur0(stats.forecast)}</b>` : `Cerraste el mes en <b>${eur0(stats.spent)}</b>`}, ${stats.spent <= G.state.budget ? 'por debajo' : 'por encima'} de los <b>${eur0(G.state.budget)}</b> del presupuesto.</p></div>`;
  }

  // Tocar un gasto deja cambiarle la fecha
  function openEditDate(id) {
    const ex = G.state.expenses.find(x => x.id === id);
    if (!ex) return;
    G.openSheet('Cambiar fecha', `
      <p class="hint" style="font-size:14px;color:var(--ink)"><b>${esc(ex.merchant)}</b> · ${eur(ex.amount)}</p>
      <label class="lbl">Fecha<input id="ed-date" class="field" type="date" max="${esc(G.todayISO())}" value="${esc(ex.date)}"></label>
      <div class="sheet-actions"><button id="ed-save" class="btn big" type="button">Guardar</button></div>`);
    $('ed-save').onclick = () => {
      const list = P.setExpenseDate(G.state.expenses, id, $('ed-date').value);
      if (!list) { G.toast('Fecha no válida'); return; }
      G.state.expenses = list; G.save(); G.closeSheet(); G.render(); G.toast('Fecha cambiada');
    };
  }

  function openMonthPicker() {
    const y = G.view.y, today = G.todayISO(), curKey = today.slice(0, 7);
    const cell = (name, m) => {
      const key = monthKey(y, m), future = key > curKey;
      const s = P.monthStats(G.state.expenses, key, G.state.budget, today);
      return `<button class="mc ${key === G.viewMonth() ? 'now' : ''} ${s.over ? 'over' : ''}" type="button" data-month="${m}" ${future ? 'disabled' : ''}>
        <b>${name.slice(0, 3)}</b><small>${future || !s.spent ? '—' : eur0(s.spent)}</small><span class="p"><i style="width:${future ? 0 : Math.round(s.pct)}%"></i></span></button>`;
    };
    G.openSheet('Elige un mes', `
      <div class="yr"><button class="ar" type="button" data-year="-1" aria-label="Año anterior">${ARROW_L}</button><span>${y}</span>
        <button class="ar" type="button" data-year="1" aria-label="Año siguiente" ${y >= Number(curKey.slice(0, 4)) ? 'disabled' : ''}>${ARROW_R}</button></div>
      <div class="mgrid">${MONTHS.map(cell).join('')}</div>
      <p class="hint center">En rojo, los meses que pasaron del presupuesto de ${eur0(G.state.budget)}.</p>`);
    $('sheet-body').onclick = e => {
      const yr = e.target.closest('[data-year]'), mo = e.target.closest('[data-month]');
      if (yr && !yr.disabled) { G.view.y += Number(yr.dataset.year); openMonthPicker(); }
      else if (mo && !mo.disabled) { G.view.m = Number(mo.dataset.month); G.view.tab = 0; G.closeSheet(); G.render(); }
    };
  }

  function render(el) {
    const today = G.todayISO(), month = G.viewMonth(), current = G.isCurrentMonth();
    const stats = P.monthStats(G.state.expenses, month, G.state.budget, today);
    const sub = stats.left < 0 ? 'te pasaste' : `${current ? stats.restDays : P.daysInMonth(month)} días`;
    const content = [() => movementsView(month, today), () => (G.view.cat ? categoryDetail(month, today, G.view.cat) : categoriesView(month)), () => evolutionView(month, stats, current, today)][G.view.tab]();

    el.innerHTML = `
      <div class="tbar">
        <div class="mnav">
          <button id="month-prev" class="ar" type="button" aria-label="Mes anterior">${ARROW_L}</button>
          <b id="month-label" role="button" tabindex="0" aria-label="Elegir mes">${MONTHS[G.view.m]} ${G.view.y}</b>
          <button id="month-next" class="ar" type="button" aria-label="Mes siguiente" ${current ? 'disabled' : ''}>${ARROW_R}</button>
        </div>
        ${current ? '' : '<button id="month-today" class="hoy" type="button">Hoy</button>'}
      </div>
      <div class="ringc"><div class="rw"><i class="ring ${stats.over ? 'over' : ''}" style="--p:${stats.pct}%"></i>
        <div><b id="ring-main" data-count="${Math.abs(stats.left)}" data-group="1" data-suffix=" €">${eur0(Math.abs(stats.left))}</b><small id="ring-sub">${sub}</small></div></div></div>
      <div id="chips" class="chips2"><span><span data-count="${stats.spent}" data-group="1" data-suffix=" €">${eur0(stats.spent)}</span> gastado</span><span><span data-count="${stats.perDay}" data-group="1" data-suffix=" €">${eur0(stats.perDay)}</span> al día</span><span>${current ? eur0(stats.forecast) + ' previsión' : 'Cerrado'}</span></div>
      <div class="sgm" role="tablist">${['Movimientos', 'Categorías', 'Evolución'].map((t, i) => `<button type="button" role="tab" data-view="${i}" aria-selected="${G.view.tab === i}" class="${G.view.tab === i ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${content}`;

    const goMonth = k => { G.view.m += k; if (G.view.m < 0) { G.view.m = 11; G.view.y--; } else if (G.view.m > 11) { G.view.m = 0; G.view.y++; } G.view.tab = 0; G.view.cat = null; G.render(); };
    $('month-prev').onclick = () => goMonth(-1);
    $('month-next').onclick = () => { if (!G.isCurrentMonth()) goMonth(1); };
    $('month-label').onclick = openMonthPicker;
    $('month-label').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMonthPicker(); } };
    const hoy = $('month-today');
    if (hoy) hoy.onclick = () => { const t = new Date(); G.view.y = t.getFullYear(); G.view.m = t.getMonth(); G.view.tab = 0; G.render(); };
    el.onclick = e => {
      const v = e.target.closest('[data-view]'), d = e.target.closest('[data-del]'), ed = e.target.closest('[data-edit]');
      const cat = e.target.closest('[data-cat]'), back = e.target.closest('#cat-back');
      if (v) { G.view.tab = Number(v.dataset.view); G.view.cat = null; G.render(); }
      else if (back) { G.view.cat = null; G.render(); }
      else if (cat) { G.view.cat = cat.dataset.cat; G.render(); }
      else if (d) {
        const ex = G.state.expenses.find(x => x.id === d.dataset.del);
        if (!ex) return;
        window.AppConfirm({ title: `¿Borrar «${ex.merchant}»?`, text: `${eur(ex.amount)} del ${ex.date.split('-').reverse().join('/')}. No se puede deshacer.`, okLabel: 'Borrar' }).then(ok => {
          if (!ok) return;
          window.Anim.remove(d.closest('.mv'), () => { G.state.expenses = G.state.expenses.filter(x => x.id !== ex.id); G.save(); G.render(); G.toast('Gasto borrado'); });
        });
      }
      else if (ed) openEditDate(ed.dataset.edit);
    };
  }

  G.register('resumen', { render });
})();
