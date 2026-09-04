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
