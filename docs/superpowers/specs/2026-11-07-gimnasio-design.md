# App de gimnasio — diseño (fase 1)

Fecha: 2026-11-07 · Estado: pendiente de aprobación

## Intención

Una app más dentro de la PWA (`apps/gimnasio/`), con la misma cuenta que el resto. Sirve para llevar los entrenos de gimnasio: un catálogo de ejercicios con imagen, rutinas propias, usar una rutina en el gimnasio mientras se cuenta el tiempo, y ver después los resultados día a día, por ejercicio y por grupo muscular.

Por qué: el usuario ya tiene rutinas que sigue en el gimnasio, a veces cambia el orden, las series o los pesos sobre la marcha sin querer alterar la rutina original, y al llegar a casa quiere comparar con otros días.

## Objetivos

- Catálogo con ~800 ejercicios, cada uno con grupos musculares e imágenes de la ejecución.
- Rutinas: crear, editar y usar. Cada ejercicio de una rutina tiene series, repeticiones y peso.
- Usar una rutina trabaja sobre una **copia**: los cambios durante el entreno no tocan la rutina original. Cronómetro con el tiempo total.
- Estadísticas: calendario estilo GitHub, comparación por ejercicio, esfuerzo por grupo muscular.
- Compartir **plantillas** de rutina por archivo (se pasa por WhatsApp, el otro lo importa).
- Datos ligados a la cuenta y sincronizados entre dispositivos; funciona sin conexión.

## No objetivos

- Nada de red social: no se comparten resultados, perfiles ni historial, solo plantillas.
- Sin vídeos (solo imágenes). Sin pasos/calorías/Salud: es la **fase 2** ("Resumen de hoy" con Google Health API), que no depende de nada de esta fase.
- Sin servidor propio. Sin pesos en libras (solo kg). Sin traducir las instrucciones paso a paso.

## Restricciones del proyecto

- HTML/JS/CSS sin compilar; `shared/auth.js` antes de `theme.js` en el `<head>` (lo comprueba `tests/run.sh`).
- Subir `VERSION` de `sw.js` en cada cambio de archivos; registrar la app en `apps.json` y en la portada.
- Firestore por la API REST con el token de la sesión (como `apps/comidas/cloud.js`).
- Leer la nube como mucho una vez cada 24 h (o si no hay datos locales, o con "Sincronizar ahora"); los cambios se suben al editar.
- Lógica pura (cálculos, validación, fusión) en un módulo UMD con tests, como `planner.js`. Tests con `tests/harness.js`.
- Nunca commit ni push sin que el usuario lo pida.

## Pantallas

Una sola página (`index.html`) con pantallas internas y barra inferior flotante como Mi-Menu.

1. **Perfil** (principal): calendario, esfuerzo por músculo, comparación por ejercicio.
2. **Rutinas** (principal): lista de rutinas, botón de importar, y por rutina: Usar, Editar, Compartir, Borrar.
3. **Crear / Editar rutina**: nombre, lista ordenable de ejercicios elegidos desde el buscador del catálogo (filtro por músculo y equipo); por ejercicio, N series con repeticiones y peso objetivo.
4. **Usar rutina**: sesión en curso con cronómetro. Se puede reordenar ejercicios, añadir/quitar series, cambiar pesos y repeticiones y marcar cada serie como hecha. Al terminar se guarda el entreno con lo realmente hecho. Salir sin terminar pide confirmación.
5. **Ficha de ejercicio** (se abre desde cualquier lista): imágenes, músculos, instrucciones.

## Datos

**Catálogo** (`apps/gimnasio/exercises.json`, en el repo): por ejercicio `id`, `name`, `primaryMuscles[]`, `secondaryMuscles[]`, `equipment`, `instructions[]`, `images[]`. Base: free-exercise-db (dominio público; el planificador de la implementación verifica la licencia y el formato antes de usarla). **Nombres de ejercicios, músculos y equipo en español** (decidido por el usuario): el JSON guarda `name` en español y `nameEn` con el original, y los músculos/equipo se guardan con una clave interna y su etiqueta en español. La traducción de los ~800 nombres la hace el implementador (con un test que comprueba que ningún ejercicio se queda sin traducir). Las instrucciones paso a paso quedan en inglés salvo que se decida traducirlas también (decisión mía: fuera de esta fase por volumen).

**Rutina** `{ id, name, updatedAt, exercises: [{ exId, sets: [{ reps, weight }] }] }`.

