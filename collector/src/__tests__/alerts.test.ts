import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendAlerts } from '../alerts.js';
import type { CollectorSettings } from '../settings.js';
import { clearSecretCache } from '../secrets.js';

const mockSettings: CollectorSettings = {
  webEnabled: true,
  mapsEnabled: false,
  scoringCapPerRun: 40,
  alertThreshold: 75,
  quietHoursStart: null,
  quietHoursEnd: null,
  cleanupDue: false,
  webApprovedPlanId: 'plan-id',
  mapsApprovedPlanId: null,
};

describe('sendAlerts', () => {
  beforeEach(() => {
    clearSecretCache();
    vi.restoreAllMocks();
  });

  it('skips silently when no high-score leads', async () => {
    const supabase = { rpc: vi.fn() } as unknown as Parameters<typeof sendAlerts>[0];
    await expect(sendAlerts(supabase, mockSettings, [])).resolves.toBeUndefined();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('skips silently when Telegram is not configured', async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Secret not found')),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof sendAlerts>[0];

    await expect(sendAlerts(supabase, mockSettings, ['lead-id-1'])).resolves.toBeUndefined();
  });

  it('respects quiet hours and skips sending', async () => {
    const quietSettings: CollectorSettings = {
      ...mockSettings,
      quietHoursStart: 0,
      quietHoursEnd: 23,
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response);

    const supabase = {
      rpc: vi.fn().mockResolvedValue('fake-token'),
    } as unknown as Parameters<typeof sendAlerts>[0];

    await sendAlerts(supabase, quietSettings, ['lead-id-1']);
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.anything()
    );
  });
});

