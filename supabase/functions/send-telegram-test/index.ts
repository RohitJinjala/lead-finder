// supabase/functions/send-telegram-test/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyOwner, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await verifyOwner(req);

    // Fetch token and chat ID
    const { data: botToken } = await adminClient.rpc('get_secret_value', {
      p_secret_name: 'TELEGRAM_BOT_TOKEN',
    });
    const { data: chatId } = await adminClient.rpc('get_secret_value', {
      p_secret_name: 'TELEGRAM_CHAT_ID',
    });

    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: 'Telegram bot token and chat ID must both be configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const testMessage = `🎯 *Lead Finder Test Alert*\n\nYour Telegram alerts are connected and working correctly!\nTime: ${new Date().toISOString()}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      return new Response(JSON.stringify({ error: tgData.description || 'Failed to send test message' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Test message sent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (resOrErr) {
    if (resOrErr instanceof Response) return resOrErr;
    return new Response(JSON.stringify({ error: String(resOrErr) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

