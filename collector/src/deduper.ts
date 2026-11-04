import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checks if a lead with the given dedupe_key already exists.
 * Returns true if it's a duplicate (should be skipped).
 */
export async function isDuplicate(supabase: SupabaseClient, dedupeKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();

  if (error) {
    console.warn('[deduper] Error checking duplicate:', error.message);
    return false; // err on the side of inserting
  }

  return data !== null;
}

/**
 * Checks multiple dedupe keys at once. Returns the set of keys that already exist.
 */
export async function getExistingDedupeKeys(supabase: SupabaseClient, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await supabase
    .from('leads')
    .select('dedupe_key')
    .in('dedupe_key', keys);

  if (error) {
    console.warn('[deduper] Error batch-checking duplicates:', error.message);
    return new Set();
  }

  return new Set((data ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
}

