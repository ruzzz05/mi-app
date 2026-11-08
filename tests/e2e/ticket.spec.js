// Mi-Menu · Compra: foto del ticket en una ventana flotante con el proceso paso a paso,
// confirmación y los productos pasan a comprados. La IA se sustituye por una respuesta fija.
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/comidas/index.html';
const foto = { name: 'ticket.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') };

// reply: texto de la IA, o una función; gate: si true, la lectura espera a window.__release()
async function seed(page, reply, { gate = false } = {}) {
  await page.evaluate(({ reply, gate }) => {
    const C = window.Comidas;
    C.state.dishes = [{ id: 'p', name: 'Arroz con puerro', ingredients: [{ name: 'Arroz', qty: 1 }, { name: 'Puerro', qty: 1 }, { name: 'Leche', qty: 1 }] }];
    C.state.menu = { startDate: '2099-01-05', firstMeal: 'comida', days: 7, plan: { '0-comida': { id: 'p', name: 'Arroz con puerro' } }, exclusions: [] };
    C.save();
    window.__calls = 0;
    window.Ticket.read = async (file, prompt, onStep) => {
      window.__calls++;
      if (onStep) onStep('prepare');
      if (gate) await new Promise(r => { window.__release = r; });
      if (onStep) onStep('read');
      if (reply === 'THROW') throw new Error('sin cuota');
      if (reply === 'THROW_ONCE' && window.__calls === 1) throw new Error('sin cuota');
      if (reply === 'HANG') await new Promise(() => {});
      return reply === 'THROW_ONCE' ? '{"matches":["arroz","puerro"]}' : reply;
    };
    C.go('compra');
  }, { reply, gate });
}

const win = page => page.locator('#sheet');
const names = page => page.locator('#screen-compra > .buy .buy-name');

test.describe('Mi-Menu · ticket', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('la ventana enseña los pasos y al confirmar arroz y puerro salen de la lista', async ({ page }) => {
    await seed(page, '{"matches":["arroz","puerro"]}', { gate: true });
    await page.locator('#ticket-file').setInputFiles(foto);

    await expect(win(page)).toHaveClass(/open/);          // ventana flotante sobre la lista
    await expect(win(page).locator('.tk-step')).toHaveCount(3);
    await expect(win(page).locator('.tk-step.active')).toContainText('Preparando la foto');
    await page.evaluate(() => window.__release());

    await expect(win(page).locator('[data-ticket]:checked')).toHaveCount(2);
    await expect(win(page)).toContainText('Arroz');
    await expect(win(page)).toContainText('Puerro');
    await page.locator('#ticket-ok').click();

    await expect(win(page)).not.toHaveClass(/open/);
    await expect(page.locator('#screen-compra .bought summary')).toHaveText(/Comprados \(2\)/);
    await expect(names(page)).toHaveText(['Leche']);
  });

  test('puedes desmarcar lo que no sea correcto antes de confirmar', async ({ page }) => {
    await seed(page, '{"matches":["arroz","puerro"]}');
    await page.locator('#ticket-file').setInputFiles(foto);
    await win(page).locator('[data-ticket="puerro"]').uncheck();
    await page.locator('#ticket-ok').click();
    await expect(page.locator('#screen-compra .bought summary')).toHaveText(/Comprados \(1\)/);
    await expect(names(page)).toHaveText(['Leche', 'Puerro']);
  });

  test('si no coincide nada lo dice en la ventana y deja elegir a mano', async ({ page }) => {
    await seed(page, '{"matches":[]}');
    await page.locator('#ticket-file').setInputFiles(foto);
    await expect(win(page)).toContainText('No he encontrado ningún producto de tu lista');
    await expect(win(page).locator('[data-ticket]')).toHaveCount(3);
    await expect(win(page).locator('[data-ticket]:checked')).toHaveCount(0);
  });

  test('si falla la lectura, la ventana lo explica y permite reintentar', async ({ page }) => {
    await seed(page, 'THROW_ONCE');
    await page.locator('#ticket-file').setInputFiles(foto);
    await expect(win(page)).toContainText('No se pudo leer el ticket');
    await expect(win(page).locator('.tk-step.error')).toHaveCount(1);
    await page.locator('#ticket-retry').click();
    await expect(win(page).locator('[data-ticket]:checked')).toHaveCount(2);
    await expect(page.locator('#screen-compra .bought')).toHaveCount(0); // aún nada marcado
  });

  test('si Gemini tarda demasiado, avisa en lugar de quedarse esperando', async ({ page }) => {
    await seed(page, 'HANG');
    await page.evaluate(() => { window.Ticket.timeoutMs = 400; });
    await page.locator('#ticket-file').setInputFiles(foto);
    await expect(win(page)).toContainText('tardó demasiado');
    await expect(page.locator('#ticket-retry')).toBeVisible();
  });

  test('cerrar la ventana mientras lee cancela y no marca nada', async ({ page }) => {
    await seed(page, '{"matches":["arroz"]}', { gate: true });
    await page.locator('#ticket-file').setInputFiles(foto);
    await expect(win(page)).toHaveClass(/open/);
    await page.locator('#sheet-close').click();
    await page.evaluate(() => window.__release());
    await page.waitForTimeout(400);
    await expect(win(page)).not.toHaveClass(/open/);
    await expect(page.locator('#screen-compra .bought')).toHaveCount(0);
  });
});
