# shub.ca Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2018 CRA build at shub.ca with an Astro static site whose hero is a GitHub-powered "pulse" instrument color-coded by source.

**Architecture:** A Node exporter (`scripts/pulse.mjs`) queries the GitHub commit-search and GraphQL calendar APIs and writes `src/data/pulse.json`, counts only. Astro server-renders the page and an initial SVG grid from that JSON using a shared pure render module; a small inline script imports the same module for hover, keyboard, legend toggles and year stepping. GitHub Actions refreshes the JSON daily and deploys to GitHub Pages.

**Tech Stack:** Astro 7, TypeScript, Node 22 (`node:test`), Playwright 1.62, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-04-shub-ca-redesign-design.md`

## Global Constraints

- Repo `shubsengupta/shubsengupta.github.io`, branch `master`, CNAME `shub.ca` preserved.
- Node 22; `.nvmrc` = `22`.
- Pulse JSON contains counts only. No repo names, messages, SHAs.
- Commit search must always be scoped with `org:` or `user:`. Month windows. Sleep to stay under 30 search requests/minute.
- Cutover date `2025-12-03`. Days before it get `vidyard = calendarTotal - personal` (min 0); days on or after never get `vidyard`.
- Source inks: cio `#1f6f5f`, vidyard `#5c4310`, personal `#b8432f`, ai `#2b2b2b`. Paper `#f4efe6`, ink `#1a1917`, rule `#d8d0c2`.
- Fonts: Newsreader (serif), JetBrains Mono (mono), both from Google Fonts with fallbacks.
- No em dashes in any copy. Hyphens or commas instead.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never enable auto-merge.

---

### Task 1: Scaffold Astro project, remove CRA build

**Files:**
- Delete: `asset-manifest.json`, `index.html`, `manifest.json`, `service-worker.js`, `static/`, `.DS_Store`
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `.gitignore`, `public/CNAME` (move), `public/favicon.ico` (move), `src/pages/index.astro`, `src/styles/global.css`

**Interfaces:**
- Produces: `npm run build` emits `dist/` containing `CNAME`.

- [ ] **Step 1: Remove the old build and move static assets**

```bash
cd /Users/shub/code/shub.ca
git rm -rq asset-manifest.json index.html manifest.json service-worker.js static
git rm -q --cached .DS_Store; rm -f .DS_Store
mkdir -p public src/pages src/styles
git mv CNAME public/CNAME
git mv favicon.ico public/favicon.ico
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "shub.ca",
  "type": "module",
  "version": "2.0.0",
  "private": true,
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "pulse": "node scripts/pulse.mjs",
    "test": "node --test scripts/lib/",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@astrojs/rss": "^4.0.19",
    "astro": "^7.3.1"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.9",
    "@playwright/test": "^1.62.1",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 3: Config files**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://shub.ca',
  output: 'static',
  build: { inlineStylesheets: 'always' },
});
```

`tsconfig.json`:
```json
{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist"] }
```

`.nvmrc`: `22`

`.gitignore`:
```
node_modules/
dist/
.astro/
test-results/
playwright-report/
.DS_Store
```

- [ ] **Step 4: Minimal page and stylesheet**

`src/styles/global.css`:
```css
:root {
  --paper: #f4efe6;
  --ink: #1a1917;
  --rule: #d8d0c2;
  --muted: #6f685c;
  --cio: #1f6f5f;
  --vidyard: #5c4310;
  --personal: #b8432f;
  --ai: #2b2b2b;
  --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --measure: 62ch;
}
html { background: var(--paper); color: var(--ink); font-family: var(--serif); font-size: 17px; line-height: 1.5; }
body { margin: 0; }
a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.mono { font-family: var(--mono); font-size: 0.78rem; letter-spacing: 0.01em; }
.wrap { max-width: 72rem; margin: 0 auto; padding: 0 1.5rem; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 0; }
```

`src/pages/index.astro`:
```astro
---
import '../styles/global.css';
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shub Sengupta</title>
  </head>
  <body><div class="wrap"><h1>Shub Sengupta</h1></div></body>
</html>
```

- [ ] **Step 5: Install and build**

Run: `npm install && npm run build && ls dist`
Expected: `CNAME favicon.ico index.html`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold Astro site, remove 2018 CRA build

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Exporter pure functions (TDD)

**Files:**
- Create: `scripts/lib/windows.mjs`, `scripts/lib/bucket.mjs`, `scripts/lib/era.mjs`, `scripts/lib/merge.mjs`
- Test: `scripts/lib/windows.test.mjs`, `scripts/lib/bucket.test.mjs`, `scripts/lib/era.test.mjs`, `scripts/lib/merge.test.mjs`

**Interfaces:**
- Produces:
  - `monthWindows(fromISO: string, toISO: string): {from: string, to: string}[]` inclusive `YYYY-MM-DD` bounds, clipped to the input range.
  - `bucketCommits(items: {commit:{message:string, author:{date:string}}}[]): Record<string,{count:number, ai:number}>` keyed by the author-local date (`date.slice(0,10)`).
  - `isAiAssisted(message: string): boolean` true when message matches `/co-authored-by:.*claude/i`.
  - `applyEra(days: Days, calendar: Record<string,number>, cutover: string): Days` adds `vidyard` for pre-cutover dates.
  - `mergeDays(existing: Days, fresh: Days, range: {from, to}): Days` replaces every day inside range with fresh, keeps others.
  - `type Days = Record<string, {cio?: number, personal?: number, vidyard?: number, ai?: number}>`

- [ ] **Step 1: windows test**

`scripts/lib/windows.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthWindows } from './windows.mjs';

test('splits a range into month windows clipped to the bounds', () => {
  assert.deepEqual(monthWindows('2025-11-15', '2026-01-10'), [
    { from: '2025-11-15', to: '2025-11-30' },
    { from: '2025-12-01', to: '2025-12-31' },
    { from: '2026-01-01', to: '2026-01-10' },
  ]);
});

test('single month stays single', () => {
  assert.deepEqual(monthWindows('2026-02-03', '2026-02-20'), [{ from: '2026-02-03', to: '2026-02-20' }]);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test scripts/lib/windows.test.mjs`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement windows**

`scripts/lib/windows.mjs`:
```js
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function monthWindows(fromISO, toISO) {
  const out = [];
  let cur = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  while (cur <= end) {
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const to = monthEnd < end ? monthEnd : end;
    out.push({ from: iso(cur), to: iso(to) });
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return out;
}
```

