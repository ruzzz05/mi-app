// Botón "Sincronizar ahora" y su punto de estado (#sync-badge) en las apps que hablan con la base de datos
// (Gastos y Vinilos). Al tocarlo se debe leer la nube de nuevo (una petición GET a Firestore).
const { test, expect, freshStart } = require('./fixtures');

const FIRESTORE = '**/firestore.googleapis.com/**';
const FIRESTORE_GET = req => req.method() === 'GET' && req.url().includes('firestore.googleapis.com');
const badge = page => page.locator('#sync-badge');

for (const [nombre, ruta] of [['Gastos', 'apps/gastos/index.html'], ['Vinilos', 'apps/vinilos/index.html']]) {
  test.describe(nombre, () => {
    test.beforeEach(async ({ page }) => { await freshStart(page, ruta); });

    test('hay un botón de sincronizar en la cabecera', async ({ page }) => {
      const btn = page.locator('header.topbar #sync-now');
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('aria-label', 'Sincronizar ahora');
    });

    test('al tocarlo vuelve a leer la nube', async ({ page }) => {
      await expect(page.locator('#sync-now')).toBeVisible();
      const lectura = page.waitForRequest(FIRESTORE_GET, { timeout: 20000 });
      await page.locator('#sync-now').click();
      await lectura;
      await expect(page.locator('#sync-now')).toBeEnabled({ timeout: 20000 });
    });

    test('hay un punto de estado junto al botón, justo antes', async ({ page }) => {
      await expect(badge(page)).toBeVisible();
      const antes = await page.evaluate(() => document.getElementById('sync-badge').nextElementSibling === document.getElementById('sync-now'));
      expect(antes).toBe(true);
    });

    test('tras sincronizar el punto queda en "Sincronizado" y al tocarlo dice la hora', async ({ page }) => {
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
      await badge(page).click();
      const pop = page.locator('.sync-pop');
      await expect(pop).toBeVisible();
      await expect(pop).toContainText('Sincronizado');
      await expect(pop).toContainText('Última sincronización');
    });

    test('si la nube falla el punto queda en "Error" y al arreglarse vuelve a "Sincronizado"', async ({ page }) => {
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
      await page.route(FIRESTORE, route => route.fulfill({ status: 500, body: '{}' }));
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'error', { timeout: 20000 });
      await page.unroute(FIRESTORE);
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
    });
  });
}
