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

    await expect(page.locator('#screen-resumen .pulse-total')).toContainText('12,50');
    await expect(page.locator('#screen-resumen .cats li')).toContainText('Supermercado');
    await expect(page.locator('#screen-resumen .mov')).toContainText('Mercadona');
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

    const hero = page.locator('#screen-subs .subs-pulse');
    await expect(hero.locator('.pulse-total')).toContainText('14,99'); // 12,99 + 24/12
    await expect(hero).toContainText('179,88');                   // 12,99*12 + 24
    await expect(page.locator('#screen-subs [data-edit]')).toHaveCount(2);

    await page.locator('[data-edit]', { hasText: 'Netflix' }).click();
    await page.locator('#sb-pause').click();
    await expect(hero.locator('.pulse-total')).toContainText('2,00');
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
    await expect(page.locator('#screen-resumen .pulse-total')).toContainText('3,00');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(over).toBe(false);
  });

  test('fecha de fin: la suscripción deja de contar cuando termina y avisa antes', async ({ page }) => {
    await page.evaluate(() => {
      const G = window.Gastos, d = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
      G.state.subs = [
        { id: 'a', name: 'Netflix', amount: 10, period: 'month', anchor: d(5) },
        { id: 'b', name: 'Disney+', amount: 20, period: 'month', anchor: d(-60), until: d(-3) },
        { id: 'c', name: 'Gimnasio', amount: 30, period: 'month', anchor: d(2), until: d(40) }
      ];
      G.save(); G.go('subs');
    });
    await expect(page.locator('#screen-subs .subs-pulse .pulse-total')).toContainText('40,00'); // 10 + 30, sin Disney
    await expect(page.locator('#screen-subs [data-edit]', { hasText: 'Gimnasio' })).toContainText('Termina el');
    await page.locator('#screen-subs .ended summary').click();
    await expect(page.locator('#screen-subs .ended')).toContainText('Disney+');
    await expect(page.locator('#screen-subs .ended')).toContainText('Terminó el');
  });

  test('al guardar una suscripción con fin anterior al cobro avisa y no guarda', async ({ page }) => {
    await page.locator('.tabbar [data-screen="subs"]').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-name').fill('Disney+');
    await page.locator('#sb-amount').fill('10');
    await page.locator('#sb-date').fill('2030-05-10');
    await page.locator('#sb-until').fill('2030-05-01');
    await page.locator('#sb-save').click();
    await expect(page.locator('#toast')).toContainText('fecha de fin');
    await expect(page.locator('#sheet')).toHaveClass(/open/);
  });

  test('el formulario explica qué día se cobra', async ({ page }) => {
    await page.locator('.tabbar [data-screen="subs"]').click();
    await page.locator('#sb-add').click();
    await page.locator('#sb-date').fill('2030-05-15');
    await page.locator('#sb-date').dispatchEvent('change');
    await expect(page.locator('#sb-when')).toHaveText('Se cobra el día 15 de cada mes');
  });

  test('el gráfico marca los días de cobro y se puede navegar entre meses', async ({ page }) => {
    await page.evaluate(() => {
      const G = window.Gastos, t = new Date(), iso = (dt) => new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      G.state.subs = [{ id: 'a', name: 'Netflix', amount: 10, period: 'month', anchor: iso(new Date(t.getFullYear(), t.getMonth(), 2)) }];
      G.state.expenses = [{ id: 'x', merchant: 'Bar', amount: 8, date: iso(new Date(t.getFullYear(), t.getMonth() - 1, 10)), category: 'Otros' }];
      G.save(); G.go('resumen');
    });
    await expect(page.locator('.chart .dot')).toHaveCount(1);
    await expect(page.locator('.chart .b.today')).toHaveCount(1);
    await page.locator('[data-month="-1"]').click();
    await expect(page.locator('.pulse-total')).toContainText('8,00');
    await expect(page.locator('.chart .b.today')).toHaveCount(0);
    await expect(page.locator('[data-month="1"]')).toBeEnabled();
    await page.locator('[data-month="1"]').click();
    await expect(page.locator('[data-month="1"]')).toBeDisabled();
  });
});
