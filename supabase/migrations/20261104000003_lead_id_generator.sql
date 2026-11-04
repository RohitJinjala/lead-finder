-- 20261104000003_lead_id_generator.sql
-- Lead Finder: Atomic daily lead ID generator using id_counters and trigger

-- Function: generate_lead_code()
-- Computes DD-MM-SRC-NNNN based on Asia/Kolkata date and atomic upsert on id_counters
create or replace function public.generate_lead_code()
returns trigger
language plpgsql
security definer
as $$
declare
  v_day text;
  v_mod_code text;
  v_counter integer;
  v_counter_str text;
begin
  -- If lead_code is already explicitly provided, keep it
  if new.lead_code is not null and new.lead_code <> '' then
    return new;
  end if;

  -- 1. Compute today's date in Asia/Kolkata (format: DD-MM)
  -- We also store full date in id_counters (YYYY-MM-DD in Asia/Kolkata)
  select to_char(timezone('Asia/Kolkata', now()), 'DD-MM') into v_day;
  
  -- 2. Module code: WEB or MAP
  if new.module = 'maps' then
    v_mod_code := 'MAP';
  else
    v_mod_code := 'WEB';
  end if;

  -- 3. Atomic upsert on id_counters
  -- id_counters primary key is (day, module)
  -- row-level lock ensures parallel inserts never get duplicate counters
  insert into public.id_counters (day, module, last_number)
  values (to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM-DD'), new.module, 1)
  on conflict (day, module)
  do update set last_number = public.id_counters.last_number + 1
  returning last_number into v_counter;

  -- 4. Pad to at least 4 digits
  if v_counter < 10000 then
    v_counter_str := lpad(v_counter::text, 4, '0');
  else
    v_counter_str := v_counter::text;
  end if;

  -- 5. Format: DD-MM-SRC-NNNN
  new.lead_code := v_day || '-' || v_mod_code || '-' || v_counter_str;

  return new;
end;
$$;

-- Trigger on leads before insert
drop trigger if exists trg_generate_lead_code on public.leads;
create trigger trg_generate_lead_code
before insert on public.leads
for each row
execute function public.generate_lead_code();

