import type { SupabaseClient } from '@supabase/supabase-js';
import { makeWebDedupeKey, type SourceResult, withRetry } from '@lead-finder/shared';
import { passesKeywordFilter, type FilterPlan } from '../keyword-filter.js';
import { getExistingDedupeKeys } from '../deduper.js';

const USER_AGENT = 'LeadFinder/1.0 (personal tool; contact via GitHub)';
const TIMEOUT_MS = 15_000;
const BODY_MAX = 4000;

// HN Algolia API — public, no auth required
// Terms: https://hn.algolia.com/api (open API, no scraping restrictions)
const HN_API_BASE = 'https://hn.algolia.com/api/v1';

export interface HNHit {
  objectID: string;
  title: string;
  story_text: string | null;
  url: string | null;
  created_at: string;
  _tags: string[];
}

interface HNSearchResult {
  hits: HNHit[];
  nbHits: number;
}

async function searchHN(query: string): Promise<HNHit[]> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const params = new URLSearchParams({
        query,
        tags: 'ask_hn',
        hitsPerPage: '100',
      });
      const response = await fetch(`${HN_API_BASE}/search_by_date?${params}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HN API: HTTP ${response.status}`);
      const data = await response.json() as HNSearchResult;
      return data.hits ?? [];
    } finally {
      clearTimeout(timer);
    }
  }, { maxAttempts: 3, baseDelayMs: 2000 });
}

export async function fetchHackerNews(
  supabase: SupabaseClient,
  filterPlan: FilterPlan
): Promise<SourceResult> {
  const result: SourceResult = {
    source: 'hackernews',
    fetched: 0,
    inserted: 0,
    skipped_dedupe: 0,
    skipped_filter: 0,
    errors: 0,
    error_message: null,
  };

  try {
    const queries = ['who is hiring', 'seeking freelancer', 'freelancer'];
    const allHits: HNHit[] = [];

    for (const query of queries) {
      const hits = await searchHN(query);
      allHits.push(...hits);
    }

    const seen = new Set<string>();
    const hits = allHits.filter((h) => {
      if (seen.has(h.objectID)) return false;
      seen.add(h.objectID);
      return true;
    });

    result.fetched = hits.length;

    const dedupeKeys = hits.map((h) => makeWebDedupeKey(`https://news.ycombinator.com/item?id=${h.objectID}`));
    const existing = await getExistingDedupeKeys(supabase, dedupeKeys);

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (!hit) continue;
      const dedupeKey = dedupeKeys[i];
      if (!dedupeKey) continue;

      if (existing.has(dedupeKey)) {
        result.skipped_dedupe++;
        continue;
      }

      const body = (hit.story_text ?? '').slice(0, BODY_MAX);
      const title = hit.title ?? '';
      const sourceUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;

      if (!passesKeywordFilter(title, body, filterPlan)) {
        result.skipped_filter++;
        continue;
      }

      const { error } = await supabase.from('leads').insert({
        module: 'web',
        source: 'hackernews',
        source_url: sourceUrl,
        dedupe_key: dedupeKey,
        title: title.slice(0, 500),
        body: body,
        posted_at: hit.created_at,
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
    console.error('[hackernews] Error:', result.error_message);
  }

  return result;
}

