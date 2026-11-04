import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreWithChain, AllModelsFailedError, type RouterDependencies } from '@lead-finder/shared';
import type { ModelEntry } from '@lead-finder/shared';
import { getSecret } from './secrets.js';
import type { CollectorSettings } from './settings.js';

interface ScoringRunResult {
  scored: number;
  unscored: number;
  modelsUsed: Record<string, number>;
  highScoreLeadIds: string[];
}

export async function scoreUnscored(
  supabase: SupabaseClient,
  settings: CollectorSettings
): Promise<ScoringRunResult> {
  const result: ScoringRunResult = {
    scored: 0,
    unscored: 0,
    modelsUsed: {},
    highScoreLeadIds: [],
  };

  // Fetch unscored leads (newest first, up to cap)
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, module, source, source_url, title, body, search_profile_id')
    .eq('scored', false)
    .is('deleted_at', null)
    .order('found_at', { ascending: false })
    .limit(settings.scoringCapPerRun);

  if (leadsError) {
    console.error('[scorer] Failed to fetch unscored leads:', leadsError.message);
    return result;
  }

  if (!leads || leads.length === 0) {
    console.log('[scorer] No unscored leads to process.');
    return result;
  }

  console.log(`[scorer] Scoring ${leads.length} unscored leads...`);

  for (const lead of leads as Array<{ id: string; module: string; source: string; source_url: string; title: string; body: string; search_profile_id: string | null }>) {
    try {
      // Load model chain for this module
      const { data: models } = await supabase
        .from('model_chain')
        .select('*')
        .eq('module', lead.module)
        .eq('enabled', true)
        .order('priority', { ascending: true });

      if (!models || models.length === 0) {
        console.warn(`[scorer] No models for module ${lead.module}, skipping lead ${lead.id}`);
        result.unscored++;
        await markUnscored(supabase, lead.id);
        continue;
      }

      // Load search profile context
      const ctx = await loadProfileContext(supabase, lead.search_profile_id);

      const deps: RouterDependencies = {
        getSecret: (name) => getSecret(supabase, name),
        getModelStatus: async (modelId) => {
          const { data } = await supabase.from('model_status').select('*').eq('model_id', modelId).single();
          return data ?? null;
        },
        updateModelStatus: async (modelId, update) => {
          await supabase.from('model_status').upsert({
            model_id: modelId,
            updated_at: new Date().toISOString(),
            ...update,
          });
        },
      };

      const scoring = await scoreWithChain(
        {
          title: lead.title,
          body: lead.body,
          source: lead.source,
          module: lead.module as 'web' | 'maps',
        },
        models as ModelEntry[],
        ctx,
        deps
      );

      // Save scoring result
      await supabase.from('leads').update({
        scored: true,
        score: scoring.output.score,
        reason: scoring.output.reason,
        tags: scoring.output.tags,
        service_match: scoring.output.service_match,
        tech_stack: scoring.output.tech_stack,
        budget_signal: scoring.output.budget_signal,
        budget_amount: scoring.output.budget_amount,
        currency: scoring.output.currency,
        country: scoring.output.country,
        red_flags: scoring.output.red_flags,
        draft_line: scoring.output.draft_line,
        scored_by: scoring.scored_by,
        scored_provider: scoring.scored_provider,
        is_fallback: scoring.is_fallback,
        prompt_version: scoring.prompt_version,
      }).eq('id', lead.id);

      result.scored++;
      result.modelsUsed[scoring.scored_by] = (result.modelsUsed[scoring.scored_by] ?? 0) + 1;
      if (scoring.output.score >= settings.alertThreshold) {
        result.highScoreLeadIds.push(lead.id);
      }
    } catch (err) {
      if (err instanceof AllModelsFailedError) {
        result.unscored++;
        await markUnscored(supabase, lead.id);
      } else {
        console.error(`[scorer] Error scoring lead ${lead.id}:`, err instanceof Error ? err.message : String(err));
        result.unscored++;
        await markUnscored(supabase, lead.id);
      }
    }
  }

  return result;
}

async function markUnscored(supabase: SupabaseClient, leadId: string): Promise<void> {
  await supabase.from('leads').update({
    scored: false,
    tags: ['Unscored'],
  }).eq('id', leadId);
}

async function loadProfileContext(
  supabase: SupabaseClient,
  profileId: string | null
): Promise<{ profileBrief: string; ownerSkills: string[]; recentDecisions: Array<{ title: string; decision: 'accepted' | 'rejected'; reject_reason?: string | undefined }> }> {
  const ownerSkills = ['React', 'React Native', 'Node.js', 'Express', 'MERN', '.NET'];

  if (!profileId) {
    return {
      profileBrief: 'General freelance development leads',
      ownerSkills,
      recentDecisions: [],
    };
  }

  const { data: profile } = await supabase
    .from('search_profiles')
    .select('brief')
    .eq('id', profileId)
    .single();

  // Last 10 accept/reject decisions for calibration (no notes, no secrets)
  const { data: decisions } = await supabase
    .from('leads')
    .select('title, status, reject_reason')
    .in('status', ['acceptable', 'rejected'])
    .not('scored', 'is', null)
    .order('found_at', { ascending: false })
    .limit(10);

  return {
    profileBrief: profile?.brief ?? 'General freelance development leads',
    ownerSkills,
    recentDecisions: (decisions ?? []).map((d: { title: string; status: string; reject_reason: string | null }) => {
      const item: { title: string; decision: 'accepted' | 'rejected'; reject_reason?: string | undefined } = {
        title: d.title,
        decision: d.status === 'acceptable' ? 'accepted' : 'rejected',
      };
      if (d.reject_reason) {
        item.reject_reason = d.reject_reason;
      }
      return item;
    }),
  };
}
