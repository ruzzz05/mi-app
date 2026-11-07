// Recuperación y salud de los últimos días (lógica pura, sin red ni DOM)
const R = window.HealthCore;
const sumSq = a => a.reduce((s, x) => s + x * x, 0);

test('parseDay: acepta {year,month,day} y "AAAA-MM-DD"; otra cosa da null', () => {
  assert.eq(R.parseDay({ year: 2026, month: 11, day: 7 }), '2026-11-07');
  assert.eq(R.parseDay({ year: '2026', month: '1', day: '5' }), '2026-01-05');
  assert.eq(R.parseDay('2026-11-07'), '2026-11-07');
  assert.eq(R.parseDay('2026-11-07T10:00:00'), '2026-11-07');
  assert.eq(R.parseDay(null), null);
  assert.eq(R.parseDay({ year: 2026 }), null);
  assert.eq(R.parseDay('ayer'), null);
});

test('dailyValues: pulso en reposo (texto) y VFC (número) por día; ignora lo roto', () => {
  const rhr = { dataPoints: [
    { dailyRestingHeartRate: { date: { year: 2026, month: 11, day: 7 }, beatsPerMinute: '58' } },
    { dailyRestingHeartRate: { date: { year: 2026, month: 11, day: 6 }, beatsPerMinute: '60' } },
    { dailyRestingHeartRate: { date: { year: 2026, month: 11, day: 5 }, beatsPerMinute: 'abc' } },
    { dailyRestingHeartRate: { beatsPerMinute: '55' } }, null, {}
  ] };
  assert.eq(R.dailyValues(rhr, 'dailyRestingHeartRate', 'beatsPerMinute'), { '2026-11-07': 58, '2026-11-06': 60 });
  const hrv = { dataPoints: [{ dailyHeartRateVariability: { date: { year: 2026, month: 11, day: 7 }, averageHeartRateVariabilityMilliseconds: 42.5 } }] };
  assert.eq(R.dailyValues(hrv, 'dailyHeartRateVariability', 'averageHeartRateVariabilityMilliseconds'), { '2026-11-07': 42.5 });
  assert.eq(R.dailyValues({}, 'x', 'y'), {});
  assert.eq(R.dailyValues(null, 'x', 'y'), {});
});

const night = (endIso, offset, asleep, inBed, extra) => ({ sleep: Object.assign({
  interval: { startTime: '2026-11-06T22:00:00Z', endTime: endIso, startUtcOffset: offset, endUtcOffset: offset },
  type: 'STAGES', metadata: { nap: false, mainSleep: true },
  summary: { minutesAsleep: String(asleep), minutesInSleepPeriod: String(inBed), minutesAwake: String(inBed - asleep),
    stagesSummary: [{ type: 'DEEP', minutes: '80', count: '3' }, { type: 'LIGHT', minutes: '250', count: '20' },
                    { type: 'REM', minutes: '90', count: '4' }, { type: 'AWAKE', minutes: '30', count: '10' }] }
}, extra || {}) });

test('sleepNights: una noche por día de despertar, con sus fases', () => {
  const n = R.sleepNights({ dataPoints: [night('2026-11-07T06:30:00Z', '3600s', 420, 450)] });
  assert.eq(Object.keys(n), ['2026-11-07']);
  const x = n['2026-11-07'];
  assert.eq([x.minutesAsleep, x.minutesInBed], [420, 450]);
  assert.eq([x.deep, x.light, x.rem, x.awake], [80, 250, 90, 30]);
});

test('sleepNights: el día se cuenta en la hora local del despertar (con su desfase)', () => {
  // 23:30 UTC con desfase +2 h = 01:30 del día siguiente
  assert.eq(Object.keys(R.sleepNights({ dataPoints: [night('2026-11-06T23:30:00Z', '7200s', 400, 430)] })), ['2026-11-07']);
});

test('sleepNights: ignora siestas, y con dos sueños el mismo día se queda con el más largo', () => {
  const n = R.sleepNights({ dataPoints: [
    night('2026-11-07T15:00:00Z', '0s', 40, 45, { metadata: { nap: true, mainSleep: false } }),
    night('2026-11-07T06:00:00Z', '0s', 300, 330),
    night('2026-11-07T07:00:00Z', '0s', 410, 440)
  ] });
  assert.eq(Object.keys(n).length, 1);
  assert.eq(n['2026-11-07'].minutesAsleep, 410);
});

test('sleepNights: sin resumen calcula los minutos con las fases; sin datos válidos da {}', () => {
  const r = { dataPoints: [{ sleep: { interval: { startTime: '2026-11-06T22:00:00Z', endTime: '2026-11-07T06:00:00Z', endUtcOffset: '0s' },
    stages: [{ startTime: '2026-11-06T22:00:00Z', endTime: '2026-11-06T23:00:00Z', type: 'LIGHT' },
             { startTime: '2026-11-06T23:00:00Z', endTime: '2026-11-06T23:30:00Z', type: 'AWAKE' },
             { startTime: '2026-11-06T23:30:00Z', endTime: '2026-11-07T00:30:00Z', type: 'DEEP' }] } }] };
  const n = R.sleepNights(r)['2026-11-07'];
  assert.eq(n.minutesAsleep, 120);
  assert.eq(n.awake, 30);
  assert.eq(R.sleepNights({}), {});
  assert.eq(R.sleepNights({ dataPoints: [{ sleep: {} }, null, { sleep: { interval: { endTime: 'mal' } } }] }), {});
});

