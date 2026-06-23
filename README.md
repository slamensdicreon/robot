# Website Assessment Dashboard

An internal sales intelligence tool for Icreon that evaluates prospect company
websites across an account list. It scores each site on **usability**, **look &
feel**, and digital-experience maturity, then produces a **SitecoreAI
replatform recommendation** and a **sales opener** for outreach.

This implements **Phase 1 + Phase 2** of the PRD: the core assessment engine
(URL resolution → live fetch → technology detection → screenshot capture →
multimodal AI scoring) plus batch processing with real-time progress and CSV
export.

## How it works

For each account, the pipeline:

1. **Resolves a URL** — uses a provided URL, or strips legal suffixes from the
   name, probes `{slug}.com/.org/.ca/.gov` via HTTP HEAD, then falls back to a
   SerpAPI web search.
2. **Fetches the live site** — honors `robots.txt`, throttles to 1 req / 2s per
   domain, follows redirects, and extracts title, meta, headings, nav, footer,
   canonical/hreflang, and Open Graph data.
3. **Detects the platform** — scans headers, cookies, and HTML for Sitecore,
   WordPress, Drupal, AEM, and others, with confidence scoring.
4. **Captures screenshots** — desktop (1440×900) and mobile (390×844) via
   headless Chromium, with a responsiveness check.
5. **Scores with AI** — sends the signals + screenshot to a vision-capable
   Claude model and parses a structured JSON verdict.

Results land in a SQLite store and stream to the dashboard over SSE.

## Quick start

```bash
npm install                 # also downloads Chromium for screenshots
cp .env.example .env        # add your ANTHROPIC_API_KEY
npm start                   # http://localhost:3000
```

Open the dashboard, click **Add accounts**, paste a CSV (a sample lives in
`sample-accounts.csv`), then **Assess all**.

### Without an API key or browser

The app still boots. Scoring requires `ANTHROPIC_API_KEY`; if Chromium can't be
installed, screenshot capture is skipped and the model scores from HTML signals
alone (logged as `HTML-only` in the capability badge).

## Configuration

All settings live in `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Scoring model credential (required for scoring) |
| `SERP_API_KEY` | Optional search-fallback URL resolution |
| `SCREENSHOT_STORAGE_PATH` | Where JPEGs are written (local path) |
| `DATABASE_URL` | SQLite file path |
| `MAX_CONCURRENT_WORKERS` | Batch concurrency (default 5) |
| `FETCH_TIMEOUT_MS` | Per-request fetch timeout |
| `SCORE_MODEL` | Vision-capable model id |

## Architecture

```
public/            Dashboard UI (vanilla JS, no build step)
src/
  server.js        Express API + SSE
  pipeline.js      resolve → fetch → score → persist, bounded concurrency
  resolver.js      URL resolution (HEAD probe + search fallback)
  fetcher.js       HTML GET, extraction, robots, throttle
  techDetect.js    platform signal detection
  screenshot.js    Playwright capture (degrades gracefully)
  scorer.js        Anthropic multimodal scoring + retry
  ingest.js        CSV / pasted-table parsing + dedupe
  export.js        CSV export
  db.js            SQLite schema + queries
```

## Not yet implemented (later PRD phases)

- Salesforce push (Phase 3) and multi-user collaboration
- S3 screenshot storage (driver stub present)
- Historical trending / scheduled re-assessment (Phase 4)
