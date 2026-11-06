// Pantalla Hoy: el día del menú y qué toca comer o cenar ahora.
(() => {
  const C = window.Comidas;
  const P = window.Planner;
  const { esc } = C;
  const LABEL = { comida: 'Comida', cena: 'Cena' };

  const longDate = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    const s = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const ingredientsHtml = entry => {
    const dish = entry && entry.id ? C.state.dishes.find(d => d.id === entry.id) : null;
    const list = dish ? P.ingredientsOf(dish) : [];
    if (!list.length) return '';
    return `<ul class="ing-list">${list.map(i =>
      `<li>${esc(i.name)}${i.qty === 1 ? '' : ` <span>×${P.formatQty(i.qty)}</span>`}</li>`).join('')}</ul>`;
  };

  function render(el) {
    const v = P.todayView({ menu: C.state.menu, now: new Date() });
    el.onclick = e => { const b = e.target.closest('[data-go]'); if (b) C.go(b.dataset.go); };

    if (v.status === 'none' && C.state.draft) {
      el.innerHTML = `<div class="hero"><h2>Tu menú está sin confirmar</h2>
        <p>Has creado un menú pero aún no lo has confirmado. Confírmalo y aquí verás qué te toca cada día.</p>
        <button class="btn big" type="button" data-go="menu">Revisar y confirmar</button></div>`;
    } else if (v.status === 'none') {
      el.innerHTML = `<div class="hero"><h2>Todavía no tienes menú</h2>
        <p>Crea uno y aquí verás qué te toca comer y cenar cada día.</p>
        <button class="btn big" type="button" data-go="${C.state.dishes.length ? 'menu' : 'recetas'}">${C.state.dishes.length ? 'Crear menú' : 'Añadir recetas'}</button></div>`;
    } else if (v.status === 'notStarted') {
      el.innerHTML = `<div class="hero"><h2>Tu menú aún no ha empezado</h2>
        <p>Empieza el ${esc(longDate(v.startDate).toLowerCase())}.</p>
        <button class="btn big" type="button" data-go="menu">Ver el menú</button></div>`;
    } else if (v.status === 'finished') {
      el.innerHTML = `<div class="hero"><h2>Tu menú ha terminado</h2>
        <p>Los ${v.totalDays} días han pasado. ¿Preparamos el siguiente?</p>
        <button class="btn big" type="button" data-go="menu">Crear otro menú</button></div>`;
    } else {
      const cur = v.current;
      el.innerHTML = `
        <p class="eyebrow">Día ${v.dayNumber} de ${v.totalDays}</p>
        <h2 class="today-date">${esc(longDate(v.date))}</h2>
        <div class="today-card">
          <span class="label">Ahora toca · ${LABEL[v.meal]}</span>
          <strong>${cur ? esc(cur.name) : 'Sin plato para esta comida'}</strong>
          ${ingredientsHtml(cur)}
        </div>
        ${v.upcoming.length ? `<p class="next-title">Después</p>${v.upcoming.map(u => `
          <div class="next-row">
            <span class="next-when">${u.dayOffset === 0 ? 'Hoy' : 'Mañana'} · ${LABEL[u.meal]}</span>
            <span class="next-name">${u.entry ? esc(u.entry.name) : 'Sin plato'}</span>
          </div>`).join('')}` : ''}`;
    }
  }

  C.register('hoy', { render });
})();
