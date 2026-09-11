export function mergeDays(existing, fresh, range) {
  const out = {};
  for (const [day, v] of Object.entries(existing)) {
    if (day < range.from || day > range.to) out[day] = v;
  }
  for (const [day, v] of Object.entries(fresh)) out[day] = v;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
