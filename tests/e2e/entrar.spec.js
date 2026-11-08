// Humo: la app local, servida bajo la dirección de GitHub Pages, conecta con Firebase y deja entrar.
const { test, expect, openApp } = require('./fixtures');

test('se puede entrar en Mi-Menu con la cuenta de pruebas', async ({ page }) => {
  await openApp(page, 'apps/comidas/index.html');
  await expect(page.locator('.tabbar')).toBeVisible();
  await expect(page.locator('.topbar .title')).toHaveText('Mi-Menu');
  // Sesión real de Firebase, no solo una pantalla visible
  await expect.poll(() => page.evaluate(() => window.MiAuth && window.MiAuth.auth && window.MiAuth.auth.currentUser && window.MiAuth.auth.currentUser.email))
    .toBe('claude@mi-app.invalid');
});
