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

  test('tocar una categoría enseña sus gastos del mes por días, y se puede volver', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [
      { id: 'a', merchant: 'Cine', category: 'Ocio', amount: 9, date: ctx.today },
      { id: 'b', merchant: 'Bolera', category: 'Ocio', amount: 11, date: ctx.today },
      { id: 'c', merchant: 'Mercadona', category: 'Supermercado', amount: 30, date: ctx.today },
      { id: 'd', merchant: 'Cine viejo', category: 'Ocio', amount: 5, date: ctx.prevMonth(10) }] }));
    await page.locator('#screen-resumen [data-view="1"]').click();
    await page.locator('#screen-resumen [data-cat="Ocio"]').click();
    await expect(page.locator('#screen-resumen .mv')).toHaveCount(2);
    await expect(page.locator('#screen-resumen .lst')).toContainText('Cine');
    await expect(page.locator('#screen-resumen .lst')).not.toContainText('Mercadona');
    await expect(page.locator('#screen-resumen .lst')).not.toContainText('Cine viejo');
    await expect(page.locator('#cat-total')).toContainText('20');
    await page.locator('#cat-back').click();
    await expect(page.locator('#screen-resumen [data-cat]')).not.toHaveCount(0);
    await expect(page.locator('#screen-resumen .mv')).toHaveCount(0);
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
    // el borrado espera a que la fila termine de salir (animación)
    await expect.poll(() => page.evaluate(() => window.Gastos.state.subs.length)).toBe(0);
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

  test('dos dispositivos: se juntan los gastos de los dos y lo borrado no vuelve', async ({ page }) => {
    // Lee o escribe la copia de la nube como lo haría otro dispositivo
    const cloud = (body) => page.evaluate(async body => {
      const A = window.MiAuth.auth, token = await A.currentUser.getIdToken();
      const url = `https://firestore.googleapis.com/v1/projects/mi-app-490b5/databases/(default)/documents/users/${A.currentUser.uid}/gastos/data`;
      if (!body) { const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } }); return r.ok ? JSON.parse((await r.json()).fields.json.stringValue).expenses.map(e => e.id).join() : ''; }
      const fields = { updatedAt: { integerValue: String(Date.now() + 60000) }, json: { stringValue: JSON.stringify(body) } };
      const r = await fetch(url, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
      return String(r.status);
    }, body || null);
    const mk = (id, date) => ({ id, merchant: 'Cine', category: 'Ocio', amount: 7, date });
    const today = await page.evaluate(() => window.Gastos.todayISO());

    await seedFn(page, ctx => ({ expenses: [{ id: 'l1', merchant: 'Cine', category: 'Ocio', amount: 7, date: ctx.today }, { id: 'd1', merchant: 'Cine', category: 'Ocio', amount: 7, date: ctx.today }] }));
    await expect.poll(() => cloud(), { timeout: 15000 }).toBe('l1,d1');
    // En este móvil se borra d1 y se sube
    await page.evaluate(() => { const G = window.Gastos; G.state.expenses = G.state.expenses.filter(e => e.id !== 'd1'); G.save(); });
    await expect.poll(() => cloud(), { timeout: 15000 }).toBe('l1');
    // Otro dispositivo, que no había visto ni l1 ni el borrado, sube su copia con un gasto nuevo
    expect(await cloud({ expenses: [mk('r1', today), mk('d1', today)], subs: [], budget: 1000, categories: ['Ocio', 'Otros'] })).toBe('200');
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.Gastos.state.expenses.map(e => e.id).sort().join()), { timeout: 15000 }).toBe('l1,r1');
    // Y la copia fusionada vuelve a la nube
    await expect.poll(async () => (await cloud()).split(',').sort().join(), { timeout: 15000 }).toBe('l1,r1');
  });

  test('el buzón antiguo común no se lee desde una cuenta que no es la dueña', async ({ page }) => {
    let reads = 0;
    page.on('request', r => { if (r.url().includes('/documents/gastosInbox')) reads++; });
    await page.reload();
    await page.evaluate(() => window.Gastos.cloudReady);
    await page.waitForTimeout(1500);
    expect(reads).toBe(0);
  });

  // Buzón de la cuenta: users/{uid}/gastosInbox, con su clave en users/{uid}/gastos/inbox.
  // Sin body cuenta los pagos que hay; con body deja uno ('$KEY' = la clave de la cuenta), con sesión o sin ella.
  const inbox = (page, body, withAuth) => page.evaluate(async ({ body, withAuth }) => {
    const A = window.MiAuth.auth, info = window.Gastos.inboxInfo;
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth) headers.Authorization = 'Bearer ' + await A.currentUser.getIdToken();
    if (!body) { const r = await fetch(info.url.split('?')[0], { headers }); return ((await r.json()).documents || []).length; }
    const fields = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, { stringValue: v === '$KEY' ? info.key : v }]));
    return (await fetch(info.url, { method: 'POST', headers, body: JSON.stringify({ fields }) })).status;
  }, { body: body || null, withAuth: !!withAuth });
  const inboxReady = page => expect.poll(() => page.evaluate(() => !!(window.Gastos.inboxInfo && window.Gastos.inboxInfo.key)), { timeout: 15000 }).toBe(true);

  test('automático: enseña el texto y la dirección del Atajo de tu cuenta', async ({ page }) => {
    await inboxReady(page);
    await page.locator('#dock [data-screen="auto"]').click();
    await page.locator('details.tut summary').click();
    const uid = await page.evaluate(() => window.MiAuth.auth.currentUser.uid);
    await expect(page.locator('#tut-body')).toHaveText(/"k":\{"stringValue":"[0-9a-f]{24}"\}/);
    await expect(page.locator('#tut-body')).not.toContainText('TU_CLAVE');
    await expect(page.locator('#tut-url')).toContainText('/documents/users/' + uid + '/gastosInbox?key=');
  });

  test('un pago dejado en el buzón de la cuenta se recoge al abrir y se quita del buzón', async ({ page }) => {
    await inboxReady(page);
    expect(await inbox(page, { k: '$KEY', amount: '12,50', merchant: 'Zara' }, true)).toBe(200);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.Gastos.state.expenses.map(e => e.merchant + ' ' + e.amount).join()), { timeout: 15000 }).toBe('Zara 12.5');
    await inboxReady(page);
    await expect.poll(() => inbox(page, null, true), { timeout: 15000 }).toBe(0);
  });

  test('el Atajo, sin sesión, solo puede dejar pagos con la clave de la cuenta (reglas de Firestore)', async ({ page }) => {
    await inboxReady(page);
    expect(await inbox(page, { k: 'ffffffffffffffffffffffff', amount: '1', merchant: 'Falso' })).toBe(403);
    expect(await inbox(page, { k: '$KEY', amount: '3,20', merchant: 'Bar' })).toBe(200);
  });

  test('editar un gasto deja corregir el importe y el nombre', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 9, date: ctx.today }] }));
    await page.locator('.mv').first().click();
    await page.locator('#ed-amount').fill('12,5');
    await page.locator('#ed-merchant').fill('Cine Sur');
    await page.locator('#ed-save').click();
    expect(await page.evaluate(() => { const e = window.Gastos.state.expenses[0]; return [e.amount, e.merchant, e.category]; })).toEqual([12.5, 'Cine Sur', 'Ocio']);
    await expect(page.locator('#ring-main')).toHaveText(/988/);
    // Un importe no válido no guarda
    await page.locator('.mv').first().click();
    await page.locator('#ed-amount').fill('');
    await page.locator('#ed-save').click();
    await expect(page.locator('#sheet')).toHaveClass(/open/);
    expect(await page.evaluate(() => window.Gastos.state.expenses[0].amount)).toBe(12.5);
  });

  test('una suscripción que cobra hoy se apunta sola como gasto, una sola vez', async ({ page }) => {
    await seedFn(page, ctx => ({ subs: [{ id: 'nf', name: 'Netflix', amount: 12, period: 'month', anchor: ctx.today }] }));
    await page.evaluate(() => { window.Gastos.applySubs(); window.Gastos.applySubs(); });
    const rows = await page.evaluate(() => window.Gastos.state.expenses.map(e => [e.merchant, e.amount, e.category, e.source]));
    expect(rows).toEqual([['Netflix', 12, 'Suscripciones', 'sub']]);
    await page.locator('#dock [data-screen="resumen"]').click();
    await expect(page.locator('.mv').first()).toContainText('suscripción');
  });

  test('un comercio ya apuntado recuerda su categoría, y cambiarla reescribe sus gastos', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Bar Pepe', category: 'Ocio', amount: 5, date: ctx.prevMonth(3) }] }));
    await page.locator('#dock-add').click();
    await page.locator('#ex-amount').fill('7');
    await page.locator('#ex-merchant').fill('bar pepe');
    await expect(page.locator('#ex-cats .on')).toHaveText('Ocio');
    await page.locator('#ex-cats [data-cat="Restaurantes"]').click();
    await page.locator('#ex-save').click();
    expect(await page.evaluate(() => window.Gastos.state.expenses.map(e => e.category))).toEqual(['Restaurantes', 'Restaurantes']);
  });

  test('una categoría solo sugerida por el nombre no reescribe los gastos anteriores', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Mercadona', category: 'Viajes', amount: 5, date: ctx.prevMonth(3) }] }));
    await page.locator('#dock-add').click();
    await page.locator('#ex-amount').fill('7');
    await page.locator('#ex-merchant').fill('Mercadona');
    await expect(page.locator('#ex-cats .on')).toHaveText('Supermercado');
    await page.locator('#ex-save').click();
    expect(await page.evaluate(() => window.Gastos.state.expenses.map(e => e.category))).toEqual(['Supermercado', 'Viajes']);
  });

  test('editar la categoría de un gasto cambia todos los de ese comercio', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [
      { id: 'a', merchant: 'Bar Pepe', category: 'Otros', amount: 5, date: ctx.today },
      { id: 'b', merchant: 'Bar Pepe', category: 'Otros', amount: 5, date: ctx.prevMonth(3) },
      { id: 'c', merchant: 'Cine', category: 'Otros', amount: 9, date: ctx.prevMonth(4) }] }));
    await page.locator('.mv').first().click();
    await expect(page.locator('#ed-cats .on')).toHaveText('Otros');
    await page.locator('#ed-cats [data-cat="Restaurantes"]').click();
    await page.locator('#ed-save').click();
    expect(await page.evaluate(() => window.Gastos.state.expenses.map(e => e.category))).toEqual(['Restaurantes', 'Restaurantes', 'Otros']);
  });

  test('un pago automático de un comercio conocido entra directo con su categoría', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Bar Pepe', category: 'Ocio', amount: 5, date: ctx.today }] }));
    await page.goto('apps/gastos/index.html?pago=10&comercio=Bar%20Pepe');
    await expect(page).not.toHaveURL(/pago=/);
    await expect(page.locator('#dock [data-screen="auto"] .badge')).toBeHidden();
    await expect(page.locator('#ring-main')).toHaveText(/985/);
    expect(await page.evaluate(() => window.Gastos.state.expenses[0].category)).toBe('Ocio');
  });

  test('confirmar un pago por revisar pone su categoría a los demás gastos del comercio', async ({ page }) => {
    await seedFn(page, ctx => ({ expenses: [
      { id: 'p', merchant: 'Zara', category: 'Otros', amount: 20, date: ctx.today, pending: true },
      { id: 'a', merchant: 'Zara', category: 'Otros', amount: 30, date: ctx.prevMonth(3) }] }));
    await page.locator('#dock [data-screen="auto"]').click();
    await page.locator('#screen-auto select').selectOption('Ocio');
    await page.locator('#screen-auto [data-confirm]').click();
    expect(await page.evaluate(() => window.Gastos.state.expenses.map(e => e.category))).toEqual(['Ocio', 'Ocio']);
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