- [ ] **Step 4: bucket test**

`scripts/lib/bucket.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketCommits, isAiAssisted } from './bucket.mjs';

const item = (date, message = 'x') => ({ commit: { message, author: { date } } });

test('buckets by author-local date and counts AI co-authored commits', () => {
  const days = bucketCommits([
    item('2026-08-06T10:56:42.000-04:00', 'fix\n\nCo-authored-by: Claude Fable 5 <noreply@anthropic.com>'),
    item('2026-08-06T23:10:00.000-04:00'),
    item('2026-08-07T00:01:00.000-04:00', 'Co-Authored-By: Claude <x>'),
  ]);
  assert.deepEqual(days, {
    '2026-08-06': { count: 2, ai: 1 },
    '2026-08-07': { count: 1, ai: 1 },
  });
});

test('isAiAssisted ignores unrelated co-authors', () => {
  assert.equal(isAiAssisted('Co-authored-by: Jane <j@x.com>'), false);
  assert.equal(isAiAssisted('co-authored-by: claude opus <noreply@anthropic.com>'), true);
});
```

- [ ] **Step 5: Implement bucket**

`scripts/lib/bucket.mjs`:
```js
export const isAiAssisted = (message) => /co-authored-by:.*claude/i.test(message ?? '');

export function bucketCommits(items) {
  const days = {};
  for (const { commit } of items) {
    const day = commit.author.date.slice(0, 10);
    const d = (days[day] ??= { count: 0, ai: 0 });
    d.count += 1;
    if (isAiAssisted(commit.message)) d.ai += 1;
  }
  return days;
}
```

- [ ] **Step 6: era test**

`scripts/lib/era.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEra } from './era.mjs';

test('pre-cutover days get vidyard = calendar - personal, floored at 0', () => {
  const days = { '2019-03-12': { personal: 1 }, '2019-03-13': { personal: 5 } };
  const calendar = { '2019-03-12': 7, '2019-03-13': 2, '2019-03-14': 3 };
  assert.deepEqual(applyEra(days, calendar, '2025-12-03'), {
    '2019-03-12': { personal: 1, vidyard: 6 },
    '2019-03-13': { personal: 5 },
    '2019-03-14': { vidyard: 3 },
  });
});

test('cutover day and later never get vidyard', () => {
  const out = applyEra({}, { '2025-12-03': 4, '2025-12-02': 4 }, '2025-12-03');
  assert.deepEqual(out, { '2025-12-02': { vidyard: 4 } });
});
```

- [ ] **Step 7: Implement era**

`scripts/lib/era.mjs`:
```js
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
```

- [ ] **Step 8: merge test**

`scripts/lib/merge.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDays } from './merge.mjs';

test('replaces days inside the range, keeps the rest', () => {
  const existing = { '2026-07-01': { cio: 3 }, '2026-08-01': { cio: 9 }, '2026-08-02': { cio: 1 } };
  const fresh = { '2026-08-01': { cio: 4, ai: 2 } };
  assert.deepEqual(mergeDays(existing, fresh, { from: '2026-08-01', to: '2026-08-31' }), {
    '2026-07-01': { cio: 3 },
    '2026-08-01': { cio: 4, ai: 2 },
  });
});
```

- [ ] **Step 9: Implement merge**

`scripts/lib/merge.mjs`:
```js
export function mergeDays(existing, fresh, range) {
  const out = {};
  for (const [day, v] of Object.entries(existing)) {
    if (day < range.from || day > range.to) out[day] = v;
  }
  for (const [day, v] of Object.entries(fresh)) out[day] = v;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
```

- [ ] **Step 10: Run all, commit**

Run: `npm test`
Expected: all pass.

```bash
git add scripts
git commit -m "Add pulse exporter pure functions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Exporter script with GitHub client and fixture mode

**Files:**
- Create: `scripts/lib/github.mjs`, `scripts/pulse.mjs`, `scripts/fixtures/search-cio-2026-08.json`, `scripts/fixtures/search-personal-2026-08.json`, `scripts/fixtures/calendar-2026.json`, `scripts/fixtures/calendar-2019.json`
- Test: `scripts/pulse.test.mjs`
- Create: `src/data/pulse.json` (real run output)

**Interfaces:**
- Consumes: Task 2 functions.
- Produces: `src/data/pulse.json` in the spec shape. CLI: `node scripts/pulse.mjs [--full] [--fixture <dir>] [--out <path>]`. Env `PULSE_TOKEN` or falls back to `gh auth token`.

- [ ] **Step 1: GitHub client**

`scripts/lib/github.mjs`:
```js
import { execSync } from 'node:child_process';

const SEARCH_MIN_GAP_MS = 2100; // 30 req/min

export function resolveToken() {
  if (process.env.PULSE_TOKEN) return process.env.PULSE_TOKEN;
  try { return execSync('gh auth token', { encoding: 'utf8' }).trim(); } catch { return null; }
}

