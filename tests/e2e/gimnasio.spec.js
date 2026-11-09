// Gimnasio con el diseño nuevo: Hoy en este orden (sincronización, pasos/distancia/kcal activas, entreno de hoy,
// recuperación), rutinas con los botones al lado, entreno con lista desplegable y campos para escribir decimales.
const { test, expect, freshStart } = require('./fixtures');

const APP = 'apps/gimnasio/index.html';
test.use({ viewport: { width: 390, height: 780 } });

// Rutinas de ejemplo con ejercicios del catálogo
const seedRoutines = page => page.evaluate(() => {
  const A = window.GymApp;
  const ids = window.GymCatalog.exercises.slice(0, 4).map(e => e.id);
  const sets = (n, reps, weight) => Array.from({ length: n }, () => ({ reps, weight }));
  A.state.routines = [
    { id: 'r1', name: 'Empuje', updatedAt: 1, exercises: [{ exId: ids[0], sets: sets(3, 10, 20) }, { exId: ids[1], sets: sets(2, 8, 0) }, { exId: ids[2], sets: sets(2, 12, 5) }] },
    { id: 'r2', name: 'Tirón', updatedAt: 1, exercises: [{ exId: ids[3], sets: sets(3, 10, 30) }] }
  ];
  A.save({ touch: false });
  A.go('rutinas');
  return ids;
});

// Datos de Google Health ya guardados (frescos: no hace falta red) y la sesión de Google "vigente"
const seedHealth = async page => {
  await page.evaluate(() => {
    const today = window.Gym.dayOf(Date.now());
    const scope = ['activity_and_fitness', 'sleep', 'health_metrics_and_measurements'].map(s => 'https://www.googleapis.com/auth/googlehealth.' + s + '.readonly').join(' ');
    localStorage.setItem('gimnasio.google.token', JSON.stringify({ token: 'x', exp: Date.now() + 3600e3, scope }));
    localStorage.setItem('gimnasio.google.connected', 'true');
    localStorage.setItem('gimnasio.hoy', JSON.stringify({ day: today, at: Date.now(), steps: 6420, total: 2100, active: 312, distance: 4.8 }));
    localStorage.setItem('gimnasio.salud', JSON.stringify({ at: Date.now(), errors: {}, days: { sleep: { [today]: { minutesAsleep: 432 } }, rhr: { [today]: 54 }, hrv: { [today]: 63 }, steps: {} } }));
  });
  await page.reload();
  await expect(page.locator('#screen-hoy')).toBeVisible();
};

