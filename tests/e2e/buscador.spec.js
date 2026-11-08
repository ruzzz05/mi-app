// Mi-Menu · Recetas: buscador por nombre de receta y por ingredientes.
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/comidas/index.html';
const RECETAS = [
  { id: 'sopa', name: 'Sopa de pollo', ingredients: ['Pollo', 'Fideos'] },
  { id: 'ens', name: 'Ensalada', ingredients: ['Lechuga', 'Limón', 'Atún'] },
  { id: 'arroz', name: 'Arroz con pollo', ingredients: ['Arroz', 'Pollo', 'Pimiento'] }
];

async function seedRecetas(page, recetas) {
  await page.evaluate(list => {
    const C = window.Comidas;
    C.state.dishes = list.map(d => ({ id: d.id, name: d.name, ingredients: d.ingredients.map(n => ({ name: n, qty: 1 })) }));
    C.save();
    C.go('recetas');
  }, recetas);
}

const buscador = page => page.locator('#recipe-search');
const tarjetas = page => page.locator('#recipe-list .card-row');
const escribir = async (page, texto) => { await buscador(page).fill(texto); };

test.describe('Mi-Menu · buscador de recetas', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('sin recetas no hay buscador; con recetas sí, y se ven todas', async ({ page }) => {
    await expect(buscador(page)).toHaveCount(0);
    await seedRecetas(page, RECETAS);
    await expect(buscador(page)).toBeVisible();
    await expect(buscador(page)).toHaveAttribute('placeholder', /receta o ingrediente/i);
    await expect(tarjetas(page)).toHaveCount(3);
  });

  test('filtra por el nombre de la receta', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'ensal');
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Ensalada');
  });

  test('filtra por el nombre de un ingrediente', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'lechuga');
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Ensalada');
  });

  test('no distingue tildes ni mayúsculas, y enseña las que coinciden por nombre o por ingrediente', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'LIMON');
    await expect(tarjetas(page)).toHaveCount(1);
    await escribir(page, 'pollo');
    await expect(tarjetas(page)).toHaveCount(2);
    await expect(page.locator('#recipe-list')).toContainText('Sopa de pollo');
    await expect(page.locator('#recipe-list')).toContainText('Arroz con pollo');
  });

  test('con varias palabras deben cumplirse todas', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'pollo arroz');
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Arroz con pollo');
  });

  test('sin coincidencias lo dice, y al borrar el texto vuelven todas', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'chocolate');
    await expect(tarjetas(page)).toHaveCount(0);
    await expect(page.locator('#recipe-list .empty-msg')).toContainText('chocolate');
    await escribir(page, '');
    await expect(tarjetas(page)).toHaveCount(3);
  });

  test('escribir no pierde el foco del buscador (se puede seguir tecleando)', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await buscador(page).click();
    await page.keyboard.type('sopa');
    await expect(buscador(page)).toBeFocused();
    await expect(buscador(page)).toHaveValue('sopa');
    await expect(tarjetas(page)).toHaveCount(1);
  });

  test('tocar una receta filtrada abre esa receta', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'lechuga');
    await tarjetas(page).first().click();
    await expect(page.locator('#dish-name')).toHaveValue('Ensalada');
  });

  test('al guardar cambios de una receta, el filtro se mantiene', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'pollo');
    await tarjetas(page).first().click();
    await page.locator('#dish-save').click();
    await expect(buscador(page)).toHaveValue('pollo');
    await expect(tarjetas(page)).toHaveCount(2);
  });

  test('al crear una receta nueva se borra el filtro para verla', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'lechuga');
    await page.locator('.screen-head [data-act="new"]').click();
    await page.locator('#dish-name').fill('Tortilla');
    await page.locator('.ing-name').first().fill('Huevos');
    await page.locator('#dish-save').click();
    await expect(buscador(page)).toHaveValue('');
    await expect(tarjetas(page)).toHaveCount(4);
    await expect(page.locator('#recipe-list')).toContainText('Tortilla');
  });

  test('al cambiar de pestaña y volver, el buscador empieza vacío', async ({ page }) => {
    await seedRecetas(page, RECETAS);
    await escribir(page, 'sopa');
    await page.locator('.tabbar [data-screen="compra"]').click();
    await page.locator('.tabbar [data-screen="recetas"]').click();
    await expect(buscador(page)).toHaveValue('');
    await expect(tarjetas(page)).toHaveCount(3);
  });
});
