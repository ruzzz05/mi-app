# Categoría recordada por comercio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En Gastos, cada comercio tiene una sola categoría: la última elegida. Los gastos nuevos la heredan y elegir otra reescribe todos los gastos de ese comercio.

**Architecture:** Tres funciones puras en `apps/gastos/gastoscore.js` deducen y aplican la categoría a partir de la lista de gastos (sin estado nuevo). La interfaz (`core.js`, `screens/auto.js`, `screens/resumen.js`) las llama al apuntar, confirmar, recibir y editar.

**Tech Stack:** JavaScript sin dependencias; tests de lógica con `bash tests/run.sh` (`test`/`assert.eq`, global `Planner`); e2e con Playwright (`npm run e2e`).

**Spec:** `docs/superpowers/specs/2026-11-09-categoria-recordada-design.md`

## Global Constraints

- Solo se toca `apps/gastos`, `tests/e2e/gastos.spec.js`, `shared/version.js` (`0.8.22` → `0.8.23`) y `sw.js` (`VERSION` `v81` → `v82`).
- **Sin commits ni push**: el usuario los hace a mano. Ningún paso hace `git commit`.
- TDD: test primero, verlo fallar, suite completa antes de dar nada por hecho.
- Comentarios y textos en español, estilo del archivo. No borrar comentarios existentes.
- Mismo comercio = nombre igual tras `fold`, `trim` y espacios repetidos colapsados.
- Los cobros de suscripción (`source: 'sub'`) siguen entrando como «Suscripciones» (`applySubs` no cambia).

## Review Focus

- Nombres genéricos `'Gasto'` y `'Pago con tarjeta'` (los que pone la app si no hay comercio): no son un comercio; ni se recuerdan ni se reescriben en bloque. Test en Task 1.
- Categoría recordada que ya no existe en la lista: se trata como desconocida (`null`). Test en Task 1.
- Un pago por revisar no enseña categoría (aún no la eligió el usuario), pero sí se reescribe si el usuario elige categoría para su comercio. Test en Task 1.
- Un cobro de suscripción más reciente (`source: 'sub'`, «Suscripciones») no pisa la categoría que el usuario dio al comercio. Test en Task 1.
- Dos gastos del mismo comercio el mismo día: manda el que está antes en la lista (la lista guarda primero lo más nuevo). Test en Task 1.

---

### Task 1: Lógica pura

**Files:**
- Modify: `apps/gastos/gastoscore.js` (sección «categorías», y añadir los tres nombres a `api`)
- Test: `apps/gastos/tests/recordar.test.js` (nuevo; mismo estilo que `mes.test.js`: `const M = Planner;`)

**Interfaces:**
- Produces:
  - `rememberedCategory(expenses, merchant, categories) -> string | null` — categoría del gasto del mismo comercio con fecha más reciente, ignorando los `pending` y los `source === 'sub'`; a igual fecha, el primero de la lista. `null` si no hay, si el nombre es genérico/vacío o si la categoría no está en `categories`.
  - `setMerchantCategory(expenses, merchant, category) -> expenses` — lista nueva con `category` en todos los gastos del mismo comercio (también `pending` y `sub`; no toca `pending`). Nombre genérico/vacío: devuelve la misma lista.
  - `applyRemembered(expenses, incoming, categories) -> expense` — si el comercio de `incoming` tiene categoría recordada, devuelve `incoming` con esa categoría y sin la propiedad `pending`; si no, `incoming` tal cual.

- [ ] **Step 1: Escribir los tests que fallan** en `recordar.test.js`, con `const ex = (merchant, category, date, extra = {}) => ({ id: merchant + date, amount: 1, merchant, category, date, ...extra });` y `const CATS = ['Supermercado', 'Ocio', 'Suscripciones', 'Otros'];`

