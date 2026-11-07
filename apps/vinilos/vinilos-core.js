// Lógica pura de Vinilos (sin red ni DOM). Se prueba en apps/vinilos/tests.
// Un disco añadido desde la app: { id (id de Spotify), artist, name, image, tags[], url, year|null, addedAt }
(function (root) {
  const SPOTIFY_ID = '[A-Za-z0-9]{22}';
  const MAX_TAGS = 8, MAX_TAG = 24, MAX_NAME = 120, MAX_ARTIST = 80, MAX_IMAGE = 600;

  // Enlace de álbum de Spotify (web, con idioma o parámetros, o URI spotify:album:...) -> { id, url } | null
  function parseSpotifyAlbum(text) {
    if (typeof text !== 'string') return null;
    const t = text.trim();
    let m = t.match(new RegExp('^spotify:album:(' + SPOTIFY_ID + ')$'));
    if (!m) m = t.match(new RegExp('^https?://open\\.spotify\\.com/(?:intl-[a-z-]+/)?album/(' + SPOTIFY_ID + ')(?:[/?#].*)?$'));
    return m ? { id: m[1], url: 'https://open.spotify.com/album/' + m[1] } : null;
  }

  // "Rap, trap | RAP" -> ['rap', 'trap']
  function normalizeTags(text) {
    if (typeof text !== 'string') return [];
    const out = [];
    for (const raw of text.split(/[,|]/)) {
      const t = raw.trim().toLowerCase().slice(0, MAX_TAG);
      if (t && !out.includes(t)) out.push(t);
      if (out.length === MAX_TAGS) break;
    }
    return out;
  }

  const cleanText = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const validImage = u => typeof u === 'string' && /^https:\/\/\S+$/.test(u) && u.length <= MAX_IMAGE;
  const cleanYear = y => { const n = Number(y); return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null; };

  function newAlbum({ spotifyUrl, name, artist, image, tags, year, now }) {
    const sp = parseSpotifyAlbum(spotifyUrl);
    if (!sp) return { ok: false, error: 'Eso no es un enlace de álbum de Spotify.' };
    const n = cleanText(name, MAX_NAME), a = cleanText(artist, MAX_ARTIST);
    if (!n) return { ok: false, error: 'Falta el nombre del álbum.' };
    if (!a) return { ok: false, error: 'Falta el artista.' };
    if (!validImage(image)) return { ok: false, error: 'La portada no es válida.' };
    return { ok: true, album: { id: sp.id, artist: a, name: n, image, tags: Array.isArray(tags) ? tags : normalizeTags(tags),
                                url: sp.url, year: cleanYear(year), addedAt: now || Date.now() } };
  }

  const spotifyIdOf = url => { const p = parseSpotifyAlbum(String(url || '')); return p ? p.id : null; };

  // CSV (base) + discos añadidos, sin repetir (mismo id de Spotify). Los añadidos llevan extra:true.
  function mergeAlbums(base, extras) {
    const out = (base || []).slice();
    const seen = new Set(out.map(a => spotifyIdOf(a.url)).filter(Boolean));
    for (const e of extras || []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ artist: e.artist, name: e.name, image: e.image, tags: e.tags || [], url: e.url, year: e.year, id: e.id, extra: true });
    }
    return out;
  }

  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  function validStored(a) {
    return isObj(a) && typeof a.id === 'string' && new RegExp('^' + SPOTIFY_ID + '$').test(a.id) &&
      typeof a.artist === 'string' && a.artist && typeof a.name === 'string' && a.name &&
      validImage(a.image) && Array.isArray(a.tags) && a.url === 'https://open.spotify.com/album/' + a.id;
  }

  // Lo que viene de la nube o del almacenamiento: solo se aceptan discos bien formados
  function parseExtras(text) {
    if (typeof text !== 'string') return [];
    let v;
    try { v = JSON.parse(text); } catch (e) { return []; }
    return isObj(v) && Array.isArray(v.albums) ? v.albums.filter(validStored) : [];
  }

  const isOwner = (uid, ownerUid) => typeof uid === 'string' && !!uid && uid === ownerUid;

  const api = { parseSpotifyAlbum, normalizeTags, newAlbum, mergeAlbums, parseExtras, isOwner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VinilosCore = Object.assign(root.VinilosCore || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
