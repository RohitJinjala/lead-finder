import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ModulesScreen from '../../app/settings/modules';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'user_settings') {
      return {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'settings-1',
            web_module_enabled: true,
            maps_module_enabled: true,
            scoring_cap_per_run: 40,
            alert_threshold: 75,
          },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'settings-1' }],
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'settings-1' },
              error: null,
            }),
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
      <ModulesScreen />
    </ThemeContext.Provider>
  );
}

describe('ModulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders module configuration title and module cards', async () => {
    renderScreen();

    expect(screen.getByText('Modules Configuration')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Web Leads Module')).toBeTruthy();
      expect(screen.getByText('Maps Leads Module')).toBeTruthy();
      expect(screen.getByText('AI Scoring Cap Per Run')).toBeTruthy();
    });
  });

  it('allows toggling web and maps modules', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText('Toggle Web Leads Module')).toBeTruthy();
      expect(screen.getByLabelText('Toggle Maps Leads Module')).toBeTruthy();
    });

    const webSwitch = screen.getByLabelText('Toggle Web Leads Module');
    fireEvent(webSwitch, 'valueChange', false);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('user_settings');
    });
  });

  it('allows changing scoring cap per run', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText('Set cap to 60 leads')).toBeTruthy();
    });

    const cap60 = screen.getByLabelText('Set cap to 60 leads');
    fireEvent.press(cap60);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('user_settings');
    });
  });
});
