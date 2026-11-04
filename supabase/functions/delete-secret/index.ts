// supabase/functions/delete-secret/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyOwner, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await verifyOwner(req);
    const body = await req.json();

    const { name } = body;
    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing secret name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: rpcError } = await adminClient.rpc('delete_secret_value', {
      p_name: name,
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, deleted: name }), {
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

