import type { SupabaseClient } from '@supabase/supabase-js';
import type { SourceResult } from '@lead-finder/shared';

interface RunLogEntry {
  startedAt: Date;
  finishedAt: Date;
  found: number;
  inserted: number;
  scored: number;
  unscored: number;
  errors: number;
  sourceResults: SourceResult[];
  modelsUsed: Record<string, number>;
}

export async function writeRunLog(supabase: SupabaseClient, entry: RunLogEntry): Promise<void> {
  const { error } = await supabase.from('collector_runs').insert({
    started_at: entry.startedAt.toISOString(),
    finished_at: entry.finishedAt.toISOString(),
    found: entry.found,
    new: entry.inserted,
    scored: entry.scored,
    unscored: entry.unscored,
    errors: entry.errors,
    per_source_results: entry.sourceResults,
    models_used: entry.modelsUsed,
  });

  if (error) {
    console.error('[runlog] Failed to write run log:', error.message);
  }
}
