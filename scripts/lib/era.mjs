export function applyEra(days, calendar, cutover) {
  const out = structuredClone(days);
  for (const [day, total] of Object.entries(calendar)) {
    if (day >= cutover) continue;
    const personal = out[day]?.personal ?? 0;
    const vidyard = Math.max(0, total - personal);
    if (vidyard === 0) continue;
    (out[day] ??= {}).vidyard = vidyard;
  }
  return out;
}
