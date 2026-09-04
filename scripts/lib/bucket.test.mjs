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
