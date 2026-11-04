import type { SupabaseClient } from '@supabase/supabase-js';

export interface CleanupResult {
  purgedTrash: boolean;
  archivedRejected: boolean;
  trimmedCount: number;
  updatedSettings: boolean;
}

/**
 * Daily cleanup:
 * 1. Purge trash older than 30 days (deleted_at set)
 * 2. Archive rejected leads older than 30 days
 * 3. Trim stored text (body > 4000 chars)
 * 4. Update last_cleanup_at in user_settings
 */
export async function runDailyCleanup(supabase: SupabaseClient): Promise<CleanupResult> {
  console.log('[cleanup] Running daily cleanup...');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result: CleanupResult = {
    purgedTrash: false,
    archivedRejected: false,
    trimmedCount: 0,
    updatedSettings: false,
  };

  // 1. Hard-delete trash older than 30 days
  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', thirtyDaysAgo);

  if (deleteError) {
    console.error('[cleanup] Failed to purge old trash:', deleteError.message);
  } else {
    result.purgedTrash = true;
  }

  // 2. Archive rejected leads older than 30 days
  const { error: archiveError } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString() })
    .eq('status', 'rejected')
    .is('archived_at', null)
    .lt('found_at', thirtyDaysAgo);

  if (archiveError) {
    console.error('[cleanup] Failed to archive old rejected leads:', archiveError.message);
  } else {
    result.archivedRejected = true;
  }

  // 3. Trim stored text (body > 4000 chars)
  try {
    const sel = supabase.from('leads').select('id, body') as unknown;
    const { data: longLeads } = typeof (sel as { limit?: (n: number) => Promise<{ data: unknown }> }).limit === 'function'
      ? await (sel as { limit: (n: number) => Promise<{ data: { id: string; body: string | null }[] | null }> }).limit(50)
      : await (sel as Promise<{ data: { id: string; body: string | null }[] | null }>);

    if (longLeads && Array.isArray(longLeads)) {
      for (const item of longLeads as { id: string; body: string | null }[]) {
        if (item.body && item.body.length > 4000) {
          await supabase
            .from('leads')
            .update({ body: item.body.slice(0, 4000) })
            .eq('id', item.id);
          result.trimmedCount++;
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cleanup] Failed to trim text:', msg);
  }

  // 4. Update last_cleanup_at
  const { error: settingsError } = await supabase
    .from('user_settings')
    .update({ last_cleanup_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (settingsError) {
    console.error('[cleanup] Failed to update last_cleanup_at:', settingsError.message);
  } else {
    result.updatedSettings = true;
  }

  console.log('[cleanup] Daily cleanup complete:', result);
  return result;
}
