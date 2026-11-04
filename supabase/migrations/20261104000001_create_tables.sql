-- 20261104000001_create_tables.sql
-- Lead Finder: Initial schema for all tables

-- Enable UUID function (standard gen_random_uuid with uuid_generate_v4 alias for backwards compatibility)
create or replace function uuid_generate_v4() returns uuid as $$
  select gen_random_uuid();
$$ language sql;

-- 1. App Owner (single row for the sole owner)
create table if not exists app_owner (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null unique,
    claimed_at timestamptz not null default now()
);

-- 2. ID Counters for atomic daily lead codes (day, module)
create table if not exists id_counters (
    day text not null,       -- Format 'DD-MM-YYYY' or 'YYYY-MM-DD'
    module text not null,    -- 'web' or 'maps'
    last_number integer not null default 0,
    primary key (day, module)
);

-- 3. Search Profiles
create table if not exists search_profiles (
    id uuid primary key default uuid_generate_v4(),
    module text not null check (module in ('web', 'maps')),
    name text not null,
    brief text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. Search Plans (versioned, approved plans)
create table if not exists search_plans (
    id uuid primary key default uuid_generate_v4(),
    profile_id uuid not null references search_profiles(id) on delete cascade,
    version integer not null default 1,
    plan jsonb not null default '{}'::jsonb,
    approved boolean not null default false,
    approved_at timestamptz,
    created_at timestamptz not null default now()
);

-- 5. Leads Table
create table if not exists leads (
    id uuid primary key default uuid_generate_v4(),
    lead_code text not null unique,
    module text not null check (module in ('web', 'maps')),
    source text not null,
    source_url text not null,
    dedupe_key text not null unique,
    title text not null,
    body text not null,
    found_at timestamptz not null default now(),
    posted_at timestamptz,
    status text not null default 'new' check (status in ('new', 'acceptable', 'rejected', 'contacted', 'replied', 'won', 'lost')),
    reject_reason text,
    scored boolean not null default false,
    score integer check (score is null or (score >= 0 and score <= 100)),
    reason text,
    tags text[] not null default '{}',
    service_match text,
    tech_stack text[] not null default '{}',
    budget_signal text check (budget_signal is null or budget_signal in ('stated', 'hinted', 'none')),
    budget_amount numeric,
    currency text,
    country text,
    timezone text,
    red_flags text[] not null default '{}',
    draft_line text,
    scored_by text,
    scored_provider text,
    is_fallback boolean not null default false,
    prompt_version text,
    search_profile_id uuid references search_profiles(id) on delete set null,
    plan_version integer,
    notes text,
    contacted_at timestamptz,
    follow_up_at timestamptz,
    deleted_at timestamptz,
    archived_at timestamptz,

    -- Maps fields
    business_name text,
    niche text,
    state text,
    city text,
    address text,
    phone text,
    whatsapp_url text,
    website_status text check (website_status is null or website_status in ('none', 'social_only')),
    social_links jsonb,
    osm_type text,
    osm_id text,
    place_id text,
    lat double precision,
    lon double precision,
    suggested_offer text,
    verified_no_website boolean not null default false
);

-- 6. Deals Table
create table if not exists deals (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null unique references leads(id) on delete cascade,
    deal_code text not null,
    client text not null,
    project text not null,
    value numeric,
    currency text default 'USD',
    start_date date,
    deadline date,
    payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
    state text not null default 'live' check (state in ('live', 'completed')),
    notes text,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

-- 7. Model Chain (per-module priority list of AI models)
create table if not exists model_chain (
    id uuid primary key default uuid_generate_v4(),
    module text not null check (module in ('web', 'maps')),
    name text not null,
    provider text not null,
    base_url text not null,
    model_id text not null,
    secret_name text not null,
    priority integer not null default 0,
    enabled boolean not null default true,
    daily_limit integer,
    reset_tz text not null default 'Asia/Kolkata',
    reset_hour integer not null default 0 check (reset_hour >= 0 and reset_hour <= 23),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 8. Model Status (runtime counters and cooldown tracking)
create table if not exists model_status (
    model_id uuid primary key references model_chain(id) on delete cascade,
    status text not null default 'available' check (status in ('available', 'cooling_down', 'limit_reached', 'invalid_key', 'disabled')),
    requests_today integer not null default 0,
    errors_today integer not null default 0,
    leads_scored_today integer not null default 0,
    limit_hit_at timestamptz,
    resets_at timestamptz,
    last_error text,
    consecutive_failures integer not null default 0,
    updated_at timestamptz not null default now()
);

-- 9. Niche Offers (Maps module templates)
create table if not exists niche_offers (
    id uuid primary key default uuid_generate_v4(),
    niche text not null unique,
    offer_text text not null,
    osm_tag_filters jsonb not null default '[]'::jsonb,
    enabled boolean not null default true,
    created_at timestamptz not null default now()
);

-- 10. Locations
create table if not exists locations (
    id uuid primary key default uuid_generate_v4(),
    country text not null,
    state text not null,
    city text not null,
    created_at timestamptz not null default now(),
    unique (country, state, city)
);

-- 11. Search Presets (for Maps module area selection)
create table if not exists search_presets (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    countries text[] not null default '{}',
    states text[] not null default '{}',
    cities text[] not null default '{}',
    niches text[] not null default '{}',
    last_searched_at timestamptz,
    created_at timestamptz not null default now()
);

-- 12. Secret Metadata (app-readable view of stored secrets)
create table if not exists secret_meta (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    kind text not null, -- 'ai_model' | 'source_api' | 'telegram' | 'other'
    module text,        -- 'web' | 'maps' | null
    masked_preview text not null,
    status text not null default 'not_set' check (status in ('not_set', 'valid', 'invalid', 'rate_limited')),
    last_tested_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 13. Vault fallback / secret store (encrypted column if Supabase Vault is unavailable)
create table if not exists secret_store (
    id uuid primary key default uuid_generate_v4(),
    secret_name text not null unique references secret_meta(name) on delete cascade,
    secret_value text not null,
    updated_at timestamptz not null default now()
);

-- 14. Collector Runs (execution audit log)
create table if not exists collector_runs (
    id uuid primary key default uuid_generate_v4(),
    started_at timestamptz not null,
    finished_at timestamptz not null,
    module text,
    found integer not null default 0,
    new integer not null default 0,
    scored integer not null default 0,
    unscored integer not null default 0,
    errors integer not null default 0,
    per_source_results jsonb not null default '[]'::jsonb,
    models_used jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- 15. Collector Lock (distributed lease)
create table if not exists collector_lock (
    id integer primary key default 1 check (id = 1),
    held_by text,
    acquired_at timestamptz,
    expires_at timestamptz
);

insert into collector_lock (id, held_by, acquired_at, expires_at)
values (1, null, null, null)
on conflict (id) do nothing;

-- 16. User Settings (single user configuration)
create table if not exists user_settings (
    id uuid primary key default uuid_generate_v4(),
    theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
    web_module_enabled boolean not null default true,
    maps_module_enabled boolean not null default true,
    scoring_cap_per_run integer not null default 40,
    alert_threshold integer not null default 75,
    quiet_hours_start integer check (quiet_hours_start is null or (quiet_hours_start >= 0 and quiet_hours_start <= 23)),
    quiet_hours_end integer check (quiet_hours_end is null or (quiet_hours_end >= 0 and quiet_hours_end <= 23)),
    timezone text not null default 'Asia/Kolkata',
    last_cleanup_at timestamptz,
    updated_at timestamptz not null default now()
);

-- Insert default user settings row
insert into user_settings (web_module_enabled, maps_module_enabled, scoring_cap_per_run, alert_threshold, timezone)
select true, true, 40, 75, 'Asia/Kolkata'
where not exists (select 1 from user_settings);

