export type LeadModule = 'web' | 'maps';

export type LeadStatus =
  | 'new'
  | 'acceptable'
  | 'rejected'
  | 'contacted'
  | 'replied'
  | 'won'
  | 'lost';

export type BudgetSignal = 'stated' | 'hinted' | 'none';

export type WebsiteStatus = 'none' | 'social_only';

export interface Lead {
  id: string;
  lead_code: string;
  module: LeadModule;
  source: string;
  source_url: string;
  dedupe_key: string;
  title: string;
  body: string;
  found_at: string;
  posted_at: string | null;
  status: LeadStatus;
  reject_reason: string | null;
  scored: boolean;
  score: number | null;
  reason: string | null;
  tags: string[];
  service_match: string | null;
  tech_stack: string[];
  budget_signal: BudgetSignal | null;
  budget_amount: number | null;
  currency: string | null;
  country: string | null;
  timezone: string | null;
  red_flags: string[];
  draft_line: string | null;
  scored_by: string | null;
  scored_provider: string | null;
  is_fallback: boolean;
  prompt_version: string | null;
  search_profile_id: string | null;
  notes: string | null;
  contacted_at: string | null;
  follow_up_at: string | null;
  deleted_at: string | null;
  archived_at: string | null;
  // Maps-specific fields
  business_name: string | null;
  niche: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  whatsapp_url: string | null;
  website_status: WebsiteStatus | null;
  social_links: Record<string, string> | null;
  osm_type: string | null;
  osm_id: string | null;
  place_id: string | null;
  lat: number | null;
  lon: number | null;
  suggested_offer: string | null;
  verified_no_website: boolean;
}

export interface Deal {
  id: string;
  lead_id: string;
  deal_code: string;
  client: string;
  project: string;
  value: number | null;
  currency: string | null;
  start_date: string | null;
  deadline: string | null;
  payment_status: 'unpaid' | 'partial' | 'paid';
  state: 'live' | 'completed';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