test.describe('Gimnasio', () => {
  test.beforeEach(async ({ page }) => { await freshStart(page, APP); });

  test('quitar un ejercicio de una rutina pide confirmación', async ({ page }) => {
    await seedRoutines(page);
    await page.evaluate(() => window.GymApp.editRoutine('r1'));
    const n = () => page.evaluate(() => document.querySelectorAll('#screen-editar .eblock').length);
    expect(await n()).toBe(3);
    await page.locator('#screen-editar [aria-label="Quitar ejercicio"]').first().click();
    await expect(page.locator('#sheet [data-act="remove-ok"]')).toBeVisible();
    await page.locator('#sheet .btn.ghost').click(); // Cancelar
    expect(await n()).toBe(3);
    await page.locator('#screen-editar [aria-label="Quitar ejercicio"]').first().click();
    await page.locator('#sheet [data-act="remove-ok"]').click();
    expect(await n()).toBe(2);
  });

  test('Hoy: sincronización pequeña, pasos / distancia / kcal activas, entreno de hoy y recuperación, en ese orden', async ({ page }) => {
    await seedHealth(page);
    const order = await page.evaluate(() => ['#gy-sync', '.tiles3', '#wk-card', '.rec'].map(s => {
      const el = document.querySelector('#screen-hoy ' + s); return el ? el.getBoundingClientRect().top : null;
    }));
    expect(order.every(v => v !== null)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // de arriba abajo
    const tiles = page.locator('.tiles3');
    await expect(tiles).toContainText('pasos');
    await expect(tiles).toContainText('4,8');
    await expect(tiles).toContainText('km');
    await expect(tiles).toContainText('312');
    await expect(tiles).toContainText('kcal activas');
    await expect(tiles).not.toContainText('kcal totales');
    await expect(page.locator('#gy-sync')).toContainText('Google Health');
    await expect(page.locator('.rec')).toContainText('7 h 12 min');
  });

  test('Hoy sin entreno ofrece elegir una rutina y con entreno hecho lo resume', async ({ page }) => {
    await seedHealth(page);
    await expect(page.locator('#wk-card')).toContainText('aún no has entrenado');
    await page.locator('#wk-card [data-go="rutinas"]').click();
    await expect(page.locator('#screen-rutinas')).toBeVisible();
  });

  test('Rutinas: tarjetas con ▶ y tres puntos al lado; el menú ofrece editar, compartir y borrar', async ({ page }) => {
    await seedRoutines(page);
    await expect(page.locator('#screen-rutinas .rc')).toHaveCount(2);
    await expect(page.locator('#screen-rutinas .rc').first()).toContainText('Empuje');
    await expect(page.locator('#screen-rutinas .rc').first()).toContainText('3 ejercicios');
    await page.locator('#screen-rutinas .rc .more').first().click();
    await expect(page.locator('#sheet [data-act="edit"]')).toBeVisible();
    await expect(page.locator('#sheet [data-act="share"]')).toBeVisible();
    await page.locator('#sheet [data-act="delete"]').click();
    await page.locator('#sheet [data-act="delete-ok"]').click();
    await expect(page.locator('#screen-rutinas .rc')).toHaveCount(1);
    await expect(page.locator('#screen-rutinas .rc')).toContainText('Tirón');
  });

  test('Rutinas: editar abre el editor y guardar cambia el nombre', async ({ page }) => {
    await seedRoutines(page);
    await page.locator('#screen-rutinas .rc .more').first().click();
    await page.locator('#sheet [data-act="edit"]').click();
    await page.locator('#routine-name').fill('Empuje fuerte');
    await page.getByRole('button', { name: 'Guardar rutina' }).click();
    await expect(page.locator('#screen-rutinas .rc').first()).toContainText('Empuje fuerte');
  });

  test('Entreno: lista desplegable, decimales con coma, marcar series y terminar guarda el entreno', async ({ page }) => {
    await seedRoutines(page);
    await page.locator('#screen-rutinas .rc .play').first().click();
    await expect(page.locator('#screen-usar')).toBeVisible();
    await expect(page.locator('#screen-usar .eblock')).toHaveCount(1);          // solo el ejercicio abierto
    await expect(page.locator('#screen-usar .arow')).toHaveCount(2);            // los otros, plegados
    await page.locator('#screen-usar input[data-f="weight"]').first().fill('62,5');
    await page.locator('#screen-usar .check').first().click();
    await page.locator('#screen-usar .arow').first().click();                    // abre el siguiente
    await expect(page.locator('#screen-usar .eblock')).toHaveCount(1);
    await expect(page.locator('#screen-usar .arow')).toHaveCount(2);
    await page.locator('#run-finish').click();
    await page.locator('#sheet [data-act="finish-ok"]').click();                 // quedaban series sin marcar
    await expect(page.locator('#screen-perfil')).toBeVisible();
    await expect(page.locator('#screen-perfil .hist-row').first()).toContainText('Empuje');
    const saved = await page.evaluate(() => window.GymApp.allSessions().map(s => s.exercises[0].sets[0].weight));
    expect(saved).toEqual([62.5]);
  });

  test('Entreno: añadir una serie, quitar un ejercicio y descartar', async ({ page }) => {
    await seedRoutines(page);
    await page.locator('#screen-rutinas .rc .play').nth(1).click();
    const sets = page.locator('#screen-usar .set-row');
    await expect(sets).toHaveCount(3);
    await page.locator('#screen-usar [data-act="add-set"]').click();
    await expect(sets).toHaveCount(4);
    await page.locator('#run-discard').click();
    await page.locator('#sheet [data-act="discard-ok"]').click();
    await expect(page.locator('#screen-rutinas')).toBeVisible();
    expect(await page.evaluate(() => window.GymApp.hasActive())).toBe(false);
  });

  test('Perfil: calendario, mis entrenos, esfuerzo por músculo, evolución y salud', async ({ page }) => {
    await page.evaluate(() => {
      const A = window.GymApp, G = window.Gym, ids = window.GymCatalog.exercises.slice(0, 2).map(e => e.id);
      const now = Date.now();
      [3, 1].forEach((d, i) => A.recordSession({ id: 's' + i, startedAt: now - d * 86400000, routineName: 'Empuje', durationSec: 3000, updatedAt: now, exercises: [{ exId: ids[0], sets: [{ reps: 10, weight: 20 + i * 5, done: true }] }] }));
      A.go('perfil');
    });
    await expect(page.locator('#screen-perfil .tile')).toHaveCount(3);
    await expect(page.locator('#screen-perfil .cal')).toBeVisible();
    await expect(page.locator('#screen-perfil .hist-row')).toHaveCount(2);
    await expect(page.locator('#screen-perfil .mus-row').first()).toBeVisible();
    await expect(page.locator('#screen-perfil select')).toBeVisible();
    await expect(page.locator('#screen-perfil .chart').first()).toBeVisible();
    await page.locator('#screen-perfil .hist-del').first().click();
    await page.locator('#sheet [data-act="delete-ok"]').click();
    await expect(page.locator('#screen-perfil .hist-row')).toHaveCount(1);
  });

  test('no hay desbordamiento horizontal en ninguna pantalla', async ({ page }) => {
    await seedRoutines(page);
    for (const s of ['hoy', 'rutinas', 'perfil']) {
      await page.locator(`#tabbar [data-screen="${s}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    }
  });
});
