// Ask: las preguntas salen en baraja (sin repetir) y los jugadores se recuerdan.
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/ask/index.html';
test.use({ viewport: { width: 390, height: 780 } });

test.describe('Ask', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  const deck = page => page.evaluate(() => JSON.parse(localStorage.getItem('ask.deck.yonunca') || 'null'));

  test('cada pregunta sale de la baraja y no vuelve hasta que se acaba', async ({ page }) => {
    await expect(page.locator('#question')).not.toHaveText(/Cargando|Leyendo/);
    await expect.poll(async () => (await deck(page) || []).length).toBeGreaterThan(10);
    const before = await deck(page);
    await page.locator('#btn-next').click();
    await expect.poll(async () => (await deck(page)).length).toBe(before.length - 1);
    const after = await deck(page);
    expect(new Set(after).size).toBe(after.length);          // sin repetidas
    expect(before.slice(0, after.length)).toEqual(after);    // solo ha salido la última
  });

  test('los jugadores se recuerdan al volver a entrar', async ({ page }) => {
    await page.locator('#btn-ask').click();
    await page.locator('#new-name-input').fill('Ana');
    await page.locator('#btn-add-name').click();
    await page.locator('#new-name-input').fill('Luis');
    await page.locator('#btn-add-name').click();
    await page.locator('#players-list .player-tag').first().click();   // se quita Ana
    await page.reload();
    await page.locator('#btn-ask').click();
    await expect(page.locator('#players-list .player-tag')).toHaveCount(1);
    await expect(page.locator('#players-list')).toContainText('Luis');
  });
});
