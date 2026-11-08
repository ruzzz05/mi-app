// Aviso de sincronización: el punto de la cabecera (junto al botón de sincronizar) en Mi-Menu y Gimnasio.
const { test, expect, freshStart, setOffline } = require('./fixtures');

const FIRESTORE = '**/firestore.googleapis.com/**';
const badge = page => page.locator('#sync-badge');

async function failFirestore(page) {
  await page.route(FIRESTORE, route => route.fulfill({ status: 500, body: '{}' }));
}

for (const [nombre, ruta] of [['Mi-Menu', 'apps/comidas/index.html'], ['Gimnasio', 'apps/gimnasio/index.html']]) {
  test.describe(nombre, () => {
    test.beforeEach(async ({ page }) => { await freshStart(page, ruta); });

    test('hay un punto junto al botón de sincronizar y acaba en "Sincronizado"', async ({ page }) => {
      await expect(badge(page)).toBeVisible();
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
      // está justo antes del botón de sincronizar
      const order = await page.evaluate(() => {
        const b = document.getElementById('sync-badge'), s = document.getElementById('sync-now');
        return b.nextElementSibling === s;
      });
      expect(order).toBe(true);
    });

    test('al tocarlo dice el estado y la hora de la última sincronización', async ({ page }) => {
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
      await badge(page).click();
      const pop = page.locator('.sync-pop');
      await expect(pop).toBeVisible();
      await expect(pop).toContainText('Sincronizado');
      await expect(pop).toContainText('Última sincronización');
      await page.locator('h2, .title').first().click({ force: true });   // tocar fuera lo cierra
      await expect(pop).toBeHidden();
    });

    test('sin conexión se ve "Sin conexión" y al volver la red vuelve a "Sincronizado"', async ({ page, context }) => {
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
      await setOffline(context, true);
      await expect(badge(page)).toHaveAttribute('data-state', 'offline');
      await setOffline(context, false);
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
    });

    test('si Firestore falla se ve el error y al arreglarse vuelve a "Sincronizado"', async ({ page }) => {
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
      await failFirestore(page);
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'error', { timeout: 20000 });
      await badge(page).click();
      await expect(page.locator('.sync-pop')).toContainText('500');
      await page.unroute(FIRESTORE);
      await page.locator('#sync-now').click();
      await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
    });
  });
}

test.describe('Mi-Menu: cambios sin subir', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, 'apps/comidas/index.html'); });

  test('editar sin conexión deja "Sin conexión" con cambios pendientes y luego se sube', async ({ page, context }) => {
    await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
    await setOffline(context, true);
    await page.locator('[data-act="new"]').first().click();
    await page.locator('#dish-name').fill('Receta de aviso');
    await page.locator('.ing-name').first().fill('Sal');
    await page.locator('#dish-save').click();
    await expect(badge(page)).toHaveAttribute('data-state', 'offline');
    await badge(page).click();
    await expect(page.locator('.sync-pop')).toContainText('cambios sin subir');

    await setOffline(context, false);
    await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 30000 });
  });

  test('un cambio con la nube caída queda como "Error" y sigue guardado en el dispositivo', async ({ page }) => {
    await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
    await failFirestore(page);
    await page.locator('[data-act="new"]').first().click();
    await page.locator('#dish-name').fill('Receta con error');
    await page.locator('.ing-name').first().fill('Sal');
    await page.locator('#dish-save').click();
    await expect(badge(page)).toHaveAttribute('data-state', 'error', { timeout: 20000 });
    await badge(page).click();
    await expect(page.locator('.sync-pop')).toContainText('guardados en este dispositivo');
    await page.unroute(FIRESTORE);
    await page.locator('#sync-now').click();
    await expect(badge(page)).toHaveAttribute('data-state', 'ok', { timeout: 20000 });
  });
});
