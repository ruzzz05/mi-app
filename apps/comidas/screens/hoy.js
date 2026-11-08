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

  const dishOf = entry => (entry && entry.id ? C.state.dishes.find(d => d.id === entry.id) : null);

  const ingredientsHtml = entry => {
    const dish = dishOf(entry);
    const list = dish ? P.ingredientsOf(dish) : [];
    if (!list.length) return '';
    return `<ul class="ing-list">${list.map(i =>
      `<li>${esc(i.name)}${i.qty === 1 ? '' : ` <span>×${P.formatQty(i.qty)}</span>`}</li>`).join('')}</ul>`;
  };

  // Un plato de la comida: foto (si su receta tiene), nombre e ingredientes.
  const plateHtml = entry => {
    const dish = dishOf(entry);
    return `<div class="plate">
      ${dish && dish.photo ? `<img class="plate-photo" data-photo="${esc(dish.photo)}" alt="">` : ''}
      <strong>${esc(entry.name)}</strong>
      ${ingredientsHtml(entry)}
    </div>`;
  };

  // "Sopa + Pechugas" para las filas discretas de "Después"
  const namesOf = (entry, extras) => [entry, ...extras].filter(Boolean).map(e => e.name).join(' + ');

  function render(el) {
    if (C.promoteDraft) C.promoteDraft(); // un borrador antiguo pasa a ser el menú activo
    if (C.ensureFilled) C.ensureFilled(); // las comidas sin plato se rellenan solas
    const v = P.todayView({ menu: C.state.menu, now: new Date() });
    el.onclick = e => { const b = e.target.closest('[data-go]'); if (b) C.go(b.dataset.go); };

    if (v.status === 'none') {
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
      const plates = [v.current, ...v.currentExtras].filter(Boolean);
      el.innerHTML = `
        <p class="eyebrow">Día ${v.dayNumber} de ${v.totalDays}</p>
        <h2 class="today-date">${esc(longDate(v.date))}</h2>
        <div class="today-card">
          <span class="label">Ahora toca · ${LABEL[v.meal]}</span>
          ${plates.length ? plates.map(plateHtml).join('') : '<strong>Sin plato para esta comida</strong>'}
        </div>
        ${v.upcoming.length ? `<p class="next-title">Después</p>${v.upcoming.map(u => `
          <div class="next-row">
            <span class="next-when">${u.dayOffset === 0 ? 'Hoy' : 'Mañana'} · ${LABEL[u.meal]}</span>
            <span class="next-name">${esc(namesOf(u.entry, u.extras) || 'Sin plato')}</span>
          </div>`).join('')}` : ''}`;
      C.hydratePhotos(el);
    }
  }

  C.register('hoy', { render });
})();
