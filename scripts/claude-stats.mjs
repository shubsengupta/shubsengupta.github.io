#!/usr/bin/env node
// Exports Claude Code activity as counts only: chats, turns, tokens and the
// top model per day. Nothing from the conversations themselves is read out.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { readSessionLogs, finalizeDays, readStatsCache, mergeClaudeDays } from './lib/claude.mjs';

const { values: args } = parseArgs({ options: {
  'claude-dir': { type: 'string', default: join(homedir(), '.claude') },
  out: { type: 'string', default: 'src/data/claude.json' },
} });

async function loadJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

const existing = await loadJson(args.out);
const cache = readStatsCache(await loadJson(join(args['claude-dir'], 'stats-cache.json')));
const logs = finalizeDays(await readSessionLogs(join(args['claude-dir'], 'projects')));
const days = mergeClaudeDays(existing?.days ?? {}, cache, logs);

const json = { generatedAt: new Date().toISOString(), days };
await mkdir(dirname(args.out), { recursive: true });
await writeFile(args.out, JSON.stringify(json, null, 1) + '\n');
process.stderr.write(`wrote ${args.out}: ${Object.keys(days).length} days, ${Object.keys(logs).length} from logs\n`);
