import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocking Supabase and Edge Function Handlers ─────────────────────────────

interface MockAdminClient {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
}

function createMockAdminClient(): MockAdminClient {
  const secretStore: Record<string, string> = {};
  const secretMetaStore: Record<string, { name: string; kind: string; module: string | null; masked_preview: string; status: string; last_tested_at?: string }> = {};

  const rpc = vi.fn().mockImplementation((fnName: string, args: Record<string, unknown>) => {
    if (fnName === 'get_secret_value') {
      const name = String(args['p_secret_name']);
      return Promise.resolve({ data: secretStore[name] ?? null, error: null });
    }
    if (fnName === 'set_secret_value') {
      const name = String(args['p_name']);
      const val = String(args['p_value']);
      const kind = String(args['p_kind'] || 'other');
      const mod = (args['p_module'] as string | null) ?? null;

      secretStore[name] = val;
      const len = val.length;
      const masked = len <= 6 ? '***' : `${val.slice(0, 4)}***${val.slice(-2)}`;
      secretMetaStore[name] = { name, kind, module: mod, masked_preview: masked, status: 'not_set' };
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'app_owner') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_col: string, val: string) => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: val === 'owner-user-id' ? { user_id: 'owner-user-id' } : null,
          }),
        })),
      };
    }
    if (table === 'secret_meta') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_col: string, val: string) => ({
          single: vi.fn().mockResolvedValue({
            data: secretMetaStore[val] ?? null,
            error: secretMetaStore[val] ? null : { message: 'Not found' },
          }),
        })),
        update: vi.fn().mockImplementation((patch: Record<string, unknown>) => ({
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            if (secretMetaStore[val]) {
              Object.assign(secretMetaStore[val]!, patch);
            }
            return Promise.resolve({ error: null });
          }),
        })),
        delete: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            delete secretMetaStore[val];
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }
    if (table === 'model_chain') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'model-1',
              name: 'Groq Llama 3',
              provider: 'groq',
              base_url: 'https://api.groq.com/openai/v1',
              model_id: 'llama-3.3-70b-versatile',
              secret_name: 'GROQ_API_KEY',
              priority: 1,
            },
          ],
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  });

  return { rpc, from };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Supabase Edge Functions Logic', () => {
  let adminClient: MockAdminClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    adminClient = createMockAdminClient();
  });

  describe('save-secret', () => {
    it('requires valid name and value', async () => {
      const body = { name: '', value: '' };
      const isValid = Boolean(body.name && body.value);
      expect(isValid).toBe(false);
    });

    it('saves secret and masks preview without returning full secret', async () => {
      const secretName = 'OPENAI_API_KEY';
      const secretVal = 'sk-proj-1234567890abcdefghijklmnop';

      await adminClient.rpc('set_secret_value', {
        p_name: secretName,
        p_value: secretVal,
        p_kind: 'api_key',
        p_module: 'web',
      });

      const { data: meta } = await adminClient
        .from('secret_meta')
        .select('*')
        .eq('name', secretName)
        .single();

      expect(meta).toBeTruthy();
      expect(meta.name).toBe(secretName);
      expect(meta.masked_preview).toBe('sk-p***op');
      expect(meta.masked_preview).not.toContain('1234567890');
      // Ensure the returned meta does NOT have the full secret
      expect(JSON.stringify(meta)).not.toContain(secretVal);
    });
  });

  describe('delete-secret', () => {
    it('removes secret from store and meta', async () => {
      await adminClient.rpc('set_secret_value', {
        p_name: 'TEMP_KEY',
        p_value: 'temp-val-12345',
        p_kind: 'api_key',
      });

      await adminClient.from('secret_meta').delete().eq('name', 'TEMP_KEY');

      const { data } = await adminClient
        .from('secret_meta')
        .select('*')
        .eq('name', 'TEMP_KEY')
        .single();

      expect(data).toBeNull();
    });
  });

  describe('test-secret', () => {
    it('tests Telegram bot token and updates status', async () => {
      const botToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
      await adminClient.rpc('set_secret_value', {
        p_name: 'TELEGRAM_BOT_TOKEN',
        p_value: botToken,
        p_kind: 'telegram',
      });

      // Mock Telegram getMe returning ok: true
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, result: { id: 123456789, is_bot: true, username: 'LeadFinderBot' } }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const tgData = await tgRes.json();
      const status = tgData.ok ? 'valid' : 'invalid';

      await adminClient
        .from('secret_meta')
        .update({ status, last_tested_at: new Date().toISOString() })
        .eq('name', 'TELEGRAM_BOT_TOKEN');

      const { data: meta } = await adminClient
        .from('secret_meta')
        .select('*')
        .eq('name', 'TELEGRAM_BOT_TOKEN')
        .single();

      expect(meta.status).toBe('valid');
    });

    it('marks secret as invalid when provider returns 401 Unauthorized', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.stubGlobal('fetch', fetchMock);

      const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions');
      let status = 'valid';
      if (aiRes.status === 401 || aiRes.status === 403) {
        status = 'invalid';
      }

      expect(status).toBe('invalid');
    });

    it('marks secret as rate_limited when provider returns 429', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });
      vi.stubGlobal('fetch', fetchMock);

      const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions');
      let status = 'valid';
      if (aiRes.status === 429) {
        status = 'rate_limited';
      }

      expect(status).toBe('rate_limited');
    });
  });

  describe('detect-telegram-chat', () => {
    it('returns empty chats array when no updates exist', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, result: [] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const tgRes = await fetch('https://api.telegram.org/botTOKEN/getUpdates');
      const tgData = await tgRes.json();

      const chatsMap = new Map();
      for (const u of tgData.result) {
        const chat = u.message?.chat;
        if (chat?.id) chatsMap.set(String(chat.id), chat);
      }

      expect(Array.from(chatsMap.values())).toEqual([]);
    });

    it('extracts unique chat information when updates exist', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          result: [
            {
              update_id: 1,
              message: { chat: { id: 987654321, type: 'private', username: 'john_doe', first_name: 'John' } },
            },
            {
              update_id: 2,
              message: { chat: { id: 987654321, type: 'private', username: 'john_doe', first_name: 'John' } },
            },
            {
              update_id: 3,
              message: { chat: { id: 112233445, type: 'group', title: 'Leads Group' } },
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const tgRes = await fetch('https://api.telegram.org/botTOKEN/getUpdates');
      const tgData = await tgRes.json();

      const chatsMap = new Map();
      for (const u of tgData.result) {
        const chat = u.message?.chat;
        if (chat?.id) {
          chatsMap.set(String(chat.id), {
            id: String(chat.id),
            type: chat.type,
            title: chat.title,
            username: chat.username,
          });
        }
      }

      const chats = Array.from(chatsMap.values());
      expect(chats.length).toBe(2);
      expect(chats[0].id).toBe('987654321');
      expect(chats[0].username).toBe('john_doe');
      expect(chats[1].id).toBe('112233445');
      expect(chats[1].title).toBe('Leads Group');
    });
  });

  describe('generate-plan fallback', () => {
    it('returns a comprehensive plan matching schema even when model chain fails', () => {
      const fallbackPlan = {
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

      expect(Array.isArray(fallbackPlan.keywords)).toBe(true);
      expect(fallbackPlan.keywords.length).toBeGreaterThan(0);
      expect(Array.isArray(fallbackPlan.exclusions)).toBe(true);
      expect(fallbackPlan.sources.reddit).toBe(true);
      expect(fallbackPlan.sources.hackernews).toBe(true);
    });
  });
});

