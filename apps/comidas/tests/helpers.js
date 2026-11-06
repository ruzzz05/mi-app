// Datos de ejemplo compartidos por los tests
const dish = (id, ingredients = []) => ({
  id, name: id.toUpperCase(),
  ingredients: ingredients.map(i => (typeof i === 'string' ? { name: i, qty: 1 } : i))
});
const dishes = (...ids) => ids.map(id => dish(id));
const firstRng = () => 0; // determinista: siempre el primer candidato
const menuOf = (plan = {}, extra = {}) => ({
  startDate: '2026-01-05', firstMeal: 'comida', days: 7, plan, exclusions: [], ...extra
});

// Aleatorio con semilla (mulberry32) para tests reproducibles
const seededRng = seed => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
