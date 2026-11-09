// Lógica pura del gimnasio (sin DOM). Se prueba en apps/gimnasio/tests.
// Rutina  = { id, name, updatedAt, exercises: [{ exId, sets: [{ reps, weight }] }] }
// Sesión  = { id, startedAt, durationSec, routineId, routineName, updatedAt, deleted?,
//             exercises: [{ exId, sets: [{ reps, weight, done }] }] }
// Los días son 'AAAA-MM-DD' en hora local (nunca toISOString: cambia el día según la zona horaria).
(function (root) {
  const MAX_IMPORT_CHARS = 200 * 1024;
  const MAX_EXERCISES = 50;
  const MAX_SETS = 20;
  const MAX_VALUE = 1000;
  const MAX_NAME = 60;
  const DAY_MS = 86400000;

  const pad = n => String(n).padStart(2, '0');
  const dayOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parseDay = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (day, n) => { const d = parseDay(day); d.setDate(d.getDate() + n); return dayOf(d.getTime()); };
  const mondayOf = day => { const d = parseDay(day); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayOf(d.getTime()); };
  const toDay = v => (typeof v === 'string' ? v : dayOf(v instanceof Date ? v.getTime() : v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const monthKey = day => day.slice(0, 7);

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const live = sessions => (sessions || []).filter(s => s && !s.deleted);
  const doneSets = ex => (ex.sets || []).filter(s => s.done);

  // ---------- Cálculos ----------
  function epley1RM(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    return weight * (1 + reps / 30);
  }

  function sessionVolume(session) {
    let total = 0;
    for (const ex of session.exercises || []) {
      for (const s of doneSets(ex)) total += num(s.weight) * num(s.reps);
    }
    return total;
  }

  function elapsedSec(startedAt, now) {
    return Math.max(0, Math.floor((now - startedAt) / 1000));
  }

  // ---------- Entreno en curso ----------
  function startSession(routine, now) {
    return {
      id: uid(),
      startedAt: now,
      routineId: routine.id,
      routineName: routine.name,
      exercises: (routine.exercises || []).map(ex => ({
        exId: ex.exId,
        sets: (ex.sets || []).map(s => ({ reps: num(s.reps), weight: num(s.weight), done: false }))
      }))
    };
  }

  function finishSession(session, now) {
    const exercises = (session.exercises || [])
      .map(ex => ({ exId: ex.exId, sets: doneSets(ex).map(s => ({ reps: num(s.reps), weight: num(s.weight), done: true })) }))
      .filter(ex => ex.sets.length > 0);
    return Object.assign({}, session, { exercises, durationSec: elapsedSec(session.startedAt, now), updatedAt: now });
  }

  // ---------- Estadísticas ----------
  function exerciseHistory(sessions, exId) {
    const byDay = new Map();
    for (const session of live(sessions)) {
      const day = dayOf(session.startedAt);
      for (const ex of session.exercises || []) {
        if (ex.exId !== exId) continue;
        for (const s of doneSets(ex)) {
          const w = num(s.weight), r = num(s.reps);
          const d = byDay.get(day) || { day, maxWeight: 0, volume: 0, est1RM: 0 };
          d.maxWeight = Math.max(d.maxWeight, w);
          d.volume += w * r;
          d.est1RM = Math.max(d.est1RM, epley1RM(w, r));
          byDay.set(day, d);
        }
      }
    }
    return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  }

  // Series hechas en la semana (lunes a domingo) que empieza en weekStart. Principal 1, secundario 0,5.
  function weeklyMuscleSets(sessions, catalog, weekStart) {
    const end = addDays(weekStart, 6);
    const byId = new Map((catalog || []).map(e => [e.id, e]));
    const out = {};
    for (const session of live(sessions)) {
      const day = dayOf(session.startedAt);
      if (day < weekStart || day > end) continue;
      for (const ex of session.exercises || []) {
        const info = byId.get(ex.exId);
        if (!info) continue;
        const n = doneSets(ex).length;
        if (!n) continue;
        for (const m of info.primaryMuscles || []) out[m] = (out[m] || 0) + n;
        for (const m of info.secondaryMuscles || []) out[m] = (out[m] || 0) + n * 0.5;
      }
    }
    return out;
  }

  const levelOf = sets => (sets <= 0 ? 0 : sets <= 3 ? 1 : sets <= 7 ? 2 : sets <= 12 ? 3 : 4);

  // Cuadrícula estilo GitHub: columnas = semanas (lunes a domingo), la última contiene a `today`.
  function calendarCells(sessions, today, weeks) {
    const nWeeks = weeks || 52;
    const todayDay = toDay(today);
    const first = addDays(mondayOf(todayDay), -(nWeeks - 1) * 7);
    const sets = {};
    for (const session of live(sessions)) {
      const day = dayOf(session.startedAt);
      for (const ex of session.exercises || []) sets[day] = (sets[day] || 0) + doneSets(ex).length;
    }
    const cells = [];
    for (let i = 0; i < nWeeks * 7; i++) {
      const day = addDays(first, i);
      const n = sets[day] || 0;
      cells.push({ day, sets: n, level: levelOf(n) });
    }
    return cells;
  }

  // Resumen de los entrenos de un día ('AAAA-MM-DD'): cuántos, series hechas, duración, volumen y nombres.
  function todaySummary(sessions, day) {
    const out = { count: 0, sets: 0, durationSec: 0, volume: 0, names: [] };
    for (const s of live(sessions)) {
      if (dayOf(s.startedAt) !== day) continue;
      const sets = (s.exercises || []).reduce((n, ex) => n + doneSets(ex).length, 0);
      if (!sets) continue;
      out.count++;
      out.sets += sets;
      out.durationSec += num(s.durationSec);
      out.volume += sessionVolume(s);
      out.names.push(s.routineName || 'Entreno');
    }
    return out;
  }

  // ---------- Fusión del historial de un mes ----------
  function mergeMonthLogs(local, remote) {
    const byId = new Map();
    for (const side of [local, remote]) {
      for (const s of (side && side.sessions) || []) {
        const prev = byId.get(s.id);
        if (!prev || (s.updatedAt || 0) > (prev.updatedAt || 0)) byId.set(s.id, s);
      }
    }
    return {
      updatedAt: Math.max((local && local.updatedAt) || 0, (remote && remote.updatedAt) || 0),
      sessions: [...byId.values()]
    };
  }

  // ¿Tiene `a` algún entreno que `b` no tiene, o con una versión más reciente?
  function hasNewer(a, b) {
    const theirs = new Map(((b && b.sessions) || []).map(x => [x.id, x.updatedAt || 0]));
    return ((a && a.sessions) || []).some(x => !theirs.has(x.id) || (x.updatedAt || 0) > theirs.get(x.id));
  }

  // Datos que vienen de fuera (la nube, el almacenamiento): solo se aceptan si tienen la forma esperada,
  // para que un dato roto no rompa las pantallas.
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const validExercises = list => Array.isArray(list) &&
    list.every(e => isObj(e) && typeof e.exId === 'string' && Array.isArray(e.sets) && e.sets.every(isObj));
  const isValidSession = s => isObj(s) && typeof s.id === 'string' && Number.isFinite(s.startedAt) && validExercises(s.exercises);
  const isValidRoutine = r => isObj(r) && typeof r.id === 'string' && typeof r.name === 'string' && validExercises(r.exercises);

  // ---------- Compartir plantillas ----------
  function exportRoutine(routine) {
    return {
      type: 'mi-app-rutina',
      version: 1,
      name: routine.name,
      exercises: (routine.exercises || []).map(ex => ({
        exId: ex.exId,
        sets: (ex.sets || []).map(s => ({ reps: num(s.reps), weight: num(s.weight) }))
      }))
    };
  }

  const inRange = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_VALUE;
  const fail = error => ({ ok: false, error });

  function importRoutine(text, catalogIds) {
    if (typeof text !== 'string' || !text.trim()) return fail('El archivo está vacío.');
    if (text.length > MAX_IMPORT_CHARS) return fail('El archivo es demasiado grande para ser una rutina.');
    let data;
    try { data = JSON.parse(text); } catch (e) { return fail('El archivo no es una rutina válida.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.type !== 'mi-app-rutina') {
      return fail('El archivo no es una rutina de esta app.');
    }
    if (data.version !== 1) return fail('Este archivo es de una versión que esta app no entiende.');
    if (!Array.isArray(data.exercises)) return fail('La rutina no tiene ejercicios.');
    if (data.exercises.length > MAX_EXERCISES) return fail('La rutina tiene demasiados ejercicios.');

    const known = new Set(catalogIds || []);
    const exercises = [];
    let dropped = 0;
    for (const ex of data.exercises) {
      if (!ex || typeof ex !== 'object' || typeof ex.exId !== 'string' || !Array.isArray(ex.sets)) {
        return fail('La rutina tiene un ejercicio mal formado.');
      }
      if (ex.sets.length > MAX_SETS) return fail('Un ejercicio tiene demasiadas series.');
      const sets = [];
      for (const s of ex.sets) {
        if (!s || !inRange(s.reps) || !inRange(s.weight)) return fail('La rutina tiene repeticiones o pesos fuera de rango.');
        sets.push({ reps: s.reps, weight: s.weight });
      }
      if (!known.has(ex.exId)) { dropped++; continue; }
      exercises.push({ exId: ex.exId, sets });
    }
    const name = (typeof data.name === 'string' ? data.name.trim() : '').slice(0, MAX_NAME) || 'Rutina importada';
    return { ok: true, routine: { id: uid(), name, updatedAt: Date.now(), exercises }, dropped };
  }

  // Cambia in situ los id de ejercicio antiguos por los nuevos (aliases = { antiguo: nuevo }) en rutinas y entrenos.
  // Devuelve cuántos cambió; si se repite no cambia nada.
  function remapExerciseIds(state, aliases) {
    if (!state || !aliases) return 0;
    let n = 0;
    const fix = list => (list || []).forEach(ex => {
      if (ex && Object.prototype.hasOwnProperty.call(aliases, ex.exId)) { ex.exId = aliases[ex.exId]; n++; }
    });
    (state.routines || []).forEach(r => fix(r.exercises));
    Object.values(state.logs || {}).forEach(m => (m.sessions || []).forEach(s => fix(s.exercises)));
    return n;
  }

  // Ejercicios de una sesión cuyo mejor 1RM estimado supera al mejor de los entrenos anteriores (sin contar la propia sesión,
  // los borrados ni las series sin hacer). La primera vez que se hace un ejercicio no cuenta como récord.
  function newRecords(session, sessions) {
    const best = new Map();
    for (const prev of live(sessions)) {
      if (prev.id === session.id) continue;
      for (const ex of prev.exercises || []) {
        for (const s of doneSets(ex)) best.set(ex.exId, Math.max(best.get(ex.exId) || 0, epley1RM(num(s.weight), num(s.reps))));
      }
    }
    const out = [];
    for (const ex of session.exercises || []) {
      let top = null;
      for (const s of doneSets(ex)) {
        const e = epley1RM(num(s.weight), num(s.reps));
        if (e > 0 && (!top || e > top.est1RM)) top = { exId: ex.exId, est1RM: e, weight: num(s.weight), reps: num(s.reps) };
      }
      if (top && (best.get(ex.exId) || 0) > 0 && top.est1RM > best.get(ex.exId) + 1e-9) out.push(top);
    }
    return out;
  }

  // ---------- Nombres propios de los ejercicios ----------
  // names = { exId: 'Mi nombre' }. Se guarda solo lo que se ha cambiado; vacío o igual al original lo quita.
  const cleanName = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '');
  function cleanNames(raw) {
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) { const n = cleanName(v); if (n) out[k] = n; }
    }
    return out;
  }
  function setExerciseName(names, exId, name, original) {
    const out = Object.assign({}, cleanNames(names));
    const n = cleanName(name);
    if (!n || n === original) delete out[exId]; else out[exId] = n;
    return out;
  }

  const api = {
    epley1RM, sessionVolume, elapsedSec, startSession, finishSession, exerciseHistory,
    weeklyMuscleSets, todaySummary, calendarCells, mergeMonthLogs, hasNewer, isValidSession, isValidRoutine, monthKey, exportRoutine, importRoutine, remapExerciseIds, newRecords, cleanNames, setExerciseName,
    dayOf, addDays, mondayOf, uid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Gym = Object.assign(root.Gym || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
