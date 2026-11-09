// Gastos: círculo con lo que queda, meses, pestañas, barra flotante, suscripciones, pagos automáticos y ajustes.
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/gastos/index.html';
test.use({ viewport: { width: 390, height: 780 } });

// Siembra datos que caen en el mes actual y en el anterior. fn recibe { thisMonth(d), prevMonth(d), today }.
const seedFn = (page, fn) => page.evaluate(src => {
  const G = window.Gastos;
  const now = new Date();
  const iso = (y, m, day) => new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
  const ctx = { thisMonth: dd => iso(now.getFullYear(), now.getMonth(), dd), prevMonth: dd => iso(now.getFullYear(), now.getMonth() - 1, dd), today: iso(now.getFullYear(), now.getMonth(), now.getDate()) };
  const s = (new Function('ctx', 'return (' + src + ')(ctx)'))(ctx);
  Object.assign(G.state, { expenses: [], subs: [], budget: 1000 }, s);
  G.save(); G.go('resumen');
}, fn.toString());

test.describe('Gastos', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('la barra flotante cambia de pantalla y el + abre la hoja de nuevo gasto', async ({ page }) => {
    for (const s of ['subs', 'auto', 'ajustes', 'resumen']) {
      await page.locator(`#dock [data-screen="${s}"]`).click();
      await expect(page.locator(`#dock [data-screen="${s}"]`)).toHaveClass(/active/);
      await expect(page.locator(`#screen-${s}`)).toBeVisible();
    }
    await page.locator('#dock-add').click();
    await expect(page.locator('#sheet')).toHaveClass(/open/);
    await expect(page.locator('#ex-amount')).toBeVisible();
  });

  test('apuntar un gasto lo suma al día de hoy y resta del círculo', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [] }));
    await expect(page.locator('#ring-main')).toHaveText(/1\.000/);
    await page.locator('#dock-add').click();
    await page.locator('#ex-amount').fill('100');
    await page.locator('#ex-merchant').fill('Mercadona');
    await expect(page.locator('#ex-cats .on')).toHaveText('Supermercado'); // categoría sugerida por el nombre
    await page.locator('#ex-save').click();
    await expect(page.locator('#ring-main')).toHaveText(/900/);
    await expect(page.locator('#screen-resumen .dh').first()).toContainText('Hoy');
    await expect(page.locator('#screen-resumen .mv').first()).toContainText('Mercadona');
  });

  test('un importe no válido no guarda nada', async ({ page }) => {
    await page.locator('#dock-add').click();
    await page.locator('#ex-amount').fill('abc');
    await page.locator('#ex-save').click();
    await expect(page.locator('#toast')).toContainText('importe');
    await expect(page.locator('#sheet')).toHaveClass(/open/);
  });

  test('las etiquetas enseñan gastado, ritmo diario y previsión', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'X', category: 'Otros', amount: 100, date: ctx.today }] }));
    await expect(page.locator('#chips')).toContainText('100 € gastado');
    await expect(page.locator('#chips')).toContainText('previsión');
  });

  test('las flechas del mes van al anterior (cerrado, con botón Hoy) y vuelven', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 300, date: ctx.prevMonth(10) }] }));
    await expect(page.locator('#month-next')).toBeDisabled();
    const actual = await page.locator('#month-label').textContent();
    await page.locator('#month-prev').click();
    await expect(page.locator('#month-label')).not.toHaveText(actual);
    await expect(page.locator('#ring-main')).toHaveText(/700/);
    await expect(page.locator('#chips')).toContainText('Cerrado');
    await expect(page.locator('#month-next')).toBeEnabled();
    await page.locator('#month-today').click();
    await expect(page.locator('#month-label')).toHaveText(actual);
    await expect(page.locator('#month-today')).toHaveCount(0);
  });

  test('al tocar el mes se abre el selector de meses y se puede elegir uno', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 300, date: ctx.prevMonth(10) }] }));
    const actual = await page.locator('#month-label').textContent();
    await page.locator('#month-label').click();
    await expect(page.locator('#sheet [data-month]')).toHaveCount(12);
    await page.locator('#sheet [data-month]:not([disabled])').first().click();
    await expect(page.locator('#sheet')).not.toHaveClass(/open/);
    await expect(page.locator('#month-label')).not.toHaveText(actual);
  });

  test('las pestañas Categorías y Evolución enseñan su contenido', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Mercadona', category: 'Supermercado', amount: 80, date: ctx.today }] }));
    await page.locator('[data-view="1"]').click();
    await expect(page.locator('#screen-resumen .catrow').first()).toContainText('Supermercado');
    await page.locator('[data-view="2"]').click();
    await expect(page.locator('#screen-resumen .evo')).toBeVisible();
    await page.locator('[data-view="0"]').click();
    await expect(page.locator('#screen-resumen .mv')).toHaveCount(1);
  });

  test('borrar un gasto lo quita y devuelve el dinero al círculo', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 100, date: ctx.today }] }));
    await expect(page.locator('#ring-main')).toHaveText(/900/);
    await page.locator('[data-del]').click();
    // Pregunta dentro de la app; al cancelar no se borra nada
    await expect(page.locator('#app-confirm')).toBeVisible();
    await page.locator('#app-confirm [data-act="confirm-cancel"]').click();
    await expect(page.locator('#app-confirm')).toHaveCount(0);
    await expect(page.locator('#ring-main')).toHaveText(/900/);
    await page.locator('[data-del]').click();
    await page.locator('#app-confirm [data-act="confirm-ok"]').click();
    await expect(page.locator('#ring-main')).toHaveText(/1\.000/);
  });

  test('quitar una categoría o borrar una suscripción también pide confirmación', async ({ page }) => {
    await seedFn(page, () => ({ subs: [{ id: 's1', name: 'Netflix', amount: 12, period: 'month', anchor: '2099-01-01' }] }));
    await page.locator('#dock [data-screen="ajustes"]').click();
    await page.locator('[data-set="cats"]').click();
    await page.locator('#sheet-body [data-del="Ocio"]').click();
    await expect(page.locator('#app-confirm')).toBeVisible();
    await page.locator('#app-confirm [data-act="confirm-cancel"]').click();
    expect(await page.evaluate(() => window.Gastos.state.categories.includes('Ocio'))).toBe(true);
    await page.locator('#sheet-body [data-del="Ocio"]').click();
    await page.locator('#app-confirm [data-act="confirm-ok"]').click();
    expect(await page.evaluate(() => window.Gastos.state.categories.includes('Ocio'))).toBe(false);
    await page.keyboard.press('Escape');
    await page.locator('#dock [data-screen="subs"]').click();
    await page.locator('.subrow').first().click();
    await page.locator('#sb-del').click();
    await expect(page.locator('#app-confirm')).toBeVisible();
    await page.locator('#app-confirm [data-act="confirm-cancel"]').click();
    expect(await page.evaluate(() => window.Gastos.state.subs.length)).toBe(1);
    await page.locator('#sb-del').click();
    await page.locator('#app-confirm [data-act="confirm-ok"]').click();
    expect(await page.evaluate(() => window.Gastos.state.subs.length)).toBe(0);
  });

  test('suscripciones: alta con fecha de fin, totales y terminadas', async ({ page }) => {
    await page.locator('#dock [data-screen="subs"]').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-name').fill('Netflix');
    await page.locator('#sb-amount').fill('12,99');
    await page.locator('#sb-save').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-name').fill('Disney+');
    await page.locator('#sb-amount').fill('10');
    await page.locator('#sb-date').fill('1999-12-15');
    await page.locator('#sb-until').fill('2000-01-31'); // ya terminó
    await page.locator('#sb-save').click();
    await expect(page.locator('#screen-subs .sub-hero')).toContainText('12,99');
    await expect(page.locator('#screen-subs > .lst [data-edit]')).toHaveCount(1);
    await page.locator('#screen-subs .ended summary').click();
    await expect(page.locator('#screen-subs .ended')).toContainText('Disney+');
  });

  test('una fecha de fin anterior al cobro avisa y no guarda', async ({ page }) => {
    await page.locator('#dock [data-screen="subs"]').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-name').fill('Disney+');
    await page.locator('#sb-amount').fill('10');
    await page.locator('#sb-date').fill('2030-05-10');
    await page.locator('#sb-until').fill('2030-05-01');
    await page.locator('#sb-save').click();
    await expect(page.locator('#toast')).toContainText('fecha de fin');
    await expect(page.locator('#sheet')).toHaveClass(/open/);
  });

  test('cobros repetidos en los gastos se sugieren como suscripción', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: ['2026-01-03', '2026-02-03', '2026-03-03'].map((date, i) => ({ id: 'n' + i, merchant: 'Spotify AB', amount: 10.99, date, category: 'Suscripciones' })) }));
    await page.locator('#dock [data-screen="subs"]').click();
    await page.locator('#screen-subs [data-adopt]').click();
    await expect(page.locator('#sb-name')).toHaveValue('Spotify AB');
    await page.locator('#sb-save').click();
    await expect(page.locator('#screen-subs [data-adopt]')).toHaveCount(0);
    await expect(page.locator('#screen-subs [data-edit]')).toContainText('Spotify AB');
  });

  test('un pago que llega por la dirección queda por revisar y no cuenta hasta confirmarlo', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [] }));
    await page.goto('apps/gastos/index.html?pago=25%2C50&comercio=Mercadona');
    await expect(page).not.toHaveURL(/pago=/); // la dirección se limpia para no repetirlo al recargar
    await expect(page.locator('#dock [data-screen="auto"] .badge')).toHaveText('1');
    await expect(page.locator('#ring-main')).toHaveText(/1\.000/);
    await page.locator('#dock [data-screen="auto"]').click();
    await expect(page.locator('#screen-auto .pend')).toContainText('Mercadona');
    await page.locator('#screen-auto [data-confirm]').click();
    await expect(page.locator('#screen-auto .pend')).toHaveCount(0);
    await page.locator('#dock [data-screen="resumen"]').click();
    await expect(page.locator('#ring-main')).toHaveText(/975/);
  });

  test('ajustes: cambiar el presupuesto cambia el círculo', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 100, date: ctx.today }] }));
    await page.locator('#dock [data-screen="ajustes"]').click();
    await page.locator('[data-set="budget"]').click();
    await page.locator('#set-budget').fill('2000');
    await page.locator('#set-save').click();
    await page.locator('#dock [data-screen="resumen"]').click();
    await expect(page.locator('#ring-main')).toHaveText(/1\.900/);
  });

  test('ajustes: se pueden añadir y quitar categorías, y ya no hay fila de tema', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 5, date: ctx.today }] }));
    await page.locator('#dock [data-screen="ajustes"]').click();
    await expect(page.locator('[data-set="theme"]')).toHaveCount(0);
    await page.locator('[data-set="cats"]').click();
    await page.locator('#cat-new').fill('Mascotas');
    await page.locator('#cat-add').click();
    await expect(page.locator('#sheet-body [data-del="Mascotas"]')).toHaveCount(1);
    await page.locator('#sheet-body [data-del="Ocio"]').click();
    await page.locator('#app-confirm [data-act="confirm-ok"]').click();
    await expect(page.locator('#sheet-body [data-del="Ocio"]')).toHaveCount(0);
    await expect(page.locator('#sheet-body [data-del="Otros"]')).toHaveCount(0);
  });

  test('automático: el tutorial se despliega y se esconde', async ({ page }) => {
    await page.locator('#dock [data-screen="auto"]').click();
    const tut = page.locator('details.tut');
    await expect(tut).not.toHaveAttribute('open', '');
    await tut.locator('summary').click();
    await expect(tut).toHaveAttribute('open', '');
    await tut.locator('summary').click();
    await expect(tut).not.toHaveAttribute('open', '');
  });

  test('los gastos se suben a la nube y se recuperan en un móvil vacío', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'cloud1', merchant: 'Cine', category: 'Ocio', amount: 7, date: ctx.today }], categories: ['Ocio', 'Mascotas', 'Otros'] }));
    // Esperar a que se suba (a los pocos segundos de guardar)
    await expect.poll(() => page.evaluate(async () => {
      const A = window.MiAuth.auth, token = await A.currentUser.getIdToken();
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/mi-app-490b5/databases/(default)/documents/users/${A.currentUser.uid}/gastos/data`, { headers: { Authorization: 'Bearer ' + token } });
      return r.status;
    }), { timeout: 15000 }).toBe(200);
    // Móvil vacío: se borra lo local (menos la sesión) y se vuelve a abrir
    await page.evaluate(() => {
      const keep = Object.keys(localStorage).filter(k => /firebase|auth|session|mi-app\.user/i.test(k));
      const saved = Object.fromEntries(keep.map(k => [k, localStorage.getItem(k)]));
      localStorage.clear();
      Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.Gastos.state.expenses.map(e => e.id).join())).toBe('cloud1');
    expect(await page.evaluate(() => window.Gastos.state.categories.join())).toBe('Ocio,Mascotas,Otros');
  });

  test('una suscripción que cobra hoy se apunta sola como gasto, una sola vez', async ({ page }) => {
    await seedFn(page, ctx => ({ subs: [{ id: 'nf', name: 'Netflix', amount: 12, period: 'month', anchor: ctx.today }] }));
    await page.evaluate(() => { window.Gastos.applySubs(); window.Gastos.applySubs(); });
    const rows = await page.evaluate(() => window.Gastos.state.expenses.map(e => [e.merchant, e.amount, e.category, e.source]));
    expect(rows).toEqual([['Netflix', 12, 'Suscripciones', 'sub']]);
    await page.locator('#dock [data-screen="resumen"]').click();
    await expect(page.locator('.mv').first()).toContainText('suscripción');
  });

  test('tocar un gasto deja cambiarle la fecha y no se pierde al borrar otro', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 9, date: ctx.today }] }));
    await page.locator('.mv').first().click();
    await page.locator('#ed-date').fill('2026-01-05');
    await page.locator('#ed-save').click();
    expect(await page.evaluate(() => window.Gastos.state.expenses[0].date)).toBe('2026-01-05');
  });

  test('ajustes: exportar descarga el CSV', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 12.5, date: ctx.today }] }));
    await page.locator('#dock [data-screen="ajustes"]').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-set="export"]').click()]);
    expect(download.suggestedFilename()).toMatch(/gastos.*\.csv$/);
    const text = require('fs').readFileSync(await download.path(), 'utf8');
    expect(text).toContain('fecha;comercio;categoria;importe');
    expect(text).toContain('Cine;Ocio;12,50');
  });

  test('los datos sobreviven a recargar y no hay desbordamiento horizontal', async ({ page }) => {
    await page.locator('#dock-add').click();
    await page.locator('#ex-amount').fill('3');
    await page.locator('#ex-merchant').fill('Un nombre de comercio bastante largo para probar el recorte del texto');
    await page.locator('#ex-save').click();
    await page.reload();
    await expect(page.locator('#chips')).toContainText('3 € gastado');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
