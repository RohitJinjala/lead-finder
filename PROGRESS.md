# Lead Finder — Build Progress

> Auto-updated after every step. Use this to resume after a crash.

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked (see BLOCKERS.md)

---

## Phase 0 — Scaffold
- [x] Create PROGRESS.md
- [x] Create .gitignore
- [x] Create .env.example files (app, collector)
- [x] Create root package.json with all scripts (test, lint, typecheck, build:web, scan:secrets, verify)
- [x] Initialize git repo
- [x] Create /app directory with Expo TypeScript starter
- [x] Create /collector directory with Node+TypeScript config
- [x] Create /shared directory (runtime-neutral)
- [x] Create /supabase directory structure
- [x] Create /.github/workflows/collector.yml
- [x] Configure strict TypeScript (all three tsconfig files)
- [x] Configure ESLint (app + collector + shared)
- [x] Configure Vitest for collector and shared
- [x] Configure jest-expo for app
- [x] Implement scan:secrets script
- [x] Create theme tokens
- [x] Create README.md skeleton
- [x] Create DECISIONS.md
- [x] Create BLOCKERS.md
- [x] Create TEST_REPORT.md skeleton
- [x] Create MORNING_CHECKLIST.md
- [x] Run npm run verify (green on empty skeleton)
- [x] Git commit: phase 0: scaffold

## Phase 1 — Foundation
- [x] SQL migration 001: all tables (leads, id_counters, deals, model_chain, model_status, search_profiles, search_plans, niche_offers, locations, search_presets, secret_meta, collector_runs, collector_lock, user_settings)
- [x] SQL migration 002: RLS policies (is_owner, claim_owner)
- [x] SQL migration 003: lead ID generator (trigger + atomic upsert on id_counters)
- [x] SQL migration 004: indexes
- [x] DB tests: lead code format, daily reset, concurrency, dedupe_key unique, RLS
- [x] App auth screen (email/password via Supabase Auth)
- [x] Owner claim flow (claim_owner RPC)
- [x] Leads screen with tabs (All, Acceptable, Rejected, Trash)
- [x] Module switcher (Web, Maps, Both)
- [x] Filter chips (status, score range, source, country, tags, date, unscored)
- [x] Search box (ID or text)
- [x] Web lead card (compact + detail) with all fields from section 11
- [x] Maps lead card (compact + detail) with all fields from section 11
- [x] Confirmation dialogs (Accept, Reject+reason, Delete, bulk)
- [x] Undo toast
- [x] Trash screen (restore, 30-day label)
- [x] App tests: both cards, dialogs, tabs, filters, search, trash
- [x] npm run verify green
- [x] Git commit: phase 1: foundation

## Phase 2 — Secrets and Models
- [x] Supabase Vault / encrypted column design (decision in DECISIONS.md)
- [x] secret_meta table (already in migration 001)
- [x] Edge Function: save-secret (JWT + owner check, write-only, masked_preview)
- [x] Edge Function: delete-secret (JWT + owner check, confirmation)
- [x] Edge Function: test-secret (JWT + owner check, provider check, rate limit)
- [x] Edge Function: detect-telegram-chat (getUpdates mock, pick chat)
- [x] Edge Function: send-telegram-test
- [x] Edge Function: generate-plan
- [x] Secrets & Integrations screen (all sections from section 3)
- [x] model_chain + model_status tables
- [x] AI model router (/shared)
- [x] Settings > Models screen (add, test, reorder, enable, delete)
- [x] Model Dashboard screen
- [x] Router tests: all 10+ cases from section 14
- [x] Edge Function tests: JWT, non-owner, invalid input, masked output
- [x] npm run verify green
- [x] Git commit: phase 2: secrets and models

