/**
 * Lead Finder Collector — main entry point.
 *
 * Run flow (section 13):
 * 1. Acquire lease in collector_lock
 * 2. Load settings, enabled modules, approved plans, model chains, secrets
 * 3. For each enabled module + source: fetch, parse, normalize, dedupe, pre-filter, insert
 * 4. Score unscored leads (newest first, up to cap)
 * 5. Update model_status counters and cooldowns
 * 6. Send Telegram alerts (threshold + quiet hours)
 * 7. Run daily cleanup if due
 * 8. Write collector_runs row, release lease
 *
 * Idempotent: running twice produces no duplicates.
 * Fault-isolated: one source or model failure never aborts the run.
 */

import { createClient } from '@supabase/supabase-js';
import { runCollector } from './runner.js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

runCollector(supabase).catch((err) => {
  console.error('Collector failed with unhandled error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
