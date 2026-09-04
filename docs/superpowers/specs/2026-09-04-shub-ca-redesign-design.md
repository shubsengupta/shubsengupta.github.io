# shub.ca redesign

Date: 2026-09-04
Status: approved in chat, ready for planning

## Goal

Replace the 2018 Create React App build at shub.ca with a static Astro site. The
hero is a "pulse" instrument showing daily GitHub activity, color-coded by
source (Customer.io, Vidyard era, personal, AI-assisted). Below it: three
numbered sections, Who, What, Writing. Writing is an empty content collection
wired for future posts.

Visual direction: "Ledger". Warm paper, one monospace face for data and labels,
one serif for the name and prose, hairline rules, no cards, no gradients, no
purple. The data is the decoration.

## Non-goals

- No CMS, no comments, no analytics beyond what Cloudflare already provides.
- No local-machine exporter. All pulse data comes from the GitHub API, run in
  GitHub Actions.
- No blog posts yet. The collection exists; the index shows an empty state.
- No dark-mode toggle in v1. The palette is a single committed light look.

## Hosting and repo

- Repo: `shubsengupta/shubsengupta.github.io`, default branch `master`.
  Existing CNAME `shub.ca` stays. Cloudflare proxy unchanged.
- The old CRA build files are deleted from `master`. Astro source lives at the
  repo root.
- Deploy: GitHub Actions workflow `deploy.yml` builds with `astro build` and
  publishes `dist/` with `actions/deploy-pages`. Pages source is switched from
  "branch" to "GitHub Actions" (one-time settings change via `gh api`).
- Node 22 in CI. `.nvmrc` pinned.

## Pulse data

### Sources

All queries authenticate with a classic PAT (`repo`, `read:org`) stored as the
Actions secret `PULSE_TOKEN`. Verified 2026-09-04 that the token can search
commits in `org:customerio`.

| Key        | Label         | Query                                                                          |
|------------|---------------|--------------------------------------------------------------------------------|
| `cio`      | Customer.io   | `GET /search/commits?q=author:shubsengupta org:customerio committer-date:A..B`  |
| `personal` | Personal      | `GET /search/commits?q=author:shubsengupta user:shubsengupta committer-date:A..B` |
| `ai`       | AI-assisted   | Subset of the two above whose message contains `Co-authored-by: Claude`        |
| `vidyard`  | Vidyard       | Contribution calendar daily totals for dates before `2025-12-03`, minus personal |

Notes:

- Commit search only returns private results when scoped by `org:` or `user:`.
  Never query unscoped.
- Search returns at most 1000 results per query, so windows are one calendar
  month. Search rate limit is 30 requests/minute; the exporter sleeps to stay
  under it.
- `ai` is not a fourth stack layer. It is a per-day count carried alongside
  `cio` and `personal` and rendered as a marker (a dot or tick above the
  stack), because the same commit is already counted in its org layer.
- Vidyard org commits are not visible to the token (search returns 0), so the
  Vidyard era is attributed by date. The cutover is the first Customer.io
  commit, `2025-12-03`. Days before the cutover: `vidyard = calendarTotal -
  personal`, floored at 0. Days on or after: no Vidyard value.
- Contribution calendar comes from GraphQL `contributionsCollection(from,to)
  .contributionCalendar`, one call per year, back to account creation
  (2012-04-16).

### Output

`src/data/pulse.json`, committed by the Action.

```json
{
  "generatedAt": "2026-09-04T18:00:00Z",
  "cutover": "2025-12-03",
  "sources": {
    "cio":      { "label": "Customer.io", "ink": "#1f6f5f" },
    "vidyard":  { "label": "Vidyard",     "ink": "#7a5c1e" },
    "personal": { "label": "Personal",    "ink": "#b8432f" },
    "ai":       { "label": "AI-assisted", "ink": "#2b2b2b" }
  },
  "days": {
    "2026-09-01": { "cio": 14, "personal": 2, "ai": 9 },
    "2019-03-12": { "vidyard": 6, "personal": 1 }
  }
}
```

Only dates with any nonzero value are stored. Nothing but counts is written:
no repo names, no messages, no SHAs.

### Refresh

Workflow `pulse.yml`: cron daily at 09:00 UTC plus `workflow_dispatch`. Runs
`node scripts/pulse.mjs`, and if `src/data/pulse.json` changed, commits as
`pulse: refresh YYYY-MM-DD` and pushes to `master`, which triggers
`deploy.yml`. Incremental: the script reloads the existing JSON and only
re-queries the last 60 days plus any year with no data yet, so a daily run is
a handful of requests. A `--full` flag rebuilds everything.

## Page

