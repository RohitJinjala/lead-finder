import type { SupabaseClient } from '@supabase/supabase-js';
import { makeWebDedupeKey, type SourceResult, withRetry } from '@lead-finder/shared';
import { passesKeywordFilter, type FilterPlan } from '../keyword-filter.js';
import { getExistingDedupeKeys } from '../deduper.js';

const USER_AGENT = 'LeadFinder/1.0 (personal tool; contact via GitHub)';
const TIMEOUT_MS = 15_000;
const BODY_MAX = 4000;

const WWR_FEEDS = [
  'https://weworkremotely.com/remote-jobs.rss',
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
];

export function parseRSSItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const itemXml = match[1] ?? '';
    const title = extractCDATA(itemXml, 'title') || extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    const description = extractCDATA(itemXml, 'description') || extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link) {
      items.push({
        title: decodeEntities(title),
        link: link.trim(),
        description: decodeEntities(stripHtml(description)).slice(0, BODY_MAX),
        pubDate,
      });
    }
  }

  return items;
}

function extractCDATA(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  return match?.[1] ?? '';
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1] ?? '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ');
}

export async function fetchWeWorkRemotely(
  supabase: SupabaseClient,
  filterPlan: FilterPlan
): Promise<SourceResult> {
  const result: SourceResult = {
    source: 'weworkremotely',
    fetched: 0,
    inserted: 0,
    skipped_dedupe: 0,
    skipped_filter: 0,
    errors: 0,
    error_message: null,
  };

  for (const feedUrl of WWR_FEEDS) {
    try {
      const xml = await withRetry(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetch(feedUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`WWR: HTTP ${response.status}`);
          return await response.text();
        } finally {
          clearTimeout(timer);
        }
      }, { maxAttempts: 3, baseDelayMs: 2000 });

      const items = parseRSSItems(xml);
      result.fetched += items.length;

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

        if (!passesKeywordFilter(item.title, item.description, filterPlan)) {
          result.skipped_filter++;
          continue;
        }

        const { error } = await supabase.from('leads').insert({
          module: 'web',
          source: 'weworkremotely',
          source_url: item.link,
          dedupe_key: dedupeKey,
          title: item.title.slice(0, 500),
          body: item.description,
          posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
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
      console.error(`[weworkremotely] Error fetching ${feedUrl}:`, result.error_message);
    }
  }

  return result;
}

