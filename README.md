# Mi App

Aplicación web instalable (PWA) con varias mini-apps. Se publica en GitHub Pages y se añade a la pantalla de inicio del iPhone desde Safari.

**Web:** https://ruzzz05.github.io/mi-app/

---

## Mapa del proyecto

```
mi-app/
│
├── index.html            Menú de inicio (lee apps.json)
├── apps.json             Lista de apps: añadir o quitar aquí
├── manifest.webmanifest  Datos de instalación (nombre, iconos, colores)
├── sw.js                 Service worker: caché y modo sin conexión
├── icons/                Iconos de la app (180, 192 y 512 px)
│
├── shared/               Lo que usan todas las apps
│   ├── styles.css          Tema blanco y negro, botones, campos
│   ├── pwa.js              Registra el service worker
│   ├── auth.js             Puerta de entrada: pide usuario y contraseña (va en todas las páginas)
│   ├── authcore.js         Lógica de las cuentas (validar usuario, mensajes), sin red
│   ├── firebase-config.js  Datos de conexión de Firebase (los usan todas las apps)
│   ├── synccore.js         Reglas de sincronización con la nube comunes (24 h, dueño de los datos, formato Firestore)
│   ├── tests/              Tests de authcore.js, synccore.js y de la puerta de entrada (gate.test.html)
│   └── theme.js            Botón de modo claro/oscuro (lo inserta solo)
│
├── apps/                 Una carpeta por app, todo autocontenido
│   │
│   ├── vinilos/          Biblioteca de discos
│   │   ├── index.html
│   │   ├── musica.csv      Datos: artista, álbum, portada, estilos, enlace
│   │   ├── papaparse.min.js  Lector de CSV
│   │   └── img/            Portadas
│   │
│   ├── ask/              Juego de preguntas (Yo nunca y Ask)
│   │   ├── index.html
│   │   ├── yonunca.csv     Preguntas de Yo nunca
│   │   └── ask.csv         Preguntas de Ask
│   │
│   ├── comidas/          Mi-Menu: menú, qué toca hoy y lista de la compra
│   │   ├── index.html
│   │   ├── comidas.css     Tema blanco y amarillo
│   │   ├── core.js         Estado guardado, navegación, avisos
│   │   ├── screens/        Una pantalla por archivo: hoy, menu, compra, recetas
│   │   ├── recipes.js      Lógica: cantidades, ingredientes, migración
│   │   ├── planner.js      Lógica: crear y editar el menú, puntuación
│   │   ├── shopping.js     Lógica: lista de la compra
│   │   ├── schedule.js     Lógica: hora, inicio propuesto, vista de Hoy
│   │   └── tests/          Tests de la lógica
│   │
│   └── gimnasio/         Gimnasio: rutinas, entrenos y estadísticas
│       ├── index.html
│       ├── gym.css         Tema blanco y naranja
│       ├── core.js         Estado guardado, navegación, avisos
│       ├── screens/        Una pantalla por archivo: perfil, rutinas…
│       ├── gymcore.js      Lógica: estadísticas, copia del entreno, compartir rutinas
│       ├── exercises.js    Catálogo de ejercicios en español (ver tools/build-catalog.md)
│       └── tests/          Tests de la lógica y del catálogo
│
└── tests/          Tests de planner.js
│
└── tests/                Herramientas de test compartidas
    ├── harness.js          Mini arnés de tests
    └── run.sh              Ejecuta todos los tests
```

---

## Cuentas

Toda la app exige una sesión (usuario y contraseña, con Firebase Auth). `shared/auth.js` oculta la página, carga Firebase y muestra el login hasta que hay sesión; la sesión se guarda en el navegador y vale para todas las apps. Internamente el usuario se convierte en `usuario@mi-app.invalid`, así que **no hay recuperación de contraseña**: si alguien la olvida, hay que borrar su cuenta en la consola de Firebase (Authentication → Users). Nunca deja la pantalla en negro: mientras comprueba la sesión muestra "Cargando…" (con el paso y los segundos) y, si tarda, ofrece entrar de nuevo o reintentar; si ya iniciaste sesión en ese dispositivo, la app se ve al instante. Los datos de Mi-Menu se guardan por cuenta y se leen de la nube como mucho una vez cada 24 h (botón "Sincronizar ahora" para forzarlo). Los CSV y demás archivos estáticos siguen siendo públicos (GitHub Pages); solo los datos de Firestore quedan protegidos por las reglas.

