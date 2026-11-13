# Widget de Mi-Menu para iPhone

Una PWA no puede tener widgets en iOS. Este widget se hace con la app gratuita **Scriptable**: enseña qué toca
comer (o cenar) ahora según tu menú y qué viene después, leyendo tu copia de Mi-Menu en la nube.

## Instalar

1. Abre Scriptable, toca **+** y pega todo el contenido de `comidas-widget.js`. Ponle de nombre `Menu`.
2. Toca ▶ para ejecutarlo. Escribe tu usuario y contraseña de Mi App (una vez, aparte del widget de Gastos).
3. En la pantalla de inicio: mantén pulsado un hueco → **Editar** → **Añadir widget** → **Scriptable** → pequeño o mediano.
4. Mantén pulsado el widget → **Editar widget** → en **Script** elige `Menu`.

## Qué hay que saber

- Hasta las 17:00 enseña la comida; desde las 17:00, la cena (igual que la pantalla Hoy de la app).
- Abajo pone lo siguiente ("Después: Cena · …" o "Mañana · Comida · …").
- La contraseña no se guarda: solo la llave de sesión de Firebase, en el llavero del iPhone.
- Para cerrar sesión, ejecuta el script dentro de Scriptable y elige **Cerrar sesión**.
- Sin conexión enseña los últimos datos y lo indica con "sin conexión".
- Decide qué toca con `recipes.js`, `planner.js` y `schedule.js`, que baja de la web publicada.

La parte que calcula lo que se enseña (`MenuWidget.model`) se prueba en `apps/comidas/tests/widget.test.html`.

## Versión Rosa noche

`comidas-widget-rosa.js` es lo mismo con los colores de la paleta Rosa noche de la app (fondo `#1c1318`, acento `#f4a3c0`).
Se instala igual (nómbralo `Menu rosa`) y comparte la sesión con `Menu`, así que no pide la contraseña otra vez.
