const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Inclusive YYYY-MM-DD windows of `months` months each, aligned to month
// boundaries and clipped to [fromISO, toISO].
export function windows(fromISO, toISO, months = 1) {
  const out = [];
  let cur = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    const alignedEndMonth = Math.floor(m / months) * months + months;
    const winEnd = new Date(Date.UTC(y, alignedEndMonth, 0));
    const to = winEnd < end ? winEnd : end;
    out.push({ from: iso(cur), to: iso(to) });
    cur = new Date(Date.UTC(y, alignedEndMonth, 1));
  }
  return out;
}

export const monthWindows = (from, to) => windows(from, to, 1);
export const quarterWindows = (from, to) => windows(from, to, 3);
export const yearWindows = (from, to) => windows(from, to, 12);