export function createClient({ token, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let lastSearch = 0;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'shub.ca-pulse' };

  async function rest(path) {
    const res = await fetchImpl(`https://api.github.com${path}`, { headers });
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}: ${await res.text()}`);
    return res.json();
  }

  async function searchCommits(scope, window) {
    const items = [];
    for (let page = 1; page <= 10; page++) {
      const wait = SEARCH_MIN_GAP_MS - (Date.now() - lastSearch);
      if (wait > 0) await sleep(wait);
      lastSearch = Date.now();
      const q = encodeURIComponent(`author:shubsengupta ${scope} committer-date:${window.from}..${window.to}`);
      const data = await rest(`/search/commits?q=${q}&per_page=100&page=${page}`);
      items.push(...data.items.map((i) => ({ commit: { message: i.commit.message, author: { date: i.commit.author.date } } })));
      if (items.length >= data.total_count || data.items.length === 0) break;
    }
    return items;
  }

  async function calendar(year) {
    const query = `{ viewer { contributionsCollection(from:"${year}-01-01T00:00:00Z", to:"${year}-12-31T23:59:59Z") { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;
    const res = await fetchImpl('https://api.github.com/graphql', { method: 'POST', headers, body: JSON.stringify({ query }) });
    if (!res.ok) throw new Error(`GraphQL ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const out = {};
    for (const w of json.data.viewer.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays) if (d.contributionCount > 0) out[d.date] = d.contributionCount;
    return out;
  }

  return { searchCommits, calendar };
}
```

- [ ] **Step 2: Fixture client and fixtures**

Fixture client lives in `scripts/lib/github.mjs` too:
```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function createFixtureClient(dir) {
  const read = async (name) => JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'));
  return {
    async searchCommits(scope, window) {
      const key = scope.startsWith('org:') ? 'cio' : 'personal';
      try { return await read(`search-${key}-${window.from.slice(0, 7)}`); } catch { return []; }
    },
    async calendar(year) {
      try { return await read(`calendar-${year}`); } catch { return {}; }
    },
  };
}
```

`scripts/fixtures/search-cio-2026-08.json`:
```json
[
  { "commit": { "message": "CON-1 thing\n\nCo-authored-by: Claude Fable 5 <noreply@anthropic.com>", "author": { "date": "2026-08-06T10:56:42.000-04:00" } } },
  { "commit": { "message": "plain", "author": { "date": "2026-08-06T15:00:00.000-04:00" } } },
  { "commit": { "message": "plain", "author": { "date": "2026-08-10T09:00:00.000-04:00" } } }
]
```
`scripts/fixtures/search-personal-2026-08.json`:
```json
[ { "commit": { "message": "l2claude day 3", "author": { "date": "2026-08-10T21:00:00.000-04:00" } } } ]
```
`scripts/fixtures/calendar-2026.json`: `{ "2026-08-06": 2, "2026-08-10": 2 }`
`scripts/fixtures/calendar-2019.json`: `{ "2019-03-12": 7 }`

- [ ] **Step 3: Failing end-to-end test**

`scripts/pulse.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('fixture run produces spec-shaped json', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'pulse-')), 'pulse.json');
  execFileSync('node', ['scripts/pulse.mjs', '--full', '--fixture', 'scripts/fixtures', '--out', out,
    '--from', '2019-01-01', '--to', '2026-08-31']);
  const json = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(json.cutover, '2025-12-03');
  assert.deepEqual(Object.keys(json.sources), ['cio', 'vidyard', 'personal', 'ai']);
  assert.deepEqual(json.days['2026-08-06'], { cio: 2, ai: 1 });
  assert.deepEqual(json.days['2026-08-10'], { cio: 1, personal: 1 });
  assert.deepEqual(json.days['2019-03-12'], { vidyard: 7 });
  assert.match(json.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
```

Run: `node --test scripts/pulse.test.mjs`. Expected: FAIL.

- [ ] **Step 4: Implement pulse.mjs**

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { monthWindows } from './lib/windows.mjs';
import { bucketCommits } from './lib/bucket.mjs';
import { applyEra } from './lib/era.mjs';
import { mergeDays } from './lib/merge.mjs';
import { createClient, createFixtureClient, resolveToken } from './lib/github.mjs';

const CUTOVER = '2025-12-03';
const ACCOUNT_START = '2012-04-16';
const INCREMENTAL_DAYS = 60;
const SOURCES = {
  cio: { label: 'Customer.io', ink: '#1f6f5f' },
  vidyard: { label: 'Vidyard', ink: '#5c4310' },
  personal: { label: 'Personal', ink: '#b8432f' },
  ai: { label: 'AI-assisted', ink: '#2b2b2b' },
};

const { values: args } = parseArgs({ options: {
  full: { type: 'boolean', default: false },
  fixture: { type: 'string' },
  out: { type: 'string', default: 'src/data/pulse.json' },
  from: { type: 'string' },
  to: { type: 'string' },
} });

const today = new Date().toISOString().slice(0, 10);
const shift = (iso, days) => new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);

async function loadExisting(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

function stripEmpty(days) {
  const out = {};
  for (const [day, v] of Object.entries(days)) {
    const clean = Object.fromEntries(Object.entries(v).filter(([, n]) => n > 0));
    if (Object.keys(clean).length) out[day] = clean;
  }
  return out;
}

async function main() {
  const existing = await loadExisting(args.out);
  const full = args.full || !existing;
  const to = args.to ?? today;
  const from = args.from ?? (full ? ACCOUNT_START : shift(to, -INCREMENTAL_DAYS));
  const client = args.fixture ? createFixtureClient(args.fixture) : createClient({ token: resolveToken() });

  const fresh = {};
  for (const window of monthWindows(from, to)) {
    const cio = bucketCommits(await client.searchCommits('org:customerio', window));
    const personal = bucketCommits(await client.searchCommits('user:shubsengupta', window));
    for (const day of new Set([...Object.keys(cio), ...Object.keys(personal)])) {
      fresh[day] = {
        cio: cio[day]?.count ?? 0,
        personal: personal[day]?.count ?? 0,
        ai: (cio[day]?.ai ?? 0) + (personal[day]?.ai ?? 0),
      };
    }
    process.stderr.write(`${window.from}..${window.to} cio=${Object.keys(cio).length}d personal=${Object.keys(personal).length}d\n`);
  }

  const calendar = {};
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Math.min(Number(to.slice(0, 4)), Number(CUTOVER.slice(0, 4)));
  for (let y = firstYear; y <= lastYear; y++) Object.assign(calendar, await client.calendar(y));
  const inRange = Object.fromEntries(Object.entries(calendar).filter(([d]) => d >= from && d <= to));

  const withEra = applyEra(fresh, inRange, CUTOVER);
  const days = stripEmpty(mergeDays(existing?.days ?? {}, withEra, { from, to }));

  const json = { generatedAt: new Date().toISOString(), cutover: CUTOVER, sources: SOURCES, days };
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify(json, null, 1) + '\n');
  process.stderr.write(`wrote ${args.out}: ${Object.keys(days).length} days\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Tests pass, then real full run**

Run: `npm test && node --test scripts/pulse.test.mjs`
Expected: PASS.

Run: `node scripts/pulse.mjs --full` (about 170 month windows times 2 searches, roughly 12 minutes with the rate gap).
Expected: `src/data/pulse.json` written; spot-check `jq '.days["2026-08-06"]' src/data/pulse.json` shows `{"cio":7,"ai":...}` matching the August probe.

- [ ] **Step 6: Commit**

```bash
git add scripts src/data
git commit -m "Add GitHub pulse exporter and first data snapshot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Pulse render module (shared server and client)

**Files:**
- Create: `src/lib/pulse.ts`
- Test: `src/lib/pulse.test.ts` (run with `node --experimental-strip-types --test`)

**Interfaces:**
- Produces:
  - `type PulseData = { generatedAt: string; cutover: string; sources: Record<SourceKey, {label: string; ink: string}>; days: Record<string, Partial<Record<SourceKey, number>>> }` where `SourceKey = 'cio' | 'vidyard' | 'personal' | 'ai'`.
  - `yearGrid(year: number): string[]` 371 ISO dates (53 weeks by 7, Sunday-first, padded with days from adjacent years so `Jan 1` lands in its weekday row; the last 53 weeks ending on Dec 31 of `year`, or on today if `year` is the current year).
  - `scale(data, dates, hidden: Set<SourceKey>): number` the 95th-percentile of daily stack totals across `dates`, minimum 1.
  - `renderGrid(data, year, hidden, opts: {cell: number, gap: number}): string` SVG inner markup, one `<g class="day" data-date=...>` per date holding stacked `<rect data-source>` and an optional `<rect class="ai">` tick.
  - `readout(data, date: string): string` e.g. `Tue Sep 1 · 14 Customer.io · 2 personal · 9 AI-assisted`, or `Tue Sep 1 · quiet`.
  - `stats(data, year, hidden): {streak: number; busiest: {date: string; total: number} | null; aiShare: number}`.
  - `stackTotal(day, hidden): number` sum of `cio`, `vidyard`, `personal` not hidden.
  - `availableYears(data): number[]` descending, from the current year down to the earliest year with data.

- [ ] **Step 1: Failing tests**

`src/lib/pulse.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yearGrid, scale, renderGrid, readout, stats, availableYears, type PulseData } from './pulse.ts';

const data: PulseData = {
  generatedAt: '2026-09-04T00:00:00Z', cutover: '2025-12-03',
  sources: { cio: { label: 'Customer.io', ink: '#1f6f5f' }, vidyard: { label: 'Vidyard', ink: '#5c4310' }, personal: { label: 'Personal', ink: '#b8432f' }, ai: { label: 'AI-assisted', ink: '#2b2b2b' } },
  days: { '2026-09-01': { cio: 14, personal: 2, ai: 9 }, '2026-09-02': { cio: 1 }, '2019-03-12': { vidyard: 6 } },
};

test('yearGrid gives 371 dates ending on Dec 31 for a past year', () => {
  const g = yearGrid(2019);
  assert.equal(g.length, 371);
  assert.equal(g.at(-1)!.slice(0, 10) >= '2019-12-31', true);
  assert.equal(new Date(g[0] + 'T00:00:00Z').getUTCDay(), 0);
});

test('renderGrid emits one group per date and stacks sources', () => {
  const svg = renderGrid(data, 2026, new Set(), { cell: 10, gap: 2 });
  assert.equal((svg.match(/class="day"/g) ?? []).length, 371);
  assert.match(svg, /data-date="2026-09-01"[^>]*>[\s\S]*?data-source="cio"[\s\S]*?data-source="personal"[\s\S]*?class="ai"/);
});

test('hidden sources are not rendered', () => {
  const svg = renderGrid(data, 2026, new Set(['personal']), { cell: 10, gap: 2 });
  assert.doesNotMatch(svg, /data-source="personal"/);
});

test('readout formats a day', () => {
  assert.equal(readout(data, '2026-09-01'), 'Tue Sep 1 · 14 Customer.io · 2 personal · 9 AI-assisted');
  assert.equal(readout(data, '2026-09-03'), 'Thu Sep 3 · quiet');
});

test('stats', () => {
  const s = stats(data, 2026, new Set());
  assert.deepEqual(s.busiest, { date: '2026-09-01', total: 16 });
  assert.equal(s.aiShare, Math.round((9 / 17) * 100));
});

test('availableYears spans data to now', () => {
  const ys = availableYears(data);
  assert.equal(ys[0], new Date().getUTCFullYear());
  assert.equal(ys.at(-1), 2019);
});

test('scale uses p95 with a floor of 1', () => {
  assert.equal(scale(data, ['2026-09-03'], new Set()), 1);
});
```

Run: `node --experimental-strip-types --test src/lib/pulse.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement**

`src/lib/pulse.ts`:
```ts
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
  end += (6 - new Date(end).getUTCDay()) * DAY_MS; // pad to Saturday
  const start = end - 370 * DAY_MS;
  return Array.from({ length: 371 }, (_, i) => iso(start + i * DAY_MS));
}

export function scale(data: PulseData, dates: string[], hidden: Set<SourceKey>): number {
  const totals = dates.map((d) => stackTotal(data.days[d], hidden)).filter((n) => n > 0).sort((a, b) => a - b);
  if (!totals.length) return 1;
  return Math.max(1, totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))]);
}

export function renderGrid(data: PulseData, year: number, hidden: Set<SourceKey>, o: { cell: number; gap: number }): string {
  const dates = yearGrid(year);
  const max = scale(data, dates, hidden);
  const step = o.cell + o.gap;
  const today = todayISO();
  const parts: string[] = [];
  dates.forEach((date, i) => {
    const col = Math.floor(i / 7), row = i % 7;
    const x = col * step, y0 = row * step;
    const day = data.days[date];
    const total = stackTotal(day, hidden);
    const future = date > today;
    const rects: string[] = [];
    rects.push(`<rect class="bg${future ? ' future' : ''}" x="${x}" y="${y0}" width="${o.cell}" height="${o.cell}"/>`);
    if (total > 0) {
      let yTop = y0 + o.cell;
      for (const k of STACK) {
        const v = hidden.has(k) ? 0 : day?.[k] ?? 0;
        if (!v) continue;
        const h = Math.max(1, Math.round((Math.min(v, max) / max) * o.cell * (v / total)) );
        const hh = Math.min(h, yTop - y0);
        yTop -= hh;
        rects.push(`<rect data-source="${k}" x="${x}" y="${yTop}" width="${o.cell}" height="${hh}" fill="${data.sources[k].ink}"/>`);
      }
      if ((day?.ai ?? 0) > 0 && !hidden.has('ai')) rects.push(`<rect class="ai" x="${x}" y="${y0 - o.gap}" width="${o.cell}" height="1" fill="${data.sources.ai.ink}"/>`);
    }
    parts.push(`<g class="day" data-date="${date}" tabindex="-1">${rects.join('')}</g>`);
  });
  return parts.join('');
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return `${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
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
  const dates = yearGrid(year).filter((d) => d.startsWith(String(year)) && d <= todayISO());
  let busiest: { date: string; total: number } | null = null;
  let commits = 0, ai = 0;
  for (const d of dates) {
    const t = stackTotal(data.days[d], hidden);
    commits += t; ai += data.days[d]?.ai ?? 0;
    if (t > (busiest?.total ?? 0)) busiest = { date: d, total: t };
  }
  let streak = 0;
  for (let t = Date.parse(todayISO() + 'T00:00:00Z'); ; t -= DAY_MS) {
    const d = iso(t);
    if (stackTotal(data.days[d], hidden) > 0) streak++;
    else if (d === todayISO()) continue; // today may not have commits yet
    else break;
  }
  return { streak, busiest, aiShare: commits ? Math.round((ai / commits) * 100) : 0 };
}

export function availableYears(data: PulseData): number[] {
  const years = Object.keys(data.days).map((d) => Number(d.slice(0, 4)));
  const first = years.length ? Math.min(...years) : new Date().getUTCFullYear();
  const now = new Date().getUTCFullYear();
  return Array.from({ length: now - first + 1 }, (_, i) => now - i);
}

export function latestActive(data: PulseData): string {
  const keys = Object.keys(data.days).sort();
  return keys.at(-1) ?? todayISO();
}
```

- [ ] **Step 3: Pass and commit**

Run: `node --experimental-strip-types --test src/lib/pulse.test.ts`. Expected: PASS. Add `"test:unit": "node --experimental-strip-types --test src/lib/"` to package.json and make `test` run both: `"test": "node --test scripts/ && npm run test:unit"`.

```bash
git add src/lib package.json
git commit -m "Add shared pulse render module

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Page layout, masthead, sections, footer

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Masthead.astro`, `src/components/Section.astro`, `src/components/Footer.astro`, `src/data/projects.yaml`
- Modify: `src/pages/index.astro`, `src/styles/global.css`

**Interfaces:**
- Produces: `Base.astro` props `{title: string, description?: string}` with a `<slot />`. `Section.astro` props `{n: string, title: string, id: string}`.

- [ ] **Step 1: Base layout**

`src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
interface Props { title: string; description?: string }
const { title, description = 'Shub Sengupta. Engineering manager at Customer.io, Toronto, frequent side projecter.' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" href="/favicon.ico" />
    <link rel="alternate" type="application/rss+xml" title="Shub Sengupta, writing" href="/rss.xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet" />
  </head>
  <body><slot /></body>
</html>
```

- [ ] **Step 2: Masthead with live clock**

`src/components/Masthead.astro`:
```astro
---
const fmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto', timeZoneName: 'short' });
const now = fmt.format(new Date()).replace(',', '');
---
<header class="masthead wrap">
  <h1>Shub Sengupta</h1>
  <p class="mono where">Toronto · <time id="clock" datetime={new Date().toISOString()}>{now}</time></p>
</header>
<script>
  const el = document.getElementById('clock')!;
  const fmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto', timeZoneName: 'short' });
  const tick = () => { el.textContent = fmt.format(new Date()).replace(',', ''); };
  tick(); setInterval(tick, 15_000);
</script>
<style>
  .masthead { display: flex; align-items: baseline; justify-content: space-between; padding: 2.5rem 1.5rem 1.5rem; gap: 1rem; flex-wrap: wrap; }
  h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.01em; margin: 0; line-height: 1; }
  .where { margin: 0; color: var(--muted); }
</style>
```

- [ ] **Step 3: Section and Footer**

`src/components/Section.astro`:
```astro
---
interface Props { n: string; title: string; id: string }
const { n, title, id } = Astro.props;
---
<section class="sec wrap" id={id} aria-labelledby={`${id}-h`}>
  <div class="gutter mono">{n}</div>
  <div class="body">
    <h2 id={`${id}-h`} class="mono">{title}</h2>
    <slot />
  </div>
</section>
<style>
  .sec { display: grid; grid-template-columns: 4rem 1fr; gap: 0 1.5rem; padding: 2.25rem 1.5rem; border-top: 1px solid var(--rule); }
  .gutter { color: var(--muted); padding-top: 0.2rem; }
  h2 { margin: 0 0 1rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .body { max-width: var(--measure); }
  .body :global(p) { margin: 0 0 1rem; }
  .body :global(ul) { padding: 0; margin: 0; list-style: none; }
  @media (max-width: 40rem) { .sec { grid-template-columns: 1fr; gap: 0.5rem; } }
</style>
```

`src/components/Footer.astro`:
```astro
---
interface Props { refreshed: string }
const { refreshed } = Astro.props;
const date = refreshed.slice(0, 10);
---
<footer class="wrap mono">
  <hr />
  <p>Set in Newsreader and JetBrains Mono. Built with Astro. Pulse data from GitHub, refreshed {date}. <a href="https://github.com/shubsengupta/shubsengupta.github.io">Source</a>.</p>
</footer>
<style>
  footer p { color: var(--muted); padding: 1.5rem 0 3rem; margin: 0; }
</style>
```

- [ ] **Step 4: Projects data and index page**

`src/data/projects.yaml`:
```yaml
- name: l2claude
  year: 2026
  url: https://github.com/shubsengupta/l2claude
  blurb: A daily AI-build challenge site. Astro, Vercel, Claude drafts the tasks.
- name: co
  year: 2026
  url: https://github.com/shubsengupta/co
  blurb: A small Go CLI for the things I type too often.
- name: practation
  year: 2015
  url: https://github.com/shubsengupta/practation
  blurb: Smart queue cards that help you ace a presentation.
- name: twitterwall
  year: 2014
  url: https://github.com/shubsengupta/twitterwall
  blurb: A conference twitter wall with schedule and notices. Became confwall.com.
```

`src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Masthead from '../components/Masthead.astro';
import Pulse from '../components/Pulse.astro';
import Section from '../components/Section.astro';
import Footer from '../components/Footer.astro';
import pulse from '../data/pulse.json';
import projects from '../data/projects.yaml';
import { getCollection } from 'astro:content';
import type { PulseData } from '../lib/pulse';

const data = pulse as PulseData;
const posts = (await getCollection('writing', (p) => !p.data.draft)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---
<Base title="Shub Sengupta">
  <Masthead />
  <Pulse data={data} />

  <Section n="01" title="Who" id="who">
    <p>I'm an engineering manager at <a href="https://customer.io">Customer.io</a>, where I lead the team building Design Studio, the editor people use to make email, in-app and push content. Before that I spent a long stretch at Vidyard.</p>
    <p>I live in Toronto. I write a lot of code for someone who manages people, most of it lately with an AI pair. The chart above is the honest record.</p>
    <ul class="mono links">
      <li><a href="https://github.com/shubsengupta">github.com/shubsengupta</a></li>
      <li><a href="https://www.linkedin.com/in/shubsengupta">linkedin.com/in/shubsengupta</a></li>
      <li><a href="mailto:hi@shub.ca">hi@shub.ca</a></li>
    </ul>
  </Section>

  <Section n="02" title="What" id="what">
    <h3 class="mono sub">Now</h3>
    <p>Design Studio at Customer.io: a visual editor with an agent inside it that can fix your template, match your brand, and explain why a draft is unpublished. My job is to make the team that builds it fast and the product that comes out of it boring to rely on.</p>
    <h3 class="mono sub">Side projects</h3>
    <ul class="projects">
      {projects.map((p) => (
        <li>
          <span class="mono year">{p.year}</span>
          <span><a href={p.url}>{p.name}</a> <span class="blurb">{p.blurb}</span></span>
        </li>
      ))}
    </ul>
  </Section>

  <Section n="03" title="Writing" id="writing">
    {posts.length === 0 ? (
      <p class="mono empty">nothing here yet</p>
    ) : (
      <ul class="posts">
        {posts.map((p) => (
          <li><span class="mono year">{p.data.date.toISOString().slice(0, 10)}</span> <a href={`/writing/${p.id}/`}>{p.data.title}</a></li>
        ))}
      </ul>
    )}
  </Section>

  <Footer refreshed={data.generatedAt} />
</Base>
<style>
  .links li { margin: 0.2rem 0; }
  .sub { margin: 1.25rem 0 0.5rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .sub:first-child { margin-top: 0; }
  .projects li, .posts li { display: grid; grid-template-columns: 3.5rem 1fr; gap: 0.75rem; margin: 0.4rem 0; }
  .year { color: var(--muted); padding-top: 0.25rem; }
  .blurb { color: var(--muted); }
  .empty { color: var(--muted); }
</style>
```

Astro 7 needs YAML import support: install `@rollup/plugin-yaml` and add `vite: { plugins: [yaml()] }` to `astro.config.mjs`, plus a `src/env.d.ts` declaring `declare module '*.yaml' { const v: any; export default v }`.

- [ ] **Step 5: Temporary Pulse stub so the page builds**

`src/components/Pulse.astro`: `---interface Props { data: unknown } ---<div id="pulse"></div>`. Replaced in Task 6.

Content collection is defined in Task 7; for this task create `src/content.config.ts` now (its final form):
```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({ title: z.string(), date: z.coerce.date(), summary: z.string(), draft: z.boolean().default(false) }),
});
export const collections = { writing };
```
and `src/content/writing/.gitkeep`.

Run: `npm run build`. Expected: succeeds, `dist/index.html` contains "nothing here yet".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add page layout, masthead, sections and footer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Pulse component with interactivity

**Files:**
- Modify: `src/components/Pulse.astro`
- Consumes: everything in `src/lib/pulse.ts`.

- [ ] **Step 1: Component**

```astro
---
import { renderGrid, readout, stats, availableYears, latestActive, type PulseData } from '../lib/pulse';
interface Props { data: PulseData }
const { data } = Astro.props;
const CELL = 11, GAP = 3;
const years = availableYears(data);
const year = years[0];
const hidden = new Set<never>();
const initialDate = latestActive(data);
const s = stats(data, year, hidden);
const W = 53 * (CELL + GAP) - GAP, H = 7 * (CELL + GAP) - GAP + GAP;
const legend: Array<keyof PulseData['sources']> = ['cio', 'vidyard', 'personal', 'ai'];
---
<section class="pulse wrap" aria-label="GitHub activity" data-year={year} data-years={years.join(',')}>
  <div class="head mono">
    <span class="yearnav">
      <button class="step" data-step="1" aria-label="Earlier year">‹</button>
      <span id="pulse-year">{year}</span>
      <button class="step" data-step="-1" aria-label="Later year" disabled>›</button>
    </span>
    <span class="legend" role="group" aria-label="Sources">
      {legend.map((k) => (
        <button class="src" data-source={k} aria-pressed="true" style={`--ink:${data.sources[k].ink}`}>
          <i></i>{data.sources[k].label}
        </button>
      ))}
    </span>
  </div>
  <div class="gridwrap">
    <svg id="pulse-svg" viewBox={`0 -${GAP} ${W} ${H}`} width="100%" role="img" aria-labelledby="pulse-desc" set:html={renderGrid(data, year, hidden, { cell: CELL, gap: GAP })}></svg>
  </div>
  <p class="mono readout" id="pulse-readout" aria-live="polite">{readout(data, initialDate)}</p>
  <dl class="mono statrow">
    <div><dt>streak</dt><dd id="st-streak">{s.streak}d</dd></div>
    <div><dt>busiest</dt><dd id="st-busiest">{s.busiest ? `${s.busiest.total} on ${s.busiest.date.slice(5)}` : '0'}</dd></div>
    <div><dt>ai-assisted</dt><dd id="st-ai">{s.aiShare}%</dd></div>
  </dl>
  <p id="pulse-desc" class="sr">Daily commit counts over the last year, stacked by source: Customer.io, Vidyard and personal, with a tick marking days that had AI-assisted commits.</p>
</section>

<script>
  import { renderGrid, readout, stats, type PulseData, type SourceKey } from '../lib/pulse';
  import data from '../data/pulse.json';
  const d = data as PulseData;
  const root = document.querySelector<HTMLElement>('.pulse')!;
  const svg = document.getElementById('pulse-svg')!;
  const out = document.getElementById('pulse-readout')!;
  const yearEl = document.getElementById('pulse-year')!;
  const years = root.dataset.years!.split(',').map(Number);
  const CELL = 11, GAP = 3;
  let idx = 0;
  let hidden = new Set<SourceKey>();
  let pinned: string | null = null;
  let focused: string | null = null;

  function paint() {
    const year = years[idx];
    svg.innerHTML = renderGrid(d, year, hidden, { cell: CELL, gap: GAP });
    yearEl.textContent = String(year);
    root.querySelectorAll<HTMLButtonElement>('.step').forEach((b) => {
      const n = idx + Number(b.dataset.step);
      b.disabled = n < 0 || n >= years.length;
    });
    const s = stats(d, year, hidden);
    document.getElementById('st-streak')!.textContent = `${s.streak}d`;
    document.getElementById('st-busiest')!.textContent = s.busiest ? `${s.busiest.total} on ${s.busiest.date.slice(5)}` : '0';
    document.getElementById('st-ai')!.textContent = `${s.aiShare}%`;
    if (focused) svg.querySelector<SVGGElement>(`[data-date="${focused}"]`)?.classList.add('focus');
  }

  function show(date: string) { out.textContent = readout(d, date); }

  svg.addEventListener('pointerover', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.day');
    if (g && !pinned) show(g.dataset.date!);
  });
  svg.addEventListener('pointerleave', () => { if (pinned) show(pinned); });
  svg.addEventListener('click', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.day');
    if (!g) return;
    pinned = pinned === g.dataset.date ? null : g.dataset.date!;
    focused = pinned;
    svg.querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
    if (pinned) g.classList.add('focus');
    show(g.dataset.date!);
  });

  svg.tabIndex = 0;
  svg.addEventListener('keydown', (e) => {
    const days = [...svg.querySelectorAll<SVGGElement>('.day')];
    let i = days.findIndex((g) => g.dataset.date === focused);
    if (i < 0) i = days.length - 1;
    const delta: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    if (e.key in delta) {
      e.preventDefault();
      i = Math.max(0, Math.min(days.length - 1, i + delta[e.key]));
      focused = days[i].dataset.date!;
      days.forEach((g) => g.classList.remove('focus'));
      days[i].classList.add('focus');
      show(focused);
    } else if (e.key === 'Enter' && focused) { pinned = focused; show(focused); }
    else if (e.key === 'Escape') { pinned = null; }
  });

  root.querelectorAllFix?.();
  root.querySelectorAll<HTMLButtonElement>('.src').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.source as SourceKey;
      if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
      b.setAttribute('aria-pressed', String(!hidden.has(k)));
      paint();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('.step').forEach((b) => {
    b.addEventListener('click', () => { idx += Number(b.dataset.step); pinned = null; focused = null; paint(); });
  });
</script>

<style>
  .pulse { padding: 0.5rem 1.5rem 2rem; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; color: var(--muted); }
  .yearnav { display: inline-flex; align-items: center; gap: 0.5rem; }
  .step { all: unset; cursor: pointer; padding: 0 0.35rem; color: var(--ink); font: inherit; }
  .step:disabled { color: var(--rule); cursor: default; }
  .legend { display: inline-flex; gap: 1rem; flex-wrap: wrap; }
  .src { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; font: inherit; color: var(--ink); }
  .src i { width: 0.6rem; height: 0.6rem; background: var(--ink); display: inline-block; }
  .src[aria-pressed="false"] { color: var(--muted); }
  .src[aria-pressed="false"] i { background: transparent; box-shadow: inset 0 0 0 1px var(--rule); }
  .gridwrap { overflow-x: auto; }
  svg { display: block; min-width: 40rem; outline: none; }
  svg:focus-visible { outline: 1px solid var(--ink); outline-offset: 6px; }
  svg :global(.bg) { fill: #e9e2d6; }
  svg :global(.bg.future) { fill: transparent; }
  svg :global(.day rect) { transition: y 180ms ease, height 180ms ease; }
  svg :global(.day:hover .bg), svg :global(.day.focus .bg) { fill: #d8d0c2; }
  svg :global(.day.focus) { outline: 1px solid var(--ink); }
  .readout { margin: 0.9rem 0 0; min-height: 1.3em; }
  .statrow { display: flex; gap: 2.5rem; margin: 0.75rem 0 0; color: var(--muted); }
  .statrow div { display: flex; gap: 0.6rem; }
  .statrow dt::after { content: ':'; }
  .statrow dd { margin: 0; color: var(--ink); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (prefers-reduced-motion: reduce) { svg :global(.day rect) { transition: none; } }
</style>
```

Remove the stray `root.querelectorAllFix?.();` line. It's a typo guard for the implementer, not code to keep.

- [ ] **Step 2: Build, open, sanity check**

Run: `npm run build && npm run preview &` then open http://localhost:4321 with Playwright MCP or a browser. Expected: 371 cells, hover changes readout, legend toggles rescale, year stepper goes back to 2012 and Vidyard color appears.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "Add interactive pulse instrument

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Writing collection pages and RSS

**Files:**
- Create: `src/pages/writing/index.astro`, `src/pages/writing/[...slug].astro`, `src/pages/rss.xml.ts`
- Consumes: `src/content.config.ts` from Task 5.

- [ ] **Step 1: Index and post pages**

`src/pages/writing/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Masthead from '../../components/Masthead.astro';
import Section from '../../components/Section.astro';
import Footer from '../../components/Footer.astro';
import pulse from '../../data/pulse.json';
import { getCollection } from 'astro:content';
const posts = (await getCollection('writing', (p) => !p.data.draft)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---
<Base title="Writing, Shub Sengupta">
  <Masthead />
  <Section n="03" title="Writing" id="writing">
    {posts.length === 0 ? <p class="mono" style="color:var(--muted)">nothing here yet</p> : (
      <ul>{posts.map((p) => <li><span class="mono" style="color:var(--muted)">{p.data.date.toISOString().slice(0,10)}</span> <a href={`/writing/${p.id}/`}>{p.data.title}</a><br /><span style="color:var(--muted)">{p.data.summary}</span></li>)}</ul>
    )}
  </Section>
  <Footer refreshed={pulse.generatedAt} />
</Base>
```

`src/pages/writing/[...slug].astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Masthead from '../../components/Masthead.astro';
import Footer from '../../components/Footer.astro';
import pulse from '../../data/pulse.json';
import { getCollection, render } from 'astro:content';
export async function getStaticPaths() {
  const posts = await getCollection('writing', (p) => !p.data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<Base title={`${post.data.title}, Shub Sengupta`} description={post.data.summary}>
  <Masthead />
  <article class="wrap post">
    <p class="mono" style="color:var(--muted)">{post.data.date.toISOString().slice(0,10)}</p>
    <h1>{post.data.title}</h1>
    <Content />
  </article>
  <Footer refreshed={pulse.generatedAt} />
</Base>
<style>
  .post { max-width: var(--measure); padding-top: 1rem; padding-bottom: 3rem; }
  .post h1 { font-weight: 500; font-size: 2rem; margin: 0 0 1.5rem; }
</style>
```

`src/pages/rss.xml.ts`:
```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('writing', (p) => !p.data.draft);
  return rss({
    title: 'Shub Sengupta',
    description: 'Writing from Shub Sengupta.',
    site: context.site!,
    items: posts.map((p) => ({ title: p.data.title, pubDate: p.data.date, description: p.data.summary, link: `/writing/${p.id}/` })),
  });
}
```

- [ ] **Step 2: Verify with a throwaway draft post**

Create `src/content/writing/hello.md` with `title: Hello`, `date: 2026-09-04`, `summary: test`, `draft: true`. Run `npm run build`. Expected: build succeeds, `dist/writing/index.html` still says "nothing here yet", `dist/rss.xml` has zero items. Delete the file.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "Add writing collection pages and RSS

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Playwright smoke test

**Files:**
- Create: `playwright.config.ts`, `tests/pulse.spec.ts`

- [ ] **Step 1: Config**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  webServer: { command: 'npm run preview -- --port 4321', port: 4321, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4321' },
});
```

- [ ] **Step 2: Test**

```ts
import { test, expect } from '@playwright/test';

test('pulse renders and responds', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#pulse-svg .day')).toHaveCount(371);
  const before = await page.locator('#pulse-readout').textContent();
  const active = page.locator('#pulse-svg .day:has([data-source])').last();
  await active.hover();
  const date = await active.getAttribute('data-date');
  await expect(page.locator('#pulse-readout')).toContainText(new Date(date + 'T00:00:00Z').getUTCDate().toString());
  expect(await page.locator('#pulse-readout').textContent()).not.toBe(before === '' ? null : undefined);
  await page.locator('.src[data-source="cio"]').click();
  await expect(page.locator('#pulse-svg [data-source="cio"]')).toHaveCount(0);
  await page.locator('.step[data-step="1"]').click();
  await expect(page.locator('#pulse-year')).toHaveText(String(new Date().getUTCFullYear() - 1));
});

test('writing is wired but empty', async ({ page }) => {
  await page.goto('/writing/');
  await expect(page.getByText('nothing here yet')).toBeVisible();
  const rss = await page.request.get('/rss.xml');
  expect(rss.status()).toBe(200);
});
```

- [ ] **Step 3: Run and commit**

Run: `npx playwright install chromium && npm run build && npm run test:e2e`. Expected: 2 passed.

```bash
git add playwright.config.ts tests
git commit -m "Add Playwright smoke tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: GitHub Actions deploy and pulse refresh

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/pulse.yml`

- [ ] **Step 1: deploy.yml**

```yaml
name: deploy
on:
  push: { branches: [master] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: pulse.yml**

```yaml
name: pulse
on:
  schedule: [{ cron: '0 9 * * *' }]
  workflow_dispatch:
    inputs:
      full: { description: 'Rebuild all history', type: boolean, default: false }
permissions: { contents: write }
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc }
      - run: node scripts/pulse.mjs ${{ inputs.full && '--full' || '' }}
        env: { PULSE_TOKEN: ${{ secrets.PULSE_TOKEN }} }
      - run: |
          git config user.name pulse-bot
          git config user.email pulse-bot@shub.ca
          git add src/data/pulse.json
          git diff --cached --quiet && exit 0
          git commit -m "pulse: refresh $(date -u +%F)"
          git push
```

- [ ] **Step 3: Switch Pages to Actions, add secret**

Run:
```bash
gh api -X PUT repos/shubsengupta/shubsengupta.github.io/pages -f build_type=workflow
```
The `PULSE_TOKEN` secret needs a classic PAT with `repo` and `read:org`, SSO-authorized for customerio. That's Shub's to create; set it with `gh secret set PULSE_TOKEN -R shubsengupta/shubsengupta.github.io`. Until it exists, the committed `pulse.json` from Task 3 serves the site.

- [ ] **Step 4: Commit and push**

```bash
git add .github
git commit -m "Add Pages deploy and daily pulse refresh workflows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin master
gh run watch
```
Expected: deploy green, https://shub.ca serves the new page (purge Cloudflare if stale).

---

### Task 10: Design critic loop and AI-tell pass

**Files:**
- Modify: whichever of `src/styles/global.css`, `src/components/*.astro`, `src/pages/index.astro` the critique points at.

- [ ] **Step 1: Screenshots**

Run `npm run preview`, capture `scratchpad/shot-1440.png` and `scratchpad/shot-390.png` with Playwright (`page.screenshot({fullPage: true})` at those viewport widths).

- [ ] **Step 2: Critic**

Dispatch a subagent (general-purpose, opus) with only the two screenshots and this brief: "You are a senior product designer. Score this personal site 1 to 10 on typographic hierarchy, spacing rhythm, restraint, and whether the data visualization reads instantly. List the three highest-leverage fixes. Do not suggest adding decoration." No code context.

- [ ] **Step 3: Apply and re-score until 9**

Apply the fixes, rebuild, re-screenshot, re-dispatch. Stop at 9 or after three rounds; record the final score in the commit message.

- [ ] **Step 4: AI-tell pass**

Check and fix: no gradients, no drop shadows, no rounded cards, no "Welcome to my corner of the internet" copy, no redundant labels next to obvious data, no empty containers, no em dashes.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "Design pass after critic review

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin master
```

---

## Self-review

- Spec coverage: hosting (T1, T9), exporter and JSON shape (T2, T3), refresh workflow (T9), masthead with clock (T5), pulse grid, readout, hover, keyboard, pin, legend toggles, year stepper, stats, screen-reader summary, reduced motion (T4, T6), sections and projects list (T5), writing collection, empty state, RSS (T5, T7), footer colophon (T5), tests (T2, T3, T4, T8), critic loop (T10), launch (T9). Covered.
- Type consistency: `PulseData`, `SourceKey`, `renderGrid(data, year, hidden, {cell, gap})`, `readout(data, date)`, `stats(data, year, hidden)`, `availableYears(data)`, `latestActive(data)` are used identically in T4 and T6. Exporter output keys `cio`, `vidyard`, `personal`, `ai` match `SOURCES` in T3 and the render module in T4.
- Placeholder scan: the only intentionally deferred item is the `PULSE_TOKEN` secret, which requires Shub's credentials.
