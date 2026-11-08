// Versión de la app: pequeña, abajo a la derecha del menú inicial. Se cambia solo en shared/version.js.
const fs = require('fs');
const path = require('path');
const { test, expect, openApp } = require('./fixtures');

test.use({ viewport: { width: 390, height: 780 } });

test('la portada enseña la versión pequeña, abajo a la derecha', async ({ page }) => {
  await openApp(page, 'index.html');
  const v = page.locator('#app-version');
  await expect(v).toBeVisible();
  await expect(v).toHaveText(/^v\d+\.\d+(\.\d+)?$/);

  const shown = await v.textContent();
  expect(shown).toBe('v' + await page.evaluate(() => window.APP_VERSION));

  const box = await v.boundingBox();
  const view = page.viewportSize();
  expect(box.x).toBeGreaterThan(view.width / 2);               // mitad derecha
  expect(box.y + box.height).toBeGreaterThan(view.height - 60); // pegada abajo
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  const size = await v.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeLessThanOrEqual(12);                         // pequeña
});

test('la versión no tapa los botones de las apps', async ({ page }) => {
  await openApp(page, 'index.html');
  const v = await page.locator('#app-version').boundingBox();
  for (const card of await page.locator('main a').all()) {
    const b = await card.boundingBox();
    if (!b) continue;
    const overlap = !(b.x + b.width <= v.x || v.x + v.width <= b.x || b.y + b.height <= v.y || v.y + v.height <= b.y);
    expect(overlap).toBe(false);
  }
});

test('el service worker precarga el archivo de versión (se ve también sin conexión)', async () => {
  const sw = fs.readFileSync(path.resolve(__dirname, '..', '..', 'sw.js'), 'utf8');
  expect(sw).toContain("'shared/version.js'");
});
