// Registra el service worker desde la raíz del sitio, esté la página donde esté.
(function () {
  if (!('serviceWorker' in navigator)) return;
  const base = new URL('.', document.currentScript.src);
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', base), { scope: base.href })
      .catch(err => console.warn('SW no registrado:', err));
  });
})();
