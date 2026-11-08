// Pantalla Resumen: el mes en un gráfico (gasto de cada día + cobros de suscripciones), categorías,
// últimos meses, próximos cobros y movimientos agrupados por día.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { esc, eur } = G;

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const CAT_COLORS = {
    Supermercado: '#2BC6A3', Restaurantes: '#FF8A5B', Transporte: '#4DA3FF', Suscripciones: '#9B7BFF',
    Ocio: '#FF6FA5', Salud: '#5BD1E8', Hogar: '#F5B63C', Otros: '#8A97AD'
  };
  const colorOf = c => CAT_COLORS[c] || CAT_COLORS.Otros;
  const monthName = m => { const [y, n] = m.split('-').map(Number); return `${MONTHS[n - 1]} ${y}`; };
  const longDay = iso => { const d = new Date(iso + 'T00:00:00'); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
  const when = days => (days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`);
  const eur0 = n => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  let view = null; // mes que se está viendo ('AAAA-MM'); null = el actual

  // Barras: gasto de cada día. Hoy en coral, días futuros en hueco y cobros de suscripciones como puntos.
  function dailyChart(series, month, today, charges) {
    const W = 340, H = 118, base = 96, top = 8, n = series.length;
    const max = Math.max(1, ...series);
    const slot = W / n, bw = Math.max(3, slot * 0.62);
    const isNow = today.startsWith(month);
    const todayIdx = isNow ? Number(today.slice(8, 10)) - 1 : -1;
    const chargeDays = new Map();
    charges.forEach(c => { const i = Number(c.date.slice(8, 10)) - 1; chargeDays.set(i, [...(chargeDays.get(i) || []), c]); });

    const bars = series.map((v, i) => {
      const x = i * slot + (slot - bw) / 2;
      const h = v > 0 ? Math.max(3, (v / max) * (base - top)) : 0;
      const future = isNow && i > todayIdx;
      const cls = i === todayIdx ? 'b today' : future ? 'b future' : 'b';
      return `<rect class="${cls}" x="${x.toFixed(1)}" y="${(base - (v > 0 ? h : 2)).toFixed(1)}" width="${bw.toFixed(1)}" height="${(v > 0 ? h : 2).toFixed(1)}" rx="${Math.min(3, bw / 2).toFixed(1)}"/>`;
    }).join('');
    const dots = [...chargeDays].map(([i, list]) => {
      const cx = i * slot + slot / 2;
      const names = list.map(c => `${c.sub.name} ${eur(c.sub.amount)}`).join(', ');
      return `<circle class="dot" cx="${cx.toFixed(1)}" cy="${base + 9}" r="3.6"><title>${esc(names)}</title></circle>`;
    }).join('');
    const ticks = [1, 8, 15, 22, n].filter((d, i, a) => a.indexOf(d) === i).map(d =>
      `<text class="tick" x="${((d - 1) * slot + slot / 2).toFixed(1)}" y="${H}" text-anchor="middle">${d}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H + 2}" role="img" aria-label="Gasto de cada día de ${esc(monthName(month))}">${bars}${dots}${ticks}</svg>`;
  }

  function monthBars(list, month) {
    const max = Math.max(1, ...list.map(m => m.total));
    return `<div class="mbars">${list.map(m => {
      const h = Math.max(m.total > 0 ? 6 : 2, Math.round(m.total / max * 56));
      return `<div class="mb ${m.month === month ? 'cur' : ''}"><span class="mb-v">${m.total > 0 ? eur0(m.total) : ''}</span><i style="height:${h}px"></i><span class="mb-l">${MONTHS[Number(m.month.slice(5)) - 1].slice(0, 3)}</span></div>`;
    }).join('')}</div>`;
  }

  function render(el) {
    const today = G.todayISO();
    const nowMonth = today.slice(0, 7);
    const month = view || nowMonth;
    const isNow = month === nowMonth;
    const { expenses, subs } = G.state;

    const sum = P.monthSummary(expenses, month);
    const series = P.dailySeries(expenses, month);
    const charges = P.chargesInMonth(subs, month);
    const prev = P.monthSummary(expenses, P.shiftMonth(month, -1)).total;
    const upcoming = P.upcomingCharges(subs, today, 21);
    const inMonth = expenses.filter(e => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));

    const dayCount = isNow ? Number(today.slice(8, 10)) : series.length;
    const perDay = sum.total / dayCount;
    const lines = [];
    if (isNow && sum.total > 0 && dayCount < series.length) lines.push(`A este ritmo cerrarás en <b>${eur0(P.projectMonth(sum.total, today))}</b>`);
    if (prev > 0) {
      const diff = sum.total - prev;
      lines.push(isNow ? `${diff <= 0 ? 'Vas' : 'Llevas'} <b class="${diff <= 0 ? 'good' : 'bad'}">${eur0(Math.abs(diff))} ${diff <= 0 ? 'por debajo' : 'por encima'}</b> de todo ${monthName(P.shiftMonth(month, -1)).split(' ')[0]}`
        : `<b class="${diff <= 0 ? 'good' : 'bad'}">${eur0(Math.abs(diff))} ${diff <= 0 ? 'menos' : 'más'}</b> que ${monthName(P.shiftMonth(month, -1)).split(' ')[0]}`);
    }
    if (sum.total > 0) lines.push(`${eur(perDay)} al día de media`);

    // Agrupa los movimientos por día
    const groups = [];
    inMonth.forEach(e => { const g = groups[groups.length - 1]; if (g && g.date === e.date) g.items.push(e); else groups.push({ date: e.date, items: [e] }); });

    el.innerHTML = `
      <section class="pulse">
        <div class="pulse-nav">
          <button class="nav-btn" type="button" data-month="-1" aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
          <span class="pulse-month">${esc(monthName(month))}</span>
          <button class="nav-btn" type="button" data-month="1" aria-label="Mes siguiente" ${isNow ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
        </div>
        <div class="pulse-total">${eur(sum.total)}</div>
        <div class="pulse-lines">${lines.map(l => `<p>${l}</p>`).join('') || '<p>Sin gastos este mes</p>'}</div>
        ${dailyChart(series, month, today, charges)}
        <div class="legend"><span><i class="lg bar"></i>Gasto del día</span>${charges.length ? '<span><i class="lg dot"></i>Te cobran una suscripción</span>' : ''}</div>
      </section>

      ${upcoming.length ? `<h3 class="sec">Próximos cobros</h3>
        <div class="tiles">${upcoming.map(u => `
          <button class="tile" type="button" data-goto-subs="1">
            <b>${Number(u.date.slice(8, 10))}</b><span class="tile-m">${MONTHS[Number(u.date.slice(5, 7)) - 1].slice(0, 3)}</span>
            <span class="tile-n">${esc(u.sub.name)}</span><span class="tile-a">${eur(u.sub.amount)}</span><small>${when(u.days)}</small>
          </button>`).join('')}</div>` : ''}

      ${sum.byCategory.length ? `<h3 class="sec">En qué se va</h3>
        <div class="seg" role="img" aria-label="Reparto por categoría">${sum.byCategory.map(c => `<i style="flex:${c.total};background:${colorOf(c.category)}" title="${esc(c.category)}"></i>`).join('')}</div>
        <ul class="cats">${sum.byCategory.map(c => `
          <li><i class="swatch" style="background:${colorOf(c.category)}"></i><span class="cats-n">${esc(c.category)}</span><span class="cats-p">${Math.round(c.total / sum.total * 100)}%</span><span class="amt">${eur(c.total)}</span></li>`).join('')}
        </ul>` : ''}

      ${expenses.length ? `<h3 class="sec">Últimos meses</h3>${monthBars(P.lastMonths(expenses, month, 6), month)}` : ''}

      <h3 class="sec">Movimientos</h3>
      ${groups.length ? groups.map(g => `
        <div class="day"><div class="day-h"><span>${longDay(g.date)}</span><span>${eur(g.items.reduce((t, e) => t + e.amount, 0))}</span></div>
        ${g.items.map(e => `
          <div class="mov">
            <i class="swatch" style="background:${colorOf(e.category)}"></i>
            <span class="mov-main"><b>${esc(e.merchant)}</b><small>${esc(e.category)}${e.source === 'auto' ? ' · automático' : ''}</small></span>
            <span class="amt">${eur(e.amount)}</span>
            <button class="icon-btn" type="button" data-del="${esc(e.id)}" aria-label="Borrar ${esc(e.merchant)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
          </div>`).join('')}</div>`).join('')
        : `<p class="empty-msg">${isNow ? 'Todavía no hay gastos este mes. Toca + para apuntar el primero.' : 'No hay gastos en este mes.'}</p>`}`;

    el.onclick = e => {
      const nav = e.target.closest('[data-month]');
      const del = e.target.closest('[data-del]');
      if (nav && !nav.disabled) { view = P.shiftMonth(month, Number(nav.dataset.month)); if (view === nowMonth) view = null; G.render(); }
      else if (e.target.closest('[data-goto-subs]')) G.go('subs');
      else if (del) {
        G.state.expenses = G.state.expenses.filter(x => x.id !== del.dataset.del);
        G.save(); G.render(); G.toast('Gasto borrado');
      }
    };
  }

  G.register('resumen', { render });
})();
