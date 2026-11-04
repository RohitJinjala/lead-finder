import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCollector } from '../runner.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── In-memory Mock Supabase Database ────────────────────────────────────────

interface MockLead {
  id: string;
  lead_code: string;
  dedupe_key: string;
  scored?: boolean;
  [key: string]: unknown;
}

interface MockSearchPlan {
  id: string;
  profile_id: string;
  version: number;
  approved: boolean;
  search_profiles?: { module: string };
  plan: Record<string, unknown>;
}

interface MockCollectorRun {
  new?: number;
  per_source_results?: Array<{ error_message?: string | null }>;
  [key: string]: unknown;
}

interface UpdateChain {
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  then: (resolve: (res: { error: null }) => void) => void;
}

function createMockSupabase() {
  let leaseHeld = false;
  const leads: MockLead[] = [];
  const searchPlans: MockSearchPlan[] = [
    {
      id: 'plan-web-1',
      profile_id: 'prof-1',
      version: 1,
      approved: true,
      search_profiles: { module: 'web' },
      plan: {
        keywords: ['react', 'node'],
        exclusions: ['wordpress'],
        subreddits: ['forhire'],
      },
    },
  ];
  const userSettings = {
    web_module_enabled: true,
    maps_module_enabled: false,
    web_approved_plan_id: 'plan-web-1',
    maps_approved_plan_id: null,
    alert_threshold: 75,
    cleanup_due: false,
    telegram_bot_token: null,
    telegram_chat_id: null,
  };
  const collectorRuns: MockCollectorRun[] = [];

  const rpc = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'acquire_collector_lock') {
      if (leaseHeld) return Promise.resolve({ data: false, error: null });
      leaseHeld = true;
      return Promise.resolve({ data: true, error: null });
    }
    if (fnName === 'release_collector_lock') {
      leaseHeld = false;
      return Promise.resolve({ data: null, error: null });
    }
    if (fnName === 'get_secret_value') {
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'user_settings') {
      return {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userSettings, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: userSettings, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
          neq: vi.fn().mockResolvedValue({ error: null }),
          then: (resolve: (res: { error: null }) => void) => resolve({ error: null }),
        }),
      };
    }
    if (table === 'search_plans') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: unknown) => {
          if (col === 'approved') {
            return {
              order: vi.fn().mockResolvedValue({
                data: searchPlans.filter((p) => p.approved),
                error: null,
              }),
            };
          }
          return {
            single: vi.fn().mockResolvedValue({
              data: searchPlans.find((p) => p.id === val) ?? null,
              error: null,
            }),
          };
        }),
      };
    }
    if (table === 'leads') {
      return {
        select: vi.fn().mockImplementation((_cols?: string) => {
          return {
            eq: vi.fn().mockImplementation((col: string, val: unknown) => {
              if (col === 'scored' && val === false) {
                return {
                  is: vi.fn().mockReturnThis(),
                  order: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({
                    data: leads.filter((l) => !l.scored),
                    error: null,
                  }),
                };
              }
              return {
                in: vi.fn().mockImplementation((_c: string, values: string[]) => ({
                  data: leads.filter((l) => values.includes(l.dedupe_key)),
                  error: null,
                })),
              };
            }),
            in: vi.fn().mockImplementation((_col: string, values: string[]) => {
              const matched = leads.filter((l) => values.includes(l.dedupe_key));
              return Promise.resolve({ data: matched, error: null });
            }),
          };
        }),
        insert: vi.fn().mockImplementation((items: Record<string, unknown> | Array<Record<string, unknown>>) => {
          const arr = Array.isArray(items) ? items : [items];
          for (const item of arr) {
            const dedupeKey = String(item['dedupe_key'] ?? '');
            const exists = leads.find((l) => l.dedupe_key === dedupeKey);
            if (!exists) {
              leads.push({
                id: `lead-${leads.length + 1}`,
                lead_code: `04-11-WEB-000${leads.length + 1}`,
                dedupe_key: dedupeKey,
                scored: false,
                ...item,
              });
            }
          }
          return Promise.resolve({ error: null });
        }),
        update: vi.fn().mockImplementation((patch: Record<string, unknown>) => {
          const chain: Partial<UpdateChain> = {};
          chain.eq = vi.fn().mockImplementation((_col: string, val: string) => {
            const lead = leads.find((l) => l.id === val);
            if (lead) Object.assign(lead, patch);
            return chain;
          });
          chain.neq = vi.fn().mockReturnValue(chain);
          chain.is = vi.fn().mockReturnValue(chain);
          chain.lt = vi.fn().mockResolvedValue({ error: null });
          chain.then = (resolve: (res: { error: null }) => void) => resolve({ error: null });
          return chain;
        }),
        delete: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ error: null }),
          }),
          lt: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === 'model_chain') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }
    if (table === 'model_status') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    if (table === 'collector_runs') {
      return {
        insert: vi.fn().mockImplementation((runData: MockCollectorRun) => {
          collectorRuns.push(runData);
          return Promise.resolve({ error: null });
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
  });

  return {
    client: { rpc, from } as unknown as SupabaseClient,
    getLeads: () => leads,
    getRuns: () => collectorRuns,
    setLeaseHeld: (v: boolean) => { leaseHeld = v; },
    setUserSettings: (s: Partial<typeof userSettings>) => { Object.assign(userSettings, s); },
    clearPlans: () => { searchPlans.length = 0; },
  };
}

describe('Collector Runner End-to-End', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exits quietly if another run currently holds the lease', async () => {
    const mock = createMockSupabase();
    mock.setLeaseHeld(true);

    await runCollector(mock.client);

    // No collector runs recorded because it bailed out early
    expect(mock.getRuns().length).toBe(0);
    expect(mock.getLeads().length).toBe(0);
  });

  it('skips collection for module if approved plan is missing', async () => {
    const mock = createMockSupabase();
    mock.clearPlans();

    await runCollector(mock.client);

    const runs = mock.getRuns();
    expect(runs.length).toBe(1);
    expect(runs[0]?.new).toBe(0);
    expect(runs[0]?.per_source_results?.[0]?.error_message).toContain('No approved plan');
  });

  it('executes collection, inserts leads, scores backlog, and writes run log', async () => {
    const mock = createMockSupabase();

    // Mock Reddit fetch returning 1 item matching keyword
    const fakeRss = `
      <item>
        <title>[Hiring] Contract React / Node Engineer</title>
        <link>https://reddit.com/r/forhire/101</link>
        <description>Looking for React and Node pro</description>
      </item>
    `;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fakeRss,
      json: async () => ({ hits: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await runCollector(mock.client);

    const runs = mock.getRuns();
    expect(runs.length).toBe(1);
    expect(mock.getLeads().length).toBeGreaterThan(0);

    // Lease must be released after completion
    expect(mock.client.rpc).toHaveBeenCalledWith('release_collector_lock');
  });

  it('is completely idempotent: running twice inserts no duplicate leads', async () => {
    const mock = createMockSupabase();

    const fakeRss = `
      <item>
        <title>[Hiring] Contract React / Node Engineer</title>
        <link>https://reddit.com/r/forhire/101</link>
        <description>Looking for React and Node pro</description>
      </item>
    `;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fakeRss,
      json: async () => ({ hits: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // First Run
    await runCollector(mock.client);
    const countAfterRun1 = mock.getLeads().length;

    // Second Run
    await runCollector(mock.client);
    const countAfterRun2 = mock.getLeads().length;

    expect(countAfterRun2).toBe(countAfterRun1);
  });
});
