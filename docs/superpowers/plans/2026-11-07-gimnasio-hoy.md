# Gimnasio "Hoy" — plan

> Ejecución inline (sin commits: regla del usuario). Spec: `docs/superpowers/specs/2026-11-07-gimnasio-hoy-design.md`

**Restricciones:** sin `git commit/push`; subir `VERSION` de `sw.js`; textos con `h()`/`textContent`; `bash tests/run.sh` en verde.

## Task 1: Lógica pura (TDD)
- `Gym.todaySummary(sessions, day) -> { count, sets, durationSec, volume, names }` en `gymcore.js` (ignora borrados y entrenos sin series hechas).
- `apps/gimnasio/healthcore.js` (UMD `window.HealthCore`): `todayRange(now) -> {startTime, endTime}` (medianoche local a medianoche siguiente, ISO), `sumRollup(response) -> number|null` (suma campos `*Sum` de cada punto; null si no hay datos), `tokenValid(tok, now)`, `summaryFresh(cache, day, now)` (mismo día y < 10 min).
- Tests en `apps/gimnasio/tests/` (`gymcore.test.js`, `healthcore.test.{html,js}`).

## Task 2: Navegación y pantalla Hoy
- Barra de 3 pestañas Hoy · Rutinas · Perfil; `NAMES`/`MAIN` en `core.js`; arranque en Hoy; `clearLocal` borra también `gimnasio.hoy` y `gimnasio.google.token`.
- `screens/hoy.js`: fecha, tarjeta de entreno, tarjeta de salud (según estado de `A.health`).

## Task 3: Conexión con Google
- `google-config.js` (`window.GoogleHealthConfig = { clientId: '' }`) y `health.js` (`A.health`: `state()`, `connect()`, `refresh()`), con carga perezosa de `gsi/client`.

## Task 4: Cierre
- README (pasos de Google Cloud y aviso de caducidad), `apps.json`, `sw.js`; verificación en navegador con Google simulado; batería completa.
