# Lead Finder

Personal freelance lead finding, qualification, and pipeline management app for a full-stack developer (React, React Native, Node, Express, MERN, .NET).

> **Core Boundary**: **Zero Auto-Outreach**. No auto-apply, auto-DM, auto-email, or automated calling. The tool surfaces, qualifies, and drafts personalized pitches. Every outreach action is reviewed and initiated manually by the developer.

---

## Architecture Overview

```
lead-finder/
├── app/                  # Expo / React Native app (Mobile + Web, Expo Router v4)
├── collector/            # Node.js + TypeScript collector scheduled via GitHub Actions
├── shared/               # Universal runtime-neutral library (router, scoring schemas, analytics)
├── supabase/             # Postgres migrations, RLS, Vault, and Deno Edge Functions
├── scripts/              # Secret scanner, AJV patchers, CI verification tooling
├── MASTER_PROMPT.md      # Ground truth specification
├── MORNING_CHECKLIST.md  # Ordered, copy-paste setup guide for the owner
├── TEST_REPORT.md        # Real verification and test execution report
├── BLOCKERS.md           # Unfinished/unverified third-party items & required actions
└── DECISIONS.md          # Autonomous architecture and design decisions log
```

---

## Two Lead Discovery Modules

### 1. Web Leads Module
- Sources: Hacker News (*Who is Hiring / Freelance*), Reddit (`r/forhire`, `r/freelance_forhire`), RemoteOK, We Work Remotely, Remotive.
- Pre-filtering: Keyword inclusion/exclusion heuristics to reject low budgets, agency ads, and incompatible stacks before hitting AI APIs.
- AI Qualification: Scores leads (0–100) using a multi-provider model fallback chain (Gemini, Groq, Mistral, NVIDIA NIM, OpenRouter).
- Outputs: Score, tech stack tags, budget signals, red flags, and personalized draft opening pitch lines.

### 2. Maps Leads Module
- Sources: OpenStreetMap Overpass API (fair-use rate-limited with round-robin area selection).
- Heuristic: Identifies local businesses operating without websites or social-only profiles.
- Proposal Generation: Maps business niches to tailored offerings (e.g., custom landing page, online ordering, appointment booking).
- Outreach Tools: Instant WhatsApp deep links (`wa.me/`), Facebook/Instagram/LinkedIn search shortcuts, and Google place verification links.
- Attribution: Transparent "Found via: OpenStreetMap" badges and dataset credits.

---

## Key App Capabilities

1. **Leads Screen (`/(tabs)/index`)**:
   - Module tabs (Web & Maps), status filters (New, Acceptable, Contacted, Replied, Won, Lost, Trash), score thresholds, and search by ID/code.
   - Dynamic confirmation dialogs naming the lead ID and title on Accept, Reject, and Delete.
   - Undo toast on all status-changing actions.
   - Trash with 30-day soft-delete restore.

2. **Calendar Screen (`/(tabs)/calendar`)**:
   - Pure React Native responsive month calendar grid with event indicator dots.
   - "Due Today" list with one-tap follow-up rescheduling (+1 day, +3 days).
   - Day breakdown for found, contacted, and follow-up activities.

3. **Deals Screen (`/(tabs)/deals`)**:
   - Live and Completed deals tracking.
   - Idempotent conversion from Won leads preserving the same lead code.
   - Value, payment status filters (unpaid, partial, paid), client, deadline, and Mark Complete confirmation dialogs.

4. **Analytics Dashboard (`/(tabs)/analytics`)**:
   - Filters: Today, 7 Days, 30 Days, Custom Range, and Module (Web, Maps, Both).
   - High-level KPIs: Useful-Lead Rate (`(acceptable + won) / total`), Reply Rate (`replied / contacted`), Win Rate, Closed Revenue, and Pipeline.
   - Pure React Native responsive visualizations: Daily lead volume, status qualification funnel, score distribution, accepted vs. rejected comparison, top sources, geographic distribution, and revenue trends over time.

5. **Secrets & Integrations Screen (`/settings/secrets`)**:
   - Write-only secret preview strictly masked (`first 4, last 2`, middle `*`). Full secrets are never displayed or returned.
   - In-app Telegram Bot configuration with automated **Detect Chat** flow via `getUpdates` and live test message dispatch.

6. **Model Chains & Dashboard (`/settings/models`, `/settings/model-dashboard`)**:
   - Independent model chains for Web and Maps modules.
   - Priority reordering, in-app test execution with live latency measurement, daily limits, and automatic 429/timeout cooldown router.

