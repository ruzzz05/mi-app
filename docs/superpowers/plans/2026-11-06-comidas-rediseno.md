# Comidas: rediseño del flujo — Implementation Plan

> **Cambio posterior (el usuario):** se eliminó el complemento. No hay tipo de plato ni segundo plato por comida; la Task 3 no se ejecuta. Los huecos son `{ id, name }` y las cantidades de ingrediente se mantienen: la lista suma la cantidad por cada aparición del plato en el menú. Donde el plan diga principal/complemento, `kind` o `side`, ignorarlo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recetas propias con cantidades y tipo (principal/complemento), menú de N días con borrador, pantalla Hoy y lista de la compra automática, todo editable.

**Architecture:** La lógica pura se reparte en módulos pequeños que se suman a `window.Planner` (recipes, planner, shopping, schedule) y se prueban con TDD en Edge sin interfaz. La interfaz se reparte en un núcleo (`core.js`) y una pantalla por archivo que se registran en `window.Comidas`.

**Tech Stack:** JavaScript sin dependencias ni compilación, HTML/CSS, `localStorage`, tests con `tests/harness.js` y `bash tests/run.sh`.

**Spec:** `docs/superpowers/specs/2026-11-06-comidas-rediseno-design.md`

## Global Constraints

- **Nunca hacer `git commit` ni `git push`** (el usuario los hace). Ningún paso del plan los incluye.
- Solo comida y cena; sin desayunos.
- Corte de la comida: antes de las 17:00 toca comida; desde las 17:00, cena.
- Propuesta de inicio al crear menú: antes de las 17:00, hoy día completo; de 17:00 a 21:59, hoy desde la cena; desde las 22:00, mañana. El usuario puede cambiarla.
- Días del menú: de 1 a 14, por defecto 7. El día de inicio cuenta como día 1 aunque solo tenga cena.
- Cantidades con coma o punto al escribir; en pantalla con coma (1,5).
- Ingrediente principal de una receta: el de mayor cantidad (empate: el primero).
- Pesos de la puntuación: plato repetido 1000, mismo ingrediente principal en las 3 comidas anteriores o siguientes 100, ingrediente compartido con comidas cercanas 10 cada uno, compartido con el resto del menú 1 cada uno.
- Sin cuentas ni sincronización; datos en `localStorage` clave `comidas.v1`.
- Estilo existente: blanco cálido y amarillo, siempre claro (`comidas.css`); sin emojis; textos en español.
- Subir `VERSION` en `sw.js` al terminar y actualizar `README.md` y `apps.json`.

## Review Focus

1. Menos recetas que huecos (o ninguna principal): se repite solo si no queda otra; sin principales no se genera menú y la pantalla lo explica en vez de romperse.
2. Menú de 1 día que empieza por la cena: un solo hueco, sin comida.
3. Límites de hora y fecha: 16:59 comida, 17:00 cena, 21:59 hoy cena, 22:00 mañana, cambio de día, menú ya terminado y menú que empieza en el futuro.
4. Cantidades mal escritas ("abc", "0", "-1", vacío) se rechazan; "1,5" y "1.5" valen igual; los datos antiguos con ingredientes de texto se migran.
5. Hay recetas de complemento pero ninguna principal, o recetas sin ingredientes: sin errores y sin huecos inventados.

---

## File Structure

- Create `apps/comidas/recipes.js`: cantidades, ingredientes, platos, migración del estado guardado.
- Modify `apps/comidas/planner.js`: solo generación, exclusiones, edición y puntuación (se le quita la lista de la compra y `parseDishList`).
- Create `apps/comidas/shopping.js`: lista de la compra (movida desde `planner.js`).
- Create `apps/comidas/schedule.js`: hora, inicio propuesto y vista de Hoy.
- Create `apps/comidas/core.js`, `screens/recetas.js`, `screens/menu.js`, `screens/hoy.js`, `screens/compra.js`, `main.js`; delete `comidas.js`.
- Modify `apps/comidas/index.html`, `comidas.css`.
- Tests en `apps/comidas/tests/`: `recipes.test.js`, `planner.test.js` (migrar), `shopping.test.js`, `schedule.test.js`; `planner.test.html` carga todos los módulos y tests.
- Todos los módulos de lógica terminan con: `root.Planner = Object.assign(root.Planner || {}, api)` (y `module.exports` si existe).

