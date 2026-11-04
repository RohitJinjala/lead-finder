import { z } from 'zod';

// ─── Scoring output schema ────────────────────────────────────────────────────

export const BudgetSignalSchema = z.enum(['stated', 'hinted', 'none']);
export type BudgetSignal = z.infer<typeof BudgetSignalSchema>;

export const RedFlagSchema = z.enum([
  'free_work',
  'test_project',
  'vague',
  'unrealistic_budget',
  'full_time_job_ad',
  'agency',
]);
export type RedFlag = z.infer<typeof RedFlagSchema>;

export const ScoringOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1).max(500),
  tags: z.array(z.string()),
  service_match: z.string(),
  tech_stack: z.array(z.string()),
  budget_signal: BudgetSignalSchema,
  budget_amount: z.number().nullable(),
  currency: z.string().nullable(),
  country: z.string().nullable(),
  red_flags: z.array(RedFlagSchema),
  draft_line: z.string().max(300),
}).strict(); // reject extra fields

export type ScoringOutput = z.infer<typeof ScoringOutputSchema>;

// ─── Model chain entry ────────────────────────────────────────────────────────

export const ModelEntrySchema = z.object({
  id: z.string().uuid(),
  module: z.enum(['web', 'maps']),
  name: z.string(),
  provider: z.string(),
  base_url: z.string().url(),
  model_id: z.string(),
  secret_name: z.string(),
  priority: z.number().int().min(0),
  enabled: z.boolean(),
  daily_limit: z.number().int().positive().nullable(),
  reset_tz: z.string(),
  reset_hour: z.number().int().min(0).max(23),
});
export type ModelEntry = z.infer<typeof ModelEntrySchema>;

// ─── Model status ─────────────────────────────────────────────────────────────

export const ModelStatusValueSchema = z.enum([
  'available',
  'cooling_down',
  'limit_reached',
  'invalid_key',
  'disabled',
]);
export type ModelStatusValue = z.infer<typeof ModelStatusValueSchema>;

export const ModelStatusSchema = z.object({
  model_id: z.string().uuid(),
  status: ModelStatusValueSchema,
  requests_today: z.number().int().min(0),
  errors_today: z.number().int().min(0),
  leads_scored_today: z.number().int().min(0),
  limit_hit_at: z.string().nullable(),
  resets_at: z.string().nullable(),
  last_error: z.string().nullable(),
  consecutive_failures: z.number().int().min(0),
  updated_at: z.string(),
});
export type ModelStatus = z.infer<typeof ModelStatusSchema>;

// ─── Lead insert schema ───────────────────────────────────────────────────────

export const NormalizedLeadSchema = z.object({
  module: z.enum(['web', 'maps']),
  source: z.string(),
  source_url: z.string().url(),
  dedupe_key: z.string(),
  title: z.string(),
  body: z.string().max(4000),
  posted_at: z.string().datetime().nullable(),
  // Web-specific
  country: z.string().nullable().optional(),
  // Maps-specific
  business_name: z.string().optional(),
  niche: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().nullable().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  osm_type: z.string().optional(),
  osm_id: z.string().optional(),
  website_status: z.enum(['none', 'social_only']).optional(),
  social_links: z.record(z.string()).optional(),
  search_profile_id: z.string().uuid().optional(),
});
export type NormalizedLead = z.infer<typeof NormalizedLeadSchema>;

// ─── Collector run result ─────────────────────────────────────────────────────

export const SourceResultSchema = z.object({
  source: z.string(),
  fetched: z.number(),
  inserted: z.number(),
  skipped_dedupe: z.number(),
  skipped_filter: z.number(),
  errors: z.number(),
  error_message: z.string().nullable(),
});
export type SourceResult = z.infer<typeof SourceResultSchema>;
