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

Results are persisted per account; the dashboard updates each row as its
assessment returns.

## Quick start (local)

```bash
npm install                 # SQLite + Playwright are optional deps
npm run setup:browsers      # optional: install Chromium for screenshots
cp .env.example .env        # add your ANTHROPIC_API_KEY
npm start                   # http://localhost:3000
```

Locally the app uses a SQLite file (no setup). Open the dashboard, click
**Add accounts**, paste a CSV (a sample lives in `sample-accounts.csv`), then
**Assess all**.

### Without an API key or browser

The app still boots. Scoring requires `ANTHROPIC_API_KEY`; if Chromium isn't
installed, screenshot capture is skipped and the model scores from HTML signals
alone (shown as `HTML-only` in the capability badge).

## Deploying to Vercel

The app runs as a single Vercel function (`api/index.js`) with the UI served as
static assets. Because serverless functions are stateless, the live build uses
**Postgres** instead of a local SQLite file, the assess endpoint runs
**synchronously**, and the client orchestrates batches.

1. Import the repo into Vercel (no build command needed; `vercel.json` handles
   routing and sets `maxDuration`).
2. Add a Postgres database — **Storage → Create → Postgres** (Vercel Postgres /
   Neon). This populates `DATABASE_URL` (or `POSTGRES_URL`) automatically; the
   app accepts either.
3. Set project environment variables: `ANTHROPIC_API_KEY` (required) and
   optionally `SERP_API_KEY`.
4. Deploy. Tables are created on first request.

Screenshots are disabled on Vercel (no headless Chromium), so scoring runs
HTML-only there.

## Configuration

All settings live in `.env` for local dev (see `.env.example`):

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Scoring model credential (required for scoring) |
| `SERP_API_KEY` | Optional search-fallback URL resolution |
| `DATABASE_URL` / `POSTGRES_URL` | `postgres://…` → Neon driver; file path → local SQLite |
| `SCREENSHOT_STORAGE_PATH` | Where JPEGs are written locally (ignored on Vercel) |
| `FETCH_TIMEOUT_MS` | Per-request fetch timeout |
| `SCORE_MODEL` | Vision-capable model id |

## Architecture

```
api/index.js       Vercel serverless entry (exports the Express app)
public/            Dashboard UI (vanilla JS, no build step)
src/
  app.js           Express app + routes (shared by local + Vercel)
  server.js        Local dev entry (app.listen)
  pipeline.js      resolve → fetch → score → persist (one account, synchronous)
  resolver.js      URL resolution (HEAD probe + search fallback)
  fetcher.js       HTML GET, extraction, robots, throttle
  techDetect.js    platform signal detection
  screenshot.js    Playwright capture (disabled on serverless)
  scorer.js        Anthropic multimodal scoring + retry
  ingest.js        CSV / pasted-table parsing + dedupe
  export.js        CSV export
  db.js            backend dispatcher (postgres | sqlite)
  db.postgres.js   Neon serverless backend (Vercel)
  db.sqlite.js     better-sqlite3 backend (local dev)
```

## Not yet implemented (later PRD phases)

- Salesforce push (Phase 3) and multi-user collaboration
- S3 screenshot storage (driver stub present)
- Historical trending / scheduled re-assessment (Phase 4)
