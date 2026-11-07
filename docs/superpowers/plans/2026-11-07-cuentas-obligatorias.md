# Cuentas obligatorias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda la app exige sesión (usuario + contraseña, Firebase Auth), la sesión se guarda, y Mi-Menu sincroniza por cuenta leyendo de Firestore como máximo una vez cada 24 h.

**Architecture:** Un script clásico `shared/auth.js` en el `<head>` de cada página oculta la página, carga Firebase Auth con `import()` dinámico y muestra un login superpuesto hasta que hay sesión con usuario. Expone `window.MiAuth`. `cloud.js` deja de usar sesión anónima y usa `MiAuth`. La lógica pura (validación, cuándo leer, dueño de los datos) vive en archivos sin DOM con tests.

**Tech Stack:** JavaScript sin compilación, Firebase Auth 10.14.1 desde gstatic (mismo CDN que hoy), API REST de Firestore (como hoy), tests con `tests/harness.js` y `bash tests/run.sh`.

**Spec:** `docs/superpowers/specs/2026-11-07-cuentas-obligatorias-design.md`

## Global Constraints

- **No hacer `git commit` ni `git push`** (preferencia del dueño). Donde otros planes dirían "commit", aquí se comprueba `git status` y se sigue.
- Email de la cuenta: `usuario@mi-app.invalid`. Usuario: minúsculas, números, `.`, `_`, `-`, de 3 a 20 caracteres. Contraseña: mínimo 6.
- Intervalo de lectura de Firestore: 24 h (`86400000` ms).
- Firebase SDK: `https://www.gstatic.com/firebasejs/10.14.1/` (misma versión que `cloud.js` hoy).
- Textos de la interfaz en español. Estilo con `shared/styles.css` (variables `--surface`, `--ink`, `--line`, clases `.btn`).
- La página nunca debe verse sin sesión. Si Firebase no carga y no hay sesión, queda bloqueada.
- La sesión anónima no se crea nunca; una sesión anónima existente solo se usa para migrar (`linkWithCredential`).
- Reglas de Firestore y pasos de consola: solo se documentan/indican al dueño (Task 7), no se pueden aplicar desde el repo.

## Review Focus

1. Usuario con espacios o mayúsculas (`"  Ana "`) debe dar la misma cuenta que `ana` (Task 1).
2. Usuario con `@` u otros caracteres (`a@b.com`) debe rechazarse; no puede colarse como email arbitrario (Task 1).
3. Reloj del dispositivo adelantado (`lastSyncAt` en el futuro) debe forzar lectura, no bloquearla para siempre (Task 2).
4. `localStorage` no disponible (modo privado) no debe romper el login ni la sincronización: se trata como "nunca sincronizado" (Task 2 y 3, comprobación manual).
5. Cambio de cuenta en un mismo dispositivo: los datos locales de la cuenta anterior no se suben a la nueva (Task 2 y 5).

---

## File Structure

- Create `shared/authcore.js` — funciones puras de cuenta (validar, convertir, mensajes de error). UMD como `cloudsync.js`.
- Create `shared/tests/authcore.test.html`, `shared/tests/authcore.test.js` — tests de lo anterior.
- Create `shared/auth.js` — la puerta: ocultar, login superpuesto, `window.MiAuth`.
- Create `shared/firebase-config.js` — la config movida desde `apps/comidas/firebase-config.js` (se borra el original).
- Modify `apps/comidas/cloudsync.js` — añade `SYNC_INTERVAL_MS`, `shouldReadRemote`, `ownerAction`.
- Modify `apps/comidas/tests/cloudsync.test.js` — tests de lo anterior.
- Modify `apps/comidas/cloud.js`, `apps/comidas/core.js`, `apps/comidas/index.html` — usar `MiAuth`, leer como mucho cada 24 h, dueño de datos, botón "Sincronizar ahora".
- Modify `index.html`, `apps/ask/index.html`, `apps/vinilos/index.html` — línea de `auth.js`; portada además con zona de cuenta.
- Modify `sw.js`, `apps.json`, `README.md`, `tests/run.sh`.

---

### Task 1: Funciones puras de cuenta

**Files:**
- Create: `shared/authcore.js`
- Create: `shared/tests/authcore.test.html`, `shared/tests/authcore.test.js`
- Modify: `tests/run.sh` (el bucle `for page in ...` debe incluir también `shared/tests/*.test.html`)