**Modelo de datos**
- Plato: `{ id, name, kind: 'principal'|'complemento', ingredients: [{ name, qty }] }`
- Hueco del plan, clave `"<dia>-<comida|cena>"` (día desde 0): `{ id, name, side: { id, name } | null }`
- Menú: `{ startDate: 'YYYY-MM-DD', firstMeal: 'comida'|'cena', days, plan, exclusions }`
- Exclusión (sin cambios): `{ scope: 'menu'|'day', day?, dishId? | ingredient? }` (`'menu'` sustituye a `'week'`).
- Estado guardado: `{ dishes, draft: Menu|null, menu: Menu|null, list }`

---

### Task 1: recipes.js (cantidades, platos, migración)

**Files:**
- Create: `apps/comidas/recipes.js`, `apps/comidas/tests/recipes.test.js`
- Modify: `apps/comidas/tests/planner.test.html` (cargar `recipes.js` y `recipes.test.js`)

**Interfaces:**
- Produces:
  - `parseQty(text: string): number | null`
  - `formatQty(n: number): string`
  - `ingredientsOf(dish): { key: string, name: string, qty: number }[]`
  - `normalizeDish(raw): Dish`
  - `mainIngredient(dish): string | null`
  - `migrateState(raw: object | null): State`

- [ ] **Step 1: Write failing tests** en `recipes.test.js`:
  - `parseQty('1,5') === 1.5`, `parseQty('1.5') === 1.5`, `parseQty(' 2 ') === 2`; `parseQty('abc'`, `'0'`, `'-1'`, `''` → `null`.
  - `formatQty(2) === '2'`, `formatQty(1.5) === '1,5'`, `formatQty(0.25) === '0,25'`.
  - `ingredientsOf` acepta `'Tomate'` (→ `{key:'tomate', name:'Tomate', qty:1}`) y `{name:' Pollo ', qty:2}`; descarta nombres vacíos.
  - `normalizeDish({name:'A', ingredients:['x']})` → `kind:'principal'`, `ingredients:[{name:'x', qty:1}]`, con `id` no vacío; conserva `kind:'complemento'` y el `id` si vienen.
  - `mainIngredient`: pollo 2 + tomate 1 → `'pollo'`; empate → el primero; sin ingredientes → `null`.
  - `migrateState(null)` → `{dishes:[], draft:null, menu:null, list: emptyList}`; con `{dishes:[{id,name,ingredients:['a','b']}], plan:{...}, checked:{a:true}}` → platos normalizados, `menu:null`, `draft:null`, `list.checked` conservado (el plan antiguo se descarta).
- [ ] **Step 2: Run** `bash tests/run.sh` → los tests nuevos FALLAN (funciones inexistentes); los 41 anteriores pasan.
- [ ] **Step 3: Implement** las funciones en `recipes.js` (`migrateState` usa `emptyList` que se define aquí como `{ removed: [], extras: [], checked: {} }` y se exporta; `planner.js` pasará a usar esa).
- [ ] **Step 4: Run** → todo en verde.

### Task 2: API basada en menú (días variables y primer hueco)

**Files:**
- Modify: `apps/comidas/planner.js`, `apps/comidas/tests/planner.test.js`

**Interfaces:**
- Consumes: `ingredientsOf` (Task 1) para que `matches()` de exclusiones por ingrediente lea `{name,qty}` y texto.
- Produces:
  - `slotKeys({ days, firstMeal = 'comida' }): string[]` (orden cronológico; con `firstMeal:'cena'` falta `0-comida`)
  - `newMenu({ dishes, days, startDate, firstMeal, exclusions = [], rng }): Menu` (rellena el plan)
  - `fillMenu({ dishes, menu, rng }): Menu` (rellena solo huecos vacíos)
  - `excludeAndReplace({ dishes, menu, exclusion, rng }): Menu`
  - `rerollSlot({ dishes, menu, day, slot, rng }): Menu`
  - `regenerateDay({ dishes, menu, day, rng }): Menu`
  - `isAllowed(dish, day, exclusions): boolean`
  - Todas devuelven menús nuevos sin mutar el recibido. `generateWeek` desaparece.

- [ ] **Step 1: Migrar los tests existentes** de `generateWeek`, `excludeAndReplace`, `rerollSlot` y `regenerateDay` al nuevo contrato (helper de test `menuOf(plan, extra) => ({ startDate:'2026-01-05', firstMeal:'comida', days:7, plan, exclusions:[], ...extra })`; `scope:'week'` pasa a `'menu'`). Añadir:
  - `slotKeys({days:3})` tiene 6 claves, la primera `0-comida` y la última `2-cena`.
  - `slotKeys({days:3, firstMeal:'cena'})` tiene 5 claves y no incluye `0-comida`.
  - `newMenu({days:1, firstMeal:'cena'})` con platos → plan con una sola clave `0-cena`.
  - `newMenu` con `dishes: []` → `plan` vacío, sin lanzar errores.
  - `newMenu({days:14})` → 28 huecos.
  - Eliminar `parseDishList` y sus 7 tests (el usuario escribe las recetas desde el formulario).
