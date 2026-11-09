// Mi-Menu: pantallas reales contra Firebase (cuenta de pruebas).
const { test, expect, freshStart, makePng } = require('./fixtures');

const APP = 'apps/comidas/index.html';
const PENDING_PHOTOS = 'pending-photos.comidas';
const PENDING_STATE = 'pending-sync.comidas';

const pendingKey = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const photoStatus = (page, id) => page.evaluate(async photoId => {
  const A = window.MiAuth;
  const token = await A.auth.currentUser.getIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/mi-app-490b5/databases/(default)/documents/users/${A.auth.currentUser.uid}/fotos/${photoId}`;
  return (await fetch(url, { headers: { Authorization: 'Bearer ' + token } })).status;
}, id);

// Rellena una receta nueva en el formulario abierto
async function fillDish(page, name, ingredients) {
  await page.locator('#dish-name').fill(name);
  for (let i = 0; i < ingredients.length; i++) {
    if (i > 0) await page.locator('#ing-add').click();
    await page.locator('.ing-name').nth(i).fill(ingredients[i]);
  }
}

// Mete recetas y un menú de hoy directamente en el estado (rápido); después se prueba con la interfaz.
async function seed(page, { dishes, extras = {} }) {
  await page.evaluate(({ dishes, extras }) => {
    const C = window.Comidas;
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const e = x => ({ id: x.id, name: x.name });
    C.state.dishes = dishes.map(x => ({
      id: x.id, name: x.name, ...(x.photo ? { photo: x.photo } : {}), ingredients: x.ingredients.map(n => ({ name: n, qty: 1 }))
    }));
    const main = dishes[0];
    C.state.menu = {
      startDate: today, firstMeal: 'comida', days: 2, exclusions: [],
      plan: { '0-comida': e(main), '0-cena': e(main), '1-comida': e(main), '1-cena': e(main) }, extras
    };
    C.save();
    C.go('hoy');
  }, { dishes, extras });
}

test.describe('Mi-Menu', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('el formulario de receta no tiene campo de cantidad', async ({ page }) => {
    await page.locator('[data-act="new"]').first().click();
    await expect(page.locator('#dish-name')).toBeVisible();
    await expect(page.locator('.ing-qty')).toHaveCount(0);
  });

  test('los ingredientes ya usados salen como etiquetas y se añaden con un toque', async ({ page }) => {
    await page.locator('[data-act="new"]').first().click();
    await expect(page.locator('#ing-tags')).toHaveCount(0);          // sin recetas, sin etiquetas
    await fillDish(page, 'Sopa', ['Caldo', 'Fideos']);
    await page.locator('#dish-save').click();

    await page.locator('[data-act="new"]').first().click();
    const chip = page.locator('#ing-tags [data-tag="caldo"]');
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.locator('.ing-name').first()).toHaveValue('Caldo');
    await expect(chip).toBeHidden();                                  // ya está en la receta
    await page.locator('.ing-name').first().fill('');
    await expect(chip).toBeVisible();                                 // al quitarlo vuelve a salir
  });

  test('una receta con foto: miniatura y la foto llega a Firestore', async ({ page }) => {
    await page.locator('[data-act="new"]').first().click();
    await fillDish(page, 'Tortilla', ['Huevos']);
    await page.locator('#photo-file').setInputFiles({ name: 'tortilla.png', mimeType: 'image/png', buffer: makePng(1600, 1200) });
    await expect(page.locator('#photo-pick')).toHaveText('Cambiar foto');
    await expect(page.locator('#photo-img')).toHaveAttribute('src', /^data:image\/jpeg/);
    await page.locator('#dish-save').click();

    await expect(page.locator('.card-row .thumb')).toHaveAttribute('src', /^data:image\/jpeg/);

    // Se sube a la nube (ya no queda nada pendiente) y existe el documento en Firestore
    await expect.poll(() => pendingKey(page, PENDING_PHOTOS), { timeout: 20000 }).toBeNull();
    const id = await page.evaluate(() => window.Comidas.state.dishes[0].photo);
    expect(await photoStatus(page, id)).toBe(200);

    // Sin la copia local, la foto se recupera de la nube
    await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('comidas-fotos'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
    await page.reload();
    await page.locator('.tabbar [data-screen="recetas"]').click();
    await expect(page.locator('.card-row .thumb')).toHaveAttribute('src', /^data:image\/jpeg/, { timeout: 15000 });
  });

  test('borrar una receta con foto borra la foto de la nube', async ({ page }) => {
    await page.locator('[data-act="new"]').first().click();
    await fillDish(page, 'Lentejas', ['Lentejas']);
    await page.locator('#photo-file').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: makePng(400, 300) });
    await expect(page.locator('#photo-pick')).toHaveText('Cambiar foto');
    await page.locator('#dish-save').click();
    await expect.poll(() => pendingKey(page, PENDING_PHOTOS), { timeout: 20000 }).toBeNull();
    const id = await page.evaluate(() => window.Comidas.state.dishes[0].photo);
    expect(await photoStatus(page, id)).toBe(200);

    await page.locator('.card-row').first().click();
    await page.locator('#dish-delete').click();
    await expect(page.locator('#app-confirm')).toBeVisible(); // pregunta dentro de la app, no el cuadro del navegador
    await page.locator('#app-confirm [data-act="confirm-ok"]').click();
    await expect.poll(() => pendingKey(page, PENDING_PHOTOS), { timeout: 20000 }).toBeNull();
    expect(await photoStatus(page, id)).toBe(404);
  });

  test('Hoy enseña el plato principal y el segundo, cada uno con su foto', async ({ page }) => {
    const jpg = (r, g, b) => 'data:image/jpeg;base64,' + makePng(40, 30, [r, g, b]).toString('base64'); // el contenido no importa, solo que sea una imagen
    await page.evaluate(async ({ a, b }) => {
      // Se guardan como PNG disfrazado de JPEG: basta para comprobar que se pintan
      await window.Photos.put('fotosopa00000001', a);
      await window.Photos.put('fotopech00000001', b);
    }, { a: jpg(220, 40, 40), b: jpg(40, 180, 60) });
    const extra = { id: 'pech', name: 'Pechugas' };
    await seed(page, {
      dishes: [
        { id: 'sopa', name: 'Sopa', photo: 'fotosopa00000001', ingredients: ['Caldo'] },
        { id: 'pech', name: 'Pechugas', photo: 'fotopech00000001', ingredients: ['Pollo'] }
      ],
      extras: { '0-comida': [extra], '0-cena': [extra] }
    });
    const card = page.locator('#screen-hoy .today-card');
    await expect(card.locator('.plate')).toHaveCount(2);
    await expect(card).toContainText('Sopa');
    await expect(card).toContainText('Pechugas');
    const photos = card.locator('img.plate-photo');
    await expect(photos).toHaveCount(2);
    for (const img of await photos.all()) await expect(img).toHaveAttribute('src', /^data:image/);
    await expect(card).toContainText('Caldo');
    await expect(card).toContainText('Pollo');
  });

  test('añadir un segundo plato desde Menú: se ve en la lista y en la compra, y se puede quitar', async ({ page }) => {
    await seed(page, { dishes: [{ id: 'sopa', name: 'Sopa', ingredients: ['Caldo'] }, { id: 'pech', name: 'Pechugas', ingredients: ['Pollo'] }] });
    await page.locator('.tabbar [data-screen="menu"]').click();
    const slot = page.locator('.slot[data-day="0"][data-slot="cena"]');
    await slot.click();
    await page.locator('#add-extra').click();
    await page.locator('#extra-list [data-id="pech"]').click();
    await expect(slot).toContainText('+ Pechugas');

    await page.locator('.tabbar [data-screen="compra"]').click();
    await expect(page.locator('#screen-compra')).toContainText('Pollo');

    await page.locator('.tabbar [data-screen="menu"]').click();
    await slot.click();
    await page.locator('[data-rm-extra="0"]').click();
    await expect(slot).not.toContainText('Pechugas');
  });

  test('el estado se guarda en la nube y se recupera con el navegador vacío', async ({ page }) => {
    await page.locator('[data-act="new"]').first().click();
    await fillDish(page, 'Gazpacho', ['Tomate']);
    await page.locator('#dish-save').click();
    await expect.poll(() => pendingKey(page, PENDING_STATE), { timeout: 20000 }).toBeNull();

    await page.evaluate(() => localStorage.removeItem('comidas.v1'));   // como un móvil nuevo con la misma cuenta
    await page.reload();
    await page.locator('.tabbar [data-screen="recetas"]').click();
    await expect(page.locator('.card-row').first()).toContainText('Gazpacho', { timeout: 20000 });
  });
});