**Interfaces:**
- Produces (`window.MiAuthCore`, y `module.exports` si existe `module`):
  - `normalizeUsername(u: string): string` — `trim()` + minúsculas.
  - `validateUsername(u: string): string | null` — mensaje de error o `null`. Válido: `^[a-z0-9._-]{3,20}$` tras normalizar. Mensaje: `'El usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.'`
  - `validatePassword(p: string): string | null` — `null` si `p.length >= 6`; si no `'La contraseña debe tener al menos 6 caracteres.'`
  - `usernameToEmail(u: string): string` — normalizado + `'@mi-app.invalid'`.
  - `emailToUsername(email: string): string` — quita `'@mi-app.invalid'`; si no termina así devuelve el email tal cual.
  - `authErrorMessage(code: string): string` — mapa de códigos de Firebase a español (ver Step 3).

- [ ] **Step 1: Tests (`authcore.test.js`), usando `test`/`assert` del arnés**
  - `usernameToEmail('  Ana ')` → `'ana@mi-app.invalid'` y `usernameToEmail('ana')` igual.
  - `validateUsername('ana')` → `null`; `'a.b_c-1'` → `null`; de 20 caracteres → `null`.
  - `validateUsername('ab')`, de 21 caracteres, `'a b'`, `'a@b.com'`, `'Ñandú'`, `''` → cada uno devuelve un string (no `null`).
  - `validatePassword('123456')` → `null`; `'12345'` → string; `''` → string.
  - `emailToUsername('ana@mi-app.invalid')` → `'ana'`; `emailToUsername('x@y.com')` → `'x@y.com'`.
  - `authErrorMessage`: `'auth/email-already-in-use'` → `'Ese usuario ya existe.'`; `'auth/invalid-credential'`, `'auth/wrong-password'`, `'auth/user-not-found'` → `'Usuario o contraseña incorrectos.'`; `'auth/network-request-failed'` → `'Sin conexión. Inténtalo de nuevo cuando tengas internet.'`; `'auth/too-many-requests'` → `'Demasiados intentos. Espera un momento.'`; `'auth/operation-not-allowed'` → `'El registro no está activado todavía (falta activar Email/contraseña en Firebase).'`; código desconocido → `'No se pudo completar. Inténtalo de nuevo.'`.
- [ ] **Step 2:** Crear `authcore.test.html` (patrón de `apps/comidas/tests/planner.test.html`: harness en `../../tests/harness.js`, `../authcore.js`, el test, `finish()`), editar `tests/run.sh` y ejecutar `bash tests/run.sh`. Esperado: FAIL del nuevo bloque (`MiAuthCore` no definido).
- [ ] **Step 3:** Implementar `shared/authcore.js` con el mismo patrón UMD que `apps/comidas/cloudsync.js` (raíz `window`/`globalThis`, `module.exports` opcional).
- [ ] **Step 4:** `bash tests/run.sh`. Esperado: todos los bloques con `failed=0`.
- [ ] **Step 5:** `git status` (sin commit).

---

### Task 2: Lógica pura de sincronización: cuándo leer y de quién son los datos

**Files:**
- Modify: `apps/comidas/cloudsync.js`
- Test: `apps/comidas/tests/cloudsync.test.js`

**Interfaces:**
- Produces (se añaden a `Planner`, junto a `decideSync`):
  - `SYNC_INTERVAL_MS: number` = `86400000`.
  - `shouldReadRemote({ local, lastSyncAt, now, force }): boolean` — `true` si `force`, o `isEmptyState(local)`, o `lastSyncAt` no es un número positivo, o `lastSyncAt > now`, o `now - lastSyncAt >= SYNC_INTERVAL_MS`; si no, `false`.
  - `ownerAction(storedOwner: string | null, uid: string): 'claim' | 'wipe' | 'keep'` — `claim` si no hay dueño guardado (null/vacío); `keep` si coincide; `wipe` si es otro.

- [ ] **Step 1: Tests (en `cloudsync.test.js`, reutilizando `withData`/`emptyS`)**
  - Datos locales + `lastSyncAt = now - 1000` → `false`.
  - Datos locales + `now - SYNC_INTERVAL_MS` → `true` (límite inclusivo); `now - SYNC_INTERVAL_MS + 1` → `false`.
  - Datos locales + `lastSyncAt` `undefined`, `0`, `NaN` → `true`.
  - Datos locales + `lastSyncAt = now + 5000` (reloj adelantado) → `true`.
  - Estado vacío + `lastSyncAt` reciente → `true`.
  - `force: true` + sincronizado hace 1 s → `true`.
  - `ownerAction(null,'u1')` y `ownerAction('', 'u1')` → `'claim'`; `('u1','u1')` → `'keep'`; `('u2','u1')` → `'wipe'`.
