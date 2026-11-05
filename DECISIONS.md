# Decisions Log

Every decision made autonomously (instead of asking the owner).

| # | Decision | Alternatives Considered | Reason |
|---|----------|------------------------|--------|
| 1 | Use Vitest for collector and shared tests | Jest | Vitest has native TypeScript + ESM support, faster cold start, same API as Jest |
| 2 | Use jest-expo for app tests | Vitest + custom setup | jest-expo is the officially recommended test runner for Expo apps |
| 3 | Use `react-native-calendars` for Calendar screen | Custom grid, `react-native-calendar-events` | Well-maintained, works on mobile and web, TypeScript support |
| 4 | Use Victory Native + Victory.js for analytics charts | Recharts, Chart.js, Nivo | Victory has React Native + web parity; Recharts is web-only |
| 5 | Use Supabase Vault for secret storage | Encrypted column | Vault is available on the free plan (Supabase Free includes Vault); if not available after deploy, fall back to encrypted column (see BLOCKERS.md) |
| 6 | Use `countries-states-cities` npm package for location data (MIT license) | Hard-coded list, restcountries.com | Open, offline, frequently updated, MIT-licensed; credit displayed in About screen |
| 7 | Scan:secrets uses a custom Node script (not gitleaks) | gitleaks, trufflehog | No external binaries required; runs in CI without extra setup |
| 8 | Use `@supabase/supabase-js` v2 | v1 | v2 is current stable; v1 is deprecated |
| 9 | Pin all dependency versions exactly (no `^` or `~`) in package.json files | Semver ranges | Reproducibility; avoids surprise breakage during overnight run |
| 10 | Use `AsyncStorage` from `@react-native-async-storage/async-storage` for theme persistence | `SecureStore` | Theme is not secret; AsyncStorage is simpler and available on web |
| 11 | Scoring prompt delimiter uses XML-style tags `<lead_text>...</lead_text>` | Triple backticks, JSON nesting | Harder for prompt-injection to escape; consistent with Anthropic best practices |
| 12 | Supabase Edge Functions use Deno runtime (default for Supabase) | Node.js | Supabase Edge Functions are Deno-based; shared code uses web-standard APIs for compatibility |
| 13 | Web build deployed to Netlify (primary option; Vercel and Cloudflare Pages noted as alternatives) | Cloudflare Pages, Vercel | All three are free; Netlify has the simplest drag-and-drop for first deploy |
| 14 | ESLint flat config (eslint.config.js) | .eslintrc | ESLint v9+ uses flat config; avoids deprecation warnings |
| 15 | Use `zod` for JSON schema validation in shared router | `ajv`, manual checks | Zod works in both Node and Deno; TypeScript inference; lightweight |
| 16 | Use `@electric-sql/pglite` in-process WASM Postgres for database tests | Docker container, Supabase CLI | Zero external daemon requirement, fast execution in Node environment, full Postgres 16 SQL compliance |
| 17 | Use `gen_random_uuid()` with `uuid_generate_v4()` fallback | `uuid-ossp` extension | Modern PostgreSQL 13+ standard without requiring optional external extension packages in lightweight test environments |
| 18 | Add role existence initialization in migration 002 | Hard requirement on pre-existing roles | Allows migrations to run cleanly on standalone Postgres, PGlite, and Supabase alike |
| 19 | Standard schema grants on schema public for `anon` and `authenticated` roles | Manual per-table grants | Matches Supabase PostgREST default architecture where tables are accessible subject to RLS policies |
| 20 | Explicit `postinstall` script `scripts/patch-ajv.js` for `ajv-keywords` | Custom package hoist | Automatically ensures `ajv` v8 is available to `ajv-keywords` across all package operations |
| 21 | Write-only secret preview strictly masked (`first 4, last 2`, middle `*`) via `set_secret_value` and `secret_meta` | Storing plain secrets in client state | Prevents any accidental secret leakage in logs, screenshots, UI, or state persistence while still allowing identification |
| 22 | Preserving `?id=...` query param in `makeWebDedupeKey` while stripping tracking params | Stripping all query params | Ensures sources like Hacker News that store the post identifier in the query string (`/item?id=...`) generate distinct dedupe keys rather than collapsing to a single key |
| 23 | Pure React Native month grid with event indicator dots in `calendar.tsx` | Third-party calendar web wrappers | 100% universal rendering across Web, iOS, and Android without bundler polyfills or test mocking overhead |
| 24 | Cross-platform CSV export: HTML Blob download on Web, React Native `Share.share` on mobile | Web-only anchor tag | Enables seamless data portability on both mobile devices and desktop web browsers |
| 25 | Built-in open geographical dataset with cascading Country -> State -> City in `locations.ts` | Dynamic multi-megabyte remote runtime downloads | Provides instant, zero-latency cascading area selection with complete offline resilience |
| 26 | Responsive pure React Native bar/funnel visualization for AnalyticsScreen | Victory Native | Victory Native 36.x has missing native SVG module imports and CommonJS/ESM bundling errors on React Native Web; pure RN flex bars provide 100% web/native parity, full accessibility labels, instant testing, and zero external dependency risk |
| 27 | Telegram alert messages sent in plain text without `parse_mode: MarkdownV2` | MarkdownV2 with escaping | URLs and titles frequently contain special characters (`.`, `-`, `_`, `?`, `&`) that cause Telegram 400 Bad Request if unescaped; plain text guarantees 100% reliable message delivery |
| 28 | Automated model exhaustion alert via Telegram | Silent failure | MASTER_PROMPT Section 12 explicitly mandates alerting when all models for a module are exhausted/in cooldown; alerts owner immediately so keys can be replenished |
| 29 | Expandable in-place detail view on LeadCard with history timeline and notes editor | Modal or separate route | Seamless inline expansion keeps scroll position intact while giving immediate access to full body, service match, tech stack, notes editor with Save Note button, and history |
| 30 | Standard Intl.DateTimeFormat with mapped country-to-timezone dictionary for approximate local time | Heavy moment-timezone or remote geocoding API | Zero external network calls; provides approximate local time with mandatory `(approx.)` label for both Web client countries and Maps local businesses |
| 31 | Multi-select mode with bulk action confirmation dialog and 5-second Undo toast | Instant deletion without confirmation | Strictly satisfies Section 11 safety requirements: dialog names exact count, lead codes, and titles before applying bulk reject/accept, and gives a 5-second window to reverse |
| 32 | Upgrade Expo app to SDK 58 (`expo@58.0.23`, `react-native@0.88.1`, `react@19.3.0`, `expo-router@58.0.30`) | Retaining SDK 52 | User's physical device is running the latest Expo Go app (SDK 58). Upgraded Expo, React Native, React 19, Jest 30, vector-icons, and related peer dependencies. Confirmed 100% green verification (173 tests, 20/20 expo-doctor checks, 0 TS/ESLint errors, 22 static web routes exported). |
| 33 | Configure Jest 30 with `@react-native/jest-preset` and 60s timeout for cold start | Default 20s testTimeout | React Native 0.88 separated the jest preset into `@react-native/jest-preset`; worker cold start on Windows with React 19 test renderer requires higher timeout (60,000ms) in `jest.setup.js`. |