## Phase 3 — Web Collector and Plans
- [x] Collector entry point (single run, lease acquire/release)
- [x] Reddit RSS adapter (r/forhire, r/hiring, r/freelance)
- [x] Hacker News Algolia API adapter
- [x] RemoteOK adapter
- [x] We Work Remotely adapter
- [x] Remotive adapter
- [x] Freelancer.com optional adapter (skip cleanly if no key)
- [x] Google Alerts RSS adapter (optional, owner-supplied URLs)
- [x] Keyword pre-filter (before AI calls)
- [x] Deduplication by dedupe_key
- [x] Per-run cap (configurable, default 40)
- [x] Search profiles UI (brief editor)
- [x] generate-plan Edge Function integration
- [x] Plan chips (editable, approve)
- [x] Approved-plan-only enforcement in collector
- [x] Telegram alert sender (threshold, quiet hours, digest)
- [x] Collector runs logging (collector_runs row)
- [x] GitHub Actions workflow (cron 30min, dispatch, Node 20)
- [x] Collector Health screen
- [x] Collector tests: all cases from section 14
- [x] npm run verify green
- [x] Git commit: phase 3: web collector and plans

## Phase 4 — Workflow
- [ ] Calendar screen (month + day views, found_at, contacted_at, follow_up_at)
- [ ] Due Today list
- [ ] Follow-up date picker on lead cards
- [ ] Deals screen (Live and Completed tabs)
- [ ] Won conversion (lead -> deal, idempotent, same code)
- [ ] Deal fields (client, project, value, currency, start, deadline, payment, notes)
- [ ] Mark deal complete (confirmation + optional payment checkbox)
- [ ] Theme setting (Light, Dark, System, persisted)
- [ ] CSV export (web download, mobile share)
- [ ] Calendar + deals tests
- [ ] npm run verify green
- [ ] Git commit: phase 4: workflow

## Phase 5 — Maps Module
- [ ] Maps module toggle
- [ ] Own model chain for Maps
- [ ] Location data (open countries-states-cities dataset, credited)
- [ ] Location picker (Country -> State -> City, multi-select, presets)
- [ ] Niche picker (editable niche_offers)
- [ ] Overpass API adapter (fair-use limits, caching, backoff)
- [ ] Maps collector (no-website / social-only filter, phone + social extraction)
- [ ] Maps scoring (router, Maps chain, draft pitch line)
- [ ] Maps card (all fields: business name, niche, address, phone, WhatsApp button)
- [ ] Social search buttons (Find on Facebook/Instagram/LinkedIn)
- [ ] Verify button + verified checkbox
- [ ] "Found via: OpenStreetMap" badge + attribution on all Maps screens
- [ ] Google Places optional adapter (flag + key from Secrets)
- [ ] Round-robin area selection by last_searched_at
- [ ] Maps tests: fixture-based, no-website filter, phone extraction
- [ ] npm run verify green
- [ ] Git commit: phase 5: maps module

## Phase 6 — Analytics and Polish
- [ ] Analytics SQL views / RPC functions (day buckets, Asia/Kolkata)
- [ ] Analytics screen (filters: today/7d/30d/custom, module)
- [ ] Charts: leads per day, funnel, by source, by country, by niche, score dist, model usage, deal value
- [ ] Key metrics: useful-lead rate, reply rate, win rate, revenue
- [ ] Daily cleanup job in collector (purge trash >30d, archive old rejected, trim text)
- [ ] Accessibility pass (labels on all controls)
- [ ] Empty and error states everywhere
- [ ] Feature-flagged Expo push (logged in BLOCKERS.md)
- [ ] Deploy instructions (Cloudflare Pages / Vercel / Netlify)
- [ ] Analytics tests
- [ ] npm run verify green
- [ ] Git commit: phase 6: analytics and polish

## Final Hardening
- [ ] npm run verify x3 (three times in a row, all green)
- [ ] Mutation sanity checks (5 critical pieces)
- [ ] Security review (sections 3-4)
- [ ] Error handling review
- [ ] Accessibility labels review
- [ ] Hostile-text rendering check
- [ ] No-secret scan (repo + web build)
- [ ] Workflow YAML check
- [ ] README.md complete
- [ ] TEST_REPORT.md complete (honest)
- [ ] BLOCKERS.md complete
- [ ] MORNING_CHECKLIST.md complete
- [ ] DECISIONS.md complete

