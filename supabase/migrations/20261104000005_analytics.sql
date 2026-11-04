-- 20261104000005_analytics.sql
-- Lead Finder: Analytics Views and RPC functions in Asia/Kolkata time zone

-- 1. Daily leads count view in Asia/Kolkata
create or replace view daily_leads_summary as
select
    (found_at at time zone 'Asia/Kolkata')::date as lead_date,
    module,
    count(*) as total_found,
    count(*) filter (where scored = true) as total_scored,
    count(*) filter (where status in ('acceptable', 'contacted', 'replied', 'won')) as total_useful,
    count(*) filter (where status = 'won') as total_won,
    count(*) filter (where status = 'rejected') as total_rejected
from leads
where deleted_at is null
group by 1, 2
order by 1 desc;

-- 2. Daily deals revenue view in Asia/Kolkata
create or replace view daily_deals_summary as
select
    (created_at at time zone 'Asia/Kolkata')::date as deal_date,
    count(*) as deals_created,
    coalesce(sum(value), 0) as total_pipeline,
    coalesce(sum(value) filter (where payment_status = 'paid'), 0) as closed_revenue
from deals
group by 1
order by 1 desc;

-- 3. High level KPIs RPC function
create or replace function get_analytics_kpis(
    p_start timestamptz default null,
    p_end timestamptz default null,
    p_module text default 'all'
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_total_leads bigint;
    v_scored_leads bigint;
    v_useful_leads bigint;
    v_contacted bigint;
    v_replied bigint;
    v_won bigint;
    v_lost bigint;
    v_pipeline numeric;
    v_revenue numeric;
    v_result jsonb;
begin
    -- Leads metrics
    select
        count(*),
        count(*) filter (where scored = true),
        count(*) filter (where status in ('acceptable', 'contacted', 'replied', 'won')),
        count(*) filter (where status in ('contacted', 'replied', 'won')),
        count(*) filter (where status in ('replied', 'won')),
        count(*) filter (where status = 'won'),
        count(*) filter (where status = 'lost')
    into
        v_total_leads,
        v_scored_leads,
        v_useful_leads,
        v_contacted,
        v_replied,
        v_won,
        v_lost
    from leads
    where deleted_at is null
      and (p_module = 'all' or module = p_module)
      and (p_start is null or found_at >= p_start)
      and (p_end is null or found_at <= p_end);

    -- Deals metrics
    select
        coalesce(sum(value), 0),
        coalesce(sum(value) filter (where payment_status = 'paid'), 0)
    into
        v_pipeline,
        v_revenue
    from deals
    where (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end);

    v_result := jsonb_build_object(
        'totalLeads', v_total_leads,
        'scoredLeads', v_scored_leads,
        'usefulLeadRate', case when v_total_leads > 0 then round((v_useful_leads::numeric / v_total_leads::numeric) * 100, 1) else 0 end,
        'replyRate', case when v_contacted > 0 then round((v_replied::numeric / v_contacted::numeric) * 100, 1) else 0 end,
        'winRate', case when (v_won + v_lost) > 0 then round((v_won::numeric / (v_won + v_lost)::numeric) * 100, 1) when v_won > 0 then 100 else 0 end,
        'totalPipeline', v_pipeline,
        'totalRevenue', v_revenue,
        'wonCount', v_won
    );

    return v_result;
end;
$$;

