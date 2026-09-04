export type SourceKey = 'cio' | 'vidyard' | 'personal' | 'ai';
export type Day = Partial<Record<SourceKey, number>>;
export type PulseData = {
  generatedAt: string;
  cutover: string;
  sources: Record<SourceKey, { label: string; ink: string }>;
  days: Record<string, Day>;
};

const STACK: SourceKey[] = ['cio', 'vidyard', 'personal'];
const DAY_MS = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const todayISO = () => iso(Date.now());

export function stackTotal(day: Day | undefined, hidden: Set<SourceKey>): number {
  if (!day) return 0;
  return STACK.reduce((n, k) => n + (hidden.has(k) ? 0 : day[k] ?? 0), 0);
}

export function yearGrid(year: number): string[] {
  const today = todayISO();
  const endISO = year === Number(today.slice(0, 4)) ? today : `${year}-12-31`;
  let end = Date.parse(endISO + 'T00:00:00Z');
  end += (6 - new Date(end).getUTCDay()) * DAY_MS;
  const start = end - 370 * DAY_MS;
  return Array.from({ length: 371 }, (_, i) => iso(start + i * DAY_MS));
}

export function scale(data: PulseData, dates: string[], hidden: Set<SourceKey>): number {
  const totals = dates
    .map((d) => stackTotal(data.days[d], hidden))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (!totals.length) return 1;
  return Math.max(1, totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))]);
}

export type GridOpts = { cell: number; gap: number; colFrom?: number; colTo?: number };

// Columns are weeks (0..52). colFrom/colTo render a slice, x re-based to 0,
// so the same data can be drawn as one strip or as stacked half-year strips.
export function renderGrid(data: PulseData, year: number, hidden: Set<SourceKey>, o: GridOpts): string {
  const dates = yearGrid(year);
  const max = scale(data, dates, hidden);
  const step = o.cell + o.gap;
  const today = todayISO();
  const colFrom = o.colFrom ?? 0;
  const colTo = o.colTo ?? 52;
  const baselineY = 7 * step - o.gap + 1.5;
  const parts: string[] = [];
  dates.forEach((date, i) => {
    const col = Math.floor(i / 7);
    if (col < colFrom || col > colTo) return;
    const row = i % 7;
    const x = (col - colFrom) * step;
    const y0 = row * step;
    const day = data.days[date];
    const total = stackTotal(day, hidden);
    const future = date > today;
    const rects: string[] = [];
    rects.push(`<rect class="bg${future ? ' future' : ''}" x="${x}" y="${y0}" width="${o.cell}" height="${o.cell}"/>`);
    if (total > 0) {
      const q = Math.ceil((4 * Math.min(total, max)) / max);
      const stackH = Math.max(3, Math.round((q / 4) * o.cell));
      let yTop = y0 + o.cell;
      let used = 0;
      const visible = STACK.filter((k) => !hidden.has(k) && (day?.[k] ?? 0) > 0);
      visible.forEach((k, idx) => {
        const v = day?.[k] ?? 0;
        const h = idx === visible.length - 1 ? stackH - used : Math.max(1, Math.round((v / total) * stackH));
        const hh = Math.max(0, Math.min(h, stackH - used));
        if (hh === 0) return;
        used += hh;
        yTop -= hh;
        rects.push(`<rect data-source="${k}" x="${x}" y="${yTop}" width="${o.cell}" height="${hh}" rx="${idx === visible.length - 1 ? 2 : 0}" fill="${data.sources[k].ink}"/>`);
      });
    }
    parts.push(`<g class="day" data-date="${date}" style="--c:${col - colFrom}">${rects.join('')}</g>`);
  });
  const width = (colTo - colFrom + 1) * step - o.gap;
  parts.push(`<line class="baseline" x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}"/>`);
  if (!hidden.has('ai')) {
    dates.forEach((date, i) => {
      const col = Math.floor(i / 7);
      if (col < colFrom || col > colTo) return;
      const day = data.days[date];
      if (!(day?.ai ?? 0)) return;
      const x = (col - colFrom) * step;
      parts.push(`<rect class="ai" data-date="${date}" x="${x}" y="${baselineY + o.gap}" width="${o.cell}" height="2" rx="1" fill="${data.sources.ai.ink}"/>`);
    });
  }
  return parts.join('');
}