7. **Data & Retention (`/settings/data`)**:
   - Cross-platform CSV export (HTML Blob download on Web, React Native `Share.share` on mobile).
   - Manual Purge Trash (>30d) and Archive Old Rejected (>30d) triggers.

---

## Security Model

- **Zero Secrets in Code or Git**: `npm run scan:secrets` verifies that no API keys, tokens, or JWTs exist anywhere in the repository, git history, or web build output.
- **Write-Only Vault**: Model keys and Telegram tokens are stored in Supabase Vault or write-only masked tables. Secrets are never readable by anon or authenticated roles.
- **Row-Level Security (RLS)**: Enforced across all tables. Only the claimed single `app_owner` has access; non-owners and unauthenticated requests are rejected.
- **Single-Owner Claim**: `claim_owner()` can only be invoked once by the very first authenticated user.
- **Scrubbed Logs**: Error handlers scrub secret-like patterns before logging.

---

## Local Development & Setup

### 1. Prerequisites
- Node.js 20+
- npm 10+
- (Optional) Supabase CLI: `npm install -g supabase`

### 2. Verify Repository
```bash
# Run lint, TypeScript checks, unit tests, and secret scanner
npm run verify
```

### 3. Running the App
```bash
# Web version
cd app
npm run web

# Mobile (Android/iOS)
cd app
npm run start
```

### 4. Running the Collector Locally
Create `collector/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

Execute run:
```bash
cd collector
npm run build
npm start
```

### 5. Running Tests
```bash
# All tests
npm test

# Shared library tests (Vitest)
npm --prefix shared test

# Collector tests (Vitest)
npm --prefix collector test

# App tests (Jest Expo)
npm --prefix app test
```

---

## GitHub Actions Automated Collector

The collector runs automatically every 30 minutes via `.github/workflows/collector.yml`:
- Trigger: Cron `*/30 * * * *` and manual `workflow_dispatch`.
- Concurrency: `group: collector-run`, `cancel-in-progress: false` (runs never overlap).
- Lease Locking: PostgreSQL `collector_lock` lease ensures single-runner safety.
- Required GitHub Secrets:
  - `SUPABASE_URL`: Your Supabase project URL.
  - `SUPABASE_SERVICE_KEY`: Your Supabase `service_role` key.
  *(All model keys, bot tokens, and search plans are loaded from the database at runtime).*

---

## Deployment Instructions

### Supabase Backend & Edge Functions
1. Run database migrations:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
2. Deploy Edge Functions:
   ```bash
   supabase functions deploy
   ```

### Web Build Deployment
Export static assets:
```bash
npm run build:web
```
The static site is exported to `app/dist/`. Deploy to any static host:

- **Netlify**:
  - Drag and drop `app/dist` into https://app.netlify.com/drop, or link your Git repository with publish directory `app/dist`.
  - Set environment variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Vercel**:
  ```bash
  cd app
  npx vercel --prod
  ```
  Set output directory to `dist` and configure environment variables in project settings.
- **Cloudflare Pages**:
  - Connect Git repo or upload `app/dist`.
  - Set environment variables in Cloudflare dashboard.

---

## Free-Tier Provider Limits to Monitor

| Provider | Free Tier Quota | Mitigation in Code |
|----------|-----------------|--------------------|
| **Supabase** | 500 MB database, 50k MAU, 500k Edge Function invocations | Auto-cleanup purges trash >30d and archives old rejected leads; text trimmed to 4,000 chars |
| **GitHub Actions** | 2,000 minutes/month for private repos (~1,440 runs/mo at ~30s each = ~720 mins) | Concurrency locks, 25-min timeout, cached npm dependencies |
| **Google Gemini API** | 15 RPM, 1,500 RPD on free tier | Model fallback router switches on 429/timeout |
| **Groq** | 30 RPM, 14,400 RPD | Router enforces automatic cooldown and moves to next model |
| **Overpass API** | Fair-use shared public server | 1 req per 30 mins, 20-30s timeout, exponential backoff on 429/504 |
| **GitHub Scheduled Actions** | Disabled after 60 days of repo inactivity | Push a commit or trigger `workflow_dispatch` occasionally |

---

*For morning setup steps, refer directly to [MORNING_CHECKLIST.md](./MORNING_CHECKLIST.md).*
