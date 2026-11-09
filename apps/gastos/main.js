window.Gastos.start();
// Los cobros de suscripciones se apuntan cuando la nube ya se ha leído (o tras 12 s si no responde)
Promise.race([window.Gastos.cloudReady, new Promise(r => setTimeout(r, 12000))]).then(() => setTimeout(window.Gastos.applySubs, 1500));
document.addEventListener('visibilitychange', () => { if (!document.hidden) window.Gastos.applySubs(); });