Single page `/` plus `/writing/` and `/writing/<slug>/`. `/rss.xml` for the
collection.

### Masthead

Name in the serif, large. Right-aligned monospace line: `Toronto · HH:MM EDT`
updated every minute by a small script, static server-rendered fallback.

### Pulse instrument

- Grid: 53 columns by 7 rows, one cell per day, most recent week at the right.
  Server-rendered as inline SVG so it exists without JS.
- Each cell is a vertical stack: bottom layer `cio` or `vidyard` (whichever the
  date's era owns), top layer `personal`. Heights scale to the 95th percentile
  of daily totals in the visible year so one outlier does not flatten the rest.
  A day with `ai > 0` gets a 1px ink tick above its stack.
- Readout line below the grid, monospace: `Tue Sep 1 · 14 Customer.io · 2
  personal · 9 AI-assisted`. Default shows today or the most recent active day.
- Interaction: hover updates the readout. Arrow keys move a focused day. Click
  or Enter pins the readout. Escape unpins.
- Legend entries are buttons. Toggling one hides that layer and rescales.
  Transition 180ms, disabled under `prefers-reduced-motion`.
- Year stepper: `‹ 2026 ›` steps back through years to 2012. The Vidyard ink
  appears on pre-cutover years. Data for all years ships in the page, so
  stepping is instant.
- Stats row under the readout, three items: current streak in days, busiest
  day in the visible year, AI-assisted share of commits in the visible year as
  a percent.
- Below-the-fold summary in plain words for screen readers, generated from the
  same data.

### Sections

Fixed left gutter with the section number in monospace, content to the right.

- `01 Who` — three or four sentences. Engineering manager at Customer.io
  leading Design Studio. Toronto. Frequent side projecter. Links: GitHub,
  LinkedIn, email.
- `02 What` — two subsections. "Now": Design Studio, one paragraph. "Side
  projects": a list pulled from `src/data/projects.yaml`, each a name, one-line
  description, year, link. Seeded with public repos that still stand up
  (l2claude, co, twitterwall, practation) and left for Shub to edit.
- `03 Writing` — lists posts from the `writing` collection newest first. Empty
  state: one monospace line, `nothing here yet`. Post schema: `title`, `date`,
  `summary`, optional `draft`.

### Footer

Colophon in monospace: built with Astro, type names, source link, "pulse data
refreshed <date>" read from the JSON.

## Type and color

- Serif: Newsreader (Google Fonts) with Georgia fallback. Used for the name,
  section body prose, post bodies.
- Monospace: JetBrains Mono with ui-monospace fallback. Everything else.
- Paper `#f4efe6`, ink `#1a1917`, rule `#d8d0c2`. Source inks as in the JSON.
  All pairs meet 4.5:1 against paper for text; source inks are used for fills
  with the readout doing the labeling.

## Project layout

```
astro.config.mjs
package.json
.nvmrc
.github/workflows/deploy.yml
.github/workflows/pulse.yml
scripts/pulse.mjs
scripts/lib/            pure functions: windowing, bucketing, era, merge
scripts/lib/*.test.mjs  node:test
src/pages/index.astro
src/pages/writing/index.astro
src/pages/writing/[...slug].astro
src/pages/rss.xml.ts
src/components/Masthead.astro
src/components/Pulse.astro       SVG render + inline script
src/components/Section.astro
src/components/Footer.astro
src/content.config.ts
src/content/writing/             empty, .gitkeep
src/data/pulse.json
src/data/projects.yaml
src/styles/global.css
tests/pulse.spec.ts              Playwright
```

## Testing

- `node --test scripts/lib` for the exporter's pure functions: month windowing
  across year boundaries, day bucketing in UTC, era assignment around the
  cutover, incremental merge that preserves untouched days, Claude co-author
  detection.
- `pulse.mjs` takes `--fixture <dir>` to read canned API responses so the
  full script runs offline in tests.
- `astro check` and `astro build` in CI.
- Playwright: page loads, SVG has 371 cells, hovering a nonzero cell changes
  the readout text, toggling a legend button removes that layer, year stepper
  changes the visible year label. Runs against `astro preview` in CI.

## Design quality loop

After the first full build, screenshot the page at 1440 and 390 widths and
hand the screenshots to a design-critic subagent with no implementation
context. It scores 1 to 10 and lists the top three fixes. Iterate until 9.
Then a final pass to strip anything that reads as an AI tell: generic hero
copy, decorative gradients, redundant labels, empty containers.

## Launch

1. Merge to `master`, Actions deploy.
2. Run `pulse.yml` once by hand with `--full`.
3. Verify https://shub.ca serves the new page, purge Cloudflare cache if the
   old one lingers.
4. Confirm the daily cron fires the next morning.
