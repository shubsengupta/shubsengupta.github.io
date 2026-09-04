export type SourceKey = 'cio' | 'vidyard' | 'personal' | 'agent';
export type Day = Partial<Record<SourceKey | 'prs' | 'agentPrs' | 'tokens' | 'turns', number>> & { model?: string };
export type ClaudeData = { generatedAt: string; days: Record<string, { chats?: number; turns?: number; outputTokens?: number; model?: string }> };
export type PulseData = {
  generatedAt: string;
  cutover: string;
  sources: Record<SourceKey, { label: string; ink: string }>;
  days: Record<string, Day>;
  years?: Record<string, { reviews?: number }>;
  claudeGeneratedAt?: string;
};

// Claude Code activity comes from a separate local export. Chats become the
// agent layer; the model seen in the logs beats the one guessed from commits.
export function mergeClaude(pulse: PulseData, claude: ClaudeData | null): PulseData {
  if (!claude) return pulse;
  const days: Record<string, Day> = { ...pulse.days };
  for (const [d, c] of Object.entries(claude.days)) {
    const prev = days[d] ?? {};
    const next: Day = { ...prev };
    if (c.chats) next.agent = c.chats;
    if (c.turns) next.turns = c.turns;
    if (c.outputTokens) next.tokens = c.outputTokens;
    if (c.model) next.model = c.model;
    days[d] = next;
  }
  return { ...pulse, days, claudeGeneratedAt: claude.generatedAt };
}

export function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

// Bottom to top: employer, personal, then Claude Code chats on top.
const STACK: SourceKey[] = ['cio', 'vidyard', 'personal', 'agent'];
const DAY_MS = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const todayISO = () => iso(Date.now());

export type ModelFamily = 'fable' | 'opus' | 'sonnet' | 'haiku' | 'other';

export function modelFamily(name: string | undefined): ModelFamily {
  const n = (name ?? '').toLowerCase();
  if (n.includes('fable') || n.includes('mythos')) return 'fable';
  if (n.includes('opus')) return 'opus';
  if (n.includes('sonnet')) return 'sonnet';
  if (n.includes('haiku')) return 'haiku';
  return 'other';
}

// Claude's terracotta, stepped lighter for smaller models so the bars carry
// the model story without a separate band.
export const MODEL_INKS: Record<ModelFamily, string> = {
  fable: '#d97757',
  opus: '#e5977c',
  sonnet: '#eeb59f',
  haiku: '#f5d2c3',
  other: '#d97757',
};

export function agentInk(day: Day | undefined): string {
  return MODEL_INKS[modelFamily(day?.model)];
}

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
// Any activity fills at least half the cell; four steps cover the rest.
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
    rects.push(`<rect class="bg${future ? ' future' : ''}" x="${x}" y="${y0}" width="${o.cell}" height="${o.cell}" rx="2"/>`);
    if (total > 0) {
      const q = Math.ceil((4 * Math.min(total, max)) / max);
      const stackH = Math.max(3, Math.round((0.5 + 0.5 * (q / 4)) * o.cell));
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
        const ink = k === 'agent' ? agentInk(day) : data.sources[k].ink;
        rects.push(`<rect data-source="${k}" x="${x}" y="${yTop}" width="${o.cell}" height="${hh}" rx="${idx === visible.length - 1 ? 2 : 0}" fill="${ink}"/>`);
      });
    }
    parts.push(`<g class="day" data-date="${date}" style="--c:${col - colFrom}">${rects.join('')}</g>`);
  });
  const width = (colTo - colFrom + 1) * step - o.gap;
  parts.push(`<line class="baseline" x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}"/>`);
  return parts.join('');
}

// Height in user units needed for a grid drawn with these options.
export function gridHeight(o: { cell: number; gap: number }): number {
  const step = o.cell + o.gap;
  return 7 * step - o.gap + 3;
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
  if (day?.prs) bits.push(`${day.prs} PR${day.prs === 1 ? '' : 's'}`);
  if (day?.agent) bits.push(`${day.agent} Claude chat${day.agent === 1 ? '' : 's'}${day.model ? ` on ${day.model}` : ''}`);
  if (day?.tokens) bits.push(`${fmtTokens(day.tokens)} tokens`);
  return [formatDate(date), ...(bits.length ? bits : ['quiet'])].join(' · ');
}

export type DayRow = { key: SourceKey | 'prs' | 'tokens'; label: string; ink: string | null; n: number | string };

export function dayRows(data: PulseData, date: string): DayRow[] {
  const day = data.days[date];
  if (!day) return [];
  const rows: DayRow[] = [];
  for (const k of ['cio', 'vidyard', 'personal'] as SourceKey[]) if (day[k]) rows.push({ key: k, label: data.sources[k].label, ink: data.sources[k].ink, n: day[k]! });
  if (day.prs) rows.push({ key: 'prs', label: day.prs === 1 ? 'PR opened' : 'PRs opened', ink: null, n: day.prs });
  if (day.agent) rows.push({ key: 'agent', label: `Claude chat${day.agent === 1 ? '' : 's'}${day.model ? ` on ${day.model}` : ''}`, ink: agentInk(day), n: day.agent });
  if (day.tokens) rows.push({ key: 'tokens', label: 'tokens from Claude', ink: null, n: fmtTokens(day.tokens) });
  return rows;
}

export function stats(data: PulseData, year: number, hidden: Set<SourceKey>) {
  const today = todayISO();
  const dates = yearGrid(year).filter((d) => d.startsWith(String(year)) && d <= today);
  const noAgent = new Set<SourceKey>([...hidden, 'agent']);
  let busiest: { date: string; total: number } | null = null;
  let contributions = 0;
  let prs = 0;
  let agentPrs = 0;
  let chats = 0;
  let tokens = 0;
  for (const d of dates) {
    const day = data.days[d];
    const t = stackTotal(day, noAgent);
    contributions += t;
    prs += day?.prs ?? 0;
    agentPrs += day?.agentPrs ?? 0;
    chats += day?.agent ?? 0;
    tokens += day?.tokens ?? 0;
    if (t > (busiest?.total ?? 0)) busiest = { date: d, total: t };
  }
  let streak = 0;
  for (let t = Date.parse(today + 'T00:00:00Z'); ; t -= DAY_MS) {
    const d = iso(t);
    if (stackTotal(data.days[d], hidden) > 0) streak++;
    else if (d === today) continue;
    else break;
  }
  const reviews = data.years?.[String(year)]?.reviews ?? 0;
  return { streak, busiest, contributions, prs, agentPrs, agentShare: prs ? Math.round((agentPrs / prs) * 100) : 0, chats, tokens, reviews };
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
  const s = stats(data, year, hidden);
  const totals: Partial<Record<SourceKey, number>> = {};
  for (const [d, day] of Object.entries(data.days)) {
    if (!d.startsWith(String(year))) continue;
    for (const k of ['cio', 'vidyard', 'personal'] as SourceKey[]) if (!hidden.has(k) && day[k]) totals[k] = (totals[k] ?? 0) + day[k]!;
  }
  const labels = (['cio', 'vidyard', 'personal'] as SourceKey[]).filter((k) => totals[k]).map((k) => data.sources[k].label);
  const bits = [String(year), `${s.contributions.toLocaleString('en-CA')} contributions`, ...labels];
  if (s.prs) bits.push(`${s.prs} PRs`);
  if (s.chats) bits.push(`${s.chats} Claude chats`);
  if (s.tokens) bits.push(`${fmtTokens(s.tokens)} tokens`);
  return bits.join(' · ');
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
