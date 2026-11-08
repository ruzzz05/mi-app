// Tests de pantalla (end-to-end) con Edge. Se ejecutan con: npm run e2e
// El código local se sirve bajo la dirección de GitHub Pages (ver tests/e2e/fixtures.js) para que
// Firebase lo trate como la web real, sin necesidad de subir nada.
const { defineConfig } = require('@playwright/test');

// Que las peticiones del service worker también pasen por el servidor local (ver tests/e2e/fixtures.js)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,            // una sola cuenta de pruebas: que los tests no se pisen
  retries: 0,
  reporter: [['list']],
  use: {
    channel: 'msedge',   // el Edge instalado; no descarga otro navegador
    headless: true,
    baseURL: 'https://ruzzz05.github.io/mi-app/',
    serviceWorkers: 'block',
    locale: 'es-ES'
  }
});
