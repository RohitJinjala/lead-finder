import type { SupabaseClient } from '@supabase/supabase-js';
import { scrubSecrets } from '@lead-finder/shared';

// In-memory cache for this run only. Cleared when process exits.
const secretCache = new Map<string, string>();

/**
 * Fetches a secret value by name. Uses in-run memory cache.
 * Never logs the returned value.
 * Never persists between runs (process memory only).
 */
export async function getSecret(supabase: SupabaseClient, secretName: string): Promise<string> {
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName)!;
  }

  const { data, error } = await supabase.rpc('get_secret_value', {
    p_secret_name: secretName,
  });

  if (error) {
    throw new Error(`Secret "${secretName}" unavailable: ${scrubSecrets(error.message)}`);
  }

  if (!data || typeof data !== 'string') {
    throw new Error(`Secret "${secretName}" is empty or invalid`);
  }

  secretCache.set(secretName, data);
  return data;
}

/**
 * Clears the in-memory secret cache (called at run end).
 */
export function clearSecretCache(): void {
  secretCache.clear();
}
