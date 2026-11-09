// Pantalla Ajustes: presupuesto del mes, categorías, exportar a CSV.
(() => {
  const G = window.Gastos;
  const P = window.Planner;
  const { $, esc, eur0 } = G;

  const ROW_ICONS = { budget: '€', cats: '▦', export: '↓' };
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
    G.openSheet('Categorías', `
      ${G.CATEGORIES.map(c => `<div class="cb"><span class="ico" style="--k:${G.colorOf(c)}">${esc(c[0])}</span><span>${esc(c)}</span>
        ${c === 'Otros' ? '<span class="x"></span>' : `<button class="x" type="button" data-del="${esc(c)}" aria-label="Quitar ${esc(c)}">×</button>`}</div>`).join('')}
      <div class="cb"><input id="cat-new" class="field" type="text" maxlength="24" placeholder="Nueva categoría" autocomplete="off" aria-label="Nueva categoría" style="width:auto;flex:1;text-align:left"><button id="cat-add" class="btn small" type="button">Añadir</button></div>
      <p class="hint">Al quitar una categoría, sus gastos pasan a «Otros». «Otros» no se puede quitar.</p>`);
    $('cat-add').onclick = () => {
      const list = P.addCategory(G.state.categories, $('cat-new').value);
      if (!list) { G.toast('Nombre vacío o repetido'); return; }
      G.state.categories = list; G.save(); G.render(); openCategories();
    };
    $('sheet-body').querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => {
      if (!await window.AppConfirm({ title: `¿Quitar la categoría «${b.dataset.del}»?`, text: 'Sus gastos pasarán a «Otros».', okLabel: 'Quitar' })) return;
      const r = P.removeCategory(G.state.categories, G.state.expenses, b.dataset.del);
      if (!r) return;
      G.state.categories = r.categories; G.state.expenses = r.expenses;
      G.save(); G.render(); openCategories();
    }; });
  }

  function render(el) {
    const row = (key, title, value) => `<button class="setrow" type="button" data-set="${key}"><span class="ico2">${ROW_ICONS[key]}</span>${title}<span class="v">${esc(value)}</span>${CHEV}</button>`;
    el.innerHTML = `
      <div class="screen-title">Ajustes</div>
      <div class="lst">
        ${row('budget', 'Presupuesto mensual', eur0(G.state.budget))}
        ${row('cats', 'Categorías', String(G.CATEGORIES.length))}
        ${row('export', 'Exportar datos', 'CSV')}
      </div>
      <p class="hint">Los datos se guardan en este móvil.</p>`;
    el.onclick = e => {
      const b = e.target.closest('[data-set]');
      if (!b) return;
      const k = b.dataset.set;
      if (k === 'budget') openBudget();
      else if (k === 'cats') openCategories();
      else if (k === 'export') {
        if (!P.confirmed(G.state.expenses).length) { G.toast('No hay gastos que exportar'); return; }
        download(`gastos-${G.todayISO()}.csv`, P.toCSV(G.state.expenses));
        G.toast('Datos exportados');
      }
    };
  }

  G.register('ajustes', { render });
})();
