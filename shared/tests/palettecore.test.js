// Temas de color compartidos por Mi-Menu, Gimnasio y Gastos (lógica pura, sin DOM)
const PC = window.PaletteCore;
const TOKENS = ['bg', 'card', 'ink', 'mut', 'acc', 'onacc', 'tabbg', 'tabink', 'tabonbg', 'tabonink'];

test('hay 9 temas con id y nombre distintos', () => {
  assert.eq(PC.PALETTES.length, 9);
  assert.eq(new Set(PC.PALETTES.map(p => p.id)).size, 9);
  assert.eq(new Set(PC.PALETTES.map(p => p.name)).size, 9);
});

test('cada tema define todos sus colores como #RRGGBB', () => {
  PC.PALETTES.forEach(p => TOKENS.forEach(t => assert.ok(/^#[0-9A-Fa-f]{6}$/.test(p[t]), `${p.id}.${t} = ${p[t]}`)));
});

test('el texto sobre el color de acento se lee (contraste mínimo 3)', () => {
  PC.PALETTES.forEach(p => assert.ok(PC.contrast(p.onacc, p.acc) >= 3, `${p.id}: ${PC.contrast(p.onacc, p.acc).toFixed(2)}`));
});

test('el texto principal se lee sobre el fondo y sobre las tarjetas (contraste mínimo 7)', () => {
  PC.PALETTES.forEach(p => {
    assert.ok(PC.contrast(p.ink, p.bg) >= 7, `${p.id} fondo: ${PC.contrast(p.ink, p.bg).toFixed(2)}`);
    assert.ok(PC.contrast(p.ink, p.card) >= 7, `${p.id} tarjeta: ${PC.contrast(p.ink, p.card).toFixed(2)}`);
  });
});

test('el texto secundario se lee sobre el fondo (contraste mínimo 3)', () => {
  PC.PALETTES.forEach(p => assert.ok(PC.contrast(p.mut, p.bg) >= 3, `${p.id}: ${PC.contrast(p.mut, p.bg).toFixed(2)}`));
});

test('isDark distingue los temas oscuros de los claros', () => {
  assert.eq(PC.isDark(PC.resolve('turquesa')), true);
  assert.eq(PC.isDark(PC.resolve('rosa-noche')), true);
  assert.eq(PC.isDark(PC.resolve('blanco-verde')), false);
  assert.eq(PC.isDark(PC.resolve('rosa-pastel')), false);
});

test('resolve devuelve el tema pedido y, si no existe, el de por defecto', () => {
  assert.eq(PC.resolve('lila-pastel').id, 'lila-pastel');
  assert.eq(PC.resolve('no-existe').id, PC.DEFAULT_ID);
  assert.eq(PC.resolve(null).id, PC.DEFAULT_ID);
  assert.eq(PC.resolve(undefined).id, PC.DEFAULT_ID);
});

test('varsOf traduce el tema a las variables que usan las tres apps', () => {
  const v = PC.varsOf(PC.resolve('turquesa'));
  assert.eq(v['--bg'], '#0A0A0A');
  assert.eq(v['--surface'], '#171717');
  assert.eq(v['--ink'], '#F5F5F5');
  assert.eq(v['--accent'], '#14E0D0');
  assert.eq(v['--btn-bg'], '#14E0D0');
  assert.eq(v['--btn-ink'], '#021B19');
  assert.eq(v['--tabbg'], '#171717');
  assert.eq(v['--tabonbg'], '#14E0D0');
  assert.eq(v['color-scheme'], 'dark');
  assert.eq(PC.varsOf(PC.resolve('blanco-azul'))['color-scheme'], 'light');
});

test('varsOf incluye los tonos derivados (superficie 2, línea, acento suave, nivel del calendario)', () => {
  const v = PC.varsOf(PC.resolve('rosa-pastel'));
  ['--surface-2', '--ink-2', '--ink-3', '--line', '--accent-soft', '--ok', '--on-ok', '--lv0', '--lv1', '--lv2', '--lv3', '--lv4', '--shadow'].forEach(k => assert.ok(v[k], k));
});

test('cssText convierte las variables en texto para el atributo style', () => {
  const t = PC.cssText(PC.varsOf(PC.resolve('turquesa')));
  assert.ok(t.includes('--bg:#0A0A0A;'));
  assert.ok(t.includes('color-scheme:dark'));
});

test('next pasa al siguiente tema y da la vuelta al final', () => {
  assert.eq(PC.next('turquesa'), PC.PALETTES[1].id);
  assert.eq(PC.next(PC.PALETTES[8].id), PC.PALETTES[0].id);
  assert.eq(PC.next('no-existe'), PC.PALETTES[1].id);
});