- [ ] **Step 2: Run** → los tests migrados y nuevos FALLAN; anotar que fallan por contrato nuevo, no por errores de sintaxis.
- [ ] **Step 3: Refactor** `planner.js` al nuevo contrato (la selección sigue siendo la actual, sin puntuación todavía). Quitar `DAYS`.
- [ ] **Step 4: Run** → verde.

### Task 3: principal + complemento por hueco

**Files:**
- Modify: `apps/comidas/planner.js`, `apps/comidas/tests/planner.test.js`

**Interfaces:**
- Consumes: `dish.kind` (Task 1).
- Produces: huecos con la forma `{ id, name, side }`; `rerollSlot({ dishes, menu, day, slot, part = 'main', rng })` con `part: 'main' | 'side'`.

- [ ] **Step 1: Write failing tests:**
  - Con 3 principales y 2 complementos, `newMenu` deja en cada hueco un principal en `id` y un complemento en `side.id`.
  - Sin ningún complemento, `side === null` en todos los huecos.
  - Con solo complementos (ninguna principal), `plan` queda vacío.
  - `rerollSlot(..., part:'side')` cambia solo `side` y deja `id`; con `part:'main'` cambia solo el principal.
  - `excludeAndReplace` con un `dishId` de complemento sustituye solo el complemento afectado y no toca el principal.
  - Un complemento nunca aparece como principal ni al revés.
- [ ] **Step 2: Run** → FALLAN.
- [ ] **Step 3: Implement**: el relleno elige el principal del conjunto `kind==='principal'` y, si existen complementos permitidos, el complemento del conjunto `kind==='complemento'`. `isAllowed` se aplica a ambos.
- [ ] **Step 4: Run** → verde.

### Task 4: puntuación (menú con sentido)

**Files:**
- Modify: `apps/comidas/planner.js`, `apps/comidas/tests/planner.test.js`

**Interfaces:**
- Consumes: `ingredientsOf`, `mainIngredient` (Task 1); `slotKeys` (Task 2).
- Produces: constantes exportadas `WEIGHTS = { repeat: 1000, mainNear: 100, sharedNear: 10, sharedAll: 1 }` y `NEAR = 3`; el relleno elige el plato de menor coste con desempate por `rng`.

- [ ] **Step 1: Write failing tests** (platos: `p1`=pollo 2+arroz 1, `p2`=pollo 2+patata 1, `p3`=atún 2+tomate 1, `p4`=pasta 2+queso 1):
  - Con `days:2` (4 huecos) y esos 4 platos, ningún par de huecos contiguos comparte ingrediente principal.
  - Tras `p1` en un hueco, el siguiente prefiere un plato sin ingredientes compartidos (`p3` o `p4`) antes que `p2`, con `rng` fijo.
  - Un plato ya usado no se vuelve a elegir mientras queden otros permitidos; con 2 platos y 6 huecos se repiten solo después de agotarlos.
  - Platos sin ingredientes se pueden elegir sin errores ni `NaN`.
  - Con `rng` aleatorio, 50 menús de 7 días con 12 platos nunca repiten el mismo principal en huecos contiguos cuando existen 3 o más principales distintos.
- [ ] **Step 2: Run** → los que dependen de la puntuación FALLAN.
- [ ] **Step 3: Implement** `cost(dish, context)` privado con los pesos de Global Constraints; el contexto son los huecos ya fijados (anteriores y posteriores dentro de `NEAR`).
- [ ] **Step 4: Run** → verde.

### Task 5: shopping.js (lista con cantidades)

**Files:**
- Create: `apps/comidas/shopping.js`, `apps/comidas/tests/shopping.test.js`
- Modify: `apps/comidas/planner.js` (quitar lista), `apps/comidas/tests/planner.test.js` (mover tests de lista), `apps/comidas/tests/planner.test.html`

**Interfaces:**
- Consumes: `ingredientsOf`, `emptyList` (Task 1); huecos con `side` (Task 3).
- Produces: `buildShoppingList({ dishes, menu, list }): Item[]` con `Item = { key, name, qty: number, recipes: string[], checked: boolean, manual: boolean }`; se mantienen `removeFromList`, `restoreToList`, `addToList(list, name, qty = 1)`, `toggleChecked`.