// Height in user units needed for a grid drawn with these options.
export function gridHeight(o: { cell: number; gap: number }): number {
  const step = o.cell + o.gap;
  return 7 * step - o.gap + 1.5 + o.gap + 2 + 1;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return `${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function monthLabels(year: number, colFrom = 0, colTo = 52): Array<{ col: number; label: string }> {
  const dates = yearGrid(year);
  const out: Array<{ col: number; label: string }> = [];
  const lastLabelCol = colTo === 52 ? colTo : colTo - 2; // labels overhang their column; keep them inside a slice
  let last = '';
  dates.forEach((d, i) => {
    const m = d.slice(0, 7);
    const col = Math.floor(i / 7);
    if (i % 7 !== 0 || col < colFrom || col > lastLabelCol) return;
    const monthStartsHere = d.slice(8, 10) <= '07';
    const sliceStartsHere = col === colFrom && colFrom > 0;
    if (m !== last && (monthStartsHere || sliceStartsHere)) {
      out.push({ col: col - colFrom, label: MON[Number(d.slice(5, 7)) - 1] });
      last = m;
    } else if (m !== last && monthStartsHere === false && col === colFrom) {
      last = m;
    }
  });
  return out;
}

export function readout(data: PulseData, date: string): string {
  const day = data.days[date];
  const bits: string[] = [];
  if (day?.cio) bits.push(`${day.cio} ${data.sources.cio.label}`);
  if (day?.vidyard) bits.push(`${day.vidyard} ${data.sources.vidyard.label}`);
  if (day?.personal) bits.push(`${day.personal} ${data.sources.personal.label.toLowerCase()}`);
  if (day?.ai) bits.push(`${day.ai} ${data.sources.ai.label}`);
  return [formatDate(date), ...(bits.length ? bits : ['quiet'])].join(' · ');
}

export function stats(data: PulseData, year: number, hidden: Set<SourceKey>) {
  const today = todayISO();
  const dates = yearGrid(year).filter((d) => d.startsWith(String(year)) && d <= today);
  let busiest: { date: string; total: number } | null = null;
  let commits = 0;
  let ai = 0;
  for (const d of dates) {
    const t = stackTotal(data.days[d], hidden);
    commits += t;
    ai += data.days[d]?.ai ?? 0;
    if (t > (busiest?.total ?? 0)) busiest = { date: d, total: t };
  }
  let streak = 0;
  for (let t = Date.parse(today + 'T00:00:00Z'); ; t -= DAY_MS) {
    const d = iso(t);
    if (stackTotal(data.days[d], hidden) > 0) streak++;
    else if (d === today) continue;
    else break;
  }
  return { streak, busiest, aiShare: commits ? Math.round((ai / commits) * 100) : 0 };
}

export function availableYears(data: PulseData): number[] {
  const years = Object.keys(data.days).map((d) => Number(d.slice(0, 4)));
  const now = new Date().getUTCFullYear();
  const first = years.length ? Math.min(...years) : now;
  return Array.from({ length: now - first + 1 }, (_, i) => now - i);
}

export function latestActive(data: PulseData): string {
  const keys = Object.keys(data.days).sort();
  return keys.at(-1) ?? todayISO();
}

export function yearSummary(data: PulseData, year: number, hidden: Set<SourceKey>): string {
  const totals: Partial<Record<SourceKey, number>> = {};
  let commits = 0;
  for (const [d, day] of Object.entries(data.days)) {
    if (!d.startsWith(String(year))) continue;
    for (const k of STACK) {
      if (hidden.has(k) || !day[k]) continue;
      totals[k] = (totals[k] ?? 0) + day[k]!;
      commits += day[k]!;
    }
  }
  const labels = STACK.filter((k) => totals[k]).map((k) => data.sources[k].label);
  return [String(year), `${commits.toLocaleString('en-CA')} commits`, ...labels].join(' · ');
}

export type YearTotal = { year: number; total: number; by: Partial<Record<SourceKey, number>> };

// Yearly totals for the career strip, oldest first, including empty years.
export function yearTotals(data: PulseData): YearTotal[] {
  const map = new Map<number, YearTotal>();
  for (const y of availableYears(data)) map.set(y, { year: y, total: 0, by: {} });
  for (const [d, day] of Object.entries(data.days)) {
    const t = map.get(Number(d.slice(0, 4)));
    if (!t) continue;
    for (const k of STACK) {
      if (!day[k]) continue;
      t.by[k] = (t.by[k] ?? 0) + day[k]!;
      t.total += day[k]!;
    }
  }
  return [...map.values()].sort((a, b) => a.year - b.year);
}

export function dayRows(data: PulseData, date: string): Array<{ key: SourceKey; label: string; ink: string; n: number }> {
  const day = data.days[date];
  if (!day) return [];
  return (['cio', 'vidyard', 'personal', 'ai'] as SourceKey[])
    .filter((k) => day[k])
    .map((k) => ({ key: k, label: data.sources[k].label, ink: data.sources[k].ink, n: day[k]! }));
}
