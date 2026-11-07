# Gimnasio — pantalla "Hoy" (fase 2) — diseño

Fecha: 2026-11-07 · Estado: aprobado por el usuario en la conversación ("me parece correcto", camino A)

## Intención
Una pantalla de resumen del día en la app Gimnasio: pasos y calorías de la pulsera (Google Fitbit Air, vía Google Health API) y el estado del entreno de hoy (del propio Gimnasio). Es un **experimento** del camino A (sin servidor): se prueba en el iPhone del usuario y, si el inicio de sesión de Google no funciona en la app instalada, se pasa al camino B (función en la nube).

## Navegación
Tres pestañas, de izquierda a derecha: **Hoy, Rutinas, Perfil**. La app abre en Hoy (salvo que haya un entreno en curso, que abre en él, como ahora).

## Contenido de Hoy
- Fecha de hoy.
- Tarjeta de salud: pasos, calorías totales y calorías activas de hoy. Estados: *falta configurar* (sin clientId), *sin conectar* (botón "Conectar con Google"), *cargando*, *datos* (hora de la última actualización y botón actualizar) y *error* (mensaje real de Google).
- Tarjeta de entreno: si hay uno en curso, "Retomar"; si hoy ya hubo entrenos, nombre, series, duración y volumen; si no, "Hoy aún no has entrenado" y botón para ir a Rutinas.

## Cómo se conecta (camino A, sin servidor)
- Google Identity Services, "token client" en el navegador: `https://accounts.google.com/gsi/client`, permiso `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`. Token de acceso de ~1 h, sin refresh token. Hay que pedirlo con un toque del usuario (ventana de Google); si ya dio permiso antes, la ventana no pide confirmar.
- Consulta: `POST https://health.googleapis.com/v4/users/me/dataTypes/{steps|total-calories|active-energy-burned}/dataPoints:rollUp` con `range` (inicio y fin de hoy en hora local), `windowSize: "86400s"`. Se suma todo lo devuelto.
- El `clientId` de Google es público y va en `apps/gimnasio/google-config.js` (vacío hasta que el usuario cree el proyecto en Google Cloud; los pasos van en el README).
- Aviso al usuario: mientras la app de Google Cloud esté en modo prueba, el permiso caduca (≈ semanal) y habrá que volver a conectar.

## Decisiones mías
- El lector de la respuesta es tolerante con el nombre exacto de los campos (la documentación no lo muestra): suma cualquier campo numérico que termine en `Sum`. Un error de Google se muestra tal cual.
- Se guarda en el móvil el último resumen (`gimnasio.hoy`) para enseñarlo sin conexión y no repetir la consulta si tiene menos de 10 minutos. El token se guarda en `gimnasio.google.token` hasta que caduque. Ambos se borran si entra otra cuenta de la app.
- Las calorías activas son opcionales: si Google las rechaza, se muestran solo las totales.

## No objetivos
Sin servidor, sin guardar datos de salud en Firebase, sin histórico de pasos (solo hoy), sin Apple Salud.
