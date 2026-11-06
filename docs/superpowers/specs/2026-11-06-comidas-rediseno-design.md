# Comidas: rediseño del flujo (recetas, menú con borrador, Hoy, Compra)

Estado: aprobado por el usuario. **Actualización:** se eliminó el complemento (no hay tipo principal/complemento ni segundo plato por comida). Cada ingrediente lleva una cantidad y, si un plato se repite en el menú, la lista cuenta su ingrediente tantas veces como aparezca.

## Intención
El usuario escribe todas las recetas que sabe. Con ellas, la app crea un menú de los días que el usuario pida, con sentido (sin repetir comidas ni ingredientes), el usuario lo revisa antes de confirmarlo, y después la app le dice qué toca comer o cenar hoy y le da la lista de la compra de todo el menú. El menú se puede editar en cualquier momento y la lista de la compra se ajusta sola.

## Objetivos
- Crear y editar recetas con ingredientes y cantidades, indicando si cada plato es **principal** o **complemento**.
- Generar un menú de N días con comida y cena, empezando cuando el usuario diga.
- Revisar un borrador: "no quiero esta comida" la sustituye por otra. Solo al confirmar pasa a ser el menú activo.
- Editar el menú confirmado en cualquier momento: cambiar un plato por una alternativa o rechazarlo. La lista de la compra se actualiza.
- Pantalla Hoy: día actual del menú y qué toca (comida o cena según la hora).
- Pantalla Compra: lista automática de todo el menú, modificable (quitar, añadir, marcar).

## No objetivos
- Sin sincronización entre dispositivos ni cuentas (datos en `localStorage`).
- Solo comidas y cenas: sin desayunos ni meriendas.
- Sin recetas precargadas: el usuario escribe las suyas.

## Anti-objetivo
Un menú que repita el mismo plato o el mismo ingrediente principal en comidas cercanas, aunque técnicamente esté completo.

## Decisiones del usuario
- El tipo de plato (carne, pescado…) **no** se pide: la app lo deduce de los ingredientes y procura repetir pocos.
- Cada receta se marca como **principal** o **complemento** al crearla.
- Los ingredientes llevan cantidad en unidades (ej. pollo 2; si es complemento, 1,5).
- El usuario indica cuántos días quiere el menú y **cuándo empieza**.
- Al crear el menú, según la hora, se propone: día completo, empezar por la cena, o empezar mañana. El usuario puede cambiarlo.
- Corte de la comida: **antes de las 17:00 toca comida; desde las 17:00, cena.**
- El menú, también el confirmado, se puede editar siempre, y la lista de la compra se modifica con él.
- Solo comida y cena.
- El resto de puntos del borrador anterior (barra inferior de cuatro pantallas, cantidades con coma, datos existentes conservados, etc.) están aceptados.

## Decisiones mías (a corregir si no encajan)
- **Principal + complemento en cada hueco:** cada comida o cena lleva un plato principal y, si el usuario tiene recetas de complemento, además uno de complemento. Sin complementos, solo principal. "No la quiero" y "otro" actúan por separado sobre el principal o sobre el complemento.
- **Propuesta de inicio según la hora de creación:** antes de las 17:00, hoy día completo; de 17:00 a 22:00, hoy empezando por la cena; después de las 22:00, mañana.
- **Contar días:** el día de inicio cuenta como día 1 aunque solo tenga cena. N va de 1 a 14, por defecto 7.
- **Ingrediente principal de una receta:** el de mayor cantidad.
- **Al terminar el último día:** Hoy avisa de que el menú terminó y propone crear otro.
- **Lista de la compra:** cubre todas las comidas del menú. Los cambios del usuario sobre la lista se conservan al editar el menú y se reinician con un menú nuevo.
- **Cantidades:** decimales con coma o punto; en pantalla con coma (1,5). La lista suma cantidades.
- **Datos existentes:** los platos guardados se conservan (ingredientes con cantidad 1, tipo principal). Los de ejemplo ya no se cargan en usuarios nuevos.

## Cómo elige la app (menú con sentido)
Por cada hueco puntúa los platos permitidos y elige el de menor coste, con desempate aleatorio:
1. Plato ya usado en el menú: coste muy alto (solo se repite si no queda otro).
2. Mismo ingrediente principal que alguna de las 3 comidas anteriores o siguientes ya fijadas: coste alto.
3. Ingredientes compartidos con las comidas cercanas: coste medio por cada uno.
4. Ingredientes compartidos con el resto del menú: coste bajo por cada uno.
Platos sin ingredientes no suman coste por ingredientes. Los principales se puntúan entre principales y los complementos entre complementos, pero los ingredientes compartidos cuentan entre ambos.

## Enfoques considerados
- **A. Puntuación por costes (elegido):** simple, se prueba con TDD, las reglas se ajustan cambiando pesos.
- **B. Reglas duras (prohibir y listo):** falla cuando hay pocas recetas y deja huecos vacíos.
- **C. Etiquetas manuales de tipo (carne, pescado…):** más preciso pero exige trabajo extra; el usuario lo descartó.

## Pantallas (barra inferior: Hoy, Menú, Compra, Recetas)
- **Recetas:** lista y formulario: nombre, principal o complemento, filas de ingrediente con cantidad. Sin recetas, las demás pantallas invitan a añadir.
- **Menú:** sin menú → formulario "Crear menú" (días, cuándo empieza, con la propuesta según la hora). Con borrador → días con sus huecos, "No la quiero" y "Otro" por plato, "Regenerar todo", "Confirmar menú". Con menú confirmado → igual pero ya activo, editable, y "Menú nuevo".
- **Hoy:** día X de N con fecha real; tarjeta grande con lo que toca (principal y complemento, con ingredientes) y debajo la otra comida del día.
- **Compra:** generada del menú, cantidades sumadas; quitar, volver a poner, añadir a mano y marcar.

## Para el constructor
- La lógica sigue en `apps/comidas/planner.js` con tests primero (`bash tests/run.sh`); la interfaz en `comidas.js`.
- Cambios en la lógica: días variables y primer hueco de arranque (comida o cena del día 1), ingredientes con cantidad (aceptando los textos antiguos), tipo principal/complemento por plato y entrada de hueco con complemento opcional, puntuación, cálculo de qué toca (fecha y hora inyectables para los tests), propuesta de inicio según la hora, y suma de cantidades en la lista.
- `parseDishList` deja de usarse y se elimina.
- Subir `VERSION` en `sw.js` y actualizar `README.md`.
