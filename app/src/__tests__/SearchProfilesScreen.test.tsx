import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SearchProfilesScreen from '../../app/settings/search-profiles';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'search_profiles') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'prof-1',
            brief: 'React/Node contracts',
          },
          error: null,
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'prof-1' }, error: null }),
        }),
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      };
    }
    if (table === 'search_plans') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            version: 1,
            plan: {
              keywords: ['react', 'node'],
              exclusions: ['wordpress'],
              subreddits: ['forhire'],
              countries: ['US'],
              sources: { reddit: true, hackernews: true },
            },
          },
          error: null,
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'plan-v2', version: 2 }, error: null }),
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue({ neq: jest.fn().mockResolvedValue({ error: null }) }),
    };
  });

  return {
    supabase: {
      from: fromMock,
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: {
            plan: {
              keywords: ['react', 'next.js', 'node'],
              exclusions: ['wordpress', 'intern'],
              subreddits: ['forhire', 'hiring'],
              countries: ['US', 'EU'],
              sources: { reddit: true, hackernews: true },
            },
          },
          error: null,
        }),
      },
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
      <SearchProfilesScreen />
    </ThemeContext.Provider>
  );
}

describe('SearchProfilesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, module tabs, brief, and existing plan version', async () => {
    renderScreen();
    expect(screen.getByText('Search Profiles & Plans')).toBeTruthy();
    expect(screen.getByText('Web Leads Plan')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('🟢 Active Plan: Plan v1')).toBeTruthy();
    });
  });

  it('renders editable keyword and exclusion chips', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('react ✕')).toBeTruthy();
      expect(screen.getByText('wordpress ✕')).toBeTruthy();
    });
  });

  it('calls generate-plan function when proposal button is tapped', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Generate Query Proposal')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Generate Query Proposal'));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-plan', {
        body: expect.objectContaining({ module: 'web' }),
      });
    });
  });

  it('approves plan and saves incremented plan version', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Approve Search Plan')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Approve Search Plan'));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('search_plans');
    });
  });
});
