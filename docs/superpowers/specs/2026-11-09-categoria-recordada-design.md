# Gastos: categoría recordada por comercio

## Qué y por qué
Cada comercio tiene una sola categoría: la última que eligió el usuario. Así no hay que volver a
categorizar el mismo comercio cada vez, y el historial queda coherente.

## Comportamiento
- **Mismo comercio** = mismo nombre sin distinguir mayúsculas, acentos ni espacios sobrantes.
- **Recordar**: un gasto nuevo toma la categoría del gasto confirmado más reciente del mismo comercio.
  Basta con un único gasto anterior. Si no hay ninguno, se usa lo de hoy (palabras fijas de
  `guessCategory`, y si no, «Otros»).
- **Reescribir**: cuando el usuario elige una categoría para un gasto (al apuntarlo a mano, al
  confirmar un pago por revisar o al editar uno ya apuntado), todos los gastos de ese comercio,
  de cualquier mes, pasan a esa categoría. Cambia los totales de meses cerrados; es lo pedido.
- **Gasto a mano**: al escribir el comercio se marca su categoría recordada; se puede tocar otra.
- **Apple Pay**: un pago de comercio conocido entra directo con su categoría, sin pasar por
  «por revisar». Uno desconocido sigue como hoy.
- **Editar un gasto**: la hoja que hoy solo cambia la fecha permite también cambiar la categoría.
  Es la única forma de corregir un comercio sin apuntar un gasto nuevo.
- **Historial mezclado** (un comercio que hoy tiene gastos en varias categorías): no se toca al
  actualizar la app; se unifica la próxima vez que el usuario elija categoría para ese comercio.
  Mientras tanto manda el gasto más reciente.

## Fuera de alcance
- Cobros automáticos de suscripciones: siguen entrando como «Suscripciones» y no reescriben nada.
- Agrupar nombres parecidos («Mercadona» y «Mercadona Valencia» son comercios distintos).
- Otras apps y código compartido, salvo subir `shared/version.js` a 0.8.23.

## Enfoques
1. **Deducir del historial** (elegido): la categoría sale de los gastos ya guardados. No hay datos
   nuevos, el historial existente cuenta desde el primer día y la nube se sincroniza sin cambios.
   Pega: si se borran todos los gastos de un comercio, se olvida su categoría.
2. **Guardar una tabla comercio → categoría**: sobrevive a borrados, pero añade un dato nuevo al
   estado local y a la copia de la nube, y habría que rellenarla desde el historial la primera vez.

## Para quien lo construya
- Lógica pura en `apps/gastos/gastoscore.js` con tests en `apps/gastos/tests` (TDD): una función
  que devuelve la categoría recordada de un comercio y otra que aplica una categoría a todos los
  gastos de un comercio.
- Usarlas en `core.js` (hoja de gasto nuevo, `addIncoming`), `screens/auto.js` (confirmar) y
  `screens/resumen.js` (hoja de edición).
- Una categoría recordada que ya no exista en la lista se trata como desconocida.
- Test e2e del flujo en `tests/e2e/gastos.spec.js`.
