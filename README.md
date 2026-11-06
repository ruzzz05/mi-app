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
│   └── pwa.js              Registra el service worker
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
│   └── comidas/          Menú, qué toca hoy y lista de la compra
│       ├── index.html
│       ├── comidas.css     Tema blanco y amarillo
│       ├── core.js         Estado guardado, navegación, avisos
│       ├── screens/        Una pantalla por archivo: hoy, menu, compra, recetas
│       ├── recipes.js      Lógica: cantidades, ingredientes, migración
│       ├── planner.js      Lógica: crear y editar el menú, puntuación
│       ├── shopping.js     Lógica: lista de la compra
│       ├── schedule.js     Lógica: hora, inicio propuesto, vista de Hoy
│       └── tests/          Tests de la lógica
│
└── tests/          Tests de planner.js
│
└── tests/                Herramientas de test compartidas
    ├── harness.js          Mini arnés de tests
    └── run.sh              Ejecuta todos los tests
```

---

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

1. Crea la carpeta `apps/mi-app/` con su `index.html` (copia la cabecera de otra app: enlaza a `../../shared/styles.css` y `../../shared/pwa.js`).
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

Ejecuta los tests de `apps/*/tests/` con Edge o Chrome sin interfaz (no hace falta Node). Cubren la lógica de Comidas (recetas, menú, lista, horarios), no el aspecto de las pantallas.

La lógica de cada app se escribe con TDD: primero el test que falla, después el código mínimo para que pase.
