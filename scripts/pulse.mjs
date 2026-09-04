#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { monthWindows, quarterWindows, yearWindows } from './lib/windows.mjs';
import { bucketCommits, bucketPRs, bucketModels, topModel } from './lib/bucket.mjs';
import { applyEra } from './lib/era.mjs';
import { mergeDays } from './lib/merge.mjs';
import { createClient, createFixtureClient, resolveToken, TooManyResults } from './lib/github.mjs';

const CUTOVER = '2025-12-03';
const ACCOUNT_START = '2012-04-16';
const INCREMENTAL_DAYS = 60;
const SOURCES = {
  cio: { label: 'Customer.io', ink: '#00262b' },
  vidyard: { label: 'Vidyard', ink: '#3bcb85' },
  personal: { label: 'Personal', ink: '#3b6fe0' },
  agent: { label: 'Built with Claude', ink: '#d97757' },
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
    const clean = Object.fromEntries(Object.entries(v).filter(([, n]) => (typeof n === 'string' ? n.length > 0 : n > 0)));
    if (Object.keys(clean).some((k) => k !== 'model')) out[day] = clean;
  }
  return out;
}

const merge = (a, b) => ({ ...a, ...b });

async function main() {
  const existing = await loadExisting(args.out);
  const full = args.full || !existing;
  const to = args.to ?? today;
  const from = args.from ?? (full ? ACCOUNT_START : shift(to, -INCREMENTAL_DAYS));
  const client = args.fixture ? createFixtureClient(args.fixture) : createClient({ token: resolveToken() });
  const cioFrom = from > CUTOVER ? from : CUTOVER;

  // Search caps at 1000 results per query, so window size is per scope:
  // personal history is sparse (years), Customer.io is dense (quarters).
  // A window that overflows is split into months.
  async function collect(search, scope, wins) {
    const items = [];
    for (const window of wins) {
      let got;
      try {
        got = await search(scope, window);
      } catch (e) {
        if (!(e instanceof TooManyResults)) throw e;
        got = [];
        for (const m of monthWindows(window.from, window.to)) got.push(...(await search(scope, m)));
      }
      items.push(...got);
      process.stderr.write(`${search.name} ${scope} ${window.from}..${window.to} ${got.length}\n`);
    }
    return items;
  }

  const cioCommits = await collect(client.searchCommits, 'org:customerio', quarterWindows(cioFrom, to));
  const personalCommits = await collect(client.searchCommits, 'user:shubsengupta', yearWindows(from, to));
  const cioPRs = await collect(client.searchPRs, 'org:customerio', quarterWindows(cioFrom, to));
  const personalPRs = await collect(client.searchPRs, 'user:shubsengupta', yearWindows(from, to));

  const cio = bucketCommits(cioCommits);
  const personal = bucketCommits(personalCommits);
  const prs = bucketPRs([...cioPRs, ...personalPRs]);
  const models = merge(bucketModels(cioCommits), bucketModels(personalCommits));

  const fresh = {};
  for (const day of new Set([...Object.keys(cio), ...Object.keys(personal), ...Object.keys(prs)])) {
    fresh[day] = {
      cio: cio[day]?.count ?? 0,
      personal: personal[day]?.count ?? 0,
      prs: prs[day]?.count ?? 0,
      agent: prs[day]?.agent ?? 0,
      model: topModel(models[day]) ?? '',
    };
  }

  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4));
  const calendar = {};
  const years = { ...(existing?.years ?? {}) };
  for (let y = firstYear; y <= lastYear; y++) {
    Object.assign(calendar, await client.calendar(y));
    if (y >= Number(CUTOVER.slice(0, 4))) years[y] = { reviews: await client.countReviews('org:customerio', y) };
  }
  const inRange = Object.fromEntries(Object.entries(calendar).filter(([d]) => d >= from && d <= to));

  const withEra = applyEra(fresh, inRange, CUTOVER);
  const days = stripEmpty(mergeDays(existing?.days ?? {}, withEra, { from, to }));

  const json = {
    generatedAt: new Date().toISOString(),
    cutover: CUTOVER,
    sources: SOURCES,
    days,
    years,
  };
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify(json, null, 1) + '\n');
  process.stderr.write(`wrote ${args.out}: ${Object.keys(days).length} days\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