- [ ] **Step 2:** `bash tests/run.sh`. Esperado: FAIL (funciones no definidas).
- [ ] **Step 3:** Implementar y exportar en `cloudsync.js` (dentro del objeto `api`).
- [ ] **Step 4:** `bash tests/run.sh`. Esperado: `failed=0` en todo.
- [ ] **Step 5:** `git status` (sin commit).

---

### Task 3: La puerta (`shared/auth.js`) y la config compartida

**Files:**
- Create: `shared/auth.js`, `shared/firebase-config.js`
- Delete: `apps/comidas/firebase-config.js` (contenido idéntico a `shared/firebase-config.js`)

**Interfaces:**
- Consumes: `MiAuthCore` (Task 1), cargado por el propio `auth.js` con `import(new URL('authcore.js', base))` donde `base` sale de `document.currentScript.src` (como `shared/pwa.js`).
- Produces (`window.MiAuth`, definido de forma **síncrona** al ejecutarse el script):
  - `ready: Promise<User>` — se resuelve cuando hay sesión de un usuario no anónimo (ya existente o tras login/registro). Nunca se resuelve sin sesión.
  - `auth: Auth | null` — la instancia de Firebase Auth (disponible tras cargar el SDK).
  - `username: string | null` — `emailToUsername(user.email)` cuando hay sesión.
  - `signOut(): Promise<boolean>` — si hay en `localStorage` alguna clave que empiece por `'pending-sync.'`, pide `confirm('Tienes cambios sin subir a la nube. Si cierras sesión y entra otra cuenta en este dispositivo se perderán. ¿Cerrar sesión igualmente?')`; si cancela, `false`. Si no, `auth.signOut()`, `location.reload()`, `true`.
- Convención para otras tareas: la clave `'pending-sync.<app>'` en `localStorage` indica cambios sin subir.

- [ ] **Step 1:** Mover `apps/comidas/firebase-config.js` a `shared/firebase-config.js` (mismo contenido, mismo `export const firebaseConfig`).
- [ ] **Step 2: Ocultar al instante.** Lo primero que hace `auth.js`: insertar en `<head>` un `<style id="auth-hide">html{visibility:hidden}</style>` (síncrono, antes de cualquier `await`).
- [ ] **Step 3: Arranque.** Con `try/catch` global: importar `authcore.js`, `firebase-config.js`, `firebase-app.js` y `firebase-auth.js` (URLs gstatic 10.14.1); `initializeApp(firebaseConfig)`, `getAuth`, `await auth.authStateReady()`. Si `auth.currentUser` existe y no es anónimo: quitar `#auth-hide`, resolver `ready`. Si no: mostrar el login. Si cualquier import falla y no hay sesión, dejar el login/bloqueo (con un aviso "Sin conexión" y botón "Reintentar" que recarga) sin quitar `#auth-hide`.
- [ ] **Step 4: Login superpuesto.** Un `div` añadido a `document.documentElement`, `position:fixed; inset:0`, con `visibility:visible` explícito (el resto de la página sigue oculta), fondo `var(--bg)`, tarjeta con `var(--surface)`, dos modos "Entrar" / "Crear cuenta" (pestañas o enlace de cambio), campos usuario (`autocomplete="username"`) y contraseña (`autocomplete="current-password"` / `"new-password"`), botón `.btn`, línea de error. Validar con `validateUsername`/`validatePassword` antes de llamar a Firebase; mostrar `authErrorMessage(err.code)` ante errores. Si la sesión actual es anónima, mostrar encima: "Crea tu cuenta para conservar tus datos."
- [ ] **Step 5: Acciones.** Entrar: `signInWithEmailAndPassword(auth, usernameToEmail(u), p)`. Crear cuenta: si `auth.currentUser?.isAnonymous` → `linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, p))`; si no → `createUserWithEmailAndPassword`. Tras cualquiera: `await auth.currentUser.getIdToken(true)`, quitar el login y `#auth-hide`, resolver `ready`, fijar `MiAuth.username`.
- [ ] **Step 6: Verificación (sin red real).** Abrir `index.html` temporalmente con el tag (Task 4) en el navegador; comprobar que sin sesión se ve solo el login y que `visibility` de la página sigue oculta. La prueba con Firebase real va en Task 7.
- [ ] **Step 7:** `git status` (sin commit).

