// Pantalla Ajustes: presupuesto del mes, presupuesto por categoría, tema de color y exportar a CSV.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { $, esc, eur0 } = G;

  const ROW_ICONS = { budget: '€', cats: '▦', theme: '◐', export: '↓' };
  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

  function download(name, text) {
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function openBudget() {
    G.openSheet('Presupuesto mensual', `
      <input id="set-budget" class="field amount-in" type="text" inputmode="decimal" value="${String(G.state.budget).replace('.', ',')}" aria-label="Presupuesto mensual">
      <p class="hint">Con esto se calcula el círculo del resumen: lo que te queda cada mes.</p>
      <div class="sheet-actions"><button id="set-save" class="btn big" type="button">Guardar</button></div>`);
    $('set-save').onclick = () => {
      const v = P.parseAmount($('set-budget').value);
      if (v === null) { G.toast('Importe no válido'); return; }
      G.state.budget = v; G.save(); G.closeSheet(); G.render(); G.toast('Presupuesto actualizado');
    };
  }

  function openCategories() {
    G.openSheet('Presupuesto por categoría', `
      ${G.CATEGORIES.map(c => `<label class="cb"><span class="ico" style="--k:${G.colorOf(c)}">${esc(c[0])}</span><span>${esc(c)}</span>
        <input class="field" type="text" inputmode="decimal" data-cb="${esc(c)}" value="${String(G.state.budgets[c] || 0).replace('.', ',')}" aria-label="Presupuesto de ${esc(c)}"></label>`).join('')}
      <div class="sheet-actions"><button id="cb-save" class="btn big" type="button">Guardar</button></div>`);
    $('cb-save').onclick = () => {
      document.querySelectorAll('#sheet-body [data-cb]').forEach(i => { const v = P.parseAmount(i.value); G.state.budgets[i.dataset.cb] = v === null ? 0 : v; });
      G.save(); G.closeSheet(); G.render(); G.toast('Presupuestos guardados');
    };
  }

  function render(el) {
    const palette = window.PaletteCore ? window.PaletteCore.resolve(window.MiPalette && window.MiPalette.get()).name : '';
    const row = (key, title, value) => `<button class="setrow" type="button" data-set="${key}"><span class="ico2">${ROW_ICONS[key]}</span>${title}<span class="v">${esc(value)}</span>${CHEV}</button>`;
    el.innerHTML = `
      <div class="screen-title">Ajustes</div>
      <div class="lst">
        ${row('budget', 'Presupuesto mensual', eur0(G.state.budget))}
        ${row('cats', 'Categorías y presupuestos', String(G.CATEGORIES.length))}
        ${row('theme', 'Tema de color', palette)}
        ${row('export', 'Exportar datos', 'CSV')}
      </div>
      <p class="hint">Los datos se guardan en este móvil.</p>`;
    el.onclick = e => {
      const b = e.target.closest('[data-set]');
      if (!b) return;
      const k = b.dataset.set;
      if (k === 'budget') openBudget();
      else if (k === 'cats') openCategories();
      else if (k === 'theme') window.MiPalette.open();
      else if (k === 'export') {
        if (!P.confirmed(G.state.expenses).length) { G.toast('No hay gastos que exportar'); return; }
        download(`gastos-${G.todayISO()}.csv`, P.toCSV(G.state.expenses));
        G.toast('Datos exportados');
      }
    };
  }

  G.register('ajustes', { render });
})();
