// GitHub's contribution calendar is the source of truth for daily volume: it
// counts commits on every branch plus PRs, reviews and issues, while commit
// search only sees the default branch. Personal activity comes from search
// (scoped to the user's own repos); whatever the calendar has beyond that is
// attributed to the employer of the era.
export function applyEra(days, calendar, cutover) {
  const out = structuredClone(days);
  for (const [day, total] of Object.entries(calendar)) {
    const personal = out[day]?.personal ?? 0;
    const employer = Math.max(0, total - personal);
    if (day < cutover) {
      if (employer === 0) continue;
      (out[day] ??= {}).vidyard = employer;
    } else {
      const searched = out[day]?.cio ?? 0;
      const cio = Math.max(searched, employer);
      if (cio === 0) continue;
      (out[day] ??= {}).cio = cio;
    }
  }
  return out;
}
