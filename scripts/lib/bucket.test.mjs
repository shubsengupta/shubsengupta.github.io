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

import { bucketPRs, isAgentBuilt, bucketModels, modelName, topModel } from './bucket.mjs';

test('bucketPRs counts PRs per created day and flags agent-built ones', () => {
  const days = bucketPRs([
    { created_at: '2026-08-06T14:00:00Z', body: 'Fixes X\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' },
    { created_at: '2026-08-06T16:00:00Z', body: 'plain' },
    { created_at: '2026-08-07T09:00:00Z', body: null },
  ]);
  assert.deepEqual(days, { '2026-08-06': { count: 2, agent: 1 }, '2026-08-07': { count: 1, agent: 0 } });
  assert.equal(isAgentBuilt('Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'), true);
});

test('bucketModels tallies Claude co-authors per day with context tags stripped', () => {
  const item = (date, message) => ({ commit: { message, author: { date } } });
  const months = bucketModels([
    item('2026-06-02T00:00:00Z', 'a\n\nCo-authored-by: Claude Fable 5 <noreply@anthropic.com>'),
    item('2026-06-09T00:00:00Z', 'b\n\nCo-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>'),
    item('2026-06-10T00:00:00Z', 'c\n\nCo-authored-by: Claude Fable 5 <noreply@anthropic.com>\nCo-authored-by: Jane <j@x>'),
    item('2026-07-01T00:00:00Z', 'd'),
  ]);
  assert.deepEqual(months, { '2026-06-02': { 'Fable 5': 1 }, '2026-06-09': { 'Opus 5': 1 }, '2026-06-10': { 'Fable 5': 1 } });
  assert.equal(topModel({ 'Fable 5': 2, 'Opus 5': 3 }), 'Opus 5');
  assert.equal(modelName('Claude Fable 5.1'), 'Fable 5.1');
});
