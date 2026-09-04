import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('fixture run produces spec-shaped json', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'pulse-')), 'pulse.json');
  execFileSync('node', ['scripts/pulse.mjs', '--full', '--fixture', 'scripts/fixtures', '--out', out,
    '--from', '2019-01-01', '--to', '2026-08-31']);
  const json = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(json.cutover, '2025-12-03');
  assert.deepEqual(Object.keys(json.sources), ['cio', 'vidyard', 'indie', 'personal', 'agent']);
  assert.deepEqual(json.days['2026-08-06'], { cio: 2, prs: 2, agentPrs: 1, model: 'Fable 5' });
  assert.deepEqual(json.days['2026-08-10'], { cio: 1, personal: 1 });
  assert.deepEqual(json.days['2026-08-12'], { cio: 4, prs: 1, agentPrs: 1 }, 'calendar-only day is attributed to the current employer');
  assert.deepEqual(json.days['2019-03-12'], { vidyard: 7 });
  assert.deepEqual(json.years['2026'], { reviews: 137 });
  assert.match(json.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
