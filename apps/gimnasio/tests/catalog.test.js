// Comprobaciones del catálogo de ejercicios (traducción y consistencia)
const CAT = window.GymCatalog;

// Nombres que pueden quedar igual que el original (nombres propios o términos que se usan tal cual en español)
const SAME_NAME_OK = new Set([
  'Burpee', 'Superman', 'Bosu Ball Push-Up', 'Pilates', 'Jumping Jacks', 'Crunches', 'Otis-Up'
].map(n => n.toLowerCase()));

// Palabras inglesas que no deberían quedar en un nombre ya traducido
const ENGLISH = /\b(squats?|raises?|lunges?|deadlifts?|dumbbells?|barbells?|bench|push|pull|rows?|cable|machine|kettlebells?|lying|standing|seated|reverse|overhead|incline|decline|alternating)\b/i;

test('el catálogo tiene cientos de ejercicios y los datos de apoyo', () => {
  assert.ok(CAT && Array.isArray(CAT.exercises), 'falta GymCatalog.exercises');
  assert.ok(CAT.exercises.length > 800, 'hay ' + CAT.exercises.length);
  assert.ok(CAT.muscles && CAT.equipment && CAT.imageBase);
});

test('los id son únicos y no están vacíos', () => {
  const ids = CAT.exercises.map(e => e.id);
  assert.ok(ids.every(Boolean));
  assert.eq(new Set(ids).size, ids.length);
});

test('todo ejercicio tiene nombre en español distinto del original (salvo nombres propios)', () => {
  const bad = CAT.exercises.filter(e => !e.name || !e.nameEn ||
    (e.name === e.nameEn && !SAME_NAME_OK.has(e.name.toLowerCase())));
  assert.eq(bad.map(e => e.id), []);
});

test('ningún nombre traducido conserva palabras inglesas habituales', () => {
  // "push press" se dice tal cual en español: no cuenta como inglés sin traducir
  const clean = name => name.replace(/push press/ig, '');
  const bad = CAT.exercises.filter(e => ENGLISH.test(clean(e.name)) && !SAME_NAME_OK.has(e.name.toLowerCase()));
  assert.eq(bad.map(e => e.name + ' <- ' + e.nameEn), []);
});

test('todo músculo y equipo usado existe con etiqueta en español', () => {
  const usedM = new Set(), usedE = new Set();
  CAT.exercises.forEach(e => {
    e.primaryMuscles.concat(e.secondaryMuscles).forEach(m => usedM.add(m));
    if (e.equipment) usedE.add(e.equipment);
  });
  assert.eq([...usedM].filter(m => !CAT.muscles[m]), []);
  assert.eq([...usedE].filter(q => !CAT.equipment[q]), []);
  assert.eq(CAT.muscles.chest, 'Pecho');
});

test('todo ejercicio trabaja al menos un músculo principal', () => {
  assert.eq(CAT.exercises.filter(e => !e.primaryMuscles.length).map(e => e.id), []);
});

test('las imágenes son rutas relativas y la base fija una versión concreta (no main/master)', () => {
  assert.ok(/@[0-9a-f]{40}\//.test(CAT.imageBase), CAT.imageBase);
  assert.ok(CAT.exercises.every(e => e.images.every(i => !/^https?:|^\//.test(i))));
});
