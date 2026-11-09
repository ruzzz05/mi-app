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
│   │   ├── vinilos-core.js   Lógica: enlaces de Spotify, fusión, validación (con tests)
│   │   ├── vinilos-cloud.js  Discos añadidos desde la app (Firestore)
│   │   ├── vinilos-config.js UID del dueño (quién ve el botón de añadir)
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
│       ├── healthcore.js   Lógica: pasos y calorías de Google Health (sin red)
│       ├── health.js       Conexión con Google Health; google-config.js lleva el ID de cliente
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
    // Vinilos: la colección añadida desde la app la puede leer cualquier cuenta con sesión,
    // pero solo la puede escribir el dueño (pon aquí TU UID)
    match /vinilos/{doc} {
      allow read: if request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous';
      allow write: if request.auth != null
        && request.auth.uid == 'PEGA_AQUI_TU_UID';
    }
  }
}
```

Para comprobar que se sube: Firestore → Datos → `users` → tu UID (Authentication → Users) → deben aparecer `gym/config` y `gymlogs/AAAA-MM`. El catálogo de ejercicios (`apps/gimnasio/exercises.js`) viene de exercises-dataset (hasaneyldrm); cómo se generó está en `tools/build-catalog.md`. Las imágenes se piden bajo demanda a jsDelivr.

### Vinilos: añadir discos desde la app

Vinilos enseña una pared de portadas (3 por fila). Los 56 discos del archivo `apps/vinilos/musica.csv` siguen ahí, y **solo el dueño** puede añadir más desde la propia app (botón "+ Añadir disco"). Cualquier cuenta con sesión los ve.

- **Cómo se añade:** en Spotify, en el álbum, *Compartir → Copiar enlace*; se pega en la app, que lee el nombre y la portada de Spotify (oEmbed, público) y sugiere artista, año y estilo (buscador de iTunes). Al tocar el disco se abre ese álbum en Spotify.
- **Dónde se guardan:** Firestore, documento `vinilos/coleccion`. La nube se lee como mucho una vez cada 24 h; al añadir se lee antes de escribir para no pisar lo de otro dispositivo.
- **Para activarlo (una vez):**
  1. Copia tu **UID** (Firebase → Authentication → Usuarios, columna *UID de usuario*).
  2. Pégalo en `apps/vinilos/vinilos-config.js` (`ownerUid: '...'`). Solo decide si se enseña el botón.
  3. Pégalo también en las reglas de Firestore, en lugar de `PEGA_AQUI_TU_UID` (el bloque de reglas de la sección anterior, "Datos del Gimnasio", que son las reglas completas de la app). **Esto es lo que impide de verdad que otra persona escriba**. Publica las reglas.

### Gimnasio: pasos, calorías y recuperación (Google Health)

La pantalla **Hoy** del Gimnasio muestra los pasos y calorías de tu pulsera Google Fitbit Air a través de la Google Health API. Además calcula una **recuperación diaria** (estilo Bevel) con tu sueño, tu pulso en reposo y tu variabilidad del pulso (VFC), y en **Perfil** enseña la evolución de los últimos 14 días. Los datos de salud se guardan solo en el móvil; no se suben a Firebase. La puntuación es orientativa (sueño 35 %, VFC 40 %, pulso en reposo 25 %, comparando con tu media de los 14 días anteriores) y no es un dato médico. Es un experimento sin servidor: el navegador pide un permiso a Google (dura ~1 h) y consulta la API con él. Para activarlo hay que crear el acceso en Google Cloud **una sola vez**:

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y elige el proyecto de Firebase (`mi-app-490b5`) o crea uno.
2. **APIs y servicios → Biblioteca**: busca **Google Health API** y pulsa *Habilitar*.
3. **Google Auth Platform** (pantalla de consentimiento): tipo *Externo*, pon un nombre y tu correo; en *Público* deja el estado **En pruebas** y añade tu cuenta de Google (la de la pulsera) como **usuario de prueba**; en *Acceso a los datos* añade los tres permisos `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly` (pasos y calorías), `https://www.googleapis.com/auth/googlehealth.sleep.readonly` (sueño) y `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly` (pulso en reposo y VFC).
4. **Clientes → Crear cliente → Aplicación web**. En *Orígenes autorizados de JavaScript* pon `https://ruzzz05.github.io`. Copia el **ID de cliente**.
5. Pégalo en `apps/gimnasio/google-config.js` (`clientId: '...'`), sube el cambio y abre Hoy → **Conectar con Google**. Google avisará de que la app no está verificada: *Avanzado → Continuar*. **Deja marcadas todas las casillas de permisos**: si desmarcas alguna, Hoy lo dirá y ofrecerá "Ampliar permisos". Si ya estabas conectado antes de que existieran los permisos de sueño y salud, pulsa **Ampliar permisos** una vez.

El ID de cliente no es un secreto. Mientras la app de Google Cloud esté "En pruebas", el permiso **caduca** (calculo que cada ~7 días): la pantalla lo dirá y bastará pulsar *Volver a conectar*. Si el inicio de sesión de Google no funciona dentro de la app instalada en el iPhone, la alternativa es una función en la nube de Firebase (requiere activar la facturación).

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

Ejecuta los tests de `apps/*/tests/` y `shared/tests/` (y comprueba que todas las páginas incluyen `auth.js`) con Edge o Chrome sin interfaz (no hace falta Node). Cubren la lógica de Comidas (recetas, menú, lista, horarios, fotos, segundos platos) y la de sincronización; las pantallas se prueban con los tests de pantalla (abajo).

La lógica de cada app se escribe con TDD: primero el test que falla, después el código mínimo para que pase.

### Tests de pantalla (Playwright)

```
npm install        # una vez (necesita Node.js)
npm run e2e
```

Abren las apps de verdad en Edge, con la cuenta de pruebas, y comprueban recetas con foto, segundos platos, Hoy, el uso sin conexión (con el service worker activo) y el punto de sincronización. Están en `tests/e2e/`.

- **Prueban el código local contra el Firebase real.** `tests/e2e/fixtures.js` sirve los archivos del repositorio bajo la dirección de GitHub Pages (`https://ruzzz05.github.io/mi-app/`), así que Firebase los trata como la web publicada y no hace falta subir nada. Todo lo demás (Firebase, gstatic) va a internet.
- **Cuenta de pruebas:** usuario y contraseña en `tests/e2e/credenciales.local.json`, que está en `.gitignore` (la web es pública: no se sube al repositorio). Si la cuenta no existe, los tests la crean. Al empezar cada test se borran sus datos en la nube (estado, fotos y gimnasio), solo los de esa cuenta.
- **Sin conexión de verdad:** `setOffline()` corta la red y además hace que el servidor local rechace las peticiones, para que solo abra lo que el service worker tenga en caché.
- **Punto de sincronización:** `shared/syncbadge.js` pinta el punto junto al botón de sincronizar (verde sincronizado, ámbar cambios sin subir, gris sin conexión, rojo error, azul sincronizando). Las reglas de qué estado toca están en `SyncCore.statusOf` (`shared/synccore.js`, con tests en `shared/tests`).
