# Test Report

> Generated automatically. Only claims things that actually ran.

## Summary

| Phase | Tests Run | Passed | Failed | Skipped | Notes |
|-------|-----------|--------|--------|---------|-------|
| Phase 0 — Scaffold | 64 | 64 | 0 | 0 | 35 shared, 9 collector, 20 app. verify green. |
| Phase 1 — Foundation | — | — | — | — | Not started |
| Phase 2 — Secrets & Models | — | — | — | — | Not started |
| Phase 3 — Web Collector | — | — | — | — | Not started |
| Phase 4 — Workflow | — | — | — | — | Not started |
| Phase 5 — Maps | — | — | — | — | Not started |
| Phase 6 — Analytics | — | — | — | — | Not started |

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

