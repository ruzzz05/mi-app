// Gastos y suscripciones (sin DOM ni red). Se prueba en apps/gastos/tests.
// Fechas como texto 'AAAA-MM-DD'; importes en euros.
(function (root) {
  // ---------- fechas (en UTC para que no cambien con la zona horaria)
  const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromUTC = t => new Date(t).toISOString().slice(0, 10);
  const DAY = 86400000;

  const addDays = (s, n) => fromUTC(toUTC(s) + n * DAY);
  const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);

  // Suma meses conservando el día; si el mes destino es más corto, usa su último día.
  function addMonths(s, n) {
    const [y, m, d] = s.split('-').map(Number);
    const total = (y * 12 + (m - 1)) + n;
    const ny = Math.floor(total / 12), nm = total % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return fromUTC(Date.UTC(ny, nm, Math.min(d, last)));
  }

  // ---------- coste de una suscripción
  const round2 = n => Math.round(n * 100) / 100;
  const PER_YEAR = { week: 52, month: 12, year: 1 };
  const yearlyCost = sub => round2(sub.amount * PER_YEAR[sub.period]);
  const monthlyCost = sub => round2(yearlyCost(sub) / 12);

  // Activa = no pausada y, si tiene fecha de fin ("until", último día vigente), todavía no terminada.
  const isActive = (sub, today) => !sub.paused && !(sub.until && today && sub.until < today);

  function subscriptionTotals(subs, today) {
    const active = subs.filter(s => isActive(s, today));
    return {
      monthly: round2(active.reduce((t, s) => t + monthlyCost(s), 0)),
      yearly: round2(active.reduce((t, s) => t + yearlyCost(s), 0)),
      count: active.length
    };
  }

  // ---------- próximo cobro
  // Primer cobro que cae hoy o después. Siempre se calcula desde el anchor (no encadenando) para
  // que un 31 de enero vuelva a ser 31 en marzo aunque febrero sea más corto.
  function chargeAt(sub, k) {
    if (sub.period === 'week') return addDays(sub.anchor, 7 * k);
    return addMonths(sub.anchor, (sub.period === 'year' ? 12 : 1) * k);
  }

  // null si el siguiente cobro cae después de la fecha de fin.
  function nextCharge(sub, today) {
    const d = rawNextCharge(sub, today);
    return sub.until && d > sub.until ? null : d;
  }

  function rawNextCharge(sub, today) {
    if (sub.anchor >= today) return sub.anchor;
    const gap = daysBetween(sub.anchor, today);
    let k = Math.max(0, Math.floor(gap / (sub.period === 'week' ? 7 : sub.period === 'year' ? 366 : 31)) - 1);
    while (chargeAt(sub, k) < today) k++;
    return chargeAt(sub, k);
  }

  // Cobros de las suscripciones activas en los próximos `within` días, del más cercano al más lejano.
  function upcomingCharges(subs, today, within) {
    return subs
      .filter(s => !s.paused)
      .map(sub => { const date = nextCharge(sub, today); return date && { sub, date, days: daysBetween(today, date) }; })
      .filter(u => u && u.days <= within)
      .sort((a, b) => a.days - b.days || a.sub.name.localeCompare(b.sub.name, 'es'));
  }

  // Cobros que quedan desde hoy hasta la fecha de fin. null si no tiene fecha de fin.
  function remainingCharges(sub, today) {
    if (!sub.until) return null;
    let n = 0;
    for (let d = nextCharge(sub, today); d && n < 1000; d = nextCharge(sub, addDays(d, 1))) n++;
    return n;
  }

  // ---------- datos para los gráficos
  const daysInMonth = month => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const shiftMonth = (month, n) => addMonths(month + '-01', n).slice(0, 7);

  // Total gastado cada día del mes (posición 0 = día 1).
  function dailySeries(expenses, month) {
    const out = Array(daysInMonth(month)).fill(0);
    expenses.forEach(e => { if (e.date.startsWith(month)) out[Number(e.date.slice(8, 10)) - 1] += e.amount; });
    return out.map(round2);
  }

  // Los últimos n meses (el último es `month`), con 0 si no hubo gastos.
  function lastMonths(expenses, month, n) {
    return Array.from({ length: n }, (_, i) => {
      const m = shiftMonth(month, i - (n - 1));
      return { month: m, total: round2(expenses.filter(e => e.date.startsWith(m)).reduce((t, e) => t + e.amount, 0)) };
    });
  }

  // Cobros de suscripciones que caen en el mes (activas, sin pasar de su fecha de fin).
  function chargesInMonth(subs, month) {
    const start = month + '-01', end = month + '-' + String(daysInMonth(month)).padStart(2, '0');
    const out = [];
    subs.filter(s => !s.paused).forEach(sub => {
      for (let d = nextCharge(sub, start); d && d <= end; d = nextCharge(sub, addDays(d, 1))) out.push({ sub, date: d });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.sub.name.localeCompare(b.sub.name, 'es'));
  }

  // Cuánto se habrá gastado a final de mes si sigue el ritmo actual.
  function projectMonth(total, today) {
    const day = Number(today.slice(8, 10));
    return round2(total / day * daysInMonth(today.slice(0, 7)));
  }

  // ---------- nombres de comercios
  const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // "NETFLIX.COM AMSTERDAM" -> "netflixcom amsterdam" -> primera palabra relevante sin dominio
  const merchantKey = s => fold(s).replace(/\.(com|es|net|org)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0] || '';

  // ¿A qué suscripción corresponde este gasto? Por el nombre del comercio.
  function matchSubscription(expense, subs) {
    const text = fold(expense.merchant || '');
    return subs.find(s => { const k = merchantKey(s.name); return k && text.includes(k); }) || null;
  }

  // ---------- detectar suscripciones en los gastos
  const median = arr => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const periodOf = days => (days >= 6 && days <= 8 ? 'week' : days >= 27 && days <= 33 ? 'month' : days >= 358 && days <= 372 ? 'year' : null);

  // Gastos del mismo comercio que se repiten con importe parecido y a intervalos regulares.
  function detectSubscriptions(expenses, subs) {
    const known = new Set(subs.map(s => merchantKey(s.name)));
    const groups = new Map();
    expenses.forEach(e => {
      const k = merchantKey(e.merchant || '');
      if (!k || known.has(k)) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
    const found = [];
    groups.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => a.date.localeCompare(b.date));
      const mid = median(list.map(e => e.amount));
      if (!list.every(e => Math.abs(e.amount - mid) <= mid * 0.1)) return;
      const gaps = list.slice(1).map((e, i) => daysBetween(list[i].date, e.date));
      const period = periodOf(median(gaps));
      if (!period) return;
      const last = list[list.length - 1];
      const anchor = period === 'week' ? addDays(last.date, 7) : addMonths(last.date, period === 'year' ? 12 : 1);
      found.push({ name: last.merchant.trim(), amount: last.amount, period, anchor, count: list.length });
    });
    return found.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
  }

  // ---------- entrada automática (Atajos de iOS escribe en la bandeja)
  // "1.234,56" -> 1234.56; "12,50 €" -> 12.5; "3.5" -> 3.5; "-4,00" -> 4. null si no es un importe.
  function parseAmount(text) {
    let t = String(text == null ? '' : text).replace(/[^\d.,-]/g, '').replace(/^-/, '');
    if (!/\d/.test(t)) return null;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return n > 0 ? round2(n) : null;
  }

  const newId = () => Math.random().toString(36).slice(2, 10);

  function parseInbox(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const amount = parseAmount(raw.amount);
    if (amount === null) return null;
    const merchant = String(raw.merchant || '').trim() || 'Pago con tarjeta';
    const ts = Number.isFinite(Number(raw.ts)) ? Number(raw.ts) : Date.now();
    return { id: newId(), amount, merchant, date: fromUTC(ts), category: guessCategory(merchant), source: 'auto' };
  }

  // ---------- categorías
  const CATEGORY_WORDS = {
    Supermercado: ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia ', 'eroski', 'consum', 'alcampo', 'supermercado'],
    Suscripciones: ['netflix', 'spotify', 'hbo', 'disney', 'prime video', 'youtube', 'apple.com', 'icloud', 'dazn', 'openai', 'chatgpt', 'adobe'],
    Transporte: ['renfe', 'uber', 'cabify', 'gasolinera', 'repsol', 'cepsa', 'bp ', 'metro', 'emt', 'bolt'],
    Restaurantes: ['restaurante', 'mcdonald', 'burger', 'telepizza', 'glovo', 'just eat', 'uber eats', 'starbucks', 'cafe']
  };

  function guessCategory(merchant) {
    const text = fold(merchant) + ' ';
    const hit = Object.keys(CATEGORY_WORDS).find(c => CATEGORY_WORDS[c].some(w => text.includes(w)));
    return hit || 'Otros';
  }

  // ---------- resumen del mes ('AAAA-MM')
  function monthSummary(expenses, month) {
    const inMonth = expenses.filter(e => e.date.startsWith(month));
    const by = new Map();
    inMonth.forEach(e => by.set(e.category, (by.get(e.category) || 0) + e.amount));
    return {
      total: round2(inMonth.reduce((t, e) => t + e.amount, 0)),
      byCategory: [...by].map(([category, total]) => ({ category, total: round2(total) })).sort((a, b) => b.total - a.total)
    };
  }


  // ---------- Presupuesto, meses, categorías y exportar ----------
  const DEFAULT_MONTH_BUDGET = 1000;
  const DEFAULT_BUDGETS = { Supermercado: 350, Restaurantes: 120, Transporte: 100, Suscripciones: 80, Ocio: 120, Salud: 60, Hogar: 100, Otros: 70 };

  // Los pagos que llegan solos (Apple Pay) esperan a que los revises: no cuentan hasta confirmarlos.
  const confirmed = list => list.filter(e => !e.pending);
  const pendingList = list => list.filter(e => e.pending);
  function confirmPending(list, id, category) {
    if (!list.some(e => e.id === id)) return list;
    return list.map(e => { if (e.id !== id) return e; const { pending, ...rest } = e; return { ...rest, category: category || e.category }; });
  }

  // Cifras de un mes ('AAAA-MM') frente a un presupuesto. today = 'AAAA-MM-DD'.
  function monthStats(expenses, month, budget, today) {
    const spent = round2(sumOf(confirmed(expenses).filter(e => e.date.startsWith(month))));
    const total = daysInMonth(month), current = today.startsWith(month);
    const days = current ? Number(today.slice(8, 10)) : total;
    return {
      spent, left: round2(budget - spent), pct: budget > 0 ? Math.min(100, round2(spent / budget * 100)) : 0, over: spent > budget,
      days, perDay: round2(spent / days), forecast: current ? round2(spent / days * total) : null,
      closed: !current, restDays: current ? total - days : 0
    };
  }
  const sumOf = list => list.reduce((t, e) => t + e.amount, 0);

  const SHORT_MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  // Gastos agrupados por día, del más reciente al más antiguo: Hoy, Ayer o "12 nov".
  function groupByDay(expenses, today) {
    const by = new Map();
    confirmed(expenses).forEach(e => { if (!by.has(e.date)) by.set(e.date, []); by.get(e.date).push(e); });
    return [...by.keys()].sort().reverse().map(date => ({
      date, items: by.get(date), total: round2(sumOf(by.get(date))),
      label: date === today ? 'Hoy' : date === addDays(today, -1) ? 'Ayer' : `${Number(date.slice(8, 10))} ${SHORT_MONTH[Number(date.slice(5, 7)) - 1]}`
    }));
  }

  // Gasto de un mes por categoría frente al presupuesto de cada una, del que más gasta al que menos.
  function categoryRows(expenses, month, budgets) {
    const spent = {};
    confirmed(expenses).filter(e => e.date.startsWith(month)).forEach(e => { spent[e.category] = (spent[e.category] || 0) + e.amount; });
    const names = [...new Set([...Object.keys(budgets), ...Object.keys(spent)])];
    return names.map(category => {
      const s = round2(spent[category] || 0), budget = budgets[category] || 0;
      return { category, spent: s, budget, pct: budget > 0 ? Math.min(100, Math.round(s / budget * 100)) : 0, over: budget > 0 && s > budget };
    }).sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category, 'es'));
  }

  // Texto CSV (separado por ;, con coma decimal) para abrirlo en una hoja de cálculo en español.
  const csvField = v => (/[";\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  function toCSV(expenses) {
    const rows = confirmed(expenses).map(e => [e.date, csvField(e.merchant), csvField(e.category), e.amount.toFixed(2).replace('.', ',')].join(';'));
    return ['fecha;comercio;categoria;importe', ...rows].join('\n');
  }


  // La dirección con la que el Atajo de iOS abre la app: ?pago=12,50&comercio=Mercadona.
  // Devuelve un gasto por revisar (pending) o null si no trae un pago válido.
  function fromQuery(search, now) {
    let q; try { q = new URLSearchParams(search); } catch (e) { return null; }
    if (!q.has('pago')) return null;
    const e = parseInbox({ amount: q.get('pago'), merchant: q.get('comercio') || '', ts: now });
    return e ? { ...e, pending: true } : null;
  }


  // 1234.5 -> "1.234,50 €" (con punto de miles también desde 4 cifras)
  function euros(n, decimals) {
    const neg = n < 0, fixed = Math.abs(n).toFixed(decimals), [int, dec] = fixed.split('.');
    const out = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '');
    return (neg && Number(fixed) !== 0 ? '-' : '') + out + ' €';
  }

  const api = {
    DEFAULT_MONTH_BUDGET, DEFAULT_BUDGETS, euros, fromQuery, confirmed, pendingList, confirmPending, monthStats, groupByDay, categoryRows, toCSV,
    isActive, remainingCharges, daysInMonth, shiftMonth, dailySeries, lastMonths, chargesInMonth, projectMonth,
    addDays, addMonths, daysBetween, yearlyCost, monthlyCost, subscriptionTotals, nextCharge, upcomingCharges,
    merchantKey, matchSubscription, detectSubscriptions, parseAmount, parseInbox, guessCategory, monthSummary, newId
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
