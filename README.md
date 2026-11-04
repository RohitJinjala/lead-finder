# Lead Finder

Personal freelance lead finding, qualification, and pipeline management app for a full-stack developer (React, React Native, Node, Express, MERN, .NET).

## Architecture

- **App (`/app`)**: Cross-platform Expo app (Android, iOS, Web) with Expo Router, TypeScript, and Supabase client.
- **Collector (`/collector`)**: Node.js + TypeScript collector scheduled via GitHub Actions every 30 minutes.
- **Shared (`/shared`)**: Runtime-neutral AI model router, schemas, and utilities (Node & Deno compatible).
- **Backend (`/supabase`)**: Supabase Postgres migrations, RLS policies, Vault secrets, and Edge Functions.

## Two Modules

1. **Web Leads**: Public freelance sources (Reddit, Hacker News, RemoteOK, We Work Remotely, Remotive) pre-filtered, AI-qualified, and scored.
2. **Maps Leads**: Local businesses with no website or social-only presence from OpenStreetMap Overpass API with customized niche proposals.

> **Zero Auto-Outreach**: All communications and client outreach are manual. No auto-apply, auto-DM, or automated spamming.

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase account (free tier)

## Setup & Verification

```bash
# Verify entire repository
npm run verify

# Run individual checks
npm run lint
npm run typecheck
npm run test
npm run scan:secrets
```

See [MORNING_CHECKLIST.md](./MORNING_CHECKLIST.md) for full setup instructions upon waking up.

