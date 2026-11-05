import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import DataScreen, { leadsToCsv, dealsToCsv } from '../../app/settings/data';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';
import type { Lead } from '../types/lead';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'leads') {
      return {
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'lead-1',
                lead_code: '04-11-WEB-0001',
                module: 'web',
                source: 'reddit',
                source_url: 'https://reddit.com/r/forhire/1',
                title: 'Need "Senior" Dev, Fast',
                status: 'new',
                score: 85,
                reason: 'Good match',
                tags: ['react', 'node'],
                service_match: 'fullstack',
                budget_amount: 1500,
                currency: 'USD',
                country: 'US',
                business_name: null,
                niche: null,
                city: null,
                phone: null,
                found_at: '2026-11-04T10:00:00Z',
                contacted_at: null,
                follow_up_at: null,
              },
            ],
            error: null,
          }),
        }),
        delete: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'deals') {
      return {
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'deal-1',
                lead_id: 'lead-1',
                deal_code: '04-11-WEB-0001',
                client: 'Acme Corp',
                project: 'Portal',
                value: 5000,
                currency: 'USD',
                payment_status: 'paid',
                state: 'completed',
                start_date: '2026-11-01',
                deadline: '2026-11-15',
                created_at: '2026-11-01T10:00:00Z',
                completed_at: '2026-11-15T10:00:00Z',
                notes: 'All paid',
              },
            ],
            error: null,
          }),
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
    };
  });

  return {
    supabase: {
      from: fromMock,
    },
  };
});

const mockTheme = {
  mode: 'light' as const,
  setMode: jest.fn(),
  colors: lightColors,
  isDark: false,
};

function renderScreen() {
  return render(
    <ThemeContext.Provider value={mockTheme}>
      <DataScreen />
    </ThemeContext.Provider>
  );
}

describe('DataScreen & CSV Export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  });

  describe('CSV Serializers', () => {
    it('serializes leads array to valid CSV with escaped quotes and delimited arrays', () => {
      const mockLead: Lead = {
        id: 'lead-1',
        lead_code: '04-11-WEB-0001',
        module: 'web',
        source: 'reddit',
        source_url: 'https://reddit.com/r/forhire/1',
        dedupe_key: 'dedupe-1',
        title: 'Need "Senior" Dev, Fast',
        body: 'Full post body',
        found_at: '2026-11-04T10:00:00Z',
        posted_at: '2026-11-04T09:00:00Z',
        status: 'new',
        reject_reason: null,
        scored: true,
        score: 85,
        reason: 'Good match',
        tags: ['react', 'node'],
        service_match: 'fullstack',
        tech_stack: ['react', 'typescript'],
        budget_signal: 'stated',
        budget_amount: 1500,
        currency: 'USD',
        country: 'US',
        timezone: 'America/New_York',
        red_flags: [],
        draft_line: 'Hi there',
        scored_by: 'gemini-1.5-flash',
        scored_provider: 'google',
        is_fallback: false,
        prompt_version: 'v1',
        search_profile_id: null,
        notes: null,
        contacted_at: null,
        follow_up_at: null,
        deleted_at: null,
        archived_at: null,
        business_name: null,
        niche: null,
        state: null,
        city: null,
        address: null,
        phone: null,
        whatsapp_url: null,
        website_status: null,
        social_links: null,
        osm_type: null,
        osm_id: null,
        place_id: null,
        lat: null,
        lon: null,
        suggested_offer: null,
        verified_no_website: false,
      };

      const csv = leadsToCsv([mockLead]);
      expect(csv).toContain('lead_code,module,source');
      expect(csv).toContain('"04-11-WEB-0001"');
      expect(csv).toContain('"Need ""Senior"" Dev, Fast"');
      expect(csv).toContain('"react;node"');
    });

    it('serializes deals array to valid CSV', () => {
      const csv = dealsToCsv([
        {
          id: 'deal-1',
          lead_id: 'lead-1',
          deal_code: '04-11-WEB-0001',
          client: 'Acme Corp',
          project: 'Portal, App',
          value: 5000,
          currency: 'USD',
          payment_status: 'paid',
          state: 'completed',
          start_date: '2026-11-01',
          deadline: '2026-11-15',
          created_at: '2026-11-01T10:00:00Z',
          completed_at: '2026-11-15T10:00:00Z',
          notes: 'Paid in full',
        },
      ]);

      expect(csv).toContain('deal_code,client,project,value');
      expect(csv).toContain('"04-11-WEB-0001"');
      expect(csv).toContain('"Portal, App"');
      expect(csv).toContain('"5000"');
    });
  });

  describe('DataScreen UI', () => {
    it('renders data screen with export, retention and maintenance sections', () => {
      renderScreen();

      expect(screen.getByText('Data & Retention')).toBeTruthy();
      expect(screen.getByText('Data Export (CSV)')).toBeTruthy();
      expect(screen.getByText('Data Retention & Safety')).toBeTruthy();
      expect(screen.getByText('Manual Maintenance')).toBeTruthy();
    });

    it('triggers export leads CSV action', async () => {
      renderScreen();

      const exportLeadsBtn = screen.getByLabelText('Export all leads to CSV');
      fireEvent.press(exportLeadsBtn);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('leads');
      });
    });

    it('triggers export deals CSV action', async () => {
      renderScreen();

      const exportDealsBtn = screen.getByLabelText('Export all deals to CSV');
      fireEvent.press(exportDealsBtn);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('deals');
      });
    });

    it('prompts confirmation when purging trash', () => {
      renderScreen();

      const purgeBtn = screen.getByLabelText('Purge trash older than 30 days');
      fireEvent.press(purgeBtn);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Purge Trash',
        expect.stringContaining('Permanently delete leads in Trash older than 30 days?'),
        expect.any(Array)
      );
    });

    it('prompts confirmation when archiving old rejected leads', () => {
      renderScreen();

      const archiveBtn = screen.getByLabelText('Archive rejected leads older than 30 days');
      fireEvent.press(archiveBtn);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Archive Old Rejected Leads',
        expect.stringContaining('Archive rejected leads older than 30 days?'),
        expect.any(Array)
      );
    });
  });
});
