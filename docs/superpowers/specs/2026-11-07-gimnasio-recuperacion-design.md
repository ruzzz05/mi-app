# Gimnasio — recuperación diaria y salud de los últimos días — diseño

Fecha: 2026-11-07 · Estado: aprobado por el usuario en la conversación ("me parece correcto poner las estadísticas del día en Hoy y el registro de los últimos días en estadísticas")

## Intención
Algo parecido a Bevel dentro de la app Gimnasio, sin apuntar nada a mano: con los datos de la pulsera (Google Health) mostrar en **Hoy** cómo estás hoy (puntuación de recuperación, sueño de la noche, pulso en reposo, variabilidad) y en **Perfil** la evolución de los últimos días.

## Datos (API de Google Health, ya comprobados en la documentación)
- Sueño: `GET .../dataTypes/sleep/dataPoints?pageSize=N` (sesiones con `interval`, `metadata.nap/mainSleep`, `summary.minutesAsleep/minutesInSleepPeriod/stagesSummary[]`). Permiso `sleep.readonly`.
- Pulso en reposo: `daily-resting-heart-rate` → `dailyRestingHeartRate.{date, beatsPerMinute}` (texto). Permiso `health_metrics_and_measurements.readonly`.
- VFC: `daily-heart-rate-variability` → `dailyHeartRateVariability.{date, averageHeartRateVariabilityMilliseconds}`. Mismo permiso.
- Pasos por día: `steps` con `rollUp` en ventanas de 1 hora (`windowSize: "3600s"`) agrupadas por día local en el móvil (así el cambio de hora no descuadra los días). Permiso de actividad, que ya existe.
- `list` devuelve del más reciente al más antiguo, así que se piden los últimos N sin filtros (se evita depender de la sintaxis exacta de los filtros).

## Puntuación de recuperación (decisión mía, visible y ajustable)
- Sueño (35 %): minutos dormidos / 450 (7,5 h), máximo 100.
- VFC (40 %): comparada con TU media de los 14 días anteriores: `70 + 20·z`, entre 0 y 100.
- Pulso en reposo (25 %): igual, invertido (más bajo = mejor).
- Hacen falta al menos 5 días de historial para la referencia; sin ella la puntuación es **provisional** (solo con el sueño) y se avisa.
- Etiquetas: ≥ 75 "Buen día para entrenar"; 50–74 "Día moderado: entrena sin forzar"; < 50 "Mejor descansa hoy". No es un dato médico.

## Pantallas
- **Hoy:** tarjeta "Recuperación" (puntuación, etiqueta, sueño, pulso, VFC), y debajo lo que ya hay (entreno de hoy, pasos y calorías).
- **Perfil:** sección "Salud: últimos días" con cuatro gráficas de 14 días (sueño en horas, pulso en reposo, VFC, pasos).

## Permisos y estados
- Nuevo `SCOPE` con tres permisos (actividad, sueño, salud). Se guarda `scope` del token para saber si falta alguno (Google deja desmarcarlos); si falta, Hoy dice cuál y ofrece volver a conectar pidiendo confirmación.
- Los datos de salud se guardan en el móvil (`gimnasio.salud`) y se refrescan si tienen más de 30 minutos; el resumen de hoy sigue refrescándose a los 2 minutos. Nada de esto se sube a Firebase.
- Si un tipo de dato falla (por ejemplo la VFC), se enseñan los demás y se dice cuál falla.

## No objetivos
Sin consejos médicos, sin subir datos de salud a la nube, sin apps nuevas en la portada.
