// Pantalla Resumen: gasto del mes, categorías, próximos cobros y últimos movimientos.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { $, esc, eur } = G;

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dayLabel = iso => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)}`; };
  const whenLabel = days => (days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`);

  function render(el) {
    const today = G.todayISO();
    const month = today.slice(0, 7);
    const { expenses, subs } = G.state;
    const sum = P.monthSummary(expenses, month);
    const upcoming = P.upcomingCharges(subs, today, 14);
    const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    const top = sum.byCategory[0] ? sum.byCategory[0].total : 1;
    const [y, m] = month.split('-').map(Number);

    el.innerHTML = `
      <section class="hero">
        <div class="eyebrow">Gastado en ${MONTHS[m - 1]} ${y}</div>
        <div class="total">${eur(sum.total)}</div>
      </section>

      ${upcoming.length ? `<h3 class="sec">Próximos cobros</h3>
        <div class="card">${upcoming.map(u => `
          <div class="row"><span class="row-main"><b>${esc(u.sub.name)}</b><small>${whenLabel(u.days)} · ${dayLabel(u.date)}</small></span><span class="amt">${eur(u.sub.amount)}</span></div>`).join('')}
        </div>` : ''}

      ${sum.byCategory.length ? `<h3 class="sec">Por categoría</h3>
        <div class="card">${sum.byCategory.map(c => `
          <div class="cat"><div class="cat-top"><span>${esc(c.category)}</span><span class="amt">${eur(c.total)}</span></div>
          <div class="bar"><i style="width:${Math.max(4, Math.round(c.total / top * 100))}%"></i></div></div>`).join('')}
        </div>` : ''}

      <h3 class="sec">Últimos movimientos</h3>
      ${recent.length ? `<div class="card">${recent.map(e => `
        <div class="row">
          <span class="row-main"><b>${esc(e.merchant)}</b><small>${dayLabel(e.date)} · ${esc(e.category)}${e.source === 'auto' ? ' · automático' : ''}</small></span>
          <span class="amt">${eur(e.amount)}</span>
          <button class="icon-btn" type="button" data-del="${esc(e.id)}" aria-label="Borrar ${esc(e.merchant)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>`).join('')}</div>` : '<p class="empty-msg">Aún no hay gastos. Pulsa + para apuntar el primero.</p>'}`;

    el.onclick = e => {
      const del = e.target.closest('[data-del]');
      if (!del) return;
      G.state.expenses = G.state.expenses.filter(x => x.id !== del.dataset.del);
      G.save(); G.render(); G.toast('Gasto borrado');
    };
  }

  G.register('resumen', { render });
})();
