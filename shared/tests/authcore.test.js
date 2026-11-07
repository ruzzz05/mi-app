// Funciones puras de cuenta: validar, convertir usuario <-> email, mensajes de error
const A = MiAuthCore;

test('usernameToEmail: ignora espacios y mayusculas', () => {
  assert.eq(A.usernameToEmail('  Ana '), 'ana@mi-app.invalid');
  assert.eq(A.usernameToEmail('ana'), 'ana@mi-app.invalid');
});

test('validateUsername: acepta usuarios correctos', () => {
  assert.eq(A.validateUsername('ana'), null);
  assert.eq(A.validateUsername('a.b_c-1'), null);
  assert.eq(A.validateUsername('a'.repeat(20)), null);
  assert.eq(A.validateUsername('  Ana '), null);
});

test('validateUsername: rechaza usuarios incorrectos', () => {
  ['ab', 'a'.repeat(21), 'a b', 'a@b.com', 'Ñandú', ''].forEach(u => {
    assert.eq(typeof A.validateUsername(u), 'string', 'usuario ' + JSON.stringify(u));
  });
});

test('validatePassword: minimo 6 caracteres', () => {
  assert.eq(A.validatePassword('123456'), null);
  assert.eq(typeof A.validatePassword('12345'), 'string');
  assert.eq(typeof A.validatePassword(''), 'string');
});

test('emailToUsername: quita el dominio interno', () => {
  assert.eq(A.emailToUsername('ana@mi-app.invalid'), 'ana');
  assert.eq(A.emailToUsername('x@y.com'), 'x@y.com');
});

test('authErrorMessage: traduce los codigos de Firebase', () => {
  assert.eq(A.authErrorMessage('auth/email-already-in-use'), 'Ese usuario ya existe.');
  ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].forEach(c =>
    assert.eq(A.authErrorMessage(c), 'Usuario o contraseña incorrectos.'));
  assert.eq(A.authErrorMessage('auth/network-request-failed'), 'Sin conexión. Inténtalo de nuevo cuando tengas internet.');
  assert.eq(A.authErrorMessage('auth/too-many-requests'), 'Demasiados intentos. Espera un momento.');
  assert.eq(A.authErrorMessage('auth/operation-not-allowed'), 'El registro no está activado todavía (falta activar Email/contraseña en Firebase).');
  assert.eq(A.authErrorMessage('auth/lo-que-sea'), 'No se pudo completar. Inténtalo de nuevo.');
});

test('authErrorMessage: explica el bloqueo de la clave de API por dirección', () => {
  assert.eq(A.authErrorMessage('auth/requests-from-referer-http://localhost:8000-are-blocked.'),
    'Firebase no permite usar la app desde esta dirección (restricción de la clave de API).');
});
