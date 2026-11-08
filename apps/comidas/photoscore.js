// Fotos de recetas (sin DOM ni red): tamaño, compresión y formato en Firestore. Se prueba en apps/comidas/tests.
// Cada receta guarda solo el id de su foto; la imagen vive en users/{uid}/fotos/{id} (ver photos.js y cloud.js).
(function (root) {
  const MAX_SIDE = 800;                        // lado mayor de la foto guardada
  const MAX_PHOTO_CHARS = 700000;              // texto base64 por foto: bastante por debajo de 1 MiB, el límite de un documento
  const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3];

  // Tamaño final manteniendo la proporción; no agranda.
  function fitSize(w, h, max = MAX_SIDE) {
    const scale = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  }

  // encode(calidad) -> data URL. Devuelve la de mayor calidad que cabe, o null si ninguna cabe.
  function compressToFit(encode, maxChars = MAX_PHOTO_CHARS) {
    for (const q of QUALITIES) {
      const out = encode(q);
      if (out.length <= maxChars) return out;
    }
    return null;
  }

  const photoToFirestore = dataUrl => ({ fields: { data: { stringValue: dataUrl } } });

  function photoFromFirestore(doc) {
    const v = doc && doc.fields && doc.fields.data && doc.fields.data.stringValue;
    return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) ? v : null;
  }

  const isPhotoId = id => typeof id === 'string' && /^[a-z0-9]{6,64}$/.test(id);

  function newPhotoId() {
    let id = '';
    while (id.length < 16) id += Math.random().toString(36).slice(2);
    return id.slice(0, 16);
  }

  // Receta con esa foto (o sin ella si id es null); el resto no cambia.
  function withPhoto(dish, id) {
    const { photo, ...rest } = dish;
    return isPhotoId(id) ? { ...rest, photo: id } : rest;
  }

  const api = { MAX_SIDE, MAX_PHOTO_CHARS, fitSize, compressToFit, photoToFirestore, photoFromFirestore, isPhotoId, newPhotoId, withPhoto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
