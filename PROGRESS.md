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
- [x] Calendar screen (month + day views, found_at, contacted_at, follow_up_at)
- [x] Due Today list
- [x] Follow-up date picker on lead cards
- [x] Deals screen (Live and Completed tabs)
- [x] Won conversion (lead -> deal, idempotent, same code)
- [x] Deal fields (client, project, value, currency, start, deadline, payment, notes)
- [x] Mark deal complete (confirmation + optional payment checkbox)
- [x] Theme setting (Light, Dark, System, persisted)
- [x] CSV export (web download, mobile share)
- [x] Calendar + deals tests
- [x] npm run verify green
- [x] Git commit: phase 4: workflow

## Phase 5 — Maps Module
- [x] Maps module toggle
- [x] Own model chain for Maps
- [x] Location data (open countries-states-cities dataset, credited)
- [x] Location picker (Country -> State -> City, multi-select, presets)
- [x] Niche picker (editable niche_offers)
- [x] Overpass API adapter (fair-use limits, caching, backoff)
- [x] Maps collector (no-website / social-only filter, phone + social extraction)
- [x] Maps scoring (router, Maps chain, draft pitch line)
- [x] Maps card (all fields: business name, niche, address, phone, WhatsApp button)
- [x] Social search buttons (Find on Facebook/Instagram/LinkedIn)
- [x] Verify button + verified checkbox
- [x] "Found via: OpenStreetMap" badge + attribution on all Maps screens
- [x] Google Places optional adapter (flag + key from Secrets)
- [x] Round-robin area selection by last_searched_at
- [x] Maps tests: fixture-based, no-website filter, phone extraction
- [x] npm run verify green
- [x] Git commit: phase 5: maps module

## Phase 6 — Analytics and Polish
- [x] Analytics SQL views / RPC functions (day buckets, Asia/Kolkata)
- [x] Analytics screen (filters: today/7d/30d/custom, module)
- [x] Charts: leads per day, funnel, by source, by country, by niche, score dist, model usage, deal value
- [x] Key metrics: useful-lead rate, reply rate, win rate, revenue
- [x] Daily cleanup job in collector (purge trash >30d, archive old rejected, trim text)
- [x] Accessibility pass (labels on all controls)
- [x] Empty and error states everywhere
- [x] Feature-flagged Expo push (logged in BLOCKERS.md)
- [x] Deploy instructions (Cloudflare Pages / Vercel / Netlify)
- [x] Analytics tests
- [x] npm run verify green
- [x] Git commit: phase 6: analytics and polish

## Final Hardening
- [x] npm run verify x3 (three times in a row, all green)
- [x] Mutation sanity checks (5 critical pieces)
- [x] Security review (sections 3-4)
- [x] Error handling review
- [x] Accessibility labels review
- [x] Hostile-text rendering check
- [x] No-secret scan (repo + web build)
- [x] Workflow YAML check
- [x] README.md complete
- [x] TEST_REPORT.md complete (honest)
- [x] BLOCKERS.md complete
- [x] MORNING_CHECKLIST.md complete
- [x] DECISIONS.md complete

## Master Prompt Full Compliance Audit & Enhancements
- [x] Section 11 & 12: Telegram alert formatting in plain text (safe URLs without Markdown entity breaks)
- [x] Section 12: Automated model exhaustion alert via Telegram when all module models cooldown
- [x] Section 11: LeadCard full expandable detail view (full description, service match, tech stack chips, history timeline, notes editor with Save Note)
- [x] Section 11: Approximate local time computation helper `(approx.)` for client country & business local time
- [x] Section 11: OpenStreetMap map link (`🗺️ OSM Map`) button on Maps leads
- [x] Section 11: Bulk actions with selection toggle, confirmation dialog listing count/IDs/titles, and 5-second Undo toast
- [x] Section 11: Deal completion prompt offering "Complete & Mark Paid" and "Mark Complete"
- [x] Section 11: Replace secret confirmation naming the secret before overwriting
- [x] Section 6: Lead ID search matching partial and full ID codes
- [x] 100% tests passing (173/173 tests green across all 3 packages)
- [x] Clean Expo web build export (22 static routes) & 0 secrets detected in build artifacts


