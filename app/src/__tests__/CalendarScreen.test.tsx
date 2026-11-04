import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CalendarScreen from '../../app/(tabs)/calendar';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'leads') {
      const todayStr = new Date().toISOString().slice(0, 10);
      return {
        select: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lead-1',
              lead_code: '04-11-WEB-0001',
              title: 'React Native Expert Needed',
              business_name: null,
              module: 'web',
              found_at: `${todayStr}T10:00:00Z`,
              contacted_at: `${todayStr}T11:00:00Z`,
              follow_up_at: `${todayStr}T14:00:00Z`,
            },
            {
              id: 'lead-2',
              lead_code: '04-11-MAP-0002',
              title: 'Salon Booking Site',
              business_name: 'Glamour Salon',
              module: 'maps',
              found_at: '2026-11-01T08:00:00Z',
              contacted_at: null,
              follow_up_at: null,
            },
          ],
          error: null,
        }),
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
      <CalendarScreen />
    </ThemeContext.Provider>
  );
}

describe('CalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders calendar title and Due Today section', async () => {
    renderScreen();

    expect(screen.getByText('Calendar & Schedule')).toBeTruthy();
    expect(screen.getByLabelText('Due Today Section')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByText('04-11-WEB-0001').length).toBeGreaterThan(0);
    });
  });

  it('allows toggling between month and day view', async () => {
    renderScreen();

    const dayViewBtn = screen.getByLabelText('Day View');
    fireEvent.press(dayViewBtn);

    const monthViewBtn = screen.getByLabelText('Month View');
    fireEvent.press(monthViewBtn);

    expect(screen.getByLabelText('Month Calendar Grid')).toBeTruthy();
  });

  it('allows date navigation with Prev, Next and Jump to Today buttons', async () => {
    renderScreen();

    const nextBtn = screen.getByLabelText('Next Day');
    fireEvent.press(nextBtn);

    const prevBtn = screen.getByLabelText('Previous Day');
    fireEvent.press(prevBtn);

    const todayBtn = screen.getByLabelText('Jump to Today');
    fireEvent.press(todayBtn);

    expect(screen.getByLabelText('Jump to Today')).toBeTruthy();
  });

  it('supports quick follow up reschedule (+1d, +3d)', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText('Postpone 1 day')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Postpone 1 day'));
    expect(supabase.from).toHaveBeenCalledWith('leads');
  });
});
