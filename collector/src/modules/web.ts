import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectorSettings } from '../settings.js';
import type { SourceResult } from '@lead-finder/shared';
import { fetchRedditRSS } from '../sources/reddit.js';
import { fetchHackerNews } from '../sources/hackernews.js';
import { fetchRemoteOK } from '../sources/remoteok.js';
import { fetchWeWorkRemotely } from '../sources/weworkremotely.js';
import { fetchRemotive } from '../sources/remotive.js';

interface ModuleResult {
  found: number;
  inserted: number;
  errors: number;
  sourceResults: SourceResult[];
}

export async function runWebModule(
  supabase: SupabaseClient,
  settings: CollectorSettings
): Promise<ModuleResult> {
  console.log('[web] Starting Web module collection...');
  const result: ModuleResult = { found: 0, inserted: 0, errors: 0, sourceResults: [] };

  if (!settings.webApprovedPlanId) {
    console.log('[web] No approved plan — skipping Web module.');
    result.sourceResults.push({
      source: 'web_module',
      fetched: 0,
      inserted: 0,
      skipped_dedupe: 0,
      skipped_filter: 0,
      errors: 1,
      error_message: 'No approved plan for Web module',
    });
    return result;
  }

  // Load approved plan
  const { data: plan } = await supabase
    .from('search_plans')
    .select('plan')
    .eq('id', settings.webApprovedPlanId)
    .single();

  const planData = plan?.plan as {
    keywords?: string[];
    exclusions?: string[];
    subreddits?: string[];
  } | null;

  const sources = [
    () => fetchRedditRSS(supabase, planData?.subreddits ?? ['forhire', 'hiring', 'freelance'], {
      keywords: planData?.keywords ?? [],
      exclusions: planData?.exclusions ?? [],
    }),
    () => fetchHackerNews(supabase, {
      keywords: planData?.keywords ?? [],
      exclusions: planData?.exclusions ?? [],
    }),
    () => fetchRemoteOK(supabase, {
      keywords: planData?.keywords ?? [],
      exclusions: planData?.exclusions ?? [],
    }),
    () => fetchWeWorkRemotely(supabase, {
      keywords: planData?.keywords ?? [],
      exclusions: planData?.exclusions ?? [],
    }),
    () => fetchRemotive(supabase, {
      keywords: planData?.keywords ?? [],
      exclusions: planData?.exclusions ?? [],
    }),
  ];

  for (const fetchFn of sources) {
    try {
      const sourceResult = await fetchFn();
      result.found += sourceResult.fetched;
      result.inserted += sourceResult.inserted;
      result.sourceResults.push(sourceResult);
    } catch (err) {
      result.errors++;
      console.error('[web] Source error:', err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

