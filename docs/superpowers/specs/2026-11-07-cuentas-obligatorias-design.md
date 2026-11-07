# Cuentas obligatorias (usuario + contraseña) para toda la app

Fecha: 2026-11-07

## Intención

Toda la app (portada, Vinilos, Ask, Mi-Menu y las apps futuras) exige tener una sesión iniciada con
usuario y contraseña. La sesión se guarda en el dispositivo. Los datos de Mi-Menu pasan a estar ligados
a la cuenta, así que se ven igual desde cualquier dispositivo. Las apps futuras que usen Firebase
reutilizarán la misma cuenta.

Quién la usa: el dueño y unas pocas personas más. Por eso el registro es abierto.

## Objetivos

- Sin sesión no se ve nada de ninguna página, ni entrando por la portada, ni por la URL directa de
  una app, ni desde la PWA.
- La sesión se pide una vez por sitio (en iPhone, Safari y la PWA instalada tienen almacenamiento
  separado, así que una vez en cada uno) y se conserva.
- Con sesión guardada, la app sigue abriéndose sin conexión.
- Los datos actuales de Mi-Menu del dueño se conservan convirtiendo su identidad anónima en la cuenta.
- Añadir una app nueva con login = una línea `<script>` en su `<head>`.
- Mi-Menu no consulta Firebase en cada apertura (ver "Acceso a Firebase").

## No objetivos

- Recuperar contraseñas olvidadas (no hay email real). Si se olvida, se borra la cuenta en la consola.
- Proteger los CSV y demás archivos estáticos: GitHub Pages es público y cualquiera puede descargar
  una URL directa. Solo los datos de Firestore quedan protegidos de verdad, por las reglas.
- Verificar emails, roles, cuentas de pago, login social.

## Anti-objetivos (sería un fallo aunque "funcione")

- Que se vea la app un instante antes de comprobar la sesión.
- Que, sin sesión y sin poder cargar Firebase, la página se abra en lugar de quedarse bloqueada.
- Que los datos locales de una cuenta acaben subidos a otra cuenta en el mismo dispositivo.

## Enfoques considerados

- **A. Módulo compartido con pantalla superpuesta (elegido).** `shared/auth.js` en todas las páginas;
  tapa la página hasta que hay sesión. Una sola sesión para todas las apps (mismo origen).
- B. Página `login.html` con redirección desde cada app: parpadeo, más difícil en la PWA de iOS, más código.
- C. Una sola pantalla con todas las apps dentro: reescritura grande, no compensa.

## Diseño

### Cuenta

- El usuario se transforma en email: `usuario@mi-app.invalid`. Usuario: minúsculas, números, `.`, `_`, `-`,
  de 3 a 20 caracteres. Contraseña: mínimo 6 (mínimo de Firebase). Se usa Firebase Auth con
  email/contraseña.
- Pantalla con dos modos, "Entrar" y "Crear cuenta", y errores en español (usuario ya existe,
  contraseña incorrecta, sin conexión…).

### `shared/auth.js` (script clásico, en el `<head>` de cada página)

1. Nada más ejecutarse inserta un estilo que oculta la página (`html { visibility: hidden }`).
2. Carga el SDK de Auth de Firebase con `import()` dinámico y espera `authStateReady()`. La sesión
   persiste en el navegador por defecto y se lee sin red.
3. Con sesión con usuario: quita el estilo y la página se muestra. Sin sesión: muestra la pantalla de
   login superpuesta y la página sigue oculta debajo.
4. Si Firebase no carga y no hay sesión, se queda bloqueada.
5. Expone `window.MiAuth`: `ready` (promesa con el usuario), `user`, `signOut()`.

### Migración del dueño

- Si el dispositivo tiene una sesión anónima, la pantalla dice "Crea tu cuenta para conservar tus datos".
  Al registrarse se usa `linkWithCredential`: el uid no cambia, así que `users/{uid}` conserva los datos.
  Después se refresca el token (`getIdToken(true)`) para que las reglas vean el proveedor nuevo.
