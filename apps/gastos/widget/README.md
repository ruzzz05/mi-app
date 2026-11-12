# Widget de Gastos para iPhone

Una PWA no puede tener widgets en iOS. Este widget se hace con la app gratuita **Scriptable**: enseña lo que
queda del presupuesto del mes y el próximo cobro de una suscripción, leyendo tu copia de Gastos en la nube.

## Instalar

1. Instala **Scriptable** desde la App Store.
2. Abre Scriptable, toca **+** y pega todo el contenido de `gastos-widget.js`. Ponle de nombre `Gastos`.
3. Toca ▶ para ejecutarlo. Escribe tu usuario y contraseña de Mi App. Debe aparecer el widget de prueba.
4. En la pantalla de inicio: mantén pulsado un hueco → **Editar** → **Añadir widget** → **Scriptable** → tamaño pequeño o mediano.
5. Mantén pulsado el widget → **Editar widget** → en **Script** elige `Gastos`.

## Qué hay que saber

- La contraseña no se guarda: solo la llave de sesión de Firebase, en el llavero del iPhone.
- Para cerrar sesión, ejecuta el script dentro de Scriptable y elige **Cerrar sesión**.
- iOS decide cuándo se refresca el widget (cada 15 minutos o más).
- Sin conexión enseña los últimos datos y lo indica con "sin conexión".
- Las cuentas las hace `gastoscore.js`, que el widget baja de la web publicada: si cambia la lógica de la app,
  el widget la sigue sin tocar nada.
- Tocar el widget abre Gastos en Safari, no la app instalada en la pantalla de inicio (límite de iOS).

La parte que calcula lo que se enseña (`GastosWidget.model`) se prueba en `apps/gastos/tests/widget.test.html`.
