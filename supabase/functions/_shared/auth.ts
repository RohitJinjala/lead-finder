// supabase/functions/_shared/auth.ts
// Verifies caller JWT and confirms caller is the stored app owner.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function verifyOwner(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Client using caller's JWT to verify who they are
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Admin client to check app_owner table
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: owner } = await adminClient
    .from('app_owner')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!owner) {
    throw new Response(JSON.stringify({ error: 'Forbidden: caller is not app owner' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return { user, adminClient };
}

