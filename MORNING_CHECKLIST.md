# Morning Checklist

Do these **in order** after waking up. Each step links to the relevant section.

---

## 1. Create Supabase project
1. Go to https://supabase.com and sign in.
2. Click **New project**; choose a name and a strong database password (save it in your password manager).
3. Wait for provisioning (about 2 minutes).
4. From **Settings > API**, note:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (keep this secret — never commit it)

## 2. Disable public sign-ups; create your user
1. Go to **Authentication > Settings**.
2. Toggle **Enable email sign-ups** OFF (or set **Restrict sign-ups to email domains** to your personal domain).
3. Go to **Authentication > Users > Invite user**.
4. Enter your email and invite yourself; accept the invite and set a password.
5. _(The app will warn you if it detects public sign-ups are still enabled.)_

## 3. Apply SQL migrations
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project (run once)
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply all migrations in order
supabase db push
```
Or open the **SQL Editor** in the Supabase dashboard and run each file in `supabase/migrations/` in order.

After applying, run:
```bash
supabase functions deploy
```
to deploy all Edge Functions.

## 4. Configure the app environment
Create `app/.env.local` (this file is gitignored):
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Then run the app:
```bash
# Web
cd app && npx expo start --web

# Android / iOS
cd app && npx expo start
```

Log in with your user, tap **Claim Ownership** when prompted (first login only).

## 5. Add GitHub secrets (for the collector workflow)
In your repository on GitHub: **Settings > Secrets and variables > Actions > New repository secret**

Add exactly these two:
- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_KEY` = your service_role key

**Nothing else.** All other keys are managed inside the app.

## 6. Add AI and Telegram keys inside the app
Open the app → **Settings > Secrets & Integrations**

**AI Model Keys** — add at least one:
- Gemini (Google AI Studio): https://aistudio.google.com/app/apikey
- Groq (free tier, fast): https://console.groq.com
- Mistral: https://console.mistral.ai
- NVIDIA NIM: https://build.nvidia.com
- OpenRouter: https://openrouter.ai

**Telegram** (optional but recommended for alerts):
1. Message [@BotFather](https://t.me/botfather) on Telegram: `/newbot`
2. Copy the bot token → paste it in Settings > Telegram Token → **Save**
3. Send any message to your new bot (e.g., "hello")
4. Tap **Detect Chat** in the app — it calls your bot's `getUpdates` and shows available chats
5. Select your chat → **Save**
6. Tap **Send test message** to verify

## 7. Add models to each module's chain
1. Settings > Models > **Web Leads** tab
2. Tap **Add Model**, choose provider preset, type the model ID, paste the secret name from step 6
3. Tap **Test** — wait for the green "Valid" badge
4. Repeat for Maps Leads

## 8. Create a Search Profile and approve a plan
1. Settings > Search Profiles > **New Profile**
2. Write a plain-language brief (e.g., "React/Node/MERN or .NET projects, budget above $500, US/UK/EU, no WordPress")
3. Tap **Generate Plan** — the AI proposes keywords, subreddits, filters
4. Review the chips; add or remove any; toggle sources on or off
5. Tap **Approve** — the plan is now active

## 9. Run the collector once manually
1. Go to your repository on GitHub → **Actions > Collector**
2. Click **Run workflow** (workflow_dispatch)
3. Wait ~2 minutes for the run to finish
4. Open the app → **Settings > Collector Health** to see the run results
5. Check **Leads** tab for new leads, score badges, and "Scored by" labels
6. If you have Telegram configured, check for the alert message

## 10. Deploy the web build
```bash
cd app
npx expo export --platform web
```
Then drag the `dist/` folder to one of:
- **Netlify**: https://app.netlify.com → **Add new site > Deploy manually**
- **Vercel**: `npx vercel --prod`
- **Cloudflare Pages**: Dashboard > Pages > Upload assets

Set environment variables in the platform dashboard:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Test on your phone browser and on a laptop.

## 11. Known limits to watch
- **GitHub Actions free tier**: 2,000 minutes/month for private repos; 30-min cron = ~1,440 runs/month = fine
- **GitHub scheduled workflows**: disabled after 60 days of repository inactivity → push a commit or use workflow_dispatch occasionally
- **Groq free tier**: rate limited; the collector falls back to the next model automatically
- **Overpass API**: fair-use; the collector rate-limits itself; don't increase the cron to < 30 minutes
- **Supabase free tier**: 500 MB database, 50,000 monthly active users, 2 GB bandwidth, 500,000 Edge Function invocations — more than enough for a personal app

---

> See `BLOCKERS.md` for items that need manual action or further verification.