---

### Task 4: Poner la puerta en todas las páginas, caché y documentación

**Files:**
- Modify: `index.html`, `apps/ask/index.html`, `apps/vinilos/index.html`, `apps/comidas/index.html` (primera etiqueta `<script>` del `<head>`, antes de `theme.js`: `<script src="shared/auth.js"></script>`; en `apps/*` la ruta es `../../shared/auth.js`)
- Modify: `sw.js`, `apps.json`, `README.md`, `tests/run.sh`

- [ ] **Step 1: Test de las páginas.** En `tests/run.sh`, antes del bucle de navegador, comprobar que `index.html` y cada `"path"` de `apps.json` (extraídos con `grep -o '"path": "[^"]*"'`) contienen `shared/auth.js` y que `shared/auth.js` aparece **antes** de `theme.js` en el archivo. Si falta en alguno: imprimir `FALTA auth.js en <archivo>` y `STATUS=1`. Ejecutar `bash tests/run.sh`. Esperado: FAIL con las 4 páginas.
- [ ] **Step 2:** Añadir la línea a las cuatro páginas. `bash tests/run.sh`. Esperado: sin "FALTA" y todo `failed=0`.
- [ ] **Step 3: `sw.js`.** Añadir a `SHELL`: `shared/auth.js`, `shared/authcore.js`, `shared/firebase-config.js`. Además, en `install`, `cache.add` tolerante a fallos de `https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js` y `.../firebase-auth.js` (el resto de módulos del SDK se guardan por sí solos la primera vez que se usan, por el manejo de caché actual). Subir `VERSION` de `v25` a `v26`.
- [ ] **Step 4: `apps.json`.** En `files` de `comidas`, quitar `apps/comidas/firebase-config.js`.
- [ ] **Step 5: `README.md`.** Actualizar el mapa del proyecto (nuevos archivos de `shared/`, `shared/tests`) y añadir una sección corta "Cuentas": cómo funciona, que no hay recuperación de contraseña y que una app nueva solo necesita la línea de `auth.js`.
- [ ] **Step 6:** `git status` (sin commit).

---

### Task 5: Mi-Menu: sincronizar por cuenta, una lectura al día, dueño de los datos, botón de sincronizar

**Files:**
- Modify: `apps/comidas/cloud.js`, `apps/comidas/core.js`, `apps/comidas/index.html`

**Interfaces:**
- Consumes: `MiAuth.ready`, `MiAuth.auth` (Task 3); `Planner.shouldReadRemote`, `Planner.ownerAction`, `Planner.SYNC_INTERVAL_MS` (Task 2); `decideSync`, `deserializeRemote`, `serializeState`, `toFirestoreFields`, `fromFirestoreDoc` (ya existen).
- Produces: `Comidas.clearLocal(): void` en `core.js` — borra `comidas.v1`, `comidas.v1.bak`, `comidas.v1.pre-limpieza` de `localStorage` y reinicia el estado con `adoptState(P.migrateState(null))`. `Comidas.syncNow(): Promise<void>` (lo define `cloud.js`).
- Claves de `localStorage`: `comidas.owner` (uid dueño), `comidas.lastSync.<uid>` (ms de la última lectura), `pending-sync.comidas` (`'1'` mientras haya cambios sin subir).

