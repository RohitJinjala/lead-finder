-- 20261104000002_rls_and_owner.sql
-- Lead Finder: Security definer functions, owner check, and RLS policies

-- Ensure Supabase standard roles exist if running on standalone Postgres / PGlite
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end
$$;

-- Grant schema usage to roles so RLS policies can evaluate
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;

-- Helper function: is_owner()
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.app_owner
    where user_id = auth.uid()
  );
$$;

-- Function: claim_owner()
-- Callable once by the very first authenticated user
create or replace function public.claim_owner()
returns boolean
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.app_owner) then
    return false; -- Already claimed
  end if;

  insert into public.app_owner (user_id) values (auth.uid());
  return true;
end;
$$;

-- Function: acquire_collector_lock
create or replace function public.acquire_collector_lock(p_expires_at timestamptz)
returns boolean
language plpgsql
security definer
as $$
declare
  v_acquired boolean := false;
begin
  update public.collector_lock
  set held_by = 'collector',
      acquired_at = now(),
      expires_at = p_expires_at
  where id = 1
    and (expires_at is null or expires_at < now());

  if found then
    v_acquired := true;
  end if;

  return v_acquired;
end;
$$;

-- Function: release_collector_lock
create or replace function public.release_collector_lock()
returns void
language plpgsql
security definer
as $$
begin
  update public.collector_lock
  set held_by = null,
      acquired_at = null,
      expires_at = null
  where id = 1;
end;
$$;

-- Function: get_secret_value
-- ONLY executable by service_role (revoked from anon and authenticated)
create or replace function public.get_secret_value(p_secret_name text)
returns text
language plpgsql
security definer
as $$
declare
  v_secret text;
begin
  select secret_value into v_secret
  from public.secret_store
  where secret_name = p_secret_name;

  return v_secret;
end;
$$;

-- Function: set_secret_value
-- Securely saves a secret and updates secret_meta with masked preview
create or replace function public.set_secret_value(
  p_name text,
  p_value text,
  p_kind text,
  p_module text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_masked text;
  v_len integer;
begin
  v_len := length(p_value);
  if v_len <= 6 then
    v_masked := '***';
  else
    v_masked := substr(p_value, 1, 4) || repeat('*', least(v_len - 6, 20)) || substr(p_value, v_len - 1, 2);
  end if;

  insert into public.secret_meta (name, kind, module, masked_preview, status, updated_at)
  values (p_name, p_kind, p_module, v_masked, 'not_set', now())
  on conflict (name) do update
  set kind = excluded.kind,
      module = excluded.module,
      masked_preview = excluded.masked_preview,
      status = 'not_set',
      updated_at = now();

  insert into public.secret_store (secret_name, secret_value, updated_at)
  values (p_name, p_value, now())
  on conflict (secret_name) do update
  set secret_value = excluded.secret_value,
      updated_at = now();
end;
$$;

-- Function: delete_secret_value
create or replace function public.delete_secret_value(p_name text)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.secret_store where secret_name = p_name;
  delete from public.secret_meta where name = p_name;
end;
$$;

-- Revoke secret access from public / anon / authenticated
revoke execute on function public.get_secret_value(text) from public, anon, authenticated;
grant execute on function public.get_secret_value(text) to service_role;

revoke all on table public.secret_store from public, anon, authenticated;
grant all on table public.secret_store to service_role;

-- Enable Row Level Security on ALL tables
alter table public.app_owner enable row level security;
alter table public.id_counters enable row level security;
alter table public.search_profiles enable row level security;
alter table public.search_plans enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.model_chain enable row level security;
alter table public.model_status enable row level security;
alter table public.niche_offers enable row level security;
alter table public.locations enable row level security;
alter table public.search_presets enable row level security;
alter table public.secret_meta enable row level security;
alter table public.collector_runs enable row level security;
alter table public.collector_lock enable row level security;
alter table public.user_settings enable row level security;

-- App owner policies
create policy owner_read_app_owner on public.app_owner for select using (true);
create policy owner_manage_search_profiles on public.search_profiles for all using (public.is_owner());
create policy owner_manage_search_plans on public.search_plans for all using (public.is_owner());
create policy owner_manage_leads on public.leads for all using (public.is_owner());
create policy owner_manage_deals on public.deals for all using (public.is_owner());
create policy owner_manage_model_chain on public.model_chain for all using (public.is_owner());
create policy owner_read_model_status on public.model_status for select using (public.is_owner());
create policy owner_manage_niche_offers on public.niche_offers for all using (public.is_owner());
create policy owner_read_locations on public.locations for select using (public.is_owner());
create policy owner_manage_search_presets on public.search_presets for all using (public.is_owner());
create policy owner_manage_secret_meta on public.secret_meta for all using (public.is_owner());
create policy owner_read_collector_runs on public.collector_runs for select using (public.is_owner());
create policy owner_read_collector_lock on public.collector_lock for select using (public.is_owner());
create policy owner_manage_user_settings on public.user_settings for all using (public.is_owner());
create policy owner_read_id_counters on public.id_counters for select using (public.is_owner());

