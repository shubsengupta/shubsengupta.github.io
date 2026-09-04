import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEra, eraFor } from './era.mjs';

test('eras: indie before Vidyard (Oct 2018), Vidyard until the cutover, Customer.io after', () => {
  assert.equal(eraFor('2015-06-01'), 'indie');
  assert.equal(eraFor('2018-09-30'), 'indie');
  assert.equal(eraFor('2018-10-01'), 'vidyard');
  assert.equal(eraFor('2025-12-02'), 'vidyard');
  assert.equal(eraFor('2025-12-03'), 'cio');
});

test('vidyard days get calendar - personal, floored at 0', () => {
  const days = { '2019-03-12': { personal: 1 }, '2019-03-13': { personal: 5 } };
  const calendar = { '2019-03-12': 7, '2019-03-13': 2, '2019-03-14': 3 };
  assert.deepEqual(applyEra(days, calendar, '2025-12-03'), {
    '2019-03-12': { personal: 1, vidyard: 6 },
    '2019-03-13': { personal: 5 },
    '2019-03-14': { vidyard: 3 },
  });
});

test('pre-Vidyard days are the indie era', () => {
  assert.deepEqual(applyEra({}, { '2015-05-01': 4 }, '2025-12-03'), { '2015-05-01': { indie: 4 } });
});

test('post-cutover days lift cio to calendar - personal, never below the searched count', () => {
  const days = { '2026-08-06': { cio: 7, personal: 0, prs: 1 }, '2026-08-07': { cio: 4, personal: 1 } };
  const calendar = { '2026-08-06': 15, '2026-08-07': 3, '2026-08-08': 2 };
  assert.deepEqual(applyEra(days, calendar, '2025-12-03'), {
    '2026-08-06': { cio: 15, personal: 0, prs: 1 },
    '2026-08-07': { cio: 4, personal: 1 },
    '2026-08-08': { cio: 2 },
  });
});
