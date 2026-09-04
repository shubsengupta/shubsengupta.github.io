import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yearGrid, scale, renderGrid, readout, stats, availableYears, monthLabels, yearSummary, yearTotals, dayRows, modelFamily, agentInk, type PulseData } from './pulse.ts';

const data: PulseData = {
  generatedAt: '2026-09-04T00:00:00Z',
  cutover: '2025-12-03',
  sources: {
    cio: { label: 'Customer.io', ink: '#00262b' },
    vidyard: { label: 'Vidyard', ink: '#3bcb85' },
    personal: { label: 'Personal', ink: '#3b6fe0' },
    agent: { label: 'Built with Claude', ink: '#d97757' },
  },
  days: {
    '2026-09-01': { cio: 14, personal: 2, prs: 3, agent: 2, model: 'Fable 5.1' },
    '2026-09-02': { cio: 1 },
    '2026-09-03': { cio: 2, prs: 1, agent: 1, model: 'Opus 5' },
    '2019-03-12': { vidyard: 6 },
  },
  years: { '2026': { reviews: 137 } },
};

test('yearGrid gives 371 dates covering Dec 31 for a past year, starting on a Sunday', () => {
  const g = yearGrid(2019);
  assert.equal(g.length, 371);
  assert.equal(g.includes('2019-12-31'), true);
  assert.equal(new Date(g[0] + 'T00:00:00Z').getUTCDay(), 0);
});

test('renderGrid stacks employer, personal and agent layers, agent tinted by model', () => {
  const svg = renderGrid(data, 2026, new Set(), { cell: 10, gap: 2 });
  assert.equal((svg.match(/class="day"/g) ?? []).length, 371);
  assert.match(svg, /data-date="2026-09-01"[^>]*>[\s\S]*?data-source="cio"[\s\S]*?data-source="personal"[\s\S]*?data-source="agent"[^>]*fill="#d97757"/);
  assert.match(svg, /data-date="2026-09-03"[^>]*>[\s\S]*?data-source="agent"[^>]*fill="#e5977c"/);
  assert.match(svg, /class="baseline"/);
  assert.doesNotMatch(svg, /class="ai"/);
});

test('any activity fills at least half the cell', () => {
  const svg = renderGrid(data, 2026, new Set(), { cell: 10, gap: 2 });
  const m = svg.match(/data-date="2026-09-02"[^>]*>.*?data-source="cio"[^>]*height="(\d+)"/);
  assert.ok(m && Number(m[1]) >= 5, `expected at least 5, got ${m?.[1]}`);
});

test('hidden sources are not rendered', () => {
  assert.doesNotMatch(renderGrid(data, 2026, new Set(['personal']), { cell: 10, gap: 2 }), /data-source="personal"/);
  assert.doesNotMatch(renderGrid(data, 2026, new Set(['agent']), { cell: 10, gap: 2 }), /data-source="agent"/);
});

test('readout names the model', () => {
  assert.equal(readout(data, '2026-09-01'), 'Tue Sep 1 · 14 Customer.io · 2 personal · 3 PRs · 2 built with Fable 5.1');
  assert.equal(readout(data, '2026-09-04'), 'Fri Sep 4 · quiet');
});

test('stats count contributions without the agent layer, plus PRs, agent share and reviews', () => {
  const s = stats(data, 2026, new Set());
  assert.deepEqual(s.busiest, { date: '2026-09-01', total: 16 });
  assert.equal(s.contributions, 19);
  assert.equal(s.prs, 4);
  assert.equal(s.agentShare, 75);
  assert.equal(s.reviews, 137);
});

test('availableYears spans data to now', () => {
  const ys = availableYears(data);
  assert.equal(ys[0], new Date().getUTCFullYear());
  assert.equal(ys.at(-1), 2019);
});

test('scale uses p95 with a floor of 1', () => {
  assert.equal(scale(data, ['2026-09-04'], new Set()), 1);
});

test('monthLabels gives one label per month in the grid', () => {
  const labels = monthLabels(2019);
  assert.equal(labels.length >= 12, true);
  assert.equal(labels.at(-1)!.label, 'Dec');
});

test('a sliced strip labels its first column', () => {
  const labels = monthLabels(2019, 27, 52);
  assert.equal(labels[0].col, 0);
  assert.equal(labels.filter((l) => l.col === 0).length, 1);
});

test('yearSummary lists contributions, sources and PRs', () => {
  assert.equal(yearSummary(data, 2019, new Set()), '2019 · 6 contributions · Vidyard');
  assert.equal(yearSummary(data, 2026, new Set()), '2026 · 19 contributions · Customer.io · Personal · 4 PRs');
});

test('column slices re-base x to zero and only include their weeks', () => {
  const full = renderGrid(data, 2019, new Set(), { cell: 10, gap: 2 });
  const half = renderGrid(data, 2019, new Set(), { cell: 10, gap: 2, colFrom: 27, colTo: 52 });
  assert.equal((half.match(/class="day"/g) ?? []).length, 26 * 7);
  assert.equal((full.match(/class="day"/g) ?? []).length, 371);
  assert.match(half, /class="day" data-date="[^"]+" style="--c:0"><rect class="bg" x="0"/);
});

test('yearTotals covers every year from first data to now, oldest first', () => {
  const ys = yearTotals(data);
  assert.equal(ys[0].year, 2019);
  assert.equal(ys.at(-1)!.year, new Date().getUTCFullYear());
  assert.deepEqual(ys[0].by, { vidyard: 6 });
  assert.equal(ys.find((y) => y.year === 2026)!.total, 22);
});

test('dayRows lists the sources present on a day with the model named', () => {
  assert.deepEqual(dayRows(data, '2026-09-02').map((r) => r.key), ['cio']);
  assert.deepEqual(dayRows(data, '2026-09-01').map((r) => [r.key, r.n, r.label]), [
    ['cio', 14, 'Customer.io'], ['personal', 2, 'Personal'], ['prs', 3, 'PRs opened'], ['agent', 2, 'built with Fable 5.1'],
  ]);
  assert.deepEqual(dayRows(data, '2026-09-04'), []);
});

test('model families map to inks', () => {
  assert.equal(modelFamily('Opus 4.8'), 'opus');
  assert.equal(modelFamily('Fable 5.1'), 'fable');
  assert.equal(modelFamily(undefined), 'other');
  assert.equal(agentInk({ agent: 1, model: 'Sonnet 5' }), '#eeb59f');
});