**Entreno** `{ id, startedAt, durationSec, routineId?, routineName, updatedAt, deleted?, exercises: [{ exId, sets: [{ reps, weight, done }] }] }`. Se guarda tal como se hizo, aunque la rutina cambie después.

**Entreno en curso**: copia de trabajo guardada en `localStorage` en cada cambio, para que sobreviva a una recarga o a que iOS cierre la PWA.

**En Firestore** (reglas nuevas, ver abajo):
- `users/{uid}/gym/config` → `{ updatedAt, json }` con rutinas y ajustes (última escritura gana, como Mi-Menu).
- `users/{uid}/gymlogs/{YYYY-MM}` → `{ updatedAt, json }` con los entrenos de ese mes. Evita el límite de 1 MB por documento.

**Fusión de entrenos** al leer un mes: unión por `id`; si un entreno está en ambos lados gana el de `updatedAt` mayor; borrar = `deleted: true` (así dos dispositivos no se pisan). Solo se suben los documentos que cambiaron.

**Reglas de Firestore** (las pega el usuario en la consola): permitir leer/escribir `users/{uid}/gym/**` y `users/{uid}/gymlogs/**` solo con `request.auth.uid == uid` y `sign_in_provider != 'anonymous'`, igual que el documento actual.

## Estadísticas (calculadas en el móvil)

- **Comparación por ejercicio**: por día, tres líneas: peso máximo, volumen total (suma de peso × repeticiones de las series hechas) y 1RM estimado (Epley: `peso × (1 + reps / 30)`, mejor serie del día). Gráficas SVG propias, sin librerías.
- **Esfuerzo por músculo**: series hechas por semana; cuenta 1 para cada músculo principal y 0,5 para cada secundario. Comparación semana a semana.
- **Calendario**: última año en cuadrícula de semanas, intensidad según series hechas ese día; al tocar un día, sus entrenos.

## Compartir plantillas

- Exportar: archivo `.json` `{ type: "mi-app-rutina", version: 1, name, exercises: [{ exId, sets: [{ reps, weight }] }] }`, compartido con la hoja de compartir del móvil o descargado.
- Importar: elegir archivo; se valida tipo y versión, límite de tamaño, `exId` existentes en el catálogo (los desconocidos se descartan y se avisa), números en rango. Los textos se pintan siempre como texto, nunca como HTML. Si ya hay una rutina con ese nombre, se añade como copia.
- Solo viaja la plantilla: nunca historial, pesos reales ni datos de cuenta.

## Sin conexión e imágenes

- El service worker guarda la página, `exercises.json` y el código. Las imágenes se piden al abrir un ejercicio desde un CDN público (jsDelivr sirviendo free-exercise-db), con caché del service worker y tope de cuántas se guardan. Sin conexión y sin caché, se muestra un hueco con el nombre.
- La URL del CDN se fija a una versión concreta del repositorio de ejercicios para que no cambie por debajo.

## Enfoques considerados

1. **Pantallas**: A) una página con pantallas internas (elegido; el entreno en curso no se pierde al navegar) · B) un HTML por pantalla (descartado: frágil con recargas).
2. **Imágenes**: A) catálogo en el repo e imágenes bajo demanda desde CDN (elegido) · B) copiar las imágenes al repo (descartado: cientos de MB).
3. **Datos**: A) un documento con todo (descartado: el historial llenaría 1 MB en ~2 años) · B) rutinas aparte e historial por meses (elegido).

## Decisiones mías (a revisar)

- Un mes por documento y fusión por `id` de entreno; borrado lógico.
- Solo kg. Las instrucciones de cada ejercicio se quedan en inglés en esta fase (nombres, músculos y equipo sí en español).
- Intensidad del calendario por series hechas; gráficas SVG sin librerías.
- Archivo `.json` para compartir (no enlaces ni códigos).

## Para quien lo construya

- Estructura de archivos sugerida: `index.html`, `gym.css`, `gymcore.js` (UMD puro con tests), `core.js` (estado y pantallas), `cloud.js` (REST, patrón de `comidas/cloud.js`), `exercises.json`, `tests/`.
- Ya decidido: lo de este documento. Queda al implementador: diseño visual detallado (seguir el estilo de Mi-Menu), tamaños de página/tope de caché de imágenes, textos de la interfaz.
- Riesgos a vigilar: licencia/forma de los datos de ejercicios; iOS cerrando la PWA en mitad de un entreno; cronómetro que debe calcularse con la hora de inicio (no con un contador) para no pararse con la pantalla apagada.
