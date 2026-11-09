// Portada: cada tarjeta enseña el dato del día de su app (lo que queda de presupuesto, qué toca comer, entreno en curso).
const { test, expect, openApp } = require('./fixtures');

test.use({ viewport: { width: 390, height: 780 } });

test('las tarjetas enseñan el dato del día y, si no hay, su frase de siempre', async ({ page }) => {
  await openApp(page, 'index.html');
  await page.evaluate(() => {
    const d = new Date(), iso = n => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    localStorage.setItem('gastos.v1', JSON.stringify({ expenses: [{ id: 'a', merchant: 'Cine', category: 'Ocio', amount: 300, date: iso(1) }], subs: [], budget: 1000, categories: ['Ocio', 'Otros'], updatedAt: 1 }));
    localStorage.setItem('gimnasio.active', JSON.stringify({ id: 'x', startedAt: Date.now(), routineName: 'Pierna', exercises: [] }));
    localStorage.setItem('comidas.v1', JSON.stringify({ dishes: [], seedPurged: true, menu: { startDate: iso(d.getDate()), firstMeal: 'comida', days: 1, exclusions: [], plan: { '0-comida': { id: null, name: 'Lentejas' }, '0-cena': { id: null, name: 'Lentejas' } } } }));
  });
  await page.reload();
  await expect(page.locator('a.tile[href*="gastos"] p')).toHaveText('Te quedan 700 € este mes');
  await expect(page.locator('a.tile[href*="gimnasio"] p')).toHaveText('Entreno en curso: Pierna');
  await expect(page.locator('a.tile[href*="comidas"] p')).toHaveText(/^(Comida|Cena): Lentejas$/);
  await expect(page.locator('a.tile[href*="vinilos"] p')).toHaveText('Mi biblioteca de discos, por artista y estilo.');
  await page.evaluate(() => ['gastos.v1', 'gimnasio.active', 'comidas.v1'].forEach(k => localStorage.removeItem(k)));
  await page.reload();
  await expect(page.locator('a.tile[href*="gastos"] p')).toHaveText('Gastos y suscripciones: cuánto pagas y cuándo te cobran.');
});
