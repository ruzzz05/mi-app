// Uso sin conexión: con el service worker activo y la red cortada, las apps abren con sus datos
// y lo editado sin red se sube solo al volver la conexión.
const { test, expect, freshStart, openApp, setOffline } = require('./fixtures');

test.use({ serviceWorkers: 'allow' });

const COMIDAS = 'apps/comidas/index.html';
const remoteJson = page => page.evaluate(async () => {
  const A = window.MiAuth;
  const token = await A.auth.currentUser.getIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/mi-app-490b5/databases/(default)/documents/users/${A.auth.currentUser.uid}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) return null;
  const doc = await res.json();
  return doc.fields && doc.fields.json ? doc.fields.json.stringValue : null;
});

// Espera a que el service worker esté activo y haya guardado los archivos de la app
async function waitForOffline(page, sample) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(async f => {
    for (const k of await caches.keys()) { if (await (await caches.open(k)).match(location.origin + '/mi-app/' + f, { ignoreSearch: true })) return true; }
    return false;
  }, sample), { timeout: 30000 }).toBe(true);
}

test('Mi-Menu abre sin conexión con sus recetas', async ({ page, context }) => {
  await freshStart(page, COMIDAS);
  await page.evaluate(() => {
    const C = window.Comidas;
    C.state.dishes = [{ id: 'sopa', name: 'Sopa de prueba', ingredients: [{ name: 'Caldo', qty: 1 }] }];
    C.save(); C.go('recetas');
  });
  await waitForOffline(page, 'apps/comidas/screens/menu.js');

  await setOffline(context, true);
  await page.reload();
  await expect(page.locator('.topbar .title')).toHaveText('Mi-Menu');
  await page.locator('.tabbar [data-screen="recetas"]').click();
  await expect(page.locator('.card-row').first()).toContainText('Sopa de prueba');
});

test('Mi-Menu: lo editado sin conexión se sube solo al volver la red', async ({ page, context }) => {
  await freshStart(page, COMIDAS);
  await waitForOffline(page, 'apps/comidas/screens/menu.js');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pending-sync.comidas'))).toBeNull();

  await setOffline(context, true);
  await page.reload();
  await page.locator('.tabbar [data-screen="recetas"]').click();
  await page.locator('[data-act="new"]').first().click();
  await page.locator('#dish-name').fill('Receta sin red');
  await page.locator('.ing-name').first().fill('Sal');
  await page.locator('#dish-save').click();
  await expect(page.locator('.card-row').first()).toContainText('Receta sin red');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pending-sync.comidas'))).toBe('1');   // queda pendiente

  await setOffline(context, false);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pending-sync.comidas')), { timeout: 30000 }).toBeNull();
  expect(await remoteJson(page)).toContain('Receta sin red');
});

test('Mi-Menu: una foto añadida sin conexión se sube al volver la red', async ({ page, context }) => {
  const { makePng } = require('./fixtures');
  await freshStart(page, COMIDAS);
  await waitForOffline(page, 'apps/comidas/photos.js');

  await setOffline(context, true);
  await page.reload();
  await page.locator('.tabbar [data-screen="recetas"]').click();
  await page.locator('[data-act="new"]').first().click();
  await page.locator('#dish-name').fill('Con foto sin red');
  await page.locator('#photo-file').setInputFiles({ name: 'f.png', mimeType: 'image/png', buffer: makePng(300, 200) });
  await expect(page.locator('#photo-pick')).toHaveText('Cambiar foto');
  await page.locator('#dish-save').click();
  await expect(page.locator('.card-row .thumb')).toHaveAttribute('src', /^data:image/);      // se ve sin red
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pending-photos.comidas'))).not.toBeNull();

  await setOffline(context, false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pending-photos.comidas')), { timeout: 30000 }).toBeNull();
});

for (const [nombre, ruta, marca] of [
  ['Gimnasio', 'apps/gimnasio/index.html', '#tabbar'],
  ['Vinilos', 'apps/vinilos/index.html', '#wall']
]) {
  test(`${nombre} abre sin conexión`, async ({ page, context }) => {
    await openApp(page, ruta);
    await waitForOffline(page, ruta);
    await page.waitForTimeout(1500);   // da tiempo a que se guarde el resto de archivos
    await setOffline(context, true);
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.reload();
    await expect(page.locator(marca)).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.topbar .title')).toBeVisible();
    expect(errores).toEqual([]);
  });
}