- [ ] **Step 1: Mover los tests de lista** a `shopping.test.js` adaptándolos a `menu` y a la nueva forma de ingredientes; añadir:
  - Pollo 2 en una receta y pollo 1,5 en otra (principal y complemento del mismo hueco) → un ítem `pollo` con `qty === 3.5` y las dos recetas en `recipes`.
  - Las recetas de `side` también aportan ingredientes.
  - Ingredientes de texto antiguo cuentan 1.
  - Quitar un ingrediente y regenerar el menú lo mantiene quitado; `buildShoppingList` con `menu: null` devuelve solo los productos añadidos a mano.
- [ ] **Step 2: Run** → FALLAN (módulo inexistente).
- [ ] **Step 3: Implement** `shopping.js` moviendo las funciones y sumando `qty`; eliminarlas de `planner.js`.
- [ ] **Step 4: Run** → verde (suma total de tests igual o mayor que antes de mover).

### Task 6: schedule.js (hora, inicio y Hoy)

**Files:**
- Create: `apps/comidas/schedule.js`, `apps/comidas/tests/schedule.test.js`
- Modify: `apps/comidas/tests/planner.test.html`

**Interfaces:**
- Consumes: `slotKey` (Task 2).
- Produces:
  - `mealNow(now: Date): 'comida' | 'cena'`
  - `proposeStart(now: Date): { date: 'YYYY-MM-DD', firstMeal: 'comida' | 'cena' }`
  - `todayView({ menu, now }): View` con `View = { status: 'notStarted' | 'active' | 'finished', startDate, dayNumber, totalDays, date, meal, current: Entry | null, other: { meal, entry: Entry | null } }`
  - `toISODate(d: Date): string` (fecha local)

- [ ] **Step 1: Write failing tests** (fechas con `new Date(2026, 10, 6, h, m)`):
  - `mealNow`: 16:59 → `comida`; 17:00 → `cena`; 00:30 → `comida`.
  - `proposeStart`: 10:00 → hoy/`comida`; 17:00 → hoy/`cena`; 21:59 → hoy/`cena`; 22:00 → mañana/`comida`; 23:59 del 30 de noviembre → 1 de diciembre.
  - `todayView` con menú de 3 días iniciado hoy: a las 12:00 → `active`, `dayNumber:1`, `meal:'comida'`, `current` es el hueco `0-comida`, `other.meal:'cena'`.
  - Menú que empieza por la cena, a las 10:00 del día 1 → `meal:'cena'` (la comida de ese día no existe) y `dayNumber:1`.
  - Dos días después, `dayNumber:3`; tres días después → `status:'finished'`.
  - Menú que empieza mañana → `status:'notStarted'` con `startDate`.
  - Hueco vacío en el plan → `current: null`, sin errores.
- [ ] **Step 2: Run** → FALLAN.
- [ ] **Step 3: Implement** las funciones con aritmética de fechas locales (sin horas UTC).
- [ ] **Step 4: Run** → verde.

### Task 7: núcleo de interfaz, navegación y pantalla Recetas

**Files:**
- Create: `apps/comidas/core.js`, `apps/comidas/screens/recetas.js`, `apps/comidas/main.js`
- Modify: `apps/comidas/index.html`, `apps/comidas/comidas.css`
- Delete: `apps/comidas/comidas.js` (su contenido se reparte aquí y en las tareas 8 a 10)

**Interfaces:**
- Produces `window.Comidas`: `{ state, save(), $(id), esc(s), toast(msg), openSheet(title, html), closeSheet(), render(), go(name), register(name, { render }), start() }`. `core.js` carga con `Planner.migrateState` y expone `state` con la forma de Estado guardado.
- Las pantallas son secciones `#screen-<hoy|menu|compra|recetas>`; barra inferior con las cuatro; `go` muestra una y llama a su `render`. Pantalla inicial: Hoy si hay menú activo, si no Menú; sin recetas, Recetas.

- [ ] **Step 1: Escribir el HTML** con barra inferior (iconos SVG, sin emojis), las cuatro secciones vacías, hoja inferior y toast; cargar los scripts en este orden: `recipes.js`, `planner.js`, `shopping.js`, `schedule.js`, `core.js`, `screens/*.js`, `main.js`.
- [ ] **Step 2: Implement** `core.js` y `main.js` (`Comidas.start()`).
- [ ] **Step 3: Implement** Recetas: lista de recetas (nombre, tipo, ingredientes con cantidad `formatQty`); botón "Nueva receta"; formulario en hoja inferior con nombre, selector Principal/Complemento y filas dinámicas de ingrediente (nombre + cantidad, valor inicial 1, "Añadir ingrediente", quitar fila); guardar valida nombre y cantidades con `parseQty` y muestra toast si hay una inválida; editar y eliminar (al eliminar, quitar la receta de `menu` y `draft` y reemplazarla).
- [ ] **Step 4: Verify** con Edge sin interfaz: la página carga sin errores (`--dump-dom` muestra las 4 pestañas y la lista de recetas migradas con cantidad). `bash tests/run.sh` sigue en verde.

