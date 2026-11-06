// 6 de noviembre de 2026 (mes 10 = noviembre)
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);
const planDays = (days, firstMeal = 'comida') => {
  const plan = {};
  Planner.slotKeys({ days, firstMeal }).forEach(k => { plan[k] = { id: k, name: 'Plato ' + k }; });
  return plan;
};
const menuFrom = (startDate, days, firstMeal = 'comida') =>
  ({ startDate, firstMeal, days, plan: planDays(days, firstMeal), exclusions: [] });

test('mealNow: antes de las 17:00 toca comida y desde las 17:00 cena', () => {
  assert.eq(Planner.mealNow(at(6, 0, 30)), 'comida');
  assert.eq(Planner.mealNow(at(6, 16, 59)), 'comida');
  assert.eq(Planner.mealNow(at(6, 17, 0)), 'cena');
  assert.eq(Planner.mealNow(at(6, 23, 59)), 'cena');
});

test('proposeStart: antes de las 17:00 empieza hoy el dia completo', () => {
  assert.eq(Planner.proposeStart(at(6, 10)), { date: '2026-11-06', firstMeal: 'comida' });
  assert.eq(Planner.proposeStart(at(6, 16, 59)), { date: '2026-11-06', firstMeal: 'comida' });
});

test('proposeStart: de 17:00 a 21:59 empieza hoy por la cena', () => {
  assert.eq(Planner.proposeStart(at(6, 17, 0)), { date: '2026-11-06', firstMeal: 'cena' });
  assert.eq(Planner.proposeStart(at(6, 21, 59)), { date: '2026-11-06', firstMeal: 'cena' });
});

test('proposeStart: desde las 22:00 empieza manana, tambien al cambiar de mes y de ano', () => {
  assert.eq(Planner.proposeStart(at(6, 22, 0)), { date: '2026-11-07', firstMeal: 'comida' });
  assert.eq(Planner.proposeStart(new Date(2026, 10, 30, 23, 59)), { date: '2026-12-01', firstMeal: 'comida' });
  assert.eq(Planner.proposeStart(new Date(2026, 11, 31, 22, 30)), { date: '2027-01-01', firstMeal: 'comida' });
});

test('toISODate usa la fecha local con ceros', () => {
  assert.eq(Planner.toISODate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

const brief = v => v.upcoming.map(u => `${u.dayOffset}:${u.meal}:${u.entry ? u.entry.id : null}`);

test('todayView el primer dia a mediodia: dia 1, toca la comida y despues la cena de hoy', () => {
  const v = Planner.todayView({ menu: menuFrom('2026-11-06', 3), now: at(6, 12) });
  assert.eq([v.status, v.dayNumber, v.totalDays, v.meal], ['active', 1, 3, 'comida']);
  assert.eq(v.current.id, '0-comida');
  assert.eq(brief(v), ['0:cena:0-cena']);
  assert.eq(v.date, '2026-11-06');
});

test('todayView por la tarde toca la cena y lo siguiente es el dia de manana', () => {
  const v = Planner.todayView({ menu: menuFrom('2026-11-06', 3), now: at(6, 20) });
  assert.eq([v.meal, v.current.id], ['cena', '0-cena']);
  assert.eq(brief(v), ['1:comida:1-comida', '1:cena:1-cena']);
});

test('todayView el ultimo dia por la tarde no tiene nada siguiente', () => {
  const v = Planner.todayView({ menu: menuFrom('2026-11-06', 3), now: at(8, 20) });
  assert.eq([v.dayNumber, v.meal, v.upcoming], [3, 'cena', []]);
});

test('todayView el ultimo dia a mediodia solo deja la cena de hoy', () => {
  assert.eq(brief(Planner.todayView({ menu: menuFrom('2026-11-06', 3), now: at(8, 12) })), ['0:cena:2-cena']);
});

test('todayView con un hueco vacio en lo siguiente lo incluye con entry null', () => {
  const menu = menuFrom('2026-11-06', 3);
  delete menu.plan['1-comida'];
  assert.eq(brief(Planner.todayView({ menu, now: at(6, 20) })), ['1:comida:null', '1:cena:1-cena']);
});

test('todayView de un menu que empieza por la cena muestra la cena aunque sea por la manana', () => {
  const v = Planner.todayView({ menu: menuFrom('2026-11-06', 3, 'cena'), now: at(6, 10) });
  assert.eq([v.status, v.dayNumber, v.meal, v.current.id], ['active', 1, 'cena', '0-cena']);
  assert.eq(brief(v), ['1:comida:1-comida', '1:cena:1-cena']);
});

test('todayView de un menu que empieza por la cena, a las 18:00, no muestra la comida que no existe', () => {
  const v = Planner.todayView({ menu: menuFrom('2026-11-06', 3, 'cena'), now: at(6, 18) });
  assert.eq([v.meal, v.current.id], ['cena', '0-cena']);
  assert.eq(brief(v), ['1:comida:1-comida', '1:cena:1-cena']);
});

test('todayView avanza el dia con la fecha y termina despues del ultimo dia', () => {
  const menu = menuFrom('2026-11-06', 3);
  assert.eq(Planner.todayView({ menu, now: at(8, 13) }).dayNumber, 3);
  assert.eq(Planner.todayView({ menu, now: at(8, 23, 59) }).status, 'active');
  assert.eq(Planner.todayView({ menu, now: at(9, 0, 1) }).status, 'finished');
});

test('todayView de un menu que empieza en el futuro avisa de cuando empieza', () => {
  const v = Planner.todayView({ menu: menuFrom('2026-11-08', 3), now: at(6, 12) });
  assert.eq([v.status, v.startDate, v.current], ['notStarted', '2026-11-08', null]);
});

test('todayView con un hueco vacio no falla y devuelve current null', () => {
  const menu = menuFrom('2026-11-06', 2);
  delete menu.plan['0-comida'];
  const v = Planner.todayView({ menu, now: at(6, 12) });
  assert.eq([v.status, v.current], ['active', null]);
});

test('todayView sin menu devuelve el estado none', () => {
  assert.eq(Planner.todayView({ menu: null, now: at(6, 12) }).status, 'none');
});

test('todayView cruza el cambio de mes sin errores', () => {
  const menu = menuFrom('2026-11-29', 4);
  assert.eq(Planner.todayView({ menu, now: new Date(2026, 11, 1, 12) }).dayNumber, 3);
});
