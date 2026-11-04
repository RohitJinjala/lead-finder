// supabase/functions/save-secret/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyOwner, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await verifyOwner(req);
    const body = await req.json();

    const { name, value, kind, module } = body;
    if (!name || typeof name !== 'string' || !value || typeof value !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing name or value' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call set_secret_value RPC
    const { error: rpcError } = await adminClient.rpc('set_secret_value', {
      p_name: name,
      p_value: value,
      p_kind: kind || 'other',
      p_module: module || null,
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read back metadata preview only
    const { data: meta } = await adminClient
      .from('secret_meta')
      .select('name, kind, module, masked_preview, status')
      .eq('name', name)
      .single();

    return new Response(JSON.stringify({ success: true, meta }), {
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

