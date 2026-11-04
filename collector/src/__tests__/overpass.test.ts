import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasNoWebsite,
  extractPhone,
  extractSocialLinks,
  inferNiche,
  fetchOverpass,
} from '../sources/overpass.js';

describe('Overpass OSM Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Website Status Filtering', () => {
    it('returns null for businesses with their own website', () => {
      expect(hasNoWebsite({ website: 'https://premierdentalcare.com' })).toBeNull();
      expect(hasNoWebsite({ 'contact:website': 'http://www.citybakeshop.co.uk' })).toBeNull();
    });

    it('returns "none" for businesses without website or social links', () => {
      expect(hasNoWebsite({ name: 'Bob\'s Barber Shop' })).toBe('none');
      expect(hasNoWebsite({ name: 'Quick Fix Auto', phone: '+1234567890' })).toBe('none');
    });

    it('returns "social_only" if website points to facebook or instagram', () => {
      expect(hasNoWebsite({ website: 'https://www.facebook.com/bobsbarbershop' })).toBe('social_only');
      expect(hasNoWebsite({ website: 'https://instagram.com/sweetdelightsbakery' })).toBe('social_only');
    });

    it('returns "social_only" if no website tag but contact:facebook or instagram exists', () => {
      expect(hasNoWebsite({ 'contact:facebook': 'https://facebook.com/localgym' })).toBe('social_only');
      expect(hasNoWebsite({ instagram: 'hairsalon_nyc' })).toBe('social_only');
    });
  });

  describe('Phone Extraction', () => {
    it('extracts phone from phone, contact:phone, or mobile', () => {
      expect(extractPhone({ phone: '+1-555-0199' })).toBe('+1-555-0199');
      expect(extractPhone({ 'contact:phone': '+44 20 7946 0991' })).toBe('+44 20 7946 0991');
      expect(extractPhone({ mobile: '0987654321' })).toBe('0987654321');
      expect(extractPhone({})).toBeNull();
    });
  });

  describe('Social Links Extraction', () => {
    it('extracts facebook, instagram, and twitter links', () => {
      const tags = {
        'contact:facebook': 'https://facebook.com/sample',
        instagram: 'sample_insta',
        twitter: '@sample_biz',
      };
      const links = extractSocialLinks(tags);
      expect(links.facebook).toBe('https://facebook.com/sample');
      expect(links.instagram).toBe('sample_insta');
      expect(links.twitter).toBe('@sample_biz');
    });
  });

  describe('Niche Inference', () => {
    it('infers proper niche categories from OSM tags', () => {
      expect(inferNiche({ amenity: 'restaurant' })).toBe('restaurant_cafe');
      expect(inferNiche({ amenity: 'cafe' })).toBe('restaurant_cafe');
      expect(inferNiche({ amenity: 'dentist' })).toBe('clinic_dentist');
      expect(inferNiche({ amenity: 'clinic' })).toBe('clinic_dentist');
      expect(inferNiche({ amenity: 'gym' })).toBe('gym');
      expect(inferNiche({ amenity: 'school' })).toBe('school_coaching');
      expect(inferNiche({ shop: 'hairdresser' })).toBe('salon');
      expect(inferNiche({ shop: 'beauty' })).toBe('salon');
      expect(inferNiche({ shop: 'bakery' })).toBe('shop:bakery');
    });
  });

  describe('fetchOverpass runner', () => {
    it('processes eligible businesses without website, skipping those with website', async () => {
      const mockElements = [
        {
          type: 'node',
          id: 101,
          lat: 40.7128,
          lon: -74.006,
          tags: {
            name: 'City Dental Clinic',
            amenity: 'dentist',
            phone: '+1-212-555-0100',
            'addr:city': 'New York',
          },
        },
        {
          type: 'node',
          id: 102,
          lat: 40.7138,
          lon: -74.007,
          tags: {
            name: 'Fancy Restaurant with Site',
            amenity: 'restaurant',
            website: 'https://fancyrestaurant.com',
          },
        },
        {
          type: 'way',
          id: 202,
          tags: {
            name: 'Urban Fitness Studio',
            amenity: 'gym',
            'contact:facebook': 'https://facebook.com/urbanfitness',
          },
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ elements: mockElements }),
      } as Response);

      const insertedRows: Array<Record<string, unknown>> = [];

      const mockSupabase = {
        from: (table: string) => {
          if (table === 'search_presets') {
            return {
              select: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [{ id: 'preset-1', countries: ['US'], cities: ['New York'], states: ['NY'], niches: ['gym', 'dentist'] }],
                    error: null,
                  }),
                }),
              }),
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          }
          if (table === 'leads') {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [], error: null }),
              }),
              insert: (row: Record<string, unknown>) => {
                insertedRows.push(row);
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      } as unknown as import('@supabase/supabase-js').SupabaseClient;

      const result = await fetchOverpass(mockSupabase, 'plan-maps-1');

      expect(result.fetched).toBe(3);
      // Item 101 (dentist, no website) & Item 202 (gym, social only) should be inserted.
      // Item 102 (restaurant with website) should be filtered out.
      expect(result.inserted).toBe(2);
      expect(insertedRows.length).toBe(2);

      const dentalLead = insertedRows.find((r) => r.osm_id === '101');
      expect(dentalLead).toBeTruthy();
      expect(dentalLead?.website_status).toBe('none');
      expect(dentalLead?.whatsapp_url).toBe('https://wa.me/12125550100');
      expect(dentalLead?.module).toBe('maps');
      expect(dentalLead?.source).toBe('openstreetmap');

      const gymLead = insertedRows.find((r) => r.osm_id === '202');
      expect(gymLead).toBeTruthy();
      expect(gymLead?.website_status).toBe('social_only');
    });
  });
});

