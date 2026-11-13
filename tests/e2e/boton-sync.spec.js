// Botón "Sincronizar ahora" en las apps que hablan con la base de datos (Gastos y Vinilos).
// Al tocarlo se debe leer la nube de nuevo (una petición GET a Firestore), sin esperar a la próxima apertura.
const { test, expect, freshStart } = require('./fixtures');

const FIRESTORE_GET = req => req.method() === 'GET' && req.url().includes('firestore.googleapis.com');

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
  });
}
