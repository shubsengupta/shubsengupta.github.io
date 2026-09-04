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
