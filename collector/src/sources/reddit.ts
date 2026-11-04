import type { SupabaseClient } from '@supabase/supabase-js';
import { makeWebDedupeKey, type SourceResult, withRetry } from '@lead-finder/shared';
import { passesKeywordFilter, type FilterPlan } from '../keyword-filter.js';
import { getExistingDedupeKeys } from '../deduper.js';

const USER_AGENT = 'LeadFinder/1.0 (personal tool; contact via GitHub)';
const TIMEOUT_MS = 15_000;
const BODY_MAX = 4000;

interface RedditRSSItem {
  title: string;
  link: string;
  content: string;
  pubDate: string;
}

export function parseRedditRSS(xml: string): RedditRSSItem[] {
  const items: RedditRSSItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const itemXml = match[1] ?? '';

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const content = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded') || '';
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        link,
        content: cleanText(content).slice(0, BODY_MAX),
        pubDate,
      });
    }
  }

  return items;
}

function cleanText(text: string): string {
  // Decode entities first in case HTML tags are escaped (&lt;p&gt;)
  const decoded = decodeHtmlEntities(text);
  // Strip HTML tags
  const stripped = stripHtml(decoded);
  // Decode any nested entities
  return decodeHtmlEntities(stripped);
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1] ?? match?.[2] ?? '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function fetchRedditRSS(
  supabase: SupabaseClient,
  subreddits: string[],
  filterPlan: FilterPlan
): Promise<SourceResult> {
  const result: SourceResult = {
    source: 'reddit',
    fetched: 0,
    inserted: 0,
    skipped_dedupe: 0,
    skipped_filter: 0,
    errors: 0,
    error_message: null,
  };

  for (const subreddit of subreddits) {
    try {
      const xml = await withRetry(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetch(
            `https://www.reddit.com/r/${subreddit}/new.rss?limit=100`,
            {
              headers: { 'User-Agent': USER_AGENT },
              signal: controller.signal,
            }
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.text();
        } finally {
          clearTimeout(timer);
        }
      }, { maxAttempts: 3, baseDelayMs: 2000 });

      const items = parseRedditRSS(xml);
      result.fetched += items.length;

      // Check dedupe keys in batch
      const dedupeKeys = items.map((item) => makeWebDedupeKey(item.link));
      const existing = await getExistingDedupeKeys(supabase, dedupeKeys);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const dedupeKey = dedupeKeys[i];
        if (!dedupeKey) continue;

        if (existing.has(dedupeKey)) {
          result.skipped_dedupe++;
          continue;
        }

        if (!passesKeywordFilter(item.title, item.content, filterPlan)) {
          result.skipped_filter++;
          continue;
        }

        const { error } = await supabase.from('leads').insert({
          module: 'web',
          source: `reddit:r/${subreddit}`,
          source_url: item.link,
          dedupe_key: dedupeKey,
          title: item.title.slice(0, 500),
          body: item.content.slice(0, BODY_MAX),
          posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          status: 'new',
          scored: false,
        });

        if (error) {
          if (error.code === '23505') {
            result.skipped_dedupe++; // unique constraint
          } else {
            result.errors++;
            console.error('[reddit] Insert error:', error.message);
          }
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      result.errors++;
      result.error_message = err instanceof Error ? err.message : String(err);
      console.error(`[reddit] Error fetching r/${subreddit}:`, result.error_message);
    }
  }

  return result;
}