- Si en lugar de registrarse inicia sesión en una cuenta ya existente, se aplica la lógica de siempre
  (`decideSync`: gana la copia más reciente).
- La sesión anónima ya no se crea nunca en dispositivos nuevos.

### Cambios en Mi-Menu (`cloud.js`)

- Deja de llamar a `signInAnonymously`; espera a `MiAuth.ready` y usa su usuario.
- La config de Firebase se mueve a `shared/firebase-config.js` (la usarán todas las apps).
- Guarda en `localStorage` el uid dueño de los datos locales. Si al conectar es distinto del usuario
  actual, se descartan los datos locales antes de sincronizar. Si no hay dueño guardado (datos
  anteriores a esta versión), se le asignan al usuario actual.

### Acceso a Firebase (no en cada apertura)

- Se guarda en `localStorage` la fecha de la última sincronización por uid.
- Al abrir: si hay datos locales y la última sincronización fue hace menos de 24 h, no se lee nada
  de Firestore ni se pide token.
- Se lee (como ahora) si: no hay datos locales, es un dispositivo o sesión nuevos, o pasaron más de
  24 h.
- Las escrituras siguen igual: una por rato de edición.
- Consecuencia a conocer: un cambio hecho en otro dispositivo puede tardar hasta 24 h en aparecer,
  salvo que se pulse "Sincronizar ahora" (botón nuevo en Mi-Menu, que fuerza lectura y comparación).
  Si se edita en un dispositivo sin haber leído en más de 24 h, antes de subir se hace esa lectura
  (así no se pisa sin mirar). Dentro de la ventana de 24 h, si se editan ambos dispositivos, la copia más reciente
  gana entera (comportamiento actual).

### Portada

- Zona de cuenta: "Sesión: usuario" y botón "Cerrar sesión". Al cerrar se intenta subir lo pendiente
  antes; sin conexión se avisa de que se perderían cambios sin subir y se pide confirmación.

### Reglas de Firestore (a pegar en la consola)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
  }
}
```

### Pasos fuera del código (se los indicaré al dueño)

1. Consola de Firebase → Authentication → activar el proveedor "Email/contraseña".
2. Mantener "Anónimo" activado hasta que el dueño haya migrado su cuenta; después se puede desactivar.
3. Pegar las reglas anteriores.

### Offline y service worker

- Se añaden `shared/auth.js` y `shared/firebase-config.js` a `SHELL` y se cachean (tolerando fallos)
  los módulos del SDK de Firebase Auth, para que la comprobación de sesión funcione sin conexión
  tras el primer uso. Se sube `VERSION` en `sw.js`. Se actualiza `apps.json`.

### Pruebas

Con el arnés actual (`tests/run.sh`, `tests/harness.js`):

- Usuario → email y validación de usuario y contraseña.
- Decisión de "toca leer de la nube" (por antigüedad, por datos vacíos, por dueño distinto).
- Todas las páginas de `apps.json` y la portada incluyen `shared/auth.js` en su `<head>`.
- Verificación manual: sin sesión, con sesión, sin conexión con sesión, URL directa de una app,
  migración del dueño, dos cuentas en un mismo dispositivo.

## Decisiones mías (revisables)

- Registro abierto; contraseña mínima de 6; usuario de 3 a 20 caracteres.
- Un solo script clásico en el `<head>` que carga Firebase con `import()` dinámico.
- Intervalo de sincronización de 24 h.
- Botón "Sincronizar ahora" en la barra superior de Mi-Menu (no estaba pedido; cubre el retraso de 24 h).
- Descartar datos locales cuando cambia el dueño en el dispositivo.
- No se hace commit ni push (preferencia del dueño); el diseño queda sin commitear.

## Para quien construya

- Cómo se coloca el formulario y su estilo (usa `shared/styles.css`).
- Dónde exactamente va el botón de sincronizar y la zona de cuenta en la portada.
- Cómo se cachean los módulos del SDK en el service worker.
