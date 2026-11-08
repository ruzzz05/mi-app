// Fotos de recetas (lógica pura). Se guardan reducidas, una por receta, en Firestore.
test('fitSize reduce manteniendo la proporción hasta que el lado mayor cabe', () => {
  assert.eq(Planner.fitSize(4000, 3000, 800), { w: 800, h: 600 });
  assert.eq(Planner.fitSize(3000, 4000, 800), { w: 600, h: 800 });
});

test('fitSize no agranda las imágenes pequeñas', () => {
  assert.eq(Planner.fitSize(400, 300, 800), { w: 400, h: 300 });
});

test('fitSize nunca devuelve una dimensión menor que 1', () => {
  assert.eq(Planner.fitSize(10000, 1, 800), { w: 800, h: 1 });
});

test('compressToFit prueba calidades de mayor a menor y devuelve la primera que cabe', () => {
  const tried = [];
  const encode = q => { tried.push(q); return 'x'.repeat(Math.round(q * 1000)); };
  const out = Planner.compressToFit(encode, 650);
  assert.eq(out.length, 600);          // 0.6 es la primera con <= 650 caracteres
  assert.eq(tried, [0.8, 0.7, 0.6]);
});

test('compressToFit devuelve null si ni con la peor calidad cabe', () => {
  assert.eq(Planner.compressToFit(() => 'x'.repeat(5000), 100), null);
});

test('un documento de foto tiene un límite seguro por debajo de 1 MiB', () => {
  assert.ok(Planner.MAX_PHOTO_CHARS > 100000 && Planner.MAX_PHOTO_CHARS < 1048576);
});

test('photoToFirestore / photoFromFirestore: ida y vuelta', () => {
  const data = 'data:image/jpeg;base64,/9j/4AAQ';
  assert.eq(Planner.photoToFirestore(data), { fields: { data: { stringValue: data } } });
  assert.eq(Planner.photoFromFirestore(Planner.photoToFirestore(data)), data);
});

test('photoFromFirestore rechaza documentos rotos o que no son una imagen', () => {
  assert.eq(Planner.photoFromFirestore(null), null);
  assert.eq(Planner.photoFromFirestore({}), null);
  assert.eq(Planner.photoFromFirestore({ fields: { data: { stringValue: 'hola' } } }), null);
  assert.eq(Planner.photoFromFirestore({ fields: { data: { stringValue: 'data:text/html;base64,AAA' } } }), null);
});

test('newPhotoId da ids seguros para una ruta y distintos entre sí', () => {
  const a = Planner.newPhotoId(), b = Planner.newPhotoId();
  assert.ok(Planner.isPhotoId(a) && Planner.isPhotoId(b));
  assert.ok(a !== b);
});

test('isPhotoId rechaza lo que no sirve como id de documento', () => {
  ['', 'a/b', '../x', 'a b', 'A', null, undefined, 5, 'x'.repeat(65)].forEach(v => assert.eq(Planner.isPhotoId(v), false, String(v)));
});

test('normalizeDish conserva la foto de la receta y no inventa el campo si no hay', () => {
  assert.eq(Planner.normalizeDish({ id: 'a', name: 'A', photo: 'abc123xy', ingredients: [] }).photo, 'abc123xy');
  assert.eq('photo' in Planner.normalizeDish({ id: 'a', name: 'A' }), false);
  assert.eq('photo' in Planner.normalizeDish({ id: 'a', name: 'A', photo: '' }), false);
});

test('migrateState conserva la foto de las recetas', () => {
  const s = Planner.migrateState({ dishes: [{ id: 'a', name: 'A', photo: 'abc123xy', ingredients: ['x'] }], seedPurged: true });
  assert.eq(s.dishes[0].photo, 'abc123xy');
});

test('withPhoto pone, cambia y quita la foto de una receta sin tocar el resto', () => {
  const d = dish('a', ['x']);
  assert.eq(Planner.withPhoto(d, 'abc123xy').photo, 'abc123xy');
  assert.eq(Planner.withPhoto(d, 'abc123xy').ingredients, d.ingredients);
  assert.eq('photo' in Planner.withPhoto(Planner.withPhoto(d, 'abc123xy'), null), false);
});
