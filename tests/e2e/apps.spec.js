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

test('el tema de color se elige en una app y vale también para las otras', async ({ page }) => {
  const palette = () => page.evaluate(() => document.documentElement.getAttribute('data-palette'));
  for (const ruta of ['apps/gimnasio/index.html', 'apps/comidas/index.html']) {
    await openApp(page, ruta);
    await page.locator('#palette-btn').click();
    await expect(page.locator('#palette-picker [data-palette-id]')).toHaveCount(9);
    await page.locator('#palette-picker [data-palette-id="rosa-pastel"]').click();
    expect(await palette()).toBe('rosa-pastel');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(252, 235, 241)');
  }
  await openApp(page, 'apps/gimnasio/index.html');
  expect(await palette()).toBe('rosa-pastel'); // sigue elegido al abrir la otra app
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
