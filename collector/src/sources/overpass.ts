import type { SupabaseClient } from '@supabase/supabase-js';
import { makeMapsDedupeKey, type SourceResult, withRetry, sleep } from '@lead-finder/shared';
import { getExistingDedupeKeys } from '../deduper.js';

const USER_AGENT = 'LeadFinder/1.0 (personal tool; contact via GitHub)';
const TIMEOUT_MS = 60_000;
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const BODY_MAX = 4000;

export const BUSINESS_TAGS = [
  'amenity=restaurant',
  'amenity=cafe',
  'amenity=fast_food',
  'amenity=clinic',
  'amenity=dentist',
  'amenity=hospital',
  'amenity=gym',
  'amenity=school',
  'amenity=college',
  'amenity=beauty',
  'shop=hairdresser',
  'shop=beauty',
  'shop=clothes',
  'shop=bakery',
  'shop=butcher',
  'craft=*',
];

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export function hasNoWebsite(tags: Record<string, string>): 'none' | 'social_only' | null {
  const website = tags['website'] ?? tags['contact:website'] ?? '';
  const facebook = tags['contact:facebook'] ?? tags['facebook'] ?? '';
  const instagram = tags['contact:instagram'] ?? tags['instagram'] ?? '';

  if (!website) {
    if (facebook || instagram) return 'social_only';
    return 'none';
  }

  if (website.includes('facebook.com') || website.includes('instagram.com')) {
    return 'social_only';
  }

  return null;
}

export function extractPhone(tags: Record<string, string>): string | null {
  return tags['phone'] ?? tags['contact:phone'] ?? tags['mobile'] ?? null;
}

export function extractSocialLinks(tags: Record<string, string>): Record<string, string> {
  const links: Record<string, string> = {};
  if (tags['contact:facebook'] ?? tags['facebook']) links['facebook'] = tags['contact:facebook'] ?? tags['facebook'] ?? '';
  if (tags['contact:instagram'] ?? tags['instagram']) links['instagram'] = tags['contact:instagram'] ?? tags['instagram'] ?? '';
  if (tags['contact:twitter'] ?? tags['twitter']) links['twitter'] = tags['contact:twitter'] ?? tags['twitter'] ?? '';
  return links;
}

export function inferNiche(tags: Record<string, string>): string {
  const amenity = tags['amenity'] ?? '';
  const shop = tags['shop'] ?? '';
  const craft = tags['craft'] ?? '';

  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') return 'restaurant_cafe';
  if (amenity === 'clinic' || amenity === 'dentist') return 'clinic_dentist';
  if (amenity === 'hospital') return 'hospital';
  if (amenity === 'gym') return 'gym';
  if (amenity === 'school' || amenity === 'college') return 'school_coaching';
  if (amenity === 'beauty' || shop === 'hairdresser' || shop === 'beauty') return 'salon';
  if (shop) return `shop:${shop}`;
  if (craft) return `craft:${craft}`;
  return 'other';
}

export async function fetchOverpass(
  supabase: SupabaseClient,
  _approvedPlanId: string
): Promise<SourceResult> {
  const result: SourceResult = {
    source: 'overpass',
    fetched: 0,
    inserted: 0,
    skipped_dedupe: 0,
    skipped_filter: 0,
    errors: 0,
    error_message: null,
  };

  try {
    const { data: presets } = await supabase
      .from('search_presets')
      .select('id, countries, states, cities, niches')
      .order('last_searched_at', { ascending: true, nullsFirst: true })
      .limit(1);

    const preset = presets?.[0];
    if (!preset) {
      result.error_message = 'No search presets configured';
      return result;
    }

    const cities = (preset.cities as string[]) ?? [];
    const city = cities[0];
    if (!city) {
      result.error_message = 'No cities in search preset';
      return result;
    }

    const tagFilters = BUSINESS_TAGS.map((tag) => {
      if (tag.endsWith('*')) {
        const key = tag.slice(0, -2);
        return `node["${key}"](area.searchArea);\nway["${key}"](area.searchArea);`;
      }
      const [key, value] = tag.split('=');
      return `node["${key}"="${value}"](area.searchArea);\nway["${key}"="${value}"](area.searchArea);`;
    }).join('\n');

    const query = `
[out:json][timeout:60];
area["name"="${city}"]["place"~"city|town|village"]->.searchArea;
(
${tagFilters}
);
out center tags 200;
`;

    const data: OverpassResponse = await withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(OVERPASS_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        if (response.status === 429 || response.status === 504) {
          await sleep(60_000);
          throw new Error(`Overpass: HTTP ${response.status}`);
        }
        if (!response.ok) throw new Error(`Overpass: HTTP ${response.status}`);
        return await response.json() as OverpassResponse;
      } finally {
        clearTimeout(timer);
      }
    }, { maxAttempts: 2, baseDelayMs: 60_000 });

    const elements = data.elements ?? [];
    result.fetched = elements.length;

    const eligibleElements = elements.filter((el) => {
      const tags = el.tags ?? {};
      const name = tags['name'];
      if (!name) return false;
      return hasNoWebsite(tags) !== null;
    });

    const dedupeKeys = eligibleElements.map((el) => makeMapsDedupeKey(el.type, String(el.id)));
    const existing = await getExistingDedupeKeys(supabase, dedupeKeys);

    for (let i = 0; i < eligibleElements.length; i++) {
      const el = eligibleElements[i];
      if (!el) continue;
      const dedupeKey = dedupeKeys[i];
      if (!dedupeKey) continue;

      if (existing.has(dedupeKey)) {
        result.skipped_dedupe++;
        continue;
      }

      const tags = el.tags ?? {};
      const websiteStatus = hasNoWebsite(tags);
      if (!websiteStatus) continue;

      const phone = extractPhone(tags);
      const socialLinks = extractSocialLinks(tags);
      const niche = inferNiche(tags);
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const name = tags['name'] ?? '';

      const whatsappUrl = phone
        ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}`
        : null;

      const body = [
        `Business: ${name}`,
        `Niche: ${niche}`,
        tags['addr:city'] ? `City: ${tags['addr:city']}` : '',
        tags['addr:state'] ? `State: ${tags['addr:state']}` : '',
        phone ? `Phone: ${phone}` : '',
        websiteStatus === 'social_only' ? 'Only has social media presence' : 'No online presence found',
      ].filter(Boolean).join('\n').slice(0, BODY_MAX);

      const { error } = await supabase.from('leads').insert({
        module: 'maps',
        source: 'openstreetmap',
        source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        dedupe_key: dedupeKey,
        title: name.slice(0, 500),
        body,
        posted_at: null,
        status: 'new',
        scored: false,
        business_name: name,
        niche,
        city: tags['addr:city'] ?? city,
        state: tags['addr:state'] ?? null,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || null,
        phone,
        whatsapp_url: whatsappUrl,
        website_status: websiteStatus,
        social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
        osm_type: el.type,
        osm_id: String(el.id),
        lat: lat ?? null,
        lon: lon ?? null,
        country: preset.countries?.[0] ?? null,
      });

      if (error) {
        if (error.code === '23505') result.skipped_dedupe++;
        else {
          result.errors++;
          console.error('[overpass] Insert error:', error.message);
        }
      } else {
        result.inserted++;
      }
    }

    await supabase
      .from('search_presets')
      .update({ last_searched_at: new Date().toISOString() })
      .eq('id', preset.id);

  } catch (err) {
    result.errors++;
    result.error_message = err instanceof Error ? err.message : String(err);
    console.error('[overpass] Error:', result.error_message);
  }

  return result;
}