```js
test('recuerda la categoría del gasto más reciente del comercio, aunque solo haya uno', () => {
  assert.eq(M.rememberedCategory([ex('Bar Pepe', 'Ocio', '2026-11-01')], 'bar  pépe ', CATS), 'Ocio');
  assert.eq(M.rememberedCategory([ex('Bar Pepe', 'Otros', '2026-10-01'), ex('Bar Pepe', 'Ocio', '2026-11-01')], 'Bar Pepe', CATS), 'Ocio');
  assert.eq(M.rememberedCategory([ex('Bar Pepe', 'Ocio', '2026-11-01'), ex('Bar Pepe', 'Otros', '2026-11-01', { id: 'b' })], 'Bar Pepe', CATS), 'Ocio');
});
test('no recuerda: comercio distinto, sin historial, genérico, categoría borrada, por revisar o cobro de suscripción', () => {
  assert.eq(M.rememberedCategory([ex('Bar Pepe', 'Ocio', '2026-11-01')], 'Bar Pepe Centro', CATS), null);
  assert.eq(M.rememberedCategory([], 'Bar Pepe', CATS), null);
  assert.eq(M.rememberedCategory([ex('Gasto', 'Ocio', '2026-11-01')], 'Gasto', CATS), null);
  assert.eq(M.rememberedCategory([ex('Pago con tarjeta', 'Ocio', '2026-11-01')], 'pago con tarjeta', CATS), null);
  assert.eq(M.rememberedCategory([ex('Bar Pepe', 'Viajes', '2026-11-01')], 'Bar Pepe', CATS), null);
  assert.eq(M.rememberedCategory([ex('Bar Pepe', 'Ocio', '2026-11-01', { pending: true })], 'Bar Pepe', CATS), null);
  assert.eq(M.rememberedCategory([ex('Netflix', 'Suscripciones', '2026-11-05', { source: 'sub' }), ex('Netflix', 'Ocio', '2026-10-05')], 'Netflix', CATS), 'Ocio');
});
test('setMerchantCategory cambia todos los gastos del comercio y ningún otro', () => {
  const list = [ex('Bar Pepe', 'Otros', '2026-11-01'), ex('BAR PEPE', 'Ocio', '2026-09-01', { pending: true }), ex('Cine', 'Ocio', '2026-11-01')];
  const out = M.setMerchantCategory(list, 'bar pepe', 'Supermercado');
  assert.eq(out.map(e => e.category), ['Supermercado', 'Supermercado', 'Ocio']);
  assert.eq(out[1].pending, true);
  assert.eq(list[0].category, 'Otros'); // no modifica la lista original
  const gen = [ex('Gasto', 'Otros', '2026-11-01'), ex('Gasto', 'Ocio', '2026-11-02')];
  assert.eq(M.setMerchantCategory(gen, 'Gasto', 'Ocio').map(e => e.category), ['Otros', 'Ocio']);
});
test('applyRemembered: un pago de comercio conocido entra con su categoría y sin revisar', () => {
  const hist = [ex('Bar Pepe', 'Ocio', '2026-11-01')];
  const a = M.applyRemembered(hist, ex('Bar Pepe', 'Otros', '2026-11-09', { pending: true }), CATS);
  assert.eq([a.category, 'pending' in a], ['Ocio', false]);
  const b = M.applyRemembered(hist, ex('Zara', 'Otros', '2026-11-09', { pending: true }), CATS);
  assert.eq([b.category, b.pending], ['Otros', true]);
});
```

- [ ] **Step 2: Verlos fallar.** Run: `bash tests/run.sh` — Expected: los 4 tests nuevos fallan (`rememberedCategory is not a function` o similar); el resto pasa.
- [ ] **Step 3: Implementar** las tres funciones en `gastoscore.js` con un ayudante interno `merchantId(name)` (`fold`, `trim`, espacios colapsados; `''` si el resultado es `'gasto'` o `'pago con tarjeta'`). Exportarlas en `api`.
- [ ] **Step 4: Verlos pasar.** Run: `bash tests/run.sh` — Expected: todo en verde.

### Task 2: Interfaz

**Files:**
- Modify: `apps/gastos/core.js` (`openExpenseSheet`, `addIncoming`)
- Modify: `apps/gastos/screens/auto.js` (confirmar)
- Modify: `apps/gastos/screens/resumen.js` (`openEditDate`)
- Modify: `shared/version.js`, `sw.js`
- Test: `tests/e2e/gastos.spec.js`

**Interfaces:**
- Consumes: `P.rememberedCategory`, `P.setMerchantCategory`, `P.applyRemembered` de Task 1.

- [ ] **Step 1: Escribir los e2e que fallan** dentro de `test.describe('Gastos')`:

