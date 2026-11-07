// Pruebas de la lógica pura del gimnasio (sin DOM)
const G = window.Gym;
const near = (a, b) => Math.abs(a - b) < 0.01;
const set = (reps, weight, done = true) => ({ reps, weight, done });
const sess = (id, day, exercises, extra = {}) => Object.assign({
  id, startedAt: new Date(day + 'T10:00:00').getTime(), updatedAt: 1, exercises
}, extra);
const ex = (exId, ...sets) => ({ exId, sets });
const CAT = [
  { id: 'bench', primaryMuscles: ['pecho'], secondaryMuscles: ['triceps'] },
  { id: 'squat', primaryMuscles: ['piernas'], secondaryMuscles: [] }
];

test('epley1RM: 100 kg x 5 = 116,67; sin peso o repeticiones = 0', () => {
  assert.ok(near(G.epley1RM(100, 5), 116.667));
  assert.eq(G.epley1RM(0, 5), 0);
  assert.eq(G.epley1RM(80, 0), 0);
});

test('sessionVolume: solo cuentan las series hechas', () => {
  const s = sess('a', '2026-01-05', [ex('bench', set(10, 80), set(8, 80), set(6, 80, false))]);
  assert.eq(G.sessionVolume(s), 1440);
});

test('startSession: es una copia, cambiarla no toca la rutina', () => {
  const r = { id: 'r1', name: 'Pecho', exercises: [{ exId: 'bench', sets: [{ reps: 10, weight: 60 }] }] };
  const s = G.startSession(r, 5000);
  s.exercises[0].sets[0].weight = 100;
  s.exercises[0].sets.push({ reps: 1, weight: 1, done: false });
  assert.eq(r.exercises[0].sets, [{ reps: 10, weight: 60 }]);
  assert.eq(s.routineId, 'r1');
  assert.eq(s.startedAt, 5000);
  assert.eq(G.startSession(r, 5000).exercises[0].sets[0].done, false);
});

test('finishSession: quita series sin hacer y ejercicios sin series hechas', () => {
  const s = sess('a', '2026-01-05', [ex('bench', set(10, 80), set(8, 80, false)), ex('squat', set(5, 100, false))]);
  const f = G.finishSession(s, s.startedAt + 3600 * 1000);
  assert.eq(f.exercises.length, 1);
  assert.eq(f.exercises[0].sets.length, 1);
  assert.eq(f.durationSec, 3600);
  assert.ok(f.updatedAt > 0);
});

test('elapsedSec: nunca negativo y en segundos enteros', () => {
  assert.eq(G.elapsedSec(1000, 500), 0);
  assert.eq(G.elapsedSec(0, 90500), 90);
});

test('exerciseHistory: combina el mismo día, ignora borrados y series sin hacer', () => {
  const sessions = [
    sess('a', '2026-01-05', [ex('bench', set(10, 80), set(5, 100))]),
    sess('b', '2026-01-05', [ex('bench', set(10, 60))]),
    sess('c', '2026-01-07', [ex('bench', set(8, 90, false))]),
    sess('d', '2026-01-08', [ex('bench', set(8, 90))], { deleted: true })
  ];
  const h = G.exerciseHistory(sessions, 'bench');
  assert.eq(h.length, 1);
  assert.eq(h[0].day, '2026-01-05');
  assert.eq(h[0].maxWeight, 100);
  assert.eq(h[0].volume, 800 + 500 + 600);
  assert.ok(near(h[0].est1RM, 116.667), 'est1RM ' + h[0].est1RM);
  assert.eq(G.exerciseHistory([], 'bench'), []);
});

test('weeklyMuscleSets: principal 1, secundario 0,5, solo la semana indicada', () => {
  const sessions = [
    sess('a', '2026-01-06', [ex('bench', set(10, 50), set(10, 50), set(10, 50))]),
    sess('b', '2025-12-30', [ex('bench', set(10, 50))])
  ];
  const w = G.weeklyMuscleSets(sessions, CAT, '2026-01-05');
  assert.eq(w.pecho, 3);
  assert.eq(w.triceps, 1.5);
  assert.eq(G.weeklyMuscleSets([], CAT, '2026-01-05'), {});
});

test('calendarCells: semanas completas, nivel 0 sin entreno y más series = nivel igual o mayor', () => {
  const sessions = [
    sess('a', '2026-01-06', [ex('bench', set(10, 50))]),
    sess('b', '2026-01-07', [ex('bench', set(10, 50), set(10, 50), set(10, 50), set(10, 50), set(10, 50), set(10, 50))])
  ];
  const cells = G.calendarCells(sessions, '2026-01-08', 4);
  assert.eq(cells.length % 7, 0);
  const by = d => cells.find(c => c.day === d);
  assert.eq(by('2026-01-01').level, 0);
  assert.ok(by('2026-01-06').level >= 1);
  assert.ok(by('2026-01-07').level >= by('2026-01-06').level);
});

test('mergeMonthLogs: une por id, gana el más reciente y se conservan los borrados', () => {
  const a = { updatedAt: 1, sessions: [{ id: 'A', updatedAt: 1, exercises: [] }, { id: 'X', updatedAt: 1, exercises: [] }] };
  const b = { updatedAt: 2, sessions: [{ id: 'B', updatedAt: 1, exercises: [] }, { id: 'X', updatedAt: 5, deleted: true, exercises: [] }] };
  const m = G.mergeMonthLogs(a, b);
  assert.eq(m.sessions.map(s => s.id).sort(), ['A', 'B', 'X']);
  assert.eq(m.sessions.find(s => s.id === 'X').deleted, true);
  assert.eq(G.mergeMonthLogs(null, b).sessions.length, 2);
  assert.eq(G.mergeMonthLogs(a, null).sessions.length, 2);
});

