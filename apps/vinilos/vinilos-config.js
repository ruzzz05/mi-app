// Quién puede añadir discos. ownerUid es el UID de tu cuenta (Firebase → Authentication → Usuarios).
// No es un secreto: solo decide si se enseña el botón de añadir. Lo que de verdad impide que otra
// persona escriba son las reglas de Firestore (ver README, "Vinilos: añadir discos").
window.VinilosConfig = {
  ownerUid: 'eFXlrMGYWIRQkAkzLr5ex5J4aS13'
};