```js
test('un comercio ya apuntado recuerda su categoría, y cambiarla reescribe sus gastos', async ({ page }) => {
  await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Bar Pepe', category: 'Ocio', amount: 5, date: ctx.prevMonth(3) }] }));
  await page.locator('#dock-add').click();
  await page.locator('#ex-amount').fill('7');
  await page.locator('#ex-merchant').fill('bar pepe');
  await expect(page.locator('#ex-cats .on')).toHaveText('Ocio');
  await page.locator('#ex-cats [data-cat="Restaurantes"]').click();
  await page.locator('#ex-save').click();
  expect(await page.evaluate(() => window.Gastos.state.expenses.map(e => e.category))).toEqual(['Restaurantes', 'Restaurantes']);
});

test('editar la categoría de un gasto cambia todos los de ese comercio', async ({ page }) => {
  await seedFn(page, ctx => ({ expenses: [
    { id: 'a', merchant: 'Bar Pepe', category: 'Otros', amount: 5, date: ctx.today },
    { id: 'b', merchant: 'Bar Pepe', category: 'Otros', amount: 5, date: ctx.prevMonth(3) },
    { id: 'c', merchant: 'Cine', category: 'Otros', amount: 9, date: ctx.prevMonth(4) }] }));
  await page.locator('.mv').first().click();
  await page.locator('#ed-cats [data-cat="Restaurantes"]').click();
  await page.locator('#ed-save').click();
  expect(await page.evaluate(() => window.Gastos.state.expenses.map(e => e.category))).toEqual(['Restaurantes', 'Restaurantes', 'Otros']);
});

test('un pago automático de un comercio conocido entra directo con su categoría', async ({ page }) => {
  await seedFn(page, ctx => ({ expenses: [{ id: 'a', merchant: 'Bar Pepe', category: 'Ocio', amount: 5, date: ctx.prevMonth(3) }] }));
  await page.goto('apps/gastos/index.html?pago=10&comercio=Bar%20Pepe');
  await expect(page.locator('#dock [data-screen="auto"] .badge')).toBeHidden();
  await expect(page.locator('#ring-main')).toHaveText(/990/);
  expect(await page.evaluate(() => window.Gastos.state.expenses[0].category)).toBe('Ocio');
});
```

- [ ] **Step 2: Verlos fallar.** Run: `npm run e2e -- gastos.spec.js` — Expected: fallan los 3 nuevos; el resto pasa.
- [ ] **Step 3: `core.js`**
  - `openExpenseSheet`: mientras el usuario no haya tocado una categoría, cada `input` del comercio marca `P.rememberedCategory(...)`, o si no la de `guessCategory` distinta de «Otros», o ninguna. Al guardar, tras `addExpense`, `G.state.expenses = P.setMerchantCategory(G.state.expenses, merchant, categoríaFinal)` y un solo `G.save()`.
  - `addIncoming`: cada pago pasa por `P.applyRemembered(ex, e, G.CATEGORIES)` antes de `G.normalize`. En `takePaymentFromUrl` el aviso dice `'Pago apuntado: '` si el pago ya no está `pending`.
- [ ] **Step 4: `screens/auto.js`**: tras `confirmPending`, aplicar `P.setMerchantCategory` con el comercio del pago y la categoría elegida.
- [ ] **Step 5: `screens/resumen.js`**: `openEditDate` pasa a título `'Editar gasto'` y añade bajo la fecha `<div class="cats" id="ed-cats">` con los mismos botones `data-cat` que la hoja de gasto nuevo, marcado (`.on`) el de la categoría actual. Guardar: fecha como hoy; si la categoría cambió, `P.setMerchantCategory`; para un nombre genérico (la función no cambia nada) se cambia solo ese gasto. Aviso `'Gasto actualizado'`. Actualizar el comentario `// Tocar un gasto deja cambiarle la fecha` para incluir la categoría.
- [ ] **Step 6: Versiones**: `shared/version.js` → `'0.8.23'`; `sw.js` `VERSION` → `'v82'`.
- [ ] **Step 7: Verificar todo.** Run: `bash tests/run.sh` y `npm run e2e` — Expected: todo en verde, incluido el test existente «tocar un gasto deja cambiarle la fecha».