test('monthKey: AAAA-MM', () => {
  assert.eq(G.monthKey('2026-11-07'), '2026-11');
});

const IDS = ['bench', 'squat'];
const routine = { id: 'r1', name: 'Pecho', exercises: [{ exId: 'bench', sets: [{ reps: 10, weight: 60 }, { reps: 8, weight: 70 }] }] };

test('importRoutine: rechaza texto no JSON, otro tipo, otra versión, grande, demasiado largo o fuera de rango', () => {
  const ok = o => G.importRoutine(JSON.stringify(o), IDS);
  const base = G.exportRoutine(routine);
  assert.eq(G.importRoutine('esto no es json', IDS).ok, false);
  assert.eq(G.importRoutine('', IDS).ok, false);
  assert.eq(ok({ type: 'otra-cosa', version: 1, name: 'x', exercises: [] }).ok, false);
  assert.eq(ok(Object.assign({}, base, { version: 2 })).ok, false);
  assert.eq(G.importRoutine('x'.repeat(300 * 1024), IDS).ok, false);
  const many = Array.from({ length: 51 }, () => ({ exId: 'bench', sets: [{ reps: 1, weight: 1 }] }));
  assert.eq(ok(Object.assign({}, base, { exercises: many })).ok, false);
  const longSets = [{ exId: 'bench', sets: Array.from({ length: 21 }, () => ({ reps: 1, weight: 1 })) }];
  assert.eq(ok(Object.assign({}, base, { exercises: longSets })).ok, false);
  const heavy = [{ exId: 'bench', sets: [{ reps: 5, weight: 5000 }] }];
  assert.eq(ok(Object.assign({}, base, { exercises: heavy })).ok, false);
  assert.eq(G.importRoutine('null', IDS).ok, false);
  assert.eq(G.importRoutine('[]', IDS).ok, false);
});

test('importRoutine: descarta ejercicios desconocidos y recorta el nombre', () => {
  const base = G.exportRoutine(routine);
  base.exercises.push({ exId: 'no-existe', sets: [{ reps: 1, weight: 1 }] });
  base.name = 'N'.repeat(200);
  const r = G.importRoutine(JSON.stringify(base), IDS);
  assert.eq(r.ok, true);
  assert.eq(r.dropped, 1);
  assert.eq(r.routine.name.length, 60);
  assert.eq(r.routine.exercises.length, 1);
});

test('exportRoutine -> importRoutine devuelve la misma rutina con otro id', () => {
  const r = G.importRoutine(JSON.stringify(G.exportRoutine(routine)), IDS);
  assert.eq(r.ok, true);
  assert.eq(r.routine.exercises, routine.exercises);
  assert.eq(r.routine.name, 'Pecho');
  assert.ok(r.routine.id && r.routine.id !== 'r1');
  assert.eq(G.exportRoutine(routine).type, 'mi-app-rutina');
});

test('hasNewer: detecta entrenos que el otro lado no tiene o tiene más antiguos', () => {
  const s = (id, updatedAt) => ({ id, updatedAt, exercises: [] });
  const a = { updatedAt: 1, sessions: [s('A', 1), s('B', 5)] };
  const b = { updatedAt: 1, sessions: [s('A', 1), s('B', 3)] };
  assert.eq(G.hasNewer(a, b), true);                    // B es más reciente en a
  assert.eq(G.hasNewer(b, a), false);
  assert.eq(G.hasNewer(a, { sessions: [s('A', 1)] }), true);   // a tiene B y el otro no
  assert.eq(G.hasNewer({ sessions: [s('A', 1)] }, a), false);
  assert.eq(G.hasNewer(a, a), false);
  assert.eq(G.hasNewer(null, a), false);
  assert.eq(G.hasNewer(a, null), true);
  assert.eq(G.hasNewer({ sessions: [] }, null), false);
});

test('isValidSession / isValidRoutine: aceptan lo bueno y rechazan datos mal formados', () => {
  const okS = { id: 'a', startedAt: 1700000000000, exercises: [{ exId: 'x', sets: [{ reps: 1, weight: 1, done: true }] }] };
  assert.eq(G.isValidSession(okS), true);
  assert.eq(G.isValidSession(null), false);
  assert.eq(G.isValidSession('texto'), false);
  assert.eq(G.isValidSession(Object.assign({}, okS, { id: 5 })), false);
  assert.eq(G.isValidSession(Object.assign({}, okS, { startedAt: 'ayer' })), false);
  assert.eq(G.isValidSession(Object.assign({}, okS, { exercises: null })), false);
  assert.eq(G.isValidSession(Object.assign({}, okS, { exercises: [{ exId: 'x' }] })), false);
  assert.eq(G.isValidSession(Object.assign({}, okS, { exercises: [{ exId: 'x', sets: [null] }] })), false);
  const okR = { id: 'r', name: 'R', exercises: [{ exId: 'x', sets: [{ reps: 1, weight: 1 }] }] };
  assert.eq(G.isValidRoutine(okR), true);
  assert.eq(G.isValidRoutine(Object.assign({}, okR, { name: 7 })), false);
  assert.eq(G.isValidRoutine(Object.assign({}, okR, { exercises: [{ exId: 3, sets: [] }] })), false);
  assert.eq(G.isValidRoutine({ id: 'r', name: 'R', exercises: [{ exId: 'x', sets: 'no' }] }), false);
  assert.eq(G.isValidRoutine(undefined), false);
});
