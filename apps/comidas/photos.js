// Fotos de recetas en el dispositivo (IndexedDB) y su copia en la nube. cloud.js conecta la nube en
// Photos.remote = { get(id), put(id, dataUrl), del(id) }. Si no hay conexión, lo pendiente se guarda
// y se reintenta en la siguiente subida. La lógica pura (tamaños, formato) está en photoscore.js.
(() => {
  const P = window.Planner;
  const DB = 'comidas-fotos', STORE = 'fotos', PENDING = 'pending-photos.comidas';
  const mem = new Map();
  let dbPromise = null;

  const db = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  // IndexedDB puede no estar disponible (modo privado): en ese caso solo se usa la memoria y la nube.
  // Si IndexedDB no contesta en 3 s (pasa en algunos navegadores en modo privado) se sigue sin él.
  const idb = (mode, run) => Promise.race([
    db().then(d => new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    })),
    new Promise(resolve => setTimeout(() => resolve(null), 3000))
  ]).catch(() => null);

  const readPending = () => {
    try { return { put: [], del: [], ...JSON.parse(localStorage.getItem(PENDING) || '{}') }; }
    catch (e) { return { put: [], del: [] }; }
  };
  const writePending = p => {
    try {
      if (p.put.length || p.del.length) localStorage.setItem(PENDING, JSON.stringify(p));
      else localStorage.removeItem(PENDING);
    } catch (e) { /* sin almacenamiento */ }
  };
  const mark = (kind, id) => {
    const p = readPending();
    const other = kind === 'put' ? 'del' : 'put';
    p[other] = p[other].filter(x => x !== id);
    if (!p[kind].includes(id)) p[kind].push(id);
    writePending(p);
  };
  const unmark = (kind, id) => { const p = readPending(); p[kind] = p[kind].filter(x => x !== id); writePending(p); };

  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* prueba con <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }

  const Photos = window.Photos = {
    remote: null,

    // Foto elegida (de la cámara, galería o archivos) -> imagen reducida lista para guardar.
    async fromFile(file) {
      if (!file || !/^image\//.test(file.type)) throw new Error('Ese archivo no es una imagen');
      const bmp = await loadBitmap(file);
      const { w, h } = P.fitSize(bmp.width, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';            // los PNG con transparencia no se quedan en negro al pasar a JPEG
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const out = P.compressToFit(q => canvas.toDataURL('image/jpeg', q));
      if (!out) throw new Error('La foto es demasiado grande');
      return out;
    },

    // Memoria -> dispositivo -> nube. null si no existe.
    async get(id) {
      if (!P.isPhotoId(id)) return null;
      if (mem.has(id)) return mem.get(id);
      let data = await idb('readonly', s => s.get(id));
      if (!data && Photos.remote) {
        try { data = await Photos.remote.get(id); } catch (e) { data = null; }
        if (data) idb('readwrite', s => s.put(data, id));
      }
      if (data) mem.set(id, data);
      return data || null;
    },

    async put(id, data) {
      if (!P.isPhotoId(id)) return;
      mem.set(id, data);
      await idb('readwrite', s => s.put(data, id));
      mark('put', id);
      await Photos.flushPending();
    },

    async remove(id) {
      if (!P.isPhotoId(id)) return;
      mem.delete(id);
      await idb('readwrite', s => s.delete(id));
      mark('del', id);
      await Photos.flushPending();
    },

    // Sube y borra en la nube lo que quedó pendiente. No hace nada si no hay nada pendiente.
    async flushPending() {
      const p = readPending();
      if (!Photos.remote || !(p.put.length || p.del.length)) return;
      for (const id of p.put) {
        try {
          const data = mem.get(id) || await idb('readonly', s => s.get(id));
          if (data) await Photos.remote.put(id, data);
          unmark('put', id);
        } catch (e) { console.warn('Foto sin subir por ahora:', e); }
      }
      for (const id of p.del) {
        try { await Photos.remote.del(id); unmark('del', id); }
        catch (e) { console.warn('Foto sin borrar en la nube por ahora:', e); }
      }
    }
  };
})();