test('stepsByDay: suma las horas de cada día local y tolera datos raros', () => {
  const d = (h, v) => ({ startTime: new Date(2026, 10, 7, h).toISOString(), steps: { countSum: String(v) } });
  const e = (h, v) => ({ startTime: new Date(2026, 10, 6, h).toISOString(), steps: { countSum: v } });
  const r = { rollupDataPoints: [d(9, 1000), d(10, 500), e(23, 700), { startTime: 'mal', steps: { countSum: 1 } },
                                 { startTime: new Date(2026, 10, 7, 12).toISOString(), steps: {} }, null] };
  assert.eq(R.stepsByDay(r), { '2026-11-07': 1500, '2026-11-06': 700 });
  assert.eq(R.stepsByDay({}), {});
});

test('lastDays: n días terminando hoy, en orden', () => {
  assert.eq(R.lastDays('2026-03-02', 4), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.eq(R.lastDays('2026-11-07', 1), ['2026-11-07']);
});

test('baseline: media y desviación de los días anteriores a hoy; con menos de 5 días no hay referencia', () => {
  const v = { '2026-11-01': 40, '2026-11-02': 44, '2026-11-03': 48, '2026-11-04': 40, '2026-11-05': 48, '2026-11-07': 99 };
  const b = R.baseline(v, '2026-11-07', 14);
  assert.eq(b.n, 5);
  assert.eq(b.mean, 44);
  assert.ok(Math.abs(b.sd - Math.sqrt(sumSq([-4, 0, 4, -4, 4]) / 5)) < 1e-9);
  assert.eq(R.baseline({ '2026-11-06': 50, '2026-11-05': 51 }, '2026-11-07', 14), null);
  assert.eq(R.baseline({}, '2026-11-07', 14), null);
});

test('recoveryScore: sueño largo + VFC alta + pulso bajo = buen día', () => {
  const r = R.recoveryScore({ sleepMinutes: 480, hrv: 55, hrvBase: { mean: 45, sd: 5 }, rhr: 54, rhrBase: { mean: 58, sd: 2 } });
  assert.ok(r.score >= 90, 'score ' + r.score);
  assert.eq(r.label, 'Buen día para entrenar');
  assert.eq(r.provisional, false);
});

test('recoveryScore: poco sueño, VFC baja y pulso alto = mejor descansar', () => {
  const r = R.recoveryScore({ sleepMinutes: 240, hrv: 30, hrvBase: { mean: 45, sd: 5 }, rhr: 66, rhrBase: { mean: 58, sd: 2 } });
  assert.ok(r.score < 50, 'score ' + r.score);
  assert.eq(r.label, 'Mejor descansa hoy');
});

test('recoveryScore: sin referencias es provisional (solo sueño); sin nada da null; siempre entre 0 y 100', () => {
  const p = R.recoveryScore({ sleepMinutes: 450, hrv: 40, hrvBase: null, rhr: 60, rhrBase: null });
  assert.eq(p.provisional, true);
  assert.eq(p.score, 100);
  assert.eq(R.recoveryScore({ sleepMinutes: null, hrv: null, hrvBase: null, rhr: null, rhrBase: null }), null);
  const hi = R.recoveryScore({ sleepMinutes: 900, hrv: 500, hrvBase: { mean: 45, sd: 5 }, rhr: 10, rhrBase: { mean: 58, sd: 2 } });
  assert.ok(hi.score <= 100 && hi.score >= 0);
  const lo = R.recoveryScore({ sleepMinutes: 0, hrv: 1, hrvBase: { mean: 45, sd: 5 }, rhr: 150, rhrBase: { mean: 58, sd: 2 } });
  assert.ok(lo.score >= 0 && lo.score < 10, 'score ' + lo.score);
  const flat = R.recoveryScore({ sleepMinutes: 420, hrv: 45, hrvBase: { mean: 45, sd: 0 }, rhr: 58, rhrBase: { mean: 58, sd: 0 } });
  assert.ok(Number.isFinite(flat.score) && flat.score >= 0 && flat.score <= 100, 'sin desviación: ' + flat.score);
});

test('missingScopes: dice qué permisos faltan según lo que concedió Google', () => {
  const act = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
  const slp = 'https://www.googleapis.com/auth/googlehealth.sleep.readonly';
  assert.eq(R.missingScopes(act, [slp, act]), [slp]);
  assert.eq(R.missingScopes(slp + ' ' + act, [slp, act]), []);
  assert.eq(R.missingScopes('', [slp, act]).length, 2);
  assert.eq(R.missingScopes(undefined, [slp, act]).length, 2);
});
