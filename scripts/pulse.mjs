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
  vidyard: { label: 'Vidyard', ink: '#7a5c1e' },
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
