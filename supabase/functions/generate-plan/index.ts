// supabase/functions/generate-plan/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyOwner, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminClient } = await verifyOwner(req);
    const body = await req.json();

    const { profile_id, module = 'web', brief } = body;
    if (!brief || typeof brief !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing brief' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load enabled models for this module
    const { data: models } = await adminClient
      .from('model_chain')
      .select('id, name, provider, base_url, model_id, secret_name')
      .eq('module', module)
      .eq('enabled', true)
      .order('priority', { ascending: true });

    let planProposal = null;

    if (models && models.length > 0) {
      // Try to query the top model
      for (const m of models) {
        try {
          const { data: secretVal } = await adminClient.rpc('get_secret_value', {
            p_secret_name: m.secret_name,
          });

          if (!secretVal) continue;

          const prompt = `You are a search query strategist for freelance lead generation.
Developer skills: React, React Native, Node.js, Express, MERN, .NET
Module: ${module}
Client Brief: "${brief}"

Generate a targeting plan as JSON matching this schema:
{
  "keywords": ["array", "of", "search", "keywords"],
  "exclusions": ["array", "of", "negative", "keywords"],
  "subreddits": ["forhire", "hiring", "freelance"],
  "countries": ["US", "UK", "CA", "EU", "AU"],
  "sources": {
    "reddit": true,
    "hackernews": true,
    "remoteok": true,
    "weworkremotely": true,
    "remotive": true
  }
}
Output JSON only.`;

          const aiRes = await fetch(`${m.base_url}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${secretVal}`,
            },
            body: JSON.stringify({
              model: m.model_id,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
              response_format: { type: 'json_object' },
            }),
          });

          if (aiRes.ok) {
            const data = await aiRes.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              planProposal = JSON.parse(content);
              break;
            }
          }
        } catch {
          // Fall through to next model
        }
      }
    }

    // Default fallback if no models configured or all failed
    if (!planProposal) {
      planProposal = {
        keywords: ['react', 'node', 'express', 'mern', 'react native', 'full stack', '.net', 'api'],
        exclusions: ['wordpress', 'php', 'intern', 'unpaid', 'equity only', 'marketing'],
        subreddits: ['forhire', 'hiring', 'freelance'],
        countries: ['US', 'UK', 'CA', 'EU', 'AU'],
        sources: {
          reddit: true,
          hackernews: true,
          remoteok: true,
          weworkremotely: true,
          remotive: true,
        },
      };
    }

    // Save as draft search plan if profile_id provided
    let savedPlan = null;
    if (profile_id) {
      // Find latest version
      const { data: existingPlans } = await adminClient
        .from('search_plans')
        .select('version')
        .eq('profile_id', profile_id)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existingPlans?.[0]?.version ?? 0) + 1;

      const { data: inserted, error: insertErr } = await adminClient
        .from('search_plans')
        .insert({
          profile_id,
          version: nextVersion,
          plan: planProposal,
          approved: false,
        })
        .select()
        .single();

      if (!insertErr) {
        savedPlan = inserted;
      }
    }

    return new Response(JSON.stringify({ success: true, plan: planProposal, savedPlan }), {
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

