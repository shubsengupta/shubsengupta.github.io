import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SEARCH_MIN_GAP_MS = 2100; // 30 req/min

export function resolveToken() {
  if (process.env.PULSE_TOKEN) return process.env.PULSE_TOKEN;
  try { return execSync('gh auth token', { encoding: 'utf8' }).trim(); } catch { return null; }
}

export function createClient({ token, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let lastSearch = 0;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'shub.ca-pulse' };

  async function rest(path) {
    const res = await fetchImpl(`https://api.github.com${path}`, { headers });
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}: ${await res.text()}`);
    return res.json();
  }

  async function searchCommits(scope, window) {
    const items = [];
    for (let page = 1; page <= 10; page++) {
      const wait = SEARCH_MIN_GAP_MS - (Date.now() - lastSearch);
      if (wait > 0) await sleep(wait);
      lastSearch = Date.now();
      const q = encodeURIComponent(`author:shubsengupta ${scope} committer-date:${window.from}..${window.to}`);
      const data = await rest(`/search/commits?q=${q}&per_page=100&page=${page}`);
      items.push(...data.items.map((i) => ({ commit: { message: i.commit.message, author: { date: i.commit.author.date } } })));
      if (items.length >= data.total_count || data.items.length === 0) break;
    }
    return items;
  }

  async function calendar(year) {
    const query = `{ viewer { contributionsCollection(from:"${year}-01-01T00:00:00Z", to:"${year}-12-31T23:59:59Z") { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;
    const res = await fetchImpl('https://api.github.com/graphql', { method: 'POST', headers, body: JSON.stringify({ query }) });
    if (!res.ok) throw new Error(`GraphQL ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const out = {};
    for (const w of json.data.viewer.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays) if (d.contributionCount > 0) out[d.date] = d.contributionCount;
    return out;
  }

  return { searchCommits, calendar };
}

export function createFixtureClient(dir) {
  const read = async (name) => JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'));
  return {
    async searchCommits(scope, window) {
      const key = scope.startsWith('org:') ? 'cio' : 'personal';
      try { return await read(`search-${key}-${window.from.slice(0, 7)}`); } catch { return []; }
    },
    async calendar(year) {
      try { return await read(`calendar-${year}`); } catch { return {}; }
    },
  };
}
