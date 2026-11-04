import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Lead, LeadModule, LeadStatus } from '../types/lead';

export interface LeadFilters {
  module?: LeadModule | 'both' | undefined;
  tab?: 'all' | 'acceptable' | 'rejected' | 'trash' | undefined;
  status?: LeadStatus[] | undefined;
  scoreMin?: number | undefined;
  scoreMax?: number | undefined;
  source?: string | undefined;
  country?: string | undefined;
  tags?: string[] | undefined;
  unscored?: boolean | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export function useLeads(filters: LeadFilters = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('found_at', { ascending: false });

      // Tab filter
      if (filters.tab === 'trash') {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null).is('archived_at', null);
      }

      if (filters.tab === 'acceptable') {
        query = query.eq('status', 'acceptable');
      } else if (filters.tab === 'rejected') {
        query = query.eq('status', 'rejected');
      }

      // Module filter
      if (filters.module && filters.module !== 'both') {
        query = query.eq('module', filters.module);
      }

      // Score range
      if (filters.scoreMin !== undefined) {
        query = query.gte('score', filters.scoreMin);
      }
      if (filters.scoreMax !== undefined) {
        query = query.lte('score', filters.scoreMax);
      }

      // Country
      if (filters.country) {
        query = query.eq('country', filters.country);
      }

      // Unscored only
      if (filters.unscored) {
        query = query.eq('scored', false);
      }

      // Search (ID or text)
      if (filters.search) {
        const s = filters.search.trim();
        // Check if it looks like a lead code (DD-MM-SRC-NNNN)
        if (/^\d{2}-\d{2}-(WEB|MAP)-\d{4}$/i.test(s)) {
          query = query.eq('lead_code', s.toUpperCase());
        } else {
          query = query.or(`title.ilike.%${s}%,body.ilike.%${s}%`);
        }
      }

      // Date range
      if (filters.dateFrom) {
        query = query.gte('found_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('found_at', filters.dateTo);
      }

      const { data, error: dbError } = await query.limit(200);

      if (dbError) throw new Error(dbError.message);
      setLeads((data ?? []) as Lead[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [
    filters.module,
    filters.tab,
    filters.scoreMin,
    filters.scoreMax,
    filters.country,
    filters.unscored,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
  ]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}
