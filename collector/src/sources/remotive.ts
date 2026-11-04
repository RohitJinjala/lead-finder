import type { SupabaseClient } from '@supabase/supabase-js';
import { makeWebDedupeKey, type SourceResult, withRetry } from '@lead-finder/shared';
import { passesKeywordFilter, type FilterPlan } from '../keyword-filter.js';
import { getExistingDedupeKeys } from '../deduper.js';

const USER_AGENT = 'LeadFinder/1.0 (personal tool; contact via GitHub)';
const TIMEOUT_MS = 15_000;
const BODY_MAX = 4000;

const REMOTIVE_API = 'https://remotive.com/api/remote-jobs';

export interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  description: string;
  publication_date: string;
  tags: string[];
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export async function fetchRemotive(
  supabase: SupabaseClient,
  filterPlan: FilterPlan
): Promise<SourceResult> {
  const result: SourceResult = {
    source: 'remotive',
    fetched: 0,
    inserted: 0,
    skipped_dedupe: 0,
    skipped_filter: 0,
    errors: 0,
    error_message: null,
  };

  try {
    const data: RemotiveResponse = await withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(`${REMOTIVE_API}?limit=100`, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Remotive: HTTP ${response.status}`);
        return await response.json() as RemotiveResponse;
      } finally {
        clearTimeout(timer);
      }
    }, { maxAttempts: 3, baseDelayMs: 2000 });

    const jobs = data.jobs ?? [];
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

      const bodyRaw = job.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
      const body = bodyRaw.slice(0, BODY_MAX);

      if (!passesKeywordFilter(job.title, body, filterPlan)) {
        result.skipped_filter++;
        continue;
      }

      const { error } = await supabase.from('leads').insert({
        module: 'web',
        source: 'remotive',
        source_url: job.url,
        dedupe_key: dedupeKey,
        title: job.title.slice(0, 500),
        body,
        posted_at: job.publication_date ? new Date(job.publication_date).toISOString() : null,
        tags: job.tags ?? [],
        status: 'new',
        scored: false,
      });

      if (error) {
        if (error.code === '23505') result.skipped_dedupe++;
        else result.errors++;
      } else {
        result.inserted++;
      }
    }
  } catch (err) {
    result.errors++;
    result.error_message = err instanceof Error ? err.message : String(err);
    console.error('[remotive] Error:', result.error_message);
  }

  return result;
}

