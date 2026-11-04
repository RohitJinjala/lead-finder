import type { SupabaseClient } from '@supabase/supabase-js';
import { getSecret } from './secrets.js';
import type { CollectorSettings } from './settings.js';

interface LeadForAlert {
  lead_code: string;
  title: string;
  score: number;
  country: string | null;
  source: string;
  source_url: string;
}

export async function sendAlerts(
  supabase: SupabaseClient,
  settings: CollectorSettings,
  highScoreLeadIds: string[]
): Promise<void> {
  if (highScoreLeadIds.length === 0) return;

  // Check if Telegram is configured
  let botToken: string;
  let chatId: string;
  try {
    botToken = await getSecret(supabase, 'TELEGRAM_BOT_TOKEN');
    chatId = await getSecret(supabase, 'TELEGRAM_CHAT_ID');
  } catch {
    // Telegram not configured — skip alerts silently
    console.log('[alerts] Telegram not configured, skipping alerts.');
    return;
  }

  // Check quiet hours
  if (isQuietHours(settings)) {
    console.log('[alerts] Quiet hours active, deferring alerts.');
    return;
  }

  // Fetch lead details
  const { data: leads, error } = await supabase
    .from('leads')
    .select('lead_code, title, score, country, source, source_url')
    .in('id', highScoreLeadIds)
    .gte('score', settings.alertThreshold);

  if (error || !leads || leads.length === 0) return;

  for (const lead of leads as LeadForAlert[]) {
    const message = buildAlertMessage(lead);
    await sendTelegramMessage(botToken, chatId, message);
  }
}

export function buildAlertMessage(lead: LeadForAlert): string {
  const score = lead.score ?? 0;
  const country = lead.country ?? 'Unknown';

  return `🎯 New Lead: ${lead.lead_code}\n` +
    `📋 ${lead.title.slice(0, 100)}\n` +
    `⭐ Score: ${score} | 🌍 ${country}\n` +
    `📡 Source: ${lead.source}\n` +
    `🔗 ${lead.source_url}`;
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );
    if (!response.ok) {
      console.error('[alerts] Telegram send failed:', response.status);
    }
  } catch (err) {
    console.error('[alerts] Telegram error:', err instanceof Error ? err.message : String(err));
  }
}

export async function sendModelExhaustionAlert(
  supabase: SupabaseClient,
  module: string
): Promise<void> {
  let botToken: string;
  let chatId: string;
  try {
    botToken = await getSecret(supabase, 'TELEGRAM_BOT_TOKEN');
    chatId = await getSecret(supabase, 'TELEGRAM_CHAT_ID');
  } catch {
    return; // Telegram not configured
  }

  const message = `⚠️ [Lead Finder Alert]\nAll AI models for module "${module}" are currently exhausted, cooling down, or unavailable.\nLeads will be saved as unscored and retried on the next run.`;
  await sendTelegramMessage(botToken, chatId, message);
}

export function isQuietHours(settings: CollectorSettings): boolean {
  if (settings.quietHoursStart === null || settings.quietHoursEnd === null) return false;
  const now = new Date();
  const kolkataHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }),
    10
  );
  const { quietHoursStart: start, quietHoursEnd: end } = settings;
  if (start === null || end === null) return false;
  if (start <= end) {
    return kolkataHour >= start && kolkataHour < end;
  }
  // Wraps midnight
  return kolkataHour >= start || kolkataHour < end;
}
