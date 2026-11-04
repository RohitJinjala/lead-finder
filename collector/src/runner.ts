import type { SupabaseClient } from '@supabase/supabase-js';
import { acquireLease, releaseLease } from './lease.js';
import { loadSettings } from './settings.js';
import { runWebModule } from './modules/web.js';
import { runMapsModule } from './modules/maps.js';
import { scoreUnscored } from './scorer.js';
import { sendAlerts } from './alerts.js';
import { runDailyCleanup } from './cleanup.js';
import { writeRunLog } from './runlog.js';
import type { SourceResult } from '@lead-finder/shared';

export interface CollectorRunResult {
  found: number;
  inserted: number;
  scored: number;
  unscored: number;
  errors: number;
  sourceResults: SourceResult[];
  modelsUsed: Record<string, number>;
}

export async function runCollector(supabase: SupabaseClient): Promise<void> {
  const startedAt = new Date();
  console.log(`[collector] Starting run at ${startedAt.toISOString()}`);

  // Step 1: Acquire lease
  const leaseAcquired = await acquireLease(supabase);
  if (!leaseAcquired) {
    console.log('[collector] Another run is active. Exiting.');
    return;
  }

  let result: CollectorRunResult = {
    found: 0,
    inserted: 0,
    scored: 0,
    unscored: 0,
    errors: 0,
    sourceResults: [],
    modelsUsed: {},
  };

  try {
    // Step 2: Load settings
    const settings = await loadSettings(supabase);
    console.log(`[collector] Modules enabled: web=${settings.webEnabled}, maps=${settings.mapsEnabled}`);

    // Step 3: Run enabled modules
    if (settings.webEnabled) {
      const webResult = await runWebModule(supabase, settings);
      result.found += webResult.found;
      result.inserted += webResult.inserted;
      result.errors += webResult.errors;
      result.sourceResults.push(...webResult.sourceResults);
    }

    if (settings.mapsEnabled) {
      const mapsResult = await runMapsModule(supabase, settings);
      result.found += mapsResult.found;
      result.inserted += mapsResult.inserted;
      result.errors += mapsResult.errors;
      result.sourceResults.push(...mapsResult.sourceResults);
    }

    // Step 4: Score unscored leads
    const scoringResult = await scoreUnscored(supabase, settings);
    result.scored = scoringResult.scored;
    result.unscored = scoringResult.unscored;
    result.modelsUsed = scoringResult.modelsUsed;

    // Step 6: Send alerts
    await sendAlerts(supabase, settings, scoringResult.highScoreLeadIds);

    // Step 7: Daily cleanup
    if (settings.cleanupDue) {
      await runDailyCleanup(supabase);
    }
  } catch (err) {
    result.errors++;
    console.error('[collector] Unexpected error in run:', err instanceof Error ? err.message : String(err));
  } finally {
    // Step 8: Write run log and release lease
    const finishedAt = new Date();
    await writeRunLog(supabase, {
      startedAt,
      finishedAt,
      ...result,
    });
    await releaseLease(supabase);
    console.log(`[collector] Run finished at ${finishedAt.toISOString()}`);
  }
}
