# Test Report

> Generated automatically. Only claims things that actually ran.

## Summary

| Phase | Tests Run | Passed | Failed | Skipped | Notes |
|-------|-----------|--------|--------|---------|-------|
| Phase 0 — Scaffold | 64 | 64 | 0 | 0 | 35 shared, 9 collector, 20 app. verify green. |
| Phase 1 — Foundation | 86 | 86 | 0 | 0 | 50 shared (15 db via PGlite), 9 collector, 27 app (7 auth). verify green. |
| Phase 2 — Secrets & Models | 104 | 104 | 0 | 0 | 59 shared (9 edge fn + 18 router + 15 db + 8 schema + 9 utils), 9 collector, 36 app (20 card + 7 auth + 5 secrets + 4 models). verify green. |
| Phase 3 — Web Collector | 120 | 120 | 0 | 0 | 59 shared, 21 collector (4 runner + 8 sources + 6 filter + 3 alerts), 40 app (4 search profiles + 36 prior). verify green. |
| Phase 4 — Workflow | 135 | 135 | 0 | 0 | 59 shared, 21 collector, 55 app (4 calendar + 4 deals + 7 data/csv + 40 prior). 19 static routes exported. verify green. |
| Phase 5 — Maps | 151 | 151 | 0 | 0 | 59 shared, 29 collector (8 overpass + 21 prior), 63 app (3 modules + 4 niches + 56 prior). 22 static routes exported. verify green. |
| Phase 6 — Analytics | 167 | 167 | 0 | 0 | 67 shared (8 analytics + 59 prior), 30 collector (1 cleanup + 29 prior), 70 app (5 analytics + 2 notifications + 63 prior). 22 static routes exported. verify green. |
| Master Prompt Compliance Pass | 173 | 173 | 0 | 0 | 67 shared, 31 collector (+1 model exhaustion alert), 75 app (+4 lead card detail/time/osm/bulk + 1 secret replace confirm). 22 static routes exported. verify green. |

## What Ran Against Mocks (not real services)

- All AI provider calls: mocked HTTP responses
- All Supabase DB calls: local Postgres (Supabase CLI or PGlite)
- Telegram API: mocked
- Overpass API: saved fixture files
- Reddit/HN/RemoteOK/WWR/Remotive: saved fixture files

## What Could NOT Be Verified and Why

| Item | Reason |
|------|--------|
| Real Supabase Vault | No real Supabase project during build |
| Real Telegram bot | No real bot token |
| Real AI providers | No real API keys |
| Expo native push notifications | Requires real device + EAS project |
| Playwright E2E | Browser binaries may not be available; will attempt and record result |
| Freelancer.com API | Requires developer key |
| Google Places API | Requires API key + billing |

---

*This file will be updated with real results as each phase completes.*

