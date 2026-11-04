import type { SupabaseClient } from '@supabase/supabase-js';

export interface CollectorSettings {
  webEnabled: boolean;
  mapsEnabled: boolean;
  scoringCapPerRun: number;
  alertThreshold: number;
  quietHoursStart: number | null; // hour in Kolkata time (0-23)
  quietHoursEnd: number | null;
  cleanupDue: boolean;
  webApprovedPlanId: string | null;
  mapsApprovedPlanId: string | null;
}

export async function loadSettings(supabase: SupabaseClient): Promise<CollectorSettings> {
  // Load user_settings
  const { data: userSettings, error: userError } = await supabase
    .from('user_settings')
    .select('*')
    .single();

  if (userError) {
    console.warn('[settings] Could not load user settings, using defaults:', userError.message);
  }

  // Load approved plans (most recent approved version per module)
  const { data: plans } = await supabase
    .from('search_plans')
    .select('id, profile_id, version, approved, search_profiles(module)')
    .eq('approved', true)
    .order('version', { ascending: false });

  const webPlan = plans?.find((p) => (p.search_profiles as unknown as { module: string } | null)?.module === 'web') ?? null;
  const mapsPlan = plans?.find((p) => (p.search_profiles as unknown as { module: string } | null)?.module === 'maps') ?? null;

  // Check if daily cleanup is due (last_cleanup_at was more than 20 hours ago)
  const lastCleanup = userSettings?.['last_cleanup_at'] as string | null;
  const cleanupDue = !lastCleanup ||
    (Date.now() - new Date(lastCleanup).getTime()) > 20 * 60 * 60 * 1000;

  return {
    webEnabled: userSettings?.['web_module_enabled'] ?? false,
    mapsEnabled: userSettings?.['maps_module_enabled'] ?? false,
    scoringCapPerRun: userSettings?.['scoring_cap_per_run'] ?? 40,
    alertThreshold: userSettings?.['alert_threshold'] ?? 75,
    quietHoursStart: userSettings?.['quiet_hours_start'] ?? null,
    quietHoursEnd: userSettings?.['quiet_hours_end'] ?? null,
    cleanupDue,
    webApprovedPlanId: webPlan?.id ?? null,
    mapsApprovedPlanId: mapsPlan?.id ?? null,
  };
}
