// Lógica de Ask sin DOM: baraja de preguntas sin repetir y jugadores guardados. Se prueba en apps/ask/tests.
(function (root) {
  // Saca la siguiente pregunta de la baraja (deck = posiciones que quedan por salir; sale la última).
  // Cuando se acaba se baraja otra vez, sin empezar por la que acaba de salir (last).
  // Devuelve { index, deck }; index -1 si no hay preguntas.
  function draw(deck, total, last, rnd) {
    if (!(total > 0)) return { index: -1, deck: [] };
    let rest = [...new Set((deck || []).filter(i => Number.isInteger(i) && i >= 0 && i < total))];
    if (!rest.length) {
      rest = Array.from({ length: total }, (_, i) => i);
      for (let i = total - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      if (total > 1 && rest[total - 1] === last) [rest[0], rest[total - 1]] = [rest[total - 1], rest[0]];
    }
    const index = rest.pop();
    return { index, deck: rest };
  }

  // Jugadores guardados (texto JSON) -> lista de nombres válidos.
  function parsePlayers(json) {
    let v; try { v = JSON.parse(json); } catch (e) { return []; }
    return Array.isArray(v) ? v.filter(n => typeof n === 'string').map(n => n.trim()).filter(Boolean) : [];
  }

  const api = { draw, parsePlayers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AskCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
