// Mi-Menu · Compra: foto del ticket -> confirmación -> los productos pasan a comprados.
// La lectura con IA se sustituye por una respuesta fija (no gasta cuota ni necesita cámara).
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/comidas/index.html';

async function seed(page, aiText) {
  await page.evaluate(text => {
    const C = window.Comidas;
    C.state.dishes = [{ id: 'p', name: 'Pasta', ingredients: [{ name: 'Pasta', qty: 1 }, { name: 'Tomate', qty: 1 }, { name: 'Leche', qty: 1 }] }];
    C.state.menu = { startDate: '2099-01-05', firstMeal: 'comida', days: 7, plan: { '0-comida': { id: 'p', name: 'Pasta' } }, exclusions: [] };
    C.save();
    window.Ticket.read = async () => text;
    C.go('compra');
  }, aiText);
}

const foto = { name: 'ticket.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') };

test.describe('Mi-Menu · ticket', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('la cámara abre la confirmación y al aceptar los productos pasan a comprados', async ({ page }) => {
    await seed(page, '{"matches":["leche","pasta"]}');
    await expect(page.locator('[data-act="ticket"]')).toBeVisible();
    await page.locator('#ticket-file').setInputFiles(foto);

    const sheet = page.locator('#sheet');
    await expect(sheet).toHaveClass(/open/);
    await expect(sheet.locator('[data-ticket]:checked')).toHaveCount(2);
    await sheet.locator('[data-ticket="pasta"]').uncheck(); // la pasta no era
    await page.locator('#ticket-ok').click();

    await expect(page.locator('#screen-compra .bought summary')).toHaveText(/Comprados \(1\)/);
    await expect(page.locator('#screen-compra > .buy .buy-name')).toHaveText(['Pasta', 'Tomate']);
  });

  test('si el ticket no coincide con nada, avisa y no abre la confirmación', async ({ page }) => {
    await seed(page, '{"matches":[]}');
    await page.locator('#ticket-file').setInputFiles(foto);
    await expect(page.locator('#toast')).toContainText('No he encontrado');
    await expect(page.locator('#sheet')).not.toHaveClass(/open/);
  });

  test('si falla la lectura, avisa y la lista no cambia', async ({ page }) => {
    await seed(page, '');
    await page.evaluate(() => { window.Ticket.read = async () => { throw new Error('sin cuota'); }; });
    await page.locator('#ticket-file').setInputFiles(foto);
    await expect(page.locator('#toast')).toContainText('No se pudo leer el ticket');
    await expect(page.locator('#screen-compra .bought')).toHaveCount(0);
  });
});
