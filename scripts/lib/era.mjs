// GitHub's contribution calendar is the source of truth for daily volume: it
// counts commits on every branch plus PRs, reviews and issues, while commit
// search only sees the default branch. Personal activity comes from search
// (scoped to the user's own repos); whatever the calendar has beyond that is
// attributed to whoever Shub worked for at the time.
export const ERAS = [
  { key: 'indie', until: '2018-10-01' },   // Vidhub, LaunchVault, freelance
  { key: 'vidyard', until: '2025-12-03' }, // first Customer.io commit is the cutover
  { key: 'cio', until: '9999-12-31' },
];

export function eraFor(day, eras = ERAS) {
  return eras.find((e) => day < e.until).key;
}

export function applyEra(days, calendar, cutover = ERAS[1].until) {
  const eras = ERAS.map((e) => (e.key === 'vidyard' ? { ...e, until: cutover } : e));
  const out = structuredClone(days);
  for (const [day, total] of Object.entries(calendar)) {
    const personal = out[day]?.personal ?? 0;
    const employer = Math.max(0, total - personal);
    const key = eraFor(day, eras);
    const searched = key === 'cio' ? out[day]?.cio ?? 0 : 0;
    const n = Math.max(searched, employer);
    if (n === 0) continue;
    (out[day] ??= {})[key] = n;
  }
  return out;
}
