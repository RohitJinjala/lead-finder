import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runDailyCleanup } from '../cleanup.js';

describe('runDailyCleanup', () => {
  it('calls delete for old trash, update for old rejected, trims long text, and updates user_settings', async () => {
    const deletedFilters: string[] = [];
    const updateCalls: { action: string; id?: string; updateData: unknown }[] = [];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'leads') {
          return {
            delete: vi.fn(() => ({
              not: vi.fn(() => ({
                lt: vi.fn(async () => {
                  deletedFilters.push('deleted_at_lt_30d');
                  return { error: null };
                }),
              })),
            })),
            update: vi.fn((updateData: unknown) => ({
              eq: vi.fn((field: string, val: string) => {
                if (field === 'id') {
                  updateCalls.push({ action: 'trim', id: val, updateData });
                  return Promise.resolve({ error: null });
                }
                return {
                  is: vi.fn(() => ({
                    lt: vi.fn(async () => {
                      updateCalls.push({ action: 'archive', updateData });
                      return { error: null };
                    }),
                  })),
                };
              }),
            })),
            select: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [
                  { id: 'lead-1', body: 'Short text' },
                  { id: 'lead-2', body: 'A'.repeat(5000) },
                ],
                error: null,
              })),
            })),
          };
        }
        if (table === 'user_settings') {
          return {
            update: vi.fn((updateData: unknown) => ({
              neq: vi.fn(async () => {
                updateCalls.push({ action: 'user_settings', updateData });
                return { error: null };
              }),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    const res = await runDailyCleanup(mockSupabase);

    expect(res.purgedTrash).toBe(true);
    expect(res.archivedRejected).toBe(true);
    expect(res.trimmedCount).toBe(1);
    expect(res.updatedSettings).toBe(true);
    expect(deletedFilters).toContain('deleted_at_lt_30d');
  });
});
