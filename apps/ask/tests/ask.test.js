// Baraja de preguntas sin repetir (lógica pura)
const K = AskCore;

test('la baraja reparte todas las preguntas una vez antes de repetir ninguna', () => {
  let deck = [], seen = [];
  for (let i = 0; i < 5; i++) { const d = K.draw(deck, 5, seen[seen.length - 1], Math.random); deck = d.deck; seen.push(d.index); }
  assert.eq(seen.slice().sort(), [0, 1, 2, 3, 4]);
  assert.eq(deck.length, 0);
});

test('al acabarse se baraja de nuevo y no empieza por la última que salió', () => {
  for (let n = 0; n < 30; n++) {
    const d = K.draw([], 3, 2, Math.random);
    assert.eq(d.index === 2, false);
    assert.eq(d.deck.length, 2);
  }
  assert.eq(K.draw([], 1, 0, Math.random).index, 0); // con una sola pregunta no queda otra
});

test('una baraja guardada que ya no cuadra con las preguntas se descarta', () => {
  const d = K.draw([7, 1, 'x', 1], 3, null, Math.random);
  assert.eq([d.index, d.deck], [1, []]);
  assert.eq(K.draw([0], 0, null, Math.random), { index: -1, deck: [] });
});

test('parsePlayers lee los jugadores guardados y descarta lo que no vale', () => {
  assert.eq(K.parsePlayers('["Ana"," Luis ","",5]'), ['Ana', 'Luis']);
  assert.eq(K.parsePlayers('no es json'), []);
  assert.eq(K.parsePlayers(null), []);
});
