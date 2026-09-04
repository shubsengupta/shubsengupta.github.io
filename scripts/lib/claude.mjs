import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Claude Code keeps one JSONL per session under ~/.claude/projects/<project>/.
// We only read timestamps, roles, token usage and model names. Sessions are
// counted on the days they had a user turn; tokens on the days they were produced.
export async function readSessionLogs(projectsDir) {
  const days = {};
  let dirs = [];
  try { dirs = await readdir(projectsDir, { withFileTypes: true }); } catch { return days; }
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const full = join(projectsDir, dir.name);
    const files = (await readdir(full)).filter((f) => f.endsWith('.jsonl'));
    for (const f of files) {
      const sid = f.slice(0, -6);
      const text = await readFile(join(full, f), 'utf8');
      ingestSession(days, sid, text);
    }
  }
  return days;
}

export function ingestSession(days, sid, text) {
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const ts = o.timestamp;
    if (typeof ts !== 'string') continue;
    const d = ts.slice(0, 10);
    const day = (days[d] ??= { sessions: new Set(), turns: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, byModel: {} });
    if (o.type === 'user' && !o.isSidechain) {
      day.sessions.add(sid);
      day.turns += 1;
    } else if (o.type === 'assistant') {
      const msg = o.message ?? {};
      const u = msg.usage ?? {};
      day.inputTokens += u.input_tokens ?? 0;
      day.outputTokens += u.output_tokens ?? 0;
      day.cacheRead += u.cache_read_input_tokens ?? 0;
      if (msg.model && (u.output_tokens ?? 0) > 0) day.byModel[msg.model] = (day.byModel[msg.model] ?? 0) + u.output_tokens;
    }
  }
}

export function prettyModel(id) {
  // claude-fable-5-1 -> Fable 5.1, claude-opus-4-8 -> Opus 4.8, claude-haiku-4-5-20251001 -> Haiku 4.5
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id ?? '');
  if (!m) return id ?? '';
  const name = m[1][0].toUpperCase() + m[1].slice(1);
  return `${name} ${m[2]}${m[3] ? `.${m[3]}` : ''}`;
}

export function finalizeDays(raw) {
  const out = {};
  for (const [d, v] of Object.entries(raw)) {
    const top = Object.entries(v.byModel).sort((a, b) => b[1] - a[1])[0]?.[0];
    const rec = {
      chats: v.sessions instanceof Set ? v.sessions.size : v.sessions ?? 0,
      turns: v.turns,
      inputTokens: v.inputTokens,
      outputTokens: v.outputTokens,
      cacheRead: v.cacheRead,
    };
    if (top) rec.model = prettyModel(top);
    if (rec.chats || rec.turns || rec.outputTokens) out[d] = rec;
  }
  return out;
}

// stats-cache.json has sessionCount/messageCount per day back further than the
// logs survive. It has no token detail we trust, so only chats/turns come from it.
export function readStatsCache(json) {
  const out = {};
  for (const a of json?.dailyActivity ?? []) {
    if (a.sessionCount || a.messageCount) out[a.date] = { chats: a.sessionCount ?? 0, turns: a.messageCount ?? 0 };
  }
  return out;
}

// Logs beat the cache beat what we stored before, day by day, so pruned logs
// never erase history and re-reading a live day never double counts.
export function mergeClaudeDays(existing, fromCache, fromLogs) {
  const out = { ...existing };
  for (const [d, v] of Object.entries(fromCache)) out[d] = { ...(out[d] ?? {}), ...v };
  for (const [d, v] of Object.entries(fromLogs)) out[d] = { ...(out[d] ?? {}), ...v };
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
