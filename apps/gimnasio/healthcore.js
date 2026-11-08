// Lógica pura de la conexión con Google Health (sin red ni DOM). Se prueba en apps/gimnasio/tests.
(function (root) {
  const FRESH_MS = 2 * 60 * 1000;    // un resumen de menos de 2 minutos no se vuelve a pedir
  const TOKEN_MARGIN_MS = 60 * 1000; // el token se da por caducado un minuto antes
  const SLEEP_TARGET_MIN = 450;      // 7,5 h: con eso el sueño puntúa 100

  const pad = n => String(n).padStart(2, '0');
  const num = v => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const localDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  // Desde la medianoche local de hoy hasta la de mañana, en formato ISO con zona horaria (UTC)
  function todayRange(now) {
    const d = new Date(now);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  // Primer campo numérico que termina en "Sum" dentro de un punto de rollUp (la documentación no
  // detalla los nombres exactos: countSum, kcalSum…). null si no hay ninguno.
  function pointSum(point) {
    if (!point || typeof point !== 'object') return null;
    for (const value of Object.values(point)) {
      if (!value || typeof value !== 'object') continue;
      for (const [key, v] of Object.entries(value)) {
        if (!/Sum$/.test(key)) continue;
        const n = num(v);
        if (n !== null) return n;
      }
    }
    return null;
  }

  // Suma todo lo que devuelve un rollUp. null si no hay ningún dato.
  function sumRollup(response) {
    const points = response && Array.isArray(response.rollupDataPoints) ? response.rollupDataPoints : [];
    let total = null;
    for (const point of points) {
      const n = pointSum(point);
      if (n !== null) total = (total || 0) + n;
    }
    return total;
  }

  function tokenValid(tok, now) {
    return !!(tok && tok.token && Number(tok.exp) - TOKEN_MARGIN_MS > now);
  }

  function summaryFresh(cache, day, now) {
    return !!(cache && cache.day === day && now - Number(cache.at) < FRESH_MS);
  }

  // Permisos pedidos que Google no ha concedido (se pueden desmarcar en la pantalla de Google)
  function missingScopes(granted, needed) {
    const have = new Set(String(granted || '').split(/\s+/).filter(Boolean));
    return (needed || []).filter(s => !have.has(s));
  }

  // ---------- Días ----------
  // {year, month, day} o "AAAA-MM-DD..." -> "AAAA-MM-DD"
  function parseDay(v) {
    if (typeof v === 'string') { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; }
    if (v && typeof v === 'object') {
      const y = Number(v.year), m = Number(v.month), d = Number(v.day);
      if (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
    }
    return null;
  }

  // n días terminando en `today`, del más antiguo al más reciente
  function lastDays(today, n) {
    const [y, m, d] = today.split('-').map(Number);
    const out = [];
    for (let k = n - 1; k >= 0; k--) out.push(localDay(new Date(y, m - 1, d - k).getTime()));
    return out;
  }

  // ---------- Lectura de las respuestas de Google ----------
  // Resúmenes diarios (pulso en reposo, VFC): { 'AAAA-MM-DD': número }
  function dailyValues(response, key, field) {
    const out = {};
    const points = response && Array.isArray(response.dataPoints) ? response.dataPoints : [];
    for (const p of points) {
      const o = p && p[key];
      if (!o || typeof o !== 'object') continue;
      const day = parseDay(o.date), v = num(o[field]);
      if (day && v !== null) out[day] = v;
    }
    return out;
  }

  const offsetSec = s => { const m = typeof s === 'string' && s.match(/^(-?\d+(?:\.\d+)?)s$/); return m ? Number(m[1]) : null; };

  // Día local (con el desfase horario que da Google) en el que termina un sueño
  function dayWithOffset(iso, offset) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    let off = offsetSec(offset);
    if (off === null) off = -new Date(ms).getTimezoneOffset() * 60;
    const d = new Date(ms + off * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  const minutesBetween = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.max(0, Math.round((y - x) / 60000)) : 0; };

  // Una noche por día de despertar (las siestas no cuentan; con varios sueños se queda el más largo)
  function sleepNights(response) {
    const out = {};
    const points = response && Array.isArray(response.dataPoints) ? response.dataPoints : [];
    for (const p of points) {
      const s = p && p.sleep;
      if (!s || typeof s !== 'object' || !s.interval) continue;
      if (s.metadata && s.metadata.nap) continue;
      const day = dayWithOffset(s.interval.endTime, s.interval.endUtcOffset);
      if (!day) continue;

      const mins = { DEEP: 0, LIGHT: 0, REM: 0, AWAKE: 0 };
      const sum = s.summary || {};
      if (Array.isArray(sum.stagesSummary) && sum.stagesSummary.length) {
        for (const st of sum.stagesSummary) if (st && st.type in mins) mins[st.type] += num(st.minutes) || 0;
      } else if (Array.isArray(s.stages)) {
        for (const st of s.stages) if (st && st.type in mins) mins[st.type] += minutesBetween(st.startTime, st.endTime);
      }
      let asleep = num(sum.minutesAsleep);
      if (asleep === null && Array.isArray(s.stages) && s.stages.length) asleep = mins.DEEP + mins.LIGHT + mins.REM;
      if (asleep === null) continue;
      const inBed = num(sum.minutesInSleepPeriod);

      const night = { day, minutesAsleep: asleep, minutesInBed: inBed === null ? minutesBetween(s.interval.startTime, s.interval.endTime) || null : inBed,
                      deep: mins.DEEP, light: mins.LIGHT, rem: mins.REM, awake: mins.AWAKE, startTime: s.interval.startTime, endTime: s.interval.endTime };
      if (!out[day] || night.minutesAsleep > out[day].minutesAsleep) out[day] = night;
    }
    return out;
  }

  // Pasos por día local a partir de un rollUp en ventanas de una hora
  function stepsByDay(response) {
    const out = {};
    const points = response && Array.isArray(response.rollupDataPoints) ? response.rollupDataPoints : [];
    for (const p of points) {
      const ms = p ? Date.parse(p.startTime) : NaN;
      const n = pointSum(p);
      if (!Number.isFinite(ms) || n === null) continue;
      const day = localDay(ms);
      out[day] = (out[day] || 0) + n;
    }
    return out;
  }

  // ---------- Referencia personal y puntuación ----------
  // Media y desviación de los n días anteriores a hoy. Con menos de 5 días con dato no hay referencia.
  function baseline(values, today, n) {
    const days = lastDays(today, n + 1).slice(0, n);
    const xs = days.map(d => (values ? values[d] : undefined)).filter(v => Number.isFinite(v));
    if (xs.length < 5) return null;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length);
    return { mean, sd, n: xs.length };
  }

  // Sueño 35 % (minutos / 450), VFC 40 % y pulso en reposo 25 % frente a la media personal.
  // Sin referencias la puntuación es provisional (solo con lo que haya, normalmente el sueño).
  function recoveryScore({ sleepMinutes, hrv, hrvBase, rhr, rhrBase }) {
    const parts = {};
    if (Number.isFinite(sleepMinutes)) parts.sleep = clamp(sleepMinutes / SLEEP_TARGET_MIN * 100, 0, 100);
    if (Number.isFinite(hrv) && hrvBase) parts.hrv = clamp(70 + 20 * (hrv - hrvBase.mean) / Math.max(hrvBase.sd, hrvBase.mean * 0.05), 0, 100);
    if (Number.isFinite(rhr) && rhrBase) parts.rhr = clamp(70 + 20 * (rhrBase.mean - rhr) / Math.max(rhrBase.sd, 2), 0, 100);
    const weights = { sleep: 0.35, hrv: 0.4, rhr: 0.25 };
    const keys = Object.keys(parts);
    if (!keys.length) return null;
    const score = Math.round(keys.reduce((s, k) => s + weights[k] * parts[k], 0) / keys.reduce((s, k) => s + weights[k], 0));
    const label = score >= 75 ? 'Buen día para entrenar' : score >= 50 ? 'Día moderado: entrena sin forzar' : 'Mejor descansa hoy';
    return { score, label, parts, provisional: !(parts.hrv !== undefined && parts.rhr !== undefined) };
  }


  // Distancia del día en km. Cada punto trae un campo *Sum cuyo nombre dice la unidad
  // (millimetersSum, metersSum, kilometersSum). Si no se reconoce, se toma como metros.
  function distanceKm(response) {
    const points = response && Array.isArray(response.rollupDataPoints) ? response.rollupDataPoints : [];
    let km = null;
    for (const point of points) {
      for (const value of Object.values(point || {})) {
        if (!value || typeof value !== 'object') continue;
        for (const [key, v] of Object.entries(value)) {
          if (!/Sum$/.test(key)) continue;
          const n = num(v);
          if (n === null) continue;
          const factor = /milli/i.test(key) ? 1e-6 : /kilo/i.test(key) ? 1 : 1e-3;
          km = (km || 0) + n * factor;
          break;
        }
      }
    }
    return km === null ? null : Math.round(km * 10) / 10;
  }

  const api = { todayRange, sumRollup, distanceKm, tokenValid, summaryFresh, missingScopes, parseDay, lastDays, dailyValues,
                sleepNights, stepsByDay, baseline, recoveryScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HealthCore = Object.assign(root.HealthCore || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
