# Gimnasio recuperación — plan

> Ejecución inline, sin commits (regla del usuario). Spec: `docs/superpowers/specs/2026-11-07-gimnasio-recuperacion-design.md`

## Task 1: Lógica pura (TDD) — `healthcore.js`
`parseDay`, `dailyValues`, `sleepNights`, `stepsByDay`, `baseline`, `lastDays`, `recoveryScore`, `missingScopes`. Tests en `apps/gimnasio/tests/healthcore.test.js`.

## Task 2: Conexión — `health.js`
Permisos nuevos, `scope` del token, carga de sueño/pulso/VFC/pasos por día, caché `gimnasio.salud`, estados por tipo de dato.

## Task 3: Pantallas
Hoy: tarjeta de recuperación. Perfil: "Salud: últimos días" con 4 gráficas.

## Task 4: Cierre
README (permisos en Google Cloud), `sw.js`, verificación en navegador con Google simulado (formatos de la documentación) y batería completa.
