// supabase/functions/test-secret/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyOwner, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await verifyOwner(req);
    const body = await req.json();

    const { name, test_type, base_url, model_id } = body;
    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing secret name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve the secret value using internal function
    const { data: secretVal, error: secretErr } = await adminClient.rpc('get_secret_value', {
      p_secret_name: name,
    });

    if (secretErr || !secretVal) {
      return new Response(JSON.stringify({ error: 'Secret not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let status: 'valid' | 'invalid' | 'rate_limited' = 'valid';
    let message = 'Tested successfully';

    if (test_type === 'telegram') {
      // Test Telegram bot token: getMe
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${secretVal}/getMe`);
        const tgData = await tgRes.json();
        if (!tgData.ok) {
          status = 'invalid';
          message = tgData.description || 'Invalid Telegram bot token';
        }
      } catch (e) {
        status = 'invalid';
        message = String(e);
      }
    } else if (test_type === 'ai_model' && base_url && model_id) {
      // Test OpenAI-compatible endpoint with tiny 1-token prompt
      try {
        const cleanBaseUrl = String(base_url).trim().replace(/\/+$/, '');
        const aiRes = await fetch(`${cleanBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secretVal}`,
          },
          body: JSON.stringify({
            model: model_id,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
        });

        if (aiRes.status === 401 || aiRes.status === 403) {
          status = 'invalid';
          message = `HTTP ${aiRes.status}: Invalid API key`;
        } else if (aiRes.status === 429) {
          status = 'rate_limited';
          message = 'HTTP 429: Rate limited';
        } else if (!aiRes.ok) {
          status = 'invalid';
          let detail = '';
          try {
            const errBody = await aiRes.json();
            detail = errBody?.error?.message ? `: ${String(errBody.error.message).slice(0, 120)}` : '';
          } catch {
            // ignore non-json error body
          }
          message = `HTTP ${aiRes.status}${detail}`;
        }
      } catch (e) {
        status = 'invalid';
        message = String(e);
      }
    }

    // Update secret_meta status and last_tested_at
    await adminClient
      .from('secret_meta')
      .update({
        status,
        last_tested_at: new Date().toISOString(),
      })
      .eq('name', name);

    return new Response(JSON.stringify({ success: true, status, message }), {
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

