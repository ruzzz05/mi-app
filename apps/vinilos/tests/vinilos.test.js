// Lógica pura de Vinilos (sin red ni DOM)
const V = window.VinilosCore;
const ID = '5K79FLRUCSysQnVESLcTdb';
const OK = { spotifyUrl: 'https://open.spotify.com/album/' + ID + '?si=abc', name: 'DeBÍ TiRAR MáS FOToS', artist: 'Bad Bunny',
             image: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bbd4', tags: 'reguetón, Pop', year: 2025, now: 1730000000000 };

test('parseSpotifyAlbum: acepta enlaces de álbum (con parámetros o idioma) y los deja limpios', () => {
  assert.eq(V.parseSpotifyAlbum('https://open.spotify.com/album/' + ID + '?si=xyz'), { id: ID, url: 'https://open.spotify.com/album/' + ID });
  assert.eq(V.parseSpotifyAlbum('  https://open.spotify.com/intl-es/album/' + ID + '  ').id, ID);
  assert.eq(V.parseSpotifyAlbum('http://open.spotify.com/album/' + ID).url, 'https://open.spotify.com/album/' + ID);
  assert.eq(V.parseSpotifyAlbum('spotify:album:' + ID).id, ID);
});

test('parseSpotifyAlbum: rechaza lo que no es un álbum de Spotify', () => {
  ['', null, undefined, 'hola', 'https://open.spotify.com/track/' + ID, 'https://open.spotify.com/playlist/' + ID,
   'https://open.spotify.com/album/corto', 'https://evil.com/open.spotify.com/album/' + ID, 'https://open.spotify.com.evil.com/album/' + ID,
   'javascript:alert(1)'].forEach(x => assert.eq(V.parseSpotifyAlbum(x), null, String(x)));
});

test('normalizeTags: minúsculas, sin repetidos ni vacíos, separa por coma o barra y limita', () => {
  assert.eq(V.normalizeTags('Rap, trap | RAP,  ,pop'), ['rap', 'trap', 'pop']);
  assert.eq(V.normalizeTags(''), []);
  assert.eq(V.normalizeTags(null), []);
  assert.eq(V.normalizeTags('a,b,c,d,e,f,g,h,i,j').length, 8);
  assert.eq(V.normalizeTags('x'.repeat(40))[0].length, 24);
});

test('newAlbum: construye el disco con id de Spotify, enlace limpio y estilos normalizados', () => {
  const r = V.newAlbum(OK);
  assert.eq(r.ok, true);
  assert.eq(r.album, { id: ID, artist: 'Bad Bunny', name: 'DeBÍ TiRAR MáS FOToS', image: OK.image, tags: ['reguetón', 'pop'],
                       url: 'https://open.spotify.com/album/' + ID, year: 2025, addedAt: 1730000000000 });
});

test('newAlbum: valida enlace, nombre, artista e imagen', () => {
  assert.eq(V.newAlbum({ ...OK, spotifyUrl: 'nada' }).ok, false);
  assert.eq(V.newAlbum({ ...OK, name: '  ' }).ok, false);
  assert.eq(V.newAlbum({ ...OK, artist: '' }).ok, false);
  assert.eq(V.newAlbum({ ...OK, image: 'javascript:alert(1)' }).ok, false);
  assert.eq(V.newAlbum({ ...OK, image: 'http://inseguro/x.jpg' }).ok, false);
  assert.eq(V.newAlbum({ ...OK, name: 'n'.repeat(300) }).album.name.length, 120);
  assert.eq(V.newAlbum({ ...OK, year: 'abc' }).album.year, null);
  assert.eq(V.newAlbum({ ...OK, year: 1800 }).album.year, null);
});

test('mergeAlbums: junta el CSV y lo añadido sin repetir discos (mismo id de Spotify)', () => {
  const base = [{ artist: 'A', name: 'Uno', image: 'i', tags: [], url: 'https://open.spotify.com/album/' + ID + '?si=1' },
                { artist: 'B', name: 'Dos', image: 'i', tags: [], url: '#' }];
  const extras = [V.newAlbum(OK).album, V.newAlbum({ ...OK, spotifyUrl: 'https://open.spotify.com/album/0123456789012345678901', name: 'Nuevo', artist: 'C' }).album];
  const m = V.mergeAlbums(base, extras);
  assert.eq(m.length, 3);
  assert.eq(m.filter(a => a.extra).map(a => a.name), ['Nuevo']);
  assert.eq(V.mergeAlbums(base, null).length, 2);
});

test('parseExtras: acepta JSON bueno y descarta entradas rotas o peligrosas', () => {
  const good = V.newAlbum(OK).album;
  const doc = JSON.stringify({ albums: [good, null, { id: 1 }, { ...good, id: 'XXXXXXXXXXXXXXXXXXXXXX', image: 'javascript:1' }, 'texto'] });
  assert.eq(V.parseExtras(doc), [good]);
  assert.eq(V.parseExtras('no json'), []);
  assert.eq(V.parseExtras('{"albums": "no"}'), []);
  assert.eq(V.parseExtras(null), []);
});

test('isOwner: solo si hay uid del dueño configurado y coincide', () => {
  assert.eq(V.isOwner('abc', 'abc'), true);
  assert.eq(V.isOwner('abc', 'xyz'), false);
  assert.eq(V.isOwner('abc', ''), false);
  assert.eq(V.isOwner('', ''), false);
  assert.eq(V.isOwner(undefined, undefined), false);
});