---

### Datos del Gimnasio y reglas de Firestore

El Gimnasio guarda tus rutinas en `users/{uid}/gym/config` y tus entrenos en `users/{uid}/gymlogs/{AAAA-MM}` (un documento por mes, para no acercarse al límite de 1 MB). Los entrenos de dos móviles se fusionan por id, así que no se pierde ninguno. Hay que **pegar estas reglas en Firestore → Reglas** (sustituyen a las anteriores; incluyen el documento de Mi-Menu):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.firebase.sign_in_provider != 'anonymous';
      match /{sub=**} {
        allow read, write: if request.auth != null
          && request.auth.uid == uid
          && request.auth.token.firebase.sign_in_provider != 'anonymous';
      }
    }
  }
}
```

Para comprobar que se sube: Firestore → Datos → `users` → tu UID (Authentication → Users) → deben aparecer `gym/config` y `gymlogs/AAAA-MM`. El catálogo de ejercicios (`apps/gimnasio/exercises.js`) viene de free-exercise-db; cómo se generó está en `tools/build-catalog.md`. Las imágenes se piden bajo demanda a jsDelivr.

## Cómo encaja todo

```
 iPhone ──► index.html ──lee──► apps.json ──► tarjetas del menú
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        apps/vinilos          apps/ask             apps/comidas
              └─────────────────────┴──────┬──────────────┘
                                           ▼
                               shared/ (estilos y pwa.js)

 sw.js guarda en caché el núcleo y todos los archivos que listan las apps
```

---

## Añadir una app nueva

1. Crea la carpeta `apps/mi-app/` con su `index.html` (copia la cabecera de otra app: enlaza a `../../shared/styles.css` y `../../shared/pwa.js`). **Imprescindible:** `<script src="../../shared/auth.js"></script>` como primer script del `<head>`, antes de `theme.js`. Sin esa línea la app se abriría sin pedir cuenta (`bash tests/run.sh` lo comprueba).
2. Añade una entrada en `apps.json`:

```json
{
  "id": "mi-app",
  "name": "Nombre",
  "description": "Frase corta para el menú.",
  "path": "apps/mi-app/index.html",
  "accent": "#f5c518",
  "files": ["apps/mi-app/datos.csv"]
}
```

`accent` es opcional (punto de color en el menú). `files` lista lo que debe funcionar sin conexión.

3. Sube el número de `VERSION` en `sw.js`.

## Quitar una app

Borra su entrada de `apps.json` y, si quieres, su carpeta en `apps/`.

---

## Actualizar la app instalada

| Cambias | Qué hacer |
|---|---|
| CSV, páginas `.html` | Nada. Se ven al recargar. |
| CSS, JS, iconos, `apps.json` | Sube `VERSION` en `sw.js` antes del push. |
| Icono o nombre de la app | Quítala de la pantalla de inicio y vuelve a añadirla. |

Tras un push, espera a que termine el despliegue (pestaña *Actions*), cierra la app del todo y ábrela dos veces.

---

## Probar en local

```
python -m http.server 8000
```

Abre `http://localhost:8000`. Sin servidor no funcionan ni el service worker ni la carga de los CSV.

## Tests

```
bash tests/run.sh
```

Ejecuta los tests de `apps/*/tests/` y `shared/tests/` (y comprueba que todas las páginas incluyen `auth.js`) con Edge o Chrome sin interfaz (no hace falta Node). Cubren la lógica de Comidas (recetas, menú, lista, horarios), no el aspecto de las pantallas.

La lógica de cada app se escribe con TDD: primero el test que falla, después el código mínimo para que pase.
