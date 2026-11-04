# Blockers

Items that could not be built or verified automatically, plus the action the owner must take.

| # | What | Why | Owner Action |
|---|------|-----|--------------|
| 1 | Supabase Vault availability on free plan | Cannot connect to real Supabase during build; Vault is listed as available on free but must be verified | After creating the Supabase project, check Settings > Vault. If Vault is not available, switch to the encrypted-column fallback described in DECISIONS.md #5 and re-run the migration |
| 2 | Expo push notifications (native) | Cannot be tested without real device + EAS project + push certificate | After completing MORNING_CHECKLIST.md, run `eas build` and test on a real device; the feature is flagged off by default |
| 3 | Real Telegram bot token + chat ID | Cannot be tested without a real bot | Follow MORNING_CHECKLIST.md step 6; use the in-app Detect Chat flow |
| 4 | Real AI provider API keys (Gemini, Groq, Mistral, etc.) | Cannot call real APIs without keys | Follow MORNING_CHECKLIST.md step 6; add keys via Settings > Secrets & Integrations |
| 5 | Real Supabase Auth + RLS in production | Built and tested against local Supabase CLI / PGlite; real project may differ in minor ways | Apply migrations and run the app; if RLS errors appear, check that public sign-ups are disabled and your user is owner |
| 6 | Playwright end-to-end tests | Playwright requires a browser binary; may not be available in this environment | Run `npx playwright install` then `npx playwright test` manually after waking up |
| 7 | Freelancer.com API adapter | Requires a developer key; terms must be re-verified before use | Register at https://developers.freelancer.com; add the key via Settings > Secrets; the adapter skips cleanly if no key |
| 8 | Google Places optional adapter (Maps module) | Requires a Google Maps Platform API key; costs money for high usage | Add the key via Settings > Secrets if desired; the adapter is off by default |
| 9 | GitHub Actions scheduled workflows | Scheduled workflows are disabled by GitHub after 60 days of repository inactivity | Push a commit or use workflow_dispatch every 60 days; see README |

