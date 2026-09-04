import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SEARCH_MIN_GAP_MS = 3000;
const MAX_RESULTS = 1000;
export class TooManyResults extends Error {}

export function resolveToken() {
  if (process.env.PULSE_TOKEN) return process.env.PULSE_TOKEN;
  try { return execSync('gh auth token', { encoding: 'utf8' }).trim(); } catch { return null; }
}

export function createClient({ token, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let lastSearch = 0;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'shub.ca-pulse' };

  async function rest(path, attempt = 0) {
    const res = await fetchImpl(`https://api.github.com${path}`, { headers });
    if ((res.status === 403 || res.status === 429) && attempt < 4) {
      const retryAfter = Number(res.headers.get('retry-after')) || 60 * (attempt + 1);
      process.stderr.write(`rate limited, sleeping ${retryAfter}s\n`);
      await sleep(retryAfter * 1000);
      return rest(path, attempt + 1);
    }
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
      if (data.total_count > MAX_RESULTS) throw new TooManyResults(`${scope} ${window.from}..${window.to}: ${data.total_count}`);
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
      const { readdir } = await import('node:fs/promises');
      const names = (await readdir(dir)).filter((n) => n.startsWith(`search-${key}-`));
      const out = [];
      for (const n of names) {
        const month = n.slice(`search-${key}-`.length, -5);
        if (month >= window.from.slice(0, 7) && month <= window.to.slice(0, 7)) out.push(...(await read(n.slice(0, -5))));
      }
      return out;
    },
    async calendar(year) {
      try { return await read(`calendar-${year}`); } catch { return {}; }
    },
  };
}
