// Pantalla Automático: cómo apuntar los pagos con Apple Pay sin abrir la app (Atajos de iOS).
(() => {
  const G = window.Gastos;

  function render(el) {
    el.innerHTML = `
      <div class="screen-head"><h2>Automático</h2></div>
      <p class="sub">Apunta cada pago con Apple Pay sin abrir la app.</p>
      <div class="card pad">
        <b>Cómo va a funcionar</b>
        <ol class="steps">
          <li>En Atajos de iOS, una automatización con el disparador <i>Transacción</i> salta cada vez que pagas con una tarjeta de Wallet.</li>
          <li>El Atajo envía el comercio y el importe a tu cuenta, y aparecen aquí solos.</li>
          <li>Los cobros repetidos se convierten en suscripciones sugeridas.</li>
        </ol>
        <p class="note">Falta conectar la bandeja con la nube. Es el siguiente paso.</p>
      </div>`;
  }

  G.register('ajustes', { render });
})();
