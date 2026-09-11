import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingestSession, finalizeDays, prettyModel, readStatsCache, mergeClaudeDays } from './claude.mjs';

const line = (o) => JSON.stringify(o);
const log = [
  line({ type: 'user', timestamp: '2026-09-02T14:00:00.000Z', message: { role: 'user', content: 'hi' } }),
  line({ type: 'assistant', timestamp: '2026-09-02T14:00:05.000Z', message: { model: 'claude-fable-5-1', usage: { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 5000 } } }),
  line({ type: 'user', timestamp: '2026-09-02T14:01:00.000Z', isSidechain: true, message: {} }),
  line({ type: 'assistant', timestamp: '2026-09-03T01:00:00.000Z', message: { model: 'claude-opus-5', usage: { output_tokens: 50 } } }),
  line({ type: 'user', timestamp: '2026-09-03T01:00:30.000Z', message: {} }),
  'not json',
  line({ type: 'progress' }),
].join('\n');

test('sessions are counted once per day, turns exclude sidechains, tokens and top model per day', () => {
  const raw = {};
  ingestSession(raw, 'abc', log);
  ingestSession(raw, 'def', line({ type: 'user', timestamp: '2026-09-02T18:00:00.000Z', message: {} }));
  const days = finalizeDays(raw);
  assert.deepEqual(days['2026-09-02'], { sessions: 2, turns: 2, inputTokens: 10, outputTokens: 200, cacheRead: 5000, model: 'Fable 5.1' });
  assert.deepEqual(days['2026-09-03'], { sessions: 1, turns: 1, inputTokens: 0, outputTokens: 50, cacheRead: 0, model: 'Opus 5' });
});

test('model ids become display names', () => {
  assert.equal(prettyModel('claude-fable-5-1'), 'Fable 5.1');
  assert.equal(prettyModel('claude-opus-4-8'), 'Opus 4.8');
  assert.equal(prettyModel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.equal(prettyModel('claude-sonnet-5'), 'Sonnet 5');
});

test('stats cache gives sessions and turns only', () => {
  const days = readStatsCache({ dailyActivity: [{ date: '2026-01-22', messageCount: 282, sessionCount: 3, toolCallCount: 67 }, { date: '2026-01-23', messageCount: 0, sessionCount: 0 }] });
  assert.deepEqual(days, { '2026-01-22': { sessions: 3, turns: 282 } });
});

test('merge prefers logs over the cache for a day, and never lets a re-read shrink stored counts', () => {
  const existing = { '2026-01-01': { sessions: 1, turns: 5 }, '2026-06-01': { sessions: 4, turns: 12, outputTokens: 300, model: 'Fable 5' } };
  const cache = { '2026-01-01': { sessions: 2, turns: 6 }, '2026-06-01': { sessions: 9, turns: 99 } };
  const logs = { '2026-06-01': { sessions: 2, turns: 7, outputTokens: 120, model: 'Opus 5' }, '2026-06-02': { sessions: 1, turns: 1, outputTokens: 9, model: 'Haiku 4.5' } };
  assert.deepEqual(mergeClaudeDays(existing, cache, logs), {
    '2026-01-01': { sessions: 2, turns: 6 },
    '2026-06-01': { sessions: 4, turns: 12, outputTokens: 300, model: 'Fable 5' },
    '2026-06-02': { sessions: 1, turns: 1, outputTokens: 9, model: 'Haiku 4.5' },
  });
});
