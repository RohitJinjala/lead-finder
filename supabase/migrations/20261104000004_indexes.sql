-- 20261104000004_indexes.sql
-- Lead Finder: Performance indexes for high-frequency queries and filtering

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_module on public.leads(module);
create index if not exists idx_leads_found_at on public.leads(found_at desc);
create index if not exists idx_leads_follow_up_at on public.leads(follow_up_at);
create index if not exists idx_leads_score on public.leads(score);
create index if not exists idx_leads_deleted_at on public.leads(deleted_at);
create index if not exists idx_leads_scored on public.leads(scored);
create index if not exists idx_leads_search_profile_id on public.leads(search_profile_id);

-- Deals indexes
create index if not exists idx_deals_state on public.deals(state);
create index if not exists idx_deals_payment_status on public.deals(payment_status);

-- Collector runs index
create index if not exists idx_collector_runs_started on public.collector_runs(started_at desc);

