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

  function subscriptionTotals(subs) {
    const active = subs.filter(s => !s.paused);
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

  function nextCharge(sub, today) {
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
      .map(sub => { const date = nextCharge(sub, today); return { sub, date, days: daysBetween(today, date) }; })
      .filter(u => u.days <= within)
      .sort((a, b) => a.days - b.days || a.sub.name.localeCompare(b.sub.name, 'es'));
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

  const api = {
    addDays, addMonths, daysBetween, yearlyCost, monthlyCost, subscriptionTotals, nextCharge, upcomingCharges,
    merchantKey, matchSubscription, detectSubscriptions, parseAmount, parseInbox, guessCategory, monthSummary, newId
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Planner = Object.assign(root.Planner || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
