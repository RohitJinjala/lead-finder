import type { SupabaseClient } from '@supabase/supabase-js';
import { makeWebDedupeKey, type SourceResult, withRetry } from '@lead-finder/shared';
import { passesKeywordFilter, type FilterPlan } from '../keyword-filter.js';
import { getExistingDedupeKeys } from '../deduper.js';

const USER_AGENT = 'LeadFinder/1.0 (personal tool; contact via GitHub)';
const TIMEOUT_MS = 15_000;
const BODY_MAX = 4000;

const REMOTEOK_API = 'https://remoteok.com/api';

export interface RemoteOKJob {
  id: string;
  url: string;
  position: string;
  description: string;
  date: string;
  tags: string[];
}

export async function fetchRemoteOK(
  supabase: SupabaseClient,
  filterPlan: FilterPlan
): Promise<SourceResult> {
  const result: SourceResult = {
    source: 'remoteok',
    fetched: 0,
    inserted: 0,
    skipped_dedupe: 0,
    skipped_filter: 0,
    errors: 0,
    error_message: null,
  };

  try {
    const jobs: RemoteOKJob[] = await withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(REMOTEOK_API, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`RemoteOK: HTTP ${response.status}`);
        const data = await response.json() as RemoteOKJob[];
        return Array.isArray(data) ? data.slice(1) : [];
      } finally {
        clearTimeout(timer);
      }
    }, { maxAttempts: 3, baseDelayMs: 3000 });

    result.fetched = jobs.length;

    const dedupeKeys = jobs.map((j) => makeWebDedupeKey(j.url));
    const existing = await getExistingDedupeKeys(supabase, dedupeKeys);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!job) continue;
      const dedupeKey = dedupeKeys[i];
      if (!dedupeKey) continue;

      if (existing.has(dedupeKey)) {
        result.skipped_dedupe++;
        continue;
      }

      const body = (job.description ?? '').slice(0, BODY_MAX);
      const title = job.position ?? '';

      if (!passesKeywordFilter(title, body, filterPlan)) {
        result.skipped_filter++;
        continue;
      }

      const { error } = await supabase.from('leads').insert({
        module: 'web',
        source: 'remoteok',
        source_url: job.url,
        dedupe_key: dedupeKey,
        title: title.slice(0, 500),
        body,
        posted_at: job.date ? new Date(job.date).toISOString() : null,
        tags: job.tags ?? [],
        status: 'new',
        scored: false,
      });

      if (error) {
        if (error.code === '23505') {
          result.skipped_dedupe++;
        } else {
          result.errors++;
        }
      } else {
        result.inserted++;
      }
    }
  } catch (err) {
    result.errors++;
    result.error_message = err instanceof Error ? err.message : String(err);
    console.error('[remoteok] Error:', result.error_message);
  }

  return result;
}

