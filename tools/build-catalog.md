# Cómo se generó `apps/gimnasio/exercises.js`

Es un archivo generado una sola vez; no hay paso de compilación en el proyecto.

- **Fuente:** [free-exercise-db](https://github.com/yuhonas/free-exercise-db), licencia **Unlicense** (dominio público). Se usó `dist/exercises.json` del commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (876 ejercicios).
- **Imágenes:** no están en el repo. Se piden bajo demanda a jsDelivr con ese mismo commit fijado (`imageBase` dentro del archivo), p. ej.
  `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/3_4_Sit-Up/0.jpg`.
- **Traducción:** los nombres de los ejercicios, los músculos y el equipo están traducidos al español (`name`; el original queda en `nameEn`). Las claves de músculos y equipo siguen siendo las originales (`chest`, `body only`…) y su etiqueta en español está en `muscles` y `equipment`. Las instrucciones paso a paso siguen en inglés.
- **Qué se guarda por ejercicio:** `id`, `name`, `nameEn`, `primaryMuscles`, `secondaryMuscles`, `equipment` (`null` si no necesita), `instructions`, `images`.
- **Cómo regenerarlo (por ejemplo, para actualizar a otra versión de la base):** descargar el `exercises.json` nuevo, traducir los nombres que falten y volver a producir el archivo con la misma estructura. `apps/gimnasio/tests/catalog.test.html` comprueba que no quede ningún nombre sin traducir, que los músculos y el equipo tengan etiqueta y que `imageBase` fije un commit concreto.
