// supabase/functions/detect-telegram-chat/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyOwner, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await verifyOwner(req);

    // Retrieve stored bot token
    const { data: botToken, error: secretErr } = await adminClient.rpc('get_secret_value', {
      p_secret_name: 'TELEGRAM_BOT_TOKEN',
    });

    if (secretErr || !botToken) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call getUpdates on Telegram API
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=20`);
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return new Response(JSON.stringify({ error: tgData.description || 'Failed to fetch Telegram updates' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract unique chats from recent messages
    const updates = tgData.result || [];
    const chatsMap = new Map<string, { id: string; type: string; title?: string; username?: string; first_name?: string }>();

    for (const u of updates) {
      const chat = u.message?.chat || u.channel_post?.chat || u.edited_message?.chat;
      if (chat && chat.id) {
        const idStr = String(chat.id);
        chatsMap.set(idStr, {
          id: idStr,
          type: chat.type,
          title: chat.title,
          username: chat.username,
          first_name: chat.first_name,
        });
      }
    }

    const chats = Array.from(chatsMap.values());

    return new Response(JSON.stringify({ success: true, chats }), {
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

