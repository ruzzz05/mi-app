// De quién es el buzón de pagos de Apple Pay (gastosInbox). inboxOwnerUid es el UID de tu cuenta
// (Firebase → Authentication → Usuarios). Solo esa cuenta recoge los pagos que escribe el Atajo; así
// otra persona con sesión no se los lleva al abrir Gastos. No es un secreto.
window.GastosConfig = {
  inboxOwnerUid: 'eFXlrMGYWIRQkAkzLr5ex5J4aS13'
};
