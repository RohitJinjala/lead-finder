import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AnalyticsScreen from '../../app/(tabs)/analytics';
import { supabase } from '../../src/lib/supabase';

// Mock supabase
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('AnalyticsScreen', () => {
  const mockLeadsData = [
    {
      id: 'l1',
      lead_code: '04-11-WEB-0001',
      module: 'web',
      source: 'hackernews',
      found_at: new Date().toISOString(),
      status: 'acceptable',
      scored: true,
      score: 85,
      country: 'United States',
      niche: 'SaaS',
      reject_reason: null,
      deleted_at: null,
      archived_at: null,
    },
    {
      id: 'l2',
      lead_code: '04-11-MAP-0001',
      module: 'maps',
      source: 'overpass',
      found_at: new Date().toISOString(),
      status: 'won',
      scored: true,
      score: 92,
      country: 'India',
      niche: 'Dental Clinic',
      reject_reason: null,
      deleted_at: null,
      archived_at: null,
    },
    {
      id: 'l3',
      lead_code: '04-11-WEB-0002',
      module: 'web',
      source: 'reddit',
      found_at: new Date().toISOString(),
      status: 'rejected',
      scored: true,
      score: 30,
      country: 'Canada',
      niche: 'Design',
      reject_reason: 'low budget',
      deleted_at: null,
      archived_at: null,
    },
  ];

  const mockDealsData = [
    {
      id: 'd1',
      lead_id: '04-11-MAP-0001',
      value: 1200,
      currency: 'USD',
      payment_status: 'paid',
      state: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'leads') {
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockLeadsData, error: null }),
        };
      }
      if (table === 'deals') {
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockDealsData, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    });
  });

  it('renders analytics dashboard with title and filters', async () => {
    const { getByText, getByLabelText } = render(<AnalyticsScreen />);

    await waitFor(() => {
      expect(getByText('Analytics Dashboard')).toBeTruthy();
    });

    expect(getByLabelText('All Modules')).toBeTruthy();
    expect(getByLabelText('Web Leads')).toBeTruthy();
    expect(getByLabelText('Maps Leads')).toBeTruthy();
    expect(getByLabelText('7 Days')).toBeTruthy();
  });

  it('computes and displays KPIs accurately', async () => {
    const { getByText, getAllByText } = render(<AnalyticsScreen />);

    await waitFor(() => {
      expect(getByText('Useful-Lead Rate')).toBeTruthy();
      expect(getByText('Reply Rate')).toBeTruthy();
      expect(getByText('Win Rate')).toBeTruthy();
      expect(getByText('Closed Revenue')).toBeTruthy();
    });

    // Closed revenue is $1,200 (appears in KPI card and revenue trend)
    expect(getAllByText('$1,200').length).toBeGreaterThan(0);
  });

  it('renders the qualification funnel stages', async () => {
    const { getByText } = render(<AnalyticsScreen />);

    await waitFor(() => {
      expect(getByText('Lead Qualification Funnel')).toBeTruthy();
      expect(getByText('New')).toBeTruthy();
      expect(getByText('Acceptable')).toBeTruthy();
      expect(getByText('Contacted')).toBeTruthy();
      expect(getByText('Replied')).toBeTruthy();
      expect(getByText('Won')).toBeTruthy();
    });
  });

  it('allows switching module filter and toggling custom range input', async () => {
    const { getByLabelText, getByText } = render(<AnalyticsScreen />);

    await waitFor(() => {
      expect(getByText('Analytics Dashboard')).toBeTruthy();
    });

    // Switch to Web Leads
    fireEvent.press(getByLabelText('Web Leads'));
    expect(getByLabelText('Web Leads')).toBeTruthy();

    // Switch to Custom Range
    fireEvent.press(getByLabelText('Custom'));
    await waitFor(() => {
      expect(getByLabelText('Enter number of past days')).toBeTruthy();
    });
  });

  it('handles and displays error with retry button', async () => {
    (supabase.from as jest.Mock).mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database connection failed' } }),
    }));

    const { getByText } = render(<AnalyticsScreen />);

    await waitFor(() => {
      expect(getByText('Database connection failed')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });
});
