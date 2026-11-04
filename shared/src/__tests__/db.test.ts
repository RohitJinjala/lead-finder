import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');

describe('Database Migrations and Business Logic', () => {
  let db: PGlite;
  const ownerUserId = '11111111-1111-1111-1111-111111111111';
  const strangerUserId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    db = new PGlite();

    // Set up auth schema mimicking Supabase JWT context
    await db.exec(`
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ language sql stable;
    `);

    // Run migrations in chronological order
    const migrationFiles = [
      '20261104000001_create_tables.sql',
      '20261104000002_rls_and_owner.sql',
      '20261104000003_lead_id_generator.sql',
      '20261104000004_indexes.sql',
    ];

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }
  });

  const asUser = async (userId: string | null, fn: () => Promise<void>) => {
    if (userId) {
      await db.query(`set role authenticated;`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, false);`, [userId]);
    } else {
      await db.query(`set role anon;`);
      await db.query(`select set_config('request.jwt.claim.sub', '', false);`);
    }
    try {
      await fn();
    } finally {
      await db.query(`reset role;`);
      await db.query(`select set_config('request.jwt.claim.sub', '', false);`);
    }
  };

  describe('claim_owner() and is_owner()', () => {
    it('rejects unauthenticated user from claiming owner', async () => {
      await expect(asUser(null, async () => {
        await db.query(`select public.claim_owner();`);
      })).rejects.toThrow(/Not authenticated/);
    });

    it('allows first authenticated user to claim owner', async () => {
      let claimed: boolean = false;
      await asUser(ownerUserId, async () => {
        const res = await db.query<{ claim_owner: boolean }>(`select public.claim_owner() as claim_owner;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        claimed = row.claim_owner;
      });
      expect(claimed).toBe(true);

      // Verify is_owner() returns true for owner
      await asUser(ownerUserId, async () => {
        const res = await db.query<{ is_owner: boolean }>(`select public.is_owner() as is_owner;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        expect(row.is_owner).toBe(true);
      });
    });

    it('rejects subsequent claim attempts by other users', async () => {
      let claimedByStranger: boolean = true;
      await asUser(strangerUserId, async () => {
        const res = await db.query<{ claim_owner: boolean }>(`select public.claim_owner() as claim_owner;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        claimedByStranger = row.claim_owner;
      });
      expect(claimedByStranger).toBe(false);

      // Verify is_owner() returns false for stranger
      await asUser(strangerUserId, async () => {
        const res = await db.query<{ is_owner: boolean }>(`select public.is_owner() as is_owner;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        expect(row.is_owner).toBe(false);
      });
    });
  });

  describe('Lead ID Generator (DD-MM-SRC-NNNN)', () => {
    it('generates proper DD-MM-WEB-NNNN format for web leads', async () => {
      const res = await db.query<{ lead_code: string; module: string }>(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body)
        values ('web', 'reddit', 'https://reddit.com/r/forhire/1', 'key-test-web-1', 'Need React dev', 'Looking for developer')
        returning lead_code, module;
      `);

      const row = res.rows[0];
      if (!row) throw new Error('No row returned');
      expect(row.lead_code).toMatch(/^\d{2}-\d{2}-WEB-\d{4}$/);
    });

    it('generates proper DD-MM-MAP-NNNN format for maps leads', async () => {
      const res = await db.query<{ lead_code: string; module: string }>(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body)
        values ('maps', 'osm', 'https://osm.org/node/1', 'key-test-map-1', 'Local Gym', 'No website')
        returning lead_code, module;
      `);

      const row = res.rows[0];
      if (!row) throw new Error('No row returned');
      expect(row.lead_code).toMatch(/^\d{2}-\d{2}-MAP-\d{4}$/);
    });

    it('increments sequence atomically', async () => {
      const res1 = await db.query<{ lead_code: string }>(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body)
        values ('web', 'reddit', 'https://reddit.com/r/forhire/2', 'key-test-web-2', 'Lead 2', 'Body')
        returning lead_code;
      `);
      const res2 = await db.query<{ lead_code: string }>(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body)
        values ('web', 'reddit', 'https://reddit.com/r/forhire/3', 'key-test-web-3', 'Lead 3', 'Body')
        returning lead_code;
      `);

      const row1 = res1.rows[0];
      const row2 = res2.rows[0];
      if (!row1 || !row2) throw new Error('Rows missing');

      const parts1 = row1.lead_code.split('-');
      const parts2 = row2.lead_code.split('-');
      const num1 = parseInt(parts1[3] ?? '0', 10);
      const num2 = parseInt(parts2[3] ?? '0', 10);
      expect(num2).toBe(num1 + 1);
    });

    it('handles 50 concurrent inserts with no duplicate lead codes', async () => {
      const promises = Array.from({ length: 50 }, (_, i) => {
        return db.query<{ lead_code: string }>(`
          insert into public.leads (module, source, source_url, dedupe_key, title, body)
          values ('web', 'reddit', 'https://reddit.com/batch/${i}', 'batch-key-${i}', 'Batch Lead ${i}', 'Batch Body')
          returning lead_code;
        `);
      });

      const results = await Promise.all(promises);
      const codes = results.map(r => {
        const row = r.rows[0];
        if (!row) throw new Error('Row missing');
        return row.lead_code;
      });
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(50);
      expect(uniqueCodes.size).toBe(50);

      // Verify all match pattern
      for (const code of codes) {
        expect(code).toMatch(/^\d{2}-\d{2}-WEB-\d{4}$/);
      }
    });
  });

  describe('Deduplication Constraint', () => {
    it('enforces unique dedupe_key constraint', async () => {
      await expect(db.query(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body)
        values ('web', 'reddit', 'https://reddit.com/dup', 'batch-key-0', 'Duplicate', 'Body')
      `)).rejects.toThrow();
    });
  });

  describe('Secret Store Security and Masking', () => {
    it('sets secret value and updates secret_meta with masked preview (first 4, last 2)', async () => {
      await db.query(`
        select public.set_secret_value('OPENAI_API_KEY', 'sk-proj-1234567890abcdefghijklmnop', 'api_key', 'web');
      `);

      // secret_meta should have masked preview
      const meta = await db.query<{ name: string; masked_preview: string; status: string }>(`
        select name, masked_preview, status from public.secret_meta where name = 'OPENAI_API_KEY';
      `);
      expect(meta.rows.length).toBe(1);
      const row = meta.rows[0];
      if (!row) throw new Error('No row returned');
      expect(row.masked_preview.startsWith('sk-p')).toBe(true);
      expect(row.masked_preview.endsWith('op')).toBe(true);
      expect(row.masked_preview.includes('***')).toBe(true);
      // It must not reveal the full key
      expect(row.masked_preview).not.toBe('sk-proj-1234567890abcdefghijklmnop');

      // get_secret_value returns plaintext when called
      const secret = await db.query<{ get_secret_value: string }>(`
        select public.get_secret_value('OPENAI_API_KEY');
      `);
      const secretRow = secret.rows[0];
      if (!secretRow) throw new Error('No secret returned');
      expect(secretRow.get_secret_value).toBe('sk-proj-1234567890abcdefghijklmnop');
    });

    it('delete_secret_value removes from both store and meta', async () => {
      await db.query(`select public.delete_secret_value('OPENAI_API_KEY');`);

      const meta = await db.query(`select * from public.secret_meta where name = 'OPENAI_API_KEY';`);
      expect(meta.rows.length).toBe(0);

      const secret = await db.query<{ get_secret_value: string | null }>(`
        select public.get_secret_value('OPENAI_API_KEY');
      `);
      const secretRow = secret.rows[0];
      if (!secretRow) throw new Error('No row returned');
      expect(secretRow.get_secret_value).toBeNull();
    });
  });

  describe('Row Level Security (RLS)', () => {
    it('allows owner to select and manage leads', async () => {
      await asUser(ownerUserId, async () => {
        const res = await db.query<{ count: string }>(`select count(*) as count from public.leads;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        expect(parseInt(row.count, 10)).toBeGreaterThan(0);
      });
    });

    it('blocks non-owner from viewing leads', async () => {
      await asUser(strangerUserId, async () => {
        const res = await db.query<{ count: string }>(`select count(*) as count from public.leads;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        expect(parseInt(row.count, 10)).toBe(0);
      });
    });

    it('blocks unauthenticated requests from viewing leads', async () => {
      await asUser(null, async () => {
        const res = await db.query<{ count: string }>(`select count(*) as count from public.leads;`);
        const row = res.rows[0];
        if (!row) throw new Error('No row returned');
        expect(parseInt(row.count, 10)).toBe(0);
      });
    });
  });

  describe('Trash and 30-day Restore', () => {
    it('supports soft-delete (moving to trash) and restoration', async () => {
      // 1. Create a lead
      const leadRes = await db.query<{ id: string; lead_code: string }>(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body)
        values ('web', 'hn', 'https://news.ycombinator.com/item?id=999', 'key-trash-test', 'Trash Test Lead', 'Body')
        returning id, lead_code;
      `);
      const leadRow = leadRes.rows[0];
      if (!leadRow) throw new Error('No lead returned');
      const leadId = leadRow.id;

      // 2. Soft-delete
      await db.query(`update public.leads set deleted_at = now() where id = $1;`, [leadId]);

      const deletedCheck = await db.query<{ deleted_at: string | null }>(`
        select deleted_at from public.leads where id = $1;
      `, [leadId]);
      const deletedRow = deletedCheck.rows[0];
      if (!deletedRow) throw new Error('No deleted row returned');
      expect(deletedRow.deleted_at).not.toBeNull();

      // 3. Restore
      await db.query(`update public.leads set deleted_at = null where id = $1;`, [leadId]);

      const restoredCheck = await db.query<{ deleted_at: string | null }>(`
        select deleted_at from public.leads where id = $1;
      `, [leadId]);
      const restoredRow = restoredCheck.rows[0];
      if (!restoredRow) throw new Error('No restored row returned');
      expect(restoredRow.deleted_at).toBeNull();
    });
  });

  describe('Lead-to-Deal Conversion', () => {
    it('creates deal preserving identical lead code and ensures unique per lead', async () => {
      const leadRes = await db.query<{ id: string; lead_code: string }>(`
        insert into public.leads (module, source, source_url, dedupe_key, title, body, status)
        values ('web', 'hn', 'https://news.ycombinator.com/item?id=888', 'key-deal-test', 'Deal Lead', 'Body', 'won')
        returning id, lead_code;
      `);
      const leadRow = leadRes.rows[0];
      if (!leadRow) throw new Error('No lead returned');
      const leadId = leadRow.id;
      const leadCode = leadRow.lead_code;

      // Create deal with matching code
      const dealRes = await db.query<{ id: string; deal_code: string; state: string }>(`
        insert into public.deals (lead_id, deal_code, client, project, value, currency, state)
        values ($1, $2, 'Acme Corp', 'SaaS Platform', 2500, 'USD', 'live')
        returning id, deal_code, state;
      `, [leadId, leadCode]);

      const dealRow = dealRes.rows[0];
      if (!dealRow) throw new Error('No deal returned');
      expect(dealRow.deal_code).toBe(leadCode);
      expect(dealRow.state).toBe('live');

      // Duplicate deal for same lead violates unique constraint
      await expect(db.query(`
        insert into public.deals (lead_id, deal_code, client, project, value, currency)
        values ($1, $2, 'Acme Corp 2', 'SaaS Platform 2', 3000, 'USD')
      `, [leadId, leadCode])).rejects.toThrow();
    });
  });
});
