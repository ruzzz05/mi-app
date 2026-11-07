// Lógica pura de las cuentas (sin red ni DOM): validar usuario y contraseña, convertir el usuario
// en el email interno que usa Firebase, y traducir los errores. Se prueba en shared/tests.
(function (root) {
  const DOMAIN = '@mi-app.invalid';
  const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

  const normalizeUsername = u => String(u == null ? '' : u).trim().toLowerCase();

  function validateUsername(u) {
    return USERNAME_RE.test(normalizeUsername(u))
      ? null
      : 'El usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.';
  }

  function validatePassword(p) {
    return typeof p === 'string' && p.length >= 6 ? null : 'La contraseña debe tener al menos 6 caracteres.';
  }

  const usernameToEmail = u => normalizeUsername(u) + DOMAIN;

  const emailToUsername = email =>
    typeof email === 'string' && email.endsWith(DOMAIN) ? email.slice(0, -DOMAIN.length) : email;

  const BAD_LOGIN = 'Usuario o contraseña incorrectos.';
  const MESSAGES = {
    'auth/email-already-in-use': 'Ese usuario ya existe.',
    'auth/invalid-credential': BAD_LOGIN,
    'auth/invalid-login-credentials': BAD_LOGIN,
    'auth/wrong-password': BAD_LOGIN,
    'auth/user-not-found': BAD_LOGIN,
    'auth/network-request-failed': 'Sin conexión. Inténtalo de nuevo cuando tengas internet.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/operation-not-allowed': 'El registro no está activado todavía (falta activar Email/contraseña en Firebase).'
  };

  const authErrorMessage = code => {
    if (MESSAGES[code]) return MESSAGES[code];
    if (typeof code === 'string' && code.includes('requests-from-referer')) {
      return 'Firebase no permite usar la app desde esta dirección (restricción de la clave de API).';
    }
    return 'No se pudo completar. Inténtalo de nuevo.';
  };

  const api = { normalizeUsername, validateUsername, validatePassword, usernameToEmail, emailToUsername, authErrorMessage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MiAuthCore = Object.assign(root.MiAuthCore || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
