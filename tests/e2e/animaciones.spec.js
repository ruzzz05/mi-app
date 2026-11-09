// Animaciones compartidas (shared/anim.*): entrada de pantallas, avisos, récords y respeto a "reducir movimiento".
const { test, expect, freshStart } = require('./fixtures');

test.use({ viewport: { width: 390, height: 780 } });

const GYM = 'apps/gimnasio/index.html';
const GASTOS = 'apps/gastos/index.html';

const seed = page => page.evaluate(() => {
  const A = window.GymApp;
  const ids = window.GymCatalog.exercises.slice(0, 2).map(e => e.id);
  const sets = (n, reps, weight) => Array.from({ length: n }, () => ({ reps, weight }));
  A.state.routines = [{ id: 'r1', name: 'Empuje', updatedAt: 1, exercises: [{ exId: ids[0], sets: sets(2, 10, 20) }, { exId: ids[1], sets: sets(2, 8, 10) }] }];
  A.save({ touch: false });
  A.go('rutinas');
  return ids;
});

test.describe('Animaciones', () => {
  test('Gimnasio: al cambiar de pestaña la pantalla entra animada y luego queda limpia', async ({ page }) => {
    await freshStart(page, GYM);
    await seed(page);
    await page.evaluate(() => window.GymApp.go('hoy'));
    const sec = page.locator('#screen-hoy');
    await expect(sec).toHaveClass(/anim-enter/);
    await expect(sec).toHaveClass(/anim-in-l/);            // de Rutinas a Hoy: entra desde la izquierda
    await expect(sec).not.toHaveClass(/anim-enter/, { timeout: 4000 });
    await page.evaluate(() => window.GymApp.go('rutinas'));
    await expect(page.locator('#screen-rutinas')).toHaveClass(/anim-in-r/);
    expect(await page.locator('#screen-rutinas .rc.anim-rise').count()).toBeGreaterThan(0);
  });

  test('con "reducir movimiento" no se anima nada', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await freshStart(page, GYM);
    await seed(page);
    await page.evaluate(() => window.GymApp.go('hoy'));
    await expect(page.locator('#screen-hoy')).not.toHaveClass(/anim-enter/);
    expect(await page.locator('.anim-rise').count()).toBe(0);
  });

  test('el aviso lleva su barrita de tiempo ajustada a lo que dura', async ({ page }) => {
    await freshStart(page, GYM);
    await page.evaluate(() => window.GymApp.toast('Hola', 1500));
    const t = page.locator('#toast');
    await expect(t).toHaveClass(/show/);
    expect(await t.evaluate(el => el.style.getPropertyValue('--toast-ms'))).toBe('1500ms');
    await expect(t).not.toHaveClass(/show/, { timeout: 4000 });
  });

  test('la pastilla de la barra de pestañas se coloca bajo la pestaña activa', async ({ page }) => {
    await freshStart(page, GYM);
    await page.evaluate(() => window.GymApp.go('perfil'));
    await expect(page.locator('#tabbar .anim-ind')).toHaveCount(1);
    await page.waitForTimeout(700);
    const [ind, btn] = await page.evaluate(() => {
      const i = document.querySelector('#tabbar .anim-ind').getBoundingClientRect();
      const b = document.querySelector('#tabbar button.active').getBoundingClientRect();
      return [i.left, b.left];
    });
    expect(Math.abs(ind - btn)).toBeLessThan(2);
  });

  test('terminar un entreno que mejora la marca anterior enseña el récord', async ({ page }) => {
    await freshStart(page, GYM);
    const ids = await seed(page);
    await page.evaluate(ex => window.GymApp.recordSession({
      id: 'old', startedAt: Date.now() - 3 * 864e5, durationSec: 600, routineId: 'r1', routineName: 'Empuje', updatedAt: 1,
      exercises: [{ exId: ex, sets: [{ reps: 10, weight: 20, done: true }] }]
    }), ids[0]);
    await page.evaluate(() => window.GymApp.go('rutinas'));
    await page.locator('#screen-rutinas .rc .play').first().click();
    await page.locator('#screen-usar input[data-f="weight"]').first().fill('25');
    await page.locator('#screen-usar .check').first().click();
    await page.locator('#run-finish').click();
    await page.locator('#sheet [data-act="finish-ok"]').click();
    await expect(page.locator('.anim-pr')).toBeVisible();
    await expect(page.locator('.anim-pr')).toContainText('récord');
    await expect(page.locator('.anim-pr')).toContainText('25 kg × 10');
  });

  test('la primera vez que haces un ejercicio no es récord', async ({ page }) => {
    await freshStart(page, GYM);
    await seed(page);
    await page.locator('#screen-rutinas .rc .play').first().click();
    await page.locator('#screen-usar input[data-f="weight"]').first().fill('25');
    await page.locator('#screen-usar .check').first().click();
    await page.locator('#run-finish').click();
    await page.locator('#sheet [data-act="finish-ok"]').click();
    await expect(page.locator('#screen-perfil')).toBeVisible();
    await page.waitForTimeout(900);
    await expect(page.locator('.anim-pr')).toHaveCount(0);
  });

  test('Gastos: la cifra del círculo acaba con el texto de siempre tras contar', async ({ page }) => {
    await freshStart(page, GASTOS);
    await expect(page.locator('#ring-main')).toHaveText(/^\d[\d.]* €$/, { timeout: 5000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('#ring-main')).toHaveText(/^\d[\d.]* €$/);
  });
  test('al tocar un ejercicio plegado, su bloque se despliega animado', async ({ page }) => {
    await freshStart(page, GYM);
    await seed(page);
    await page.locator('#screen-rutinas .rc .play').first().click();
    await page.locator('#screen-usar .arow').first().click();
    await expect(page.locator('#screen-usar .eblock')).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector('#screen-usar .eblock').getAnimations().length)).toBeGreaterThan(0);
  });

  test('la serie nueva entra con su animación', async ({ page }) => {
    await freshStart(page, GYM);
    await seed(page);
    await page.locator('#screen-rutinas .rc .play').first().click();
    const before = await page.locator('#screen-usar .set-row').count();
    await page.locator('#screen-usar [data-act="add-set"]').click();
    await expect(page.locator('#screen-usar .set-row')).toHaveCount(before + 1);
    await expect(page.locator('#screen-usar .set-row.anim-new')).toHaveCount(1);
    // no se queda grabada en los datos guardados
    expect(await page.evaluate(() => JSON.stringify(window.GymApp.state)).then(s => s.includes('anim'))).toBe(false);
  });

  test('subir o bajar un ejercicio desplaza las filas hasta su sitio (entreno y editor)', async ({ page }) => {
    await freshStart(page, GYM);
    await seed(page);
    await page.locator('#screen-rutinas .rc .play').first().click();
    const firstName = await page.locator('#screen-usar .eblock .ex-name').textContent();
    await page.locator('#screen-usar [aria-label="Bajar ejercicio"]').click();
    expect(await page.evaluate(() => [...document.querySelectorAll('#screen-usar [data-k]')].some(e => e.getAnimations().length > 0))).toBe(true);
    await expect(page.locator('#screen-usar .eblock .ex-name')).toHaveText(firstName);   // sigue abierto el mismo
    await page.evaluate(() => { window.GymApp.go('rutinas'); window.GymApp.editRoutine('r1'); });
    await page.locator('#screen-editar [aria-label="Bajar ejercicio"]').first().click();
    expect(await page.evaluate(() => [...document.querySelectorAll('#screen-editar [data-k]')].some(e => e.getAnimations().length > 0))).toBe(true);
  });

  test('Mi-Menu: marcar un producto lo tacha con animación y luego pasa a Comprados', async ({ page }) => {
    await freshStart(page, 'apps/comidas/index.html');
    await page.evaluate(() => {
      const C = window.Comidas, d = new Date(), pad = n => String(n).padStart(2, '0');
      const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const e = { id: 'sopa', name: 'Sopa' };
      C.state.dishes = [{ id: 'sopa', name: 'Sopa', ingredients: [{ name: 'Caldo', qty: 1 }, { name: 'Fideos', qty: 1 }] }];
      C.state.menu = { startDate: today, firstMeal: 'comida', days: 2, exclusions: [], plan: { '0-comida': e, '0-cena': e, '1-comida': e, '1-cena': e }, extras: {} };
      C.save();
      C.go('compra');
    });
    await expect(page.locator('#screen-compra [data-check]').first()).toBeVisible();
    await page.locator('#screen-compra [data-check]').first().check();
    await expect(page.locator('#screen-compra .buy.marking')).toHaveCount(1);
    await expect(page.locator('#screen-compra details.bought')).toHaveCount(1, { timeout: 4000 });
    await expect(page.locator('#screen-compra .buy.marking')).toHaveCount(0);
  });

  test('el punto de sincronización late mientras sincroniza y parpadea si falla', async ({ page }) => {
    await freshStart(page, GYM);
    const anim = (state, pseudo) => page.evaluate(([s, p]) => {
      const b = document.getElementById('sync-badge');
      b.setAttribute('data-state', s);
      return getComputedStyle(b, p).animationName;
    }, [state, pseudo]);
    expect(await anim('syncing', '::after')).toBe('anim-ring');
    expect(await anim('error', '::before')).toBe('anim-blink');
    expect(await anim('ok', '::after')).toBe('none');
  });

  test('Hoy enseña esqueleto mientras carga Google Health y luego los datos suben en cascada', async ({ page }) => {
    await freshStart(page, GYM);
    await page.evaluate(() => {
      const A = window.GymApp;
      A.health.state = () => ({ kind: 'cargando', summary: null, missing: [], healthErrors: {}, connected: true });
      A.go('hoy');
    });
    await expect(page.locator('#screen-hoy .sk-l').first()).toBeVisible();
    await expect(page.locator('#screen-hoy .tiles3 b')).toHaveCount(0);
    await page.evaluate(() => {
      const A = window.GymApp;
      A.health.state = () => ({ kind: 'datos', summary: { steps: 6420, distance: 4.8, active: 312, at: Date.now() }, missing: [], healthErrors: {}, connected: true });
      A.render();
    });
    await expect(page.locator('#screen-hoy .sk-l')).toHaveCount(0);
    await expect(page.locator('#screen-hoy .tiles3 > div.anim-rise')).toHaveCount(3);
  });
});