### Task 8: pantalla Menú (crear, borrador, confirmar, editar)

**Files:**
- Create: `apps/comidas/screens/menu.js`
- Modify: `apps/comidas/comidas.css`

**Interfaces:**
- Consumes: `newMenu`, `fillMenu`, `rerollSlot`, `regenerateDay`, `excludeAndReplace` (Tareas 2–3), `proposeStart`, `toISODate` (Task 6), `Comidas.*` (Task 7). Estado: `draft` (borrador) y `menu` (confirmado); ambos con la misma forma.

- [ ] **Step 1: Implement estado "sin menú"**: si no hay recetas principales, mensaje "Añade recetas principales" con botón a Recetas. Si hay, formulario: días (1–14, por defecto 7), inicio con tres opciones (hoy día completo, hoy desde la cena, mañana; la de `proposeStart(new Date())` preseleccionada) y "Otro día" con selector de fecha y comida/cena; botón "Crear menú" que guarda `draft = newMenu(...)`.
- [ ] **Step 2: Implement borrador**: días con sus huecos (principal y complemento); en cada plato "Otro" (`rerollSlot`) y "No la quiero" (`excludeAndReplace` con `scope:'menu'`, y la opción de solo ese día); "No quiero…" libre por plato o ingrediente (como ahora); "Regenerar día" y "Regenerar todo"; "Confirmar menú" mueve `draft` a `menu`, reinicia `state.list` y borra `draft`; "Descartar".
- [ ] **Step 3: Implement menú confirmado**: mismas acciones de edición aplicadas sobre `menu` (se guardan al instante y la Compra se recalcula sola), más "Menú nuevo" (con confirmación) que lo deja en `null`.
- [ ] **Step 4: Verify** con un archivo temporal de humo (se borra después) que carga la página y pulsa: crear menú, confirmar. Comprobar en `--dump-dom` que aparecen los huecos esperados, que tras confirmar `state.menu` existe y que "Otro" cambia un plato. `bash tests/run.sh` en verde.

### Task 9: pantalla Hoy

**Files:**
- Create: `apps/comidas/screens/hoy.js`
- Modify: `apps/comidas/comidas.css`

**Interfaces:**
- Consumes: `todayView` (Task 6), `formatQty`/`ingredientsOf` (Task 1).

- [ ] **Step 1: Implement** con `todayView({ menu: state.menu, now: new Date() })`: `active` → "Día X de N" con fecha real, tarjeta grande de lo que toca (principal, complemento y sus ingredientes con cantidad) y debajo la otra comida del día; `notStarted` → "Tu menú empieza el <fecha>"; `finished` → "Tu menú ha terminado" con botón a Menú; sin menú → botón a Menú. Se vuelve a pintar al volver a la pestaña y cada minuto.
- [ ] **Step 2: Verify** con el archivo temporal de humo: con un menú confirmado en el estado, `--dump-dom` muestra "Día 1 de" y el nombre del plato de hoy; sin menú muestra el botón a Menú.

### Task 10: pantalla Compra, SW, README

**Files:**
- Create: `apps/comidas/screens/compra.js`
- Modify: `apps/comidas/comidas.css`, `apps.json`, `sw.js`, `README.md`

**Interfaces:**
- Consumes: `buildShoppingList`, `removeFromList`, `restoreToList`, `addToList`, `toggleChecked` (Task 5), `formatQty`, `parseQty` (Task 1).

- [ ] **Step 1: Implement** la lista desde `buildShoppingList({ dishes, menu: state.menu, list: state.list })`: cada fila con casilla, nombre, recetas de origen, cantidad (`formatQty`, "×" solo si es distinta de 1), botón quitar; "Quitados" con "Volver a poner"; campo para añadir producto con cantidad opcional; "Copiar lista" (solo lo no marcado) y "Desmarcar todo". Sin menú: mensaje y botón a Menú.
- [ ] **Step 2: Actualizar** `apps.json` (`files` con todos los archivos nuevos y la carpeta `screens/`), subir `VERSION` en `sw.js`, y `README.md` (árbol de `apps/comidas/` y flujo nuevo).
- [ ] **Step 3: Verify** completo: `bash tests/run.sh` en verde; con el archivo temporal de humo (borrarlo) confirmar que cambiar un plato en Menú cambia los ingredientes de la Compra; recorrer las cuatro pestañas en `--dump-dom` sin errores de carga.