- [ ] **Step 1:** `cloud.js`: quitar los imports de `firebase-app`/`firebase-auth` y toda llamada a `signInAnonymously`; importar `firebaseConfig` desde `../../shared/firebase-config.js` (solo se necesita `projectId`). `request()` obtiene el token de `window.MiAuth.auth.currentUser.getIdToken()`. Toda la lectura/escritura de `localStorage` nueva va en `try/catch` (si falla se comporta como "nunca sincronizado" / sin dueño).
- [ ] **Step 2: Conexión.** `doConnect()`: `await MiAuth.ready`; aplicar `ownerAction(localStorage 'comidas.owner', uid)`: `claim` → guardar el uid; `wipe` → `Comidas.clearLocal()`, borrar `pending-sync.comidas`, guardar el uid; `keep` → nada. Luego, si `shouldReadRemote({ local: C.state, lastSyncAt, now: Date.now(), force: false })` → `sync()`; si no → **no hacer ninguna petición**, marcar `ready = true`.
- [ ] **Step 3: `sync({ force })`.** El cuerpo actual de `doConnect` (leer, `decideSync`, adoptar/subir) + guardar `comidas.lastSync.<uid> = Date.now()` tras leer con éxito (no tras subir).
- [ ] **Step 4: Pendiente.** En `C.onSave` poner `pending-sync.comidas = '1'`; borrarlo cuando `push()` termine bien. Si al abrir está puesto y la lectura se omitió, el `flush()` normal (visibilitychange / online) lo sube sin leer.
- [ ] **Step 5: Botón "Sincronizar ahora".** Icono pequeño en `.topbar` de `apps/comidas/index.html` (sin quitar el botón de tema, que `theme.js` coloca en `.topbar .spacer`: añadir el botón junto al título o a la izquierda del hueco). Al pulsar: `Comidas.syncNow()` = `connect()` forzando `sync({ force: true })`; toast "Sincronizado" si va bien, "Sin conexión" si falla.
- [ ] **Step 6: Verificación.** `bash tests/run.sh` (todo en verde: nada de Task 1–2 debe haberse roto). Revisar a mano en el navegador con `console` + `localStorage` que, con `comidas.lastSync.<uid>` de hace menos de 24 h, la pestaña Red no muestra peticiones a `firestore.googleapis.com` al abrir (comprobación completa en Task 7).
- [ ] **Step 7:** `git status` (sin commit).

---

### Task 6: Portada: zona de cuenta y cerrar sesión

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `MiAuth.ready`, `MiAuth.username`, `MiAuth.signOut()` (Task 3).

- [ ] **Step 1:** Añadir bajo el pie `.social` un bloque `<div id="account">` con "Sesión: <usuario>" y un botón "Cerrar sesión" (estilo de los botones `.social a` o `.btn.ghost`, ≥44 px de alto). Se rellena con `MiAuth.ready.then(...)`; oculto hasta tener sesión.
- [ ] **Step 2:** El botón llama a `MiAuth.signOut()` (el aviso de cambios sin subir lo gestiona el propio `signOut`). El nombre se inserta con `textContent` (no `innerHTML`).
- [ ] **Step 3: Verificación manual.** Con sesión: se ve el usuario; "Cerrar sesión" recarga y aparece el login. Con `localStorage.setItem('pending-sync.comidas','1')` en consola antes: aparece el aviso y "Cancelar" mantiene la sesión.
- [ ] **Step 4:** `git status` (sin commit).

---

### Task 7: Consola de Firebase y prueba de extremo a extremo (con el dueño)

**Files:** ninguno (pasos fuera del repo).

- [ ] **Step 1: Indicar al dueño estos pasos en la consola de Firebase** (proyecto `mi-app-490b5`): (1) Authentication → Sign-in method → activar **Email/contraseña**; (2) dejar **Anónimo** activado hasta migrar su cuenta; (3) Firestore → Reglas → pegar las del diseño (sección "Reglas de Firestore") y Publicar.
- [ ] **Step 2: Migración.** En el móvil del dueño (con datos existentes): abrir la app → login con aviso "Crea tu cuenta para conservar tus datos" → crear cuenta → los datos de Mi-Menu siguen igual y en la consola `users/{uid}` no cambia de uid.
- [ ] **Step 3: Puerta.** Navegador en ventana privada: la portada y la URL directa de `apps/ask/index.html` y `apps/vinilos/index.html` muestran solo el login. Con sesión iniciada no lo piden otra vez al recargar. En modo avión con sesión guardada la app abre.
- [ ] **Step 4: Segundo dispositivo.** Entrar con la misma cuenta: se recuperan los datos. Dos cuentas distintas en un mismo dispositivo: los datos de la primera no aparecen en la segunda.
- [ ] **Step 5: Una lectura al día.** Abrir Mi-Menu dos veces seguidas con la pestaña Red del navegador abierta: la primera puede leer, la segunda no hace peticiones a `firestore.googleapis.com`. "Sincronizar ahora" sí hace una.
- [ ] **Step 6:** Si el dueño confirma que todo va, informarle de que puede desactivar "Anónimo" en la consola cuando todas las personas hayan creado su cuenta.
