import type { SupabaseClient } from '@supabase/supabase-js';

const LEASE_DURATION_MS = 25 * 60 * 1000; // 25 minutes (run timeout = 25 min)

export async function acquireLease(supabase: SupabaseClient): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

  // Try to upsert a lease. If the existing lease hasn't expired, we can't acquire it.
  // The collector_lock table has a single row (id = 1).
  const { data, error } = await supabase.rpc('acquire_collector_lock', {
    p_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('[lease] Failed to acquire lease:', error.message);
    throw new Error(`Failed to acquire collector lock: ${error.message}`);
  }

  return data === true;
}

export async function releaseLease(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('release_collector_lock');
  if (error) {
    console.error('[lease] Failed to release lease:', error.message);
  }
}
