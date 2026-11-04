import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DealsScreen from '../../app/(tabs)/deals';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';

jest.mock('../lib/supabase', () => {
  const mockDeals = [
    {
      id: 'deal-1',
      lead_id: 'lead-1',
      deal_code: '04-11-WEB-0001',
      client: 'Acme SaaS Corp',
      project: 'Mobile App MVP',
      value: 4500,
      currency: 'USD',
      start_date: '2026-11-04',
      deadline: '2026-12-01',
      payment_status: 'unpaid',
      state: 'live',
      notes: 'Deliver Figma first',
      created_at: '2026-11-04T10:00:00Z',
      completed_at: null,
    },
    {
      id: 'deal-2',
      lead_id: 'lead-2',
      deal_code: '04-11-WEB-0002',
      client: 'Beta Ltd',
      project: 'Backend API',
      value: 2000,
      currency: 'USD',
      start_date: '2026-10-15',
      deadline: '2026-11-01',
      payment_status: 'paid',
      state: 'completed',
      notes: 'Final payment received',
      created_at: '2026-10-15T10:00:00Z',
      completed_at: '2026-11-01T15:00:00Z',
    },
  ];

  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'deals') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((col: string, val: string) => ({
          order: jest.fn().mockResolvedValue({
            data: mockDeals.filter((d) => (col === 'state' ? d.state === val : true)),
            error: null,
          }),
        })),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
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
      <DealsScreen />
    </ThemeContext.Provider>
  );
}

describe('DealsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('renders Live deals tab with KPI value and deal cards', async () => {
    renderScreen();

    expect(screen.getByLabelText('Live Deals Tab')).toBeTruthy();
    expect(screen.getByLabelText('Completed Deals Tab')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('04-11-WEB-0001')).toBeTruthy();
      expect(screen.getByText('Mobile App MVP')).toBeTruthy();
      expect(screen.getByText('Client: Acme SaaS Corp')).toBeTruthy();
      expect(screen.getByText('USD 4,500')).toBeTruthy();
      expect(screen.getAllByText('UNPAID').length).toBeGreaterThan(0);
    });
  });

  it('filters deals by payment status', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('04-11-WEB-0001')).toBeTruthy();
    });

    const paidFilter = screen.getByText('PAID');
    fireEvent.press(paidFilter);

    // Live deals with payment_status 'unpaid' will be filtered out
    await waitFor(() => {
      expect(screen.getByText('No live deals currently.')).toBeTruthy();
    });
  });

  it('switches to Completed deals tab', async () => {
    renderScreen();

    const completedTab = screen.getByLabelText('Completed Deals Tab');
    fireEvent.press(completedTab);

    await waitFor(() => {
      expect(screen.getByText('04-11-WEB-0002')).toBeTruthy();
      expect(screen.getByText('Backend API')).toBeTruthy();
      expect(screen.getAllByText('PAID').length).toBeGreaterThan(0);
    });
  });

  it('triggers confirmation dialog when Mark Complete is pressed', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText('Mark deal 04-11-WEB-0001 complete')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Mark deal 04-11-WEB-0001 complete'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Complete Deal',
      expect.stringContaining('04-11-WEB-0001 · Mobile App MVP'),
      expect.any(Array)
    );
  });
});
