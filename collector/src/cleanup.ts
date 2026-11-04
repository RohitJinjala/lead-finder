import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Daily cleanup:
 * 1. Purge trash older than 30 days (deleted_at set)
 * 2. Archive rejected leads older than 30 days
 * 3. Trim stored text (body > 4000 chars)
 * 4. Update last_cleanup_at in user_settings
 */
export async function runDailyCleanup(supabase: SupabaseClient): Promise<void> {
  console.log('[cleanup] Running daily cleanup...');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Hard-delete trash older than 30 days
  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', thirtyDaysAgo);

  if (deleteError) {
    console.error('[cleanup] Failed to purge old trash:', deleteError.message);
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
  }

  // 3. Update last_cleanup_at
  const { error: settingsError } = await supabase
    .from('user_settings')
    .update({ last_cleanup_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update single row

  if (settingsError) {
    console.error('[cleanup] Failed to update last_cleanup_at:', settingsError.message);
  }

  console.log('[cleanup] Daily cleanup complete.');
}
