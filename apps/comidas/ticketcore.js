// Ticket de la compra (sin red ni DOM): qué productos de la lista salen en la foto del ticket.
// La lectura de la foto la hace una IA (ticket.js); aquí solo se prepara la pregunta y se
// interpreta la respuesta. Se prueba en apps/comidas/tests.
(function (root) {
  // Productos de la lista que aún no están comprados, solo con lo que necesita la IA.
  const pendingItems = items => items.filter(i => !i.checked).map(({ key, name }) => ({ key, name }));

  function ticketPrompt(pending) {
    const lines = pending.map(i => `${i.key}: ${i.name}`).join('\n');
    return 'Esta foto es un ticket de supermercado. Estos son los productos que faltaban por comprar ' +
      '(formato "clave: nombre"):\n' + lines + '\n\n' +
      'Dime cuáles aparecen en el ticket. Los nombres del ticket suelen ir abreviados o con la marca ' +
      '(por ejemplo "LCH ENT PULEVA" es leche). Ignora lo que no sea de la lista. ' +
      'Responde solo con JSON: {"matches": ["clave", ...]} con las claves exactas de la lista.';
  }

  // Claves válidas de la respuesta de la IA. Cualquier cosa rara devuelve [] en vez de fallar.
  function parseTicketMatches(text, pending) {
    if (typeof text !== 'string') return [];
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    let data;
    try { data = JSON.parse(m[0]); } catch (e) { return []; }
    if (!data || !Array.isArray(data.matches)) return [];
    const valid = new Set(pending.map(i => i.key));
    return [...new Set(data.matches)].filter(k => valid.has(k));
  }

  function markBought(list, keys) {
    if (!keys.length) return list;
    const checked = { ...list.checked };
    keys.forEach(k => { checked[k] = true; });
    return { ...list, checked };
  }

  const api = { pendingItems, ticketPrompt, parseTicketMatches, markBought };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
