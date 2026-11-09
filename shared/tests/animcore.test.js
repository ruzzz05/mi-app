// Pruebas de la lógica pura de las animaciones (sin DOM)
const A = window.AnimCore;

test('ease: empieza en 0, acaba en 1, nunca baja y frena al final', () => {
  assert.eq(A.ease(0), 0);
  assert.eq(A.ease(1), 1);
  let prev = -1;
  for (let i = 0; i <= 20; i++) { const v = A.ease(i / 20); assert.ok(v >= prev); prev = v; }
  assert.ok(A.ease(0.5) > 0.5, 'a mitad de tiempo ya pasó de la mitad');
  assert.eq(A.ease(-3), 0);
  assert.eq(A.ease(7), 1);
});

test('formatCount: miles al estilo español y decimales con coma', () => {
  assert.eq(A.formatCount(12840, 0), (12840).toLocaleString('es-ES'));
  assert.eq(A.formatCount(1234.56, 0), (1235).toLocaleString('es-ES'));
  assert.eq(A.formatCount(48.2, 2), '48,20');
  assert.eq(A.formatCount(0, 1), '0,0');
});

test('countText: empieza en 0, acaba exactamente en el valor y sube sin saltos hacia atrás', () => {
  assert.eq(A.countText(500, 0, 0), '0');
  assert.eq(A.countText(500, 1, 0), '500');
  assert.eq(A.countText(412.4, 1, 2), '412,40');
  const mid = Number(A.countText(1000, 0.5, 0).replace(/\./g, ''));
  assert.ok(mid > 500 && mid < 1000, 'a mitad de tiempo: ' + mid);
});

test('delayFor: escalona los elementos y no pasa de un tope', () => {
  assert.eq(A.delayFor(0), 0);
  assert.eq(A.delayFor(3), 210);
  assert.eq(A.delayFor(100), 560);
  assert.eq(A.delayFor(5, 100, 300), 300);
});

test('direction: la pestaña nueva entra desde el lado hacia el que vas', () => {
  assert.eq(A.direction(0, 2), 'r');
  assert.eq(A.direction(2, 0), 'l');
  assert.eq(A.direction(1, 1), '');
  assert.eq(A.direction(-1, 1), '');   // viene de fuera de las pestañas: sin dirección
  assert.eq(A.direction(1, -1), '');
});

test('formatCount con grupos: puntos de miles también desde 4 cifras (como los euros de Gastos)', () => {
  assert.eq(A.formatCount(1234, 0, true), '1.234');
  assert.eq(A.formatCount(987, 0, true), '987');
  assert.eq(A.formatCount(1234567.5, 2, true), '1.234.567,50');
  assert.eq(A.countText(1234, 1, 0, true), '1.234');
});
