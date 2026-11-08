// Humo de cada app: carga sin errores de script y lo básico responde.
const { test, expect, openApp } = require('./fixtures');

for (const [nombre, ruta] of [
  ['Mi-Menu', 'apps/comidas/index.html'],
  ['Gimnasio', 'apps/gimnasio/index.html'],
  ['Vinilos', 'apps/vinilos/index.html']
]) {
  test(`${nombre}: carga sin errores de script`, async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await openApp(page, ruta);
    await page.waitForTimeout(1500);
    expect(errores).toEqual([]);
  });
}

test('Gimnasio: el botón de tema recorre claro, oscuro, aqua y niebla', async ({ page }) => {
  await openApp(page, 'apps/gimnasio/index.html');
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await page.locator('.theme-toggle:not(#sync-now)').click();
    seen.push(await theme());
  }
  expect(new Set(seen)).toEqual(new Set(['light', 'dark', 'aqua', 'niebla']));
});

test('Gimnasio: las pestañas cambian de pantalla', async ({ page }) => {
  await openApp(page, 'apps/gimnasio/index.html');
  for (const s of ['rutinas', 'perfil', 'hoy']) {
    await page.locator(`#tabbar [data-screen="${s}"]`).click();
    await expect(page.locator(`#tabbar [data-screen="${s}"]`)).toHaveClass(/active/);
  }
});

test('Vinilos: enseña la pared de discos', async ({ page }) => {
  await openApp(page, 'apps/vinilos/index.html');
  await expect(page.locator('#wall')).toBeVisible();
  await expect(page.locator('#vinyl-counter')).not.toHaveText('Calculando colección...', { timeout: 15000 });
});
