// Ticket de la compra: que productos de la lista salen en el ticket (sin red ni DOM)
const pending = [
  { key: 'leche', name: 'Leche' },
  { key: 'tomate', name: 'Tomate' },
  { key: 'pasta', name: 'Pasta' }
];

test('ticketPrompt incluye cada producto pendiente con su clave', () => {
  const p = Planner.ticketPrompt(pending);
  assert.ok(p.includes('leche: Leche'));
  assert.ok(p.includes('tomate: Tomate'));
  assert.ok(p.includes('JSON'));
});

test('parseTicketMatches lee el JSON y devuelve solo claves de la lista', () => {
  const text = '{"matches":["leche","pasta","suavizante"]}';
  assert.eq(Planner.parseTicketMatches(text, pending), ['leche', 'pasta']);
});

test('parseTicketMatches acepta el JSON dentro de un bloque de codigo y sin repetidos', () => {
  const text = 'Aqui va:\n```json\n{"matches":["tomate","tomate"]}\n```';
  assert.eq(Planner.parseTicketMatches(text, pending), ['tomate']);
});

test('parseTicketMatches con respuesta rota o sin coincidencias devuelve lista vacia', () => {
  assert.eq(Planner.parseTicketMatches('no se', pending), []);
  assert.eq(Planner.parseTicketMatches('{"matches":"leche"}', pending), []);
  assert.eq(Planner.parseTicketMatches('', pending), []);
  assert.eq(Planner.parseTicketMatches(null, pending), []);
});

test('markBought marca como comprados los productos indicados sin tocar el resto', () => {
  const list = { removed: [], extras: [], checked: { pasta: true } };
  assert.eq(Planner.markBought(list, ['leche']).checked, { pasta: true, leche: true });
  assert.eq(Planner.markBought(list, []), list);
});

test('pendingItems son los de la lista sin marcar, solo con clave y nombre', () => {
  const items = [{ key: 'a', name: 'A', qty: 2, checked: false, recipes: [] }, { key: 'b', name: 'B', qty: 1, checked: true, recipes: [] }];
  assert.eq(Planner.pendingItems(items), [{ key: 'a', name: 'A' }]);
});
