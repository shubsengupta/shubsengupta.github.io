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
