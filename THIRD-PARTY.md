# Material de terceros y créditos

La licencia del repositorio (`LICENSE`) cubre **solo el código y la documentación propios**. Todo lo de esta lista conserva su dueño y sus condiciones. Si reutilizas el proyecto, tú eres responsable de cumplirlas.

## Imágenes del Gimnasio (Gym visual)

- **Qué:** miniaturas de 180×180 de los ejercicios. **No están en este repositorio**: se piden bajo demanda a jsDelivr.
- **Dueño:** © Gym visual — https://gymvisual.com/
- **Origen:** [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (hasaneyldrm), commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. El titular las redistribuye con permiso a esa resolución.
- **Condiciones:** hay que mostrar siempre el crédito «© Gym visual — https://gymvisual.com/» (la app lo enseña en la ficha de cada ejercicio). El permiso es independiente de la licencia MIT del dataset y se rige por los [Términos de Gym visual](https://gymvisual.com/content/3-terms-and-conditions-of-use). **Clonar el repositorio no da derechos sobre las imágenes**: para otro uso, pide licencia a Gym visual.
- **Importante:** las imágenes no pueden usarse con fines comerciales sin licencia propia de Gym visual; esto refuerza la cláusula no comercial de `LICENSE`.

## Datos del catálogo de ejercicios

- `apps/gimnasio/exercises.js` deriva de exercises-dataset: nombres, músculos, equipo e instrucciones, bajo **licencia MIT** (© sus autores). Los nombres están traducidos al español a mano. Cómo se generó: `tools/build-catalog.md`.

## Portadas de discos (Vinilos)

- **Qué:** las portadas de `apps/vinilos/img/` y las que `musica.csv` enlaza desde fuera, además de las que Spotify (oEmbed) e iTunes devuelven al añadir un disco.
- **Dueño:** cada portada es © de su artista, sello o autor. **No se licencian bajo MIT ni bajo ninguna licencia de este proyecto**; se incluyen solo como ilustración personal de una colección privada de discos.
- **Si publicas o reutilizas el proyecto:** borra `apps/vinilos/img/` y las portadas de `musica.csv`, o sustitúyelas por las tuyas. Si eres titular de alguna y quieres que se retire, abre un issue y se quitará.
- Los datos de Spotify e iTunes se consultan en directo y se rigen por sus propias condiciones.

## Fuentes tipográficas

En `shared/fonts/`, bajo la **SIL Open Font License 1.1** (uso libre, también comercial, sin vender las fuentes solas):

- Bricolage Grotesque — © The Bricolage Grotesque Project Authors
- DM Sans — © The DM Sans Project Authors
- Manrope — © The Manrope Project Authors

## Librerías

| Librería | Licencia | Uso |
|---|---|---|
| [Papa Parse](https://github.com/mholt/PapaParse) 5.4.1 (`apps/vinilos/papaparse.min.js`) | MIT | Lee los CSV |
| [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk) | Apache 2.0 | Cuentas y Firestore (se carga desde gstatic) |
| [Playwright](https://github.com/microsoft/playwright) | Apache 2.0 | Solo tests e2e (`devDependency`) |

## Servicios externos

Firebase (Google), Google Health API, Google Identity Services, jsDelivr, Spotify oEmbed y iTunes Search. Se usan bajo sus propios términos; esta licencia no concede nada sobre ellos.

## Contenido de los CSV

`apps/ask/*.csv` (preguntas de Yo nunca y Ask) es contenido propio del proyecto y entra en `LICENSE`, salvo que alguna pregunta proceda de otra fuente: en ese caso mantiene la suya.
