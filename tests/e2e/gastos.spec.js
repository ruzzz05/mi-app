// Gastos: apuntar un gasto, dar de alta suscripciones, totales y sugerencias de cobros repetidos.
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/gastos/index.html';
test.use({ viewport: { width: 390, height: 780 } });

test.describe('Gastos', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('apuntar un gasto con el botón + lo suma al mes y a su categoría', async ({ page }) => {
    await expect(page.locator('#screen-resumen .empty-msg')).toBeVisible();
    await page.locator('#fab').click();
    await page.locator('#ex-amount').fill('12,50');
    await page.locator('#ex-merchant').fill('Mercadona');
    await expect(page.locator('#ex-cats .on')).toHaveText('Supermercado'); // categoría sugerida
    await page.locator('#ex-save').click();

    await expect(page.locator('#screen-resumen .total')).toContainText('12,50');
    await expect(page.locator('#screen-resumen .cat')).toContainText('Supermercado');
    await expect(page.locator('#screen-resumen .row')).toContainText('Mercadona');
  });

  test('un importe no válido no guarda nada', async ({ page }) => {
    await page.locator('#fab').click();
    await page.locator('#ex-amount').fill('abc');
    await page.locator('#ex-save').click();
    await expect(page.locator('#toast')).toContainText('importe');
    await expect(page.locator('#sheet')).toHaveClass(/open/);
  });

  test('borrar un gasto lo quita del resumen', async ({ page }) => {
    await page.locator('#fab').click();
    await page.locator('#ex-amount').fill('5');
    await page.locator('#ex-save').click();
    await page.locator('[data-del]').click();
    await expect(page.locator('#screen-resumen .empty-msg')).toBeVisible();
  });

  test('suscripciones: alta, totales mensual/anual, pausa y borrado', async ({ page }) => {
    await page.locator('.tabbar [data-screen="subs"]').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-name').fill('Netflix');
    await page.locator('#sb-amount').fill('12,99');
    await page.locator('#sb-save').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-name').fill('Dominio');
    await page.locator('#sb-amount').fill('24');
    await page.locator('#sb-period').selectOption('year');
    await page.locator('#sb-save').click();

    const hero = page.locator('#screen-subs .hero');
    await expect(hero.locator('.total')).toContainText('14,99'); // 12,99 + 24/12
    await expect(hero).toContainText('179,88');                   // 12,99*12 + 24
    await expect(page.locator('#screen-subs [data-edit]')).toHaveCount(2);

    await page.locator('[data-edit]', { hasText: 'Netflix' }).click();
    await page.locator('#sb-pause').click();
    await expect(hero.locator('.total')).toContainText('2,00');
    await expect(page.locator('[data-edit]', { hasText: 'Netflix' })).toContainText('Pausada');

    await page.locator('[data-edit]', { hasText: 'Netflix' }).click();
    await page.locator('#sb-del').click();
    await expect(page.locator('#screen-subs [data-edit]')).toHaveCount(1);
  });

  test('cobros repetidos en los gastos se sugieren como suscripción y se pueden añadir', async ({ page }) => {
    await page.evaluate(() => {
      const G = window.Gastos;
      G.state.expenses = ['2026-01-03', '2026-02-03', '2026-03-03'].map((date, i) => ({ id: 'n' + i, merchant: 'Spotify AB', amount: 10.99, date, category: 'Suscripciones', source: 'auto' }));
      G.save(); G.go('subs');
    });
    const sug = page.locator('#screen-subs [data-adopt]');
    await expect(sug).toHaveCount(1);
    await sug.click();
    await expect(page.locator('#sb-name')).toHaveValue('Spotify AB');
    await expect(page.locator('#sb-amount')).toHaveValue('10,99');
    await page.locator('#sb-save').click();
    await expect(page.locator('#screen-subs [data-adopt]')).toHaveCount(0); // ya está dada de alta
    await expect(page.locator('#screen-subs [data-edit]')).toContainText('Spotify AB');
  });

  test('los datos sobreviven a recargar y no hay desbordamiento horizontal', async ({ page }) => {
    await page.locator('#fab').click();
    await page.locator('#ex-amount').fill('3');
    await page.locator('#ex-merchant').fill('Un nombre de comercio bastante largo para probar el recorte del texto');
    await page.locator('#ex-save').click();
    await page.reload();
    await expect(page.locator('#screen-resumen .total')).toContainText('3,00');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(over).toBe(false);
  });
});
