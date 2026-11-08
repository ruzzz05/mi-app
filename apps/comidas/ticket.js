// Foto del ticket -> texto de la IA (Gemini a través de Firebase AI Logic). Solo se carga el SDK
// cuando se usa. La lógica de qué hacer con la respuesta está en ticketcore.js.
(() => {
  const SDK = 'https://www.gstatic.com/firebasejs/11.10.0/';
  const MODEL = 'gemini-3.8-flash';
  const MAX_SIDE = 1600; // los tickets tienen letra pequeña: más grande que las fotos de recetas

  // Reduce la foto y la devuelve como JPEG en base64 (sin el prefijo "data:").
  function toJpegBase64(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const { w, h } = window.Planner.fitSize(img.naturalWidth, img.naturalHeight, MAX_SIDE);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
      img.src = url;
    });
  }

  let model = null;
  async function getModel() {
    if (model) return model;
    const [{ initializeApp }, ai, cfg] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-ai.js'),
      import(new URL('../../shared/firebase-config.js', document.baseURI))
    ]);
    const app = initializeApp(cfg.firebaseConfig);
    model = ai.getGenerativeModel(ai.getAI(app, { backend: new ai.GoogleAIBackend() }), { model: MODEL });
    return model;
  }

  // Devuelve el texto que responde la IA. Los tests de pantalla sustituyen esta función.
  async function read(file, prompt) {
    const [data, m] = await Promise.all([toJpegBase64(file), getModel()]);
    const result = await m.generateContent([{ inlineData: { mimeType: 'image/jpeg', data } }, prompt]);
    return result.response.text();
  }

  window.Ticket = { read };
})();
