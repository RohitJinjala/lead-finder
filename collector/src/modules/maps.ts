import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectorSettings } from '../settings.js';
import type { SourceResult } from '@lead-finder/shared';
import { fetchOverpass } from '../sources/overpass.js';

interface ModuleResult {
  found: number;
  inserted: number;
  errors: number;
  sourceResults: SourceResult[];
}

export async function runMapsModule(
  supabase: SupabaseClient,
  settings: CollectorSettings
): Promise<ModuleResult> {
  console.log('[maps] Starting Maps module collection...');
  const result: ModuleResult = { found: 0, inserted: 0, errors: 0, sourceResults: [] };

  if (!settings.mapsApprovedPlanId) {
    console.log('[maps] No approved plan — skipping Maps module.');
    result.sourceResults.push({
      source: 'maps_module',
      fetched: 0,
      inserted: 0,
      skipped_dedupe: 0,
      skipped_filter: 0,
      errors: 1,
      error_message: 'No approved plan for Maps module',
    });
    return result;
  }

  try {
    const overpassResult = await fetchOverpass(supabase, settings.mapsApprovedPlanId);
    result.found += overpassResult.fetched;
    result.inserted += overpassResult.inserted;
    result.sourceResults.push(overpassResult);
  } catch (err) {
    result.errors++;
    console.error('[maps] Overpass error:', err instanceof Error ? err.message : String(err));
  }

  return result;
}

