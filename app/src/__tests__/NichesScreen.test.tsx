import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LocationsAndNichesScreen from '../../app/settings/niches';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'search_presets') {
      return {
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'preset-1',
                name: 'California Tech Centers',
                countries: ['US'],
                states: ['CA'],
                cities: ['San Francisco', 'Los Angeles'],
                niches: ['restaurant_cafe', 'gym_fitness'],
                last_searched_at: '2026-11-04T10:00:00Z',
              },
            ],
            error: null,
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === 'niche_offers') {
      return {
        select: jest.fn().mockResolvedValue({
          data: [
            {
              niche: 'school_coaching',
              offer_text: 'Custom school & coaching management portal',
              enabled: true,
            },
          ],
          error: null,
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
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
      <LocationsAndNichesScreen />
    </ThemeContext.Provider>
  );
}

describe('LocationsAndNichesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, tabs, and cascading location picker', async () => {
    renderScreen();

    expect(screen.getByText('Locations & Niche Offers')).toBeTruthy();
    expect(screen.getByLabelText('Locations Tab')).toBeTruthy();
    expect(screen.getByLabelText('Niches Tab')).toBeTruthy();
    expect(screen.getByText('Cascading Location Picker')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('California Tech Centers')).toBeTruthy();
    });
  });

  it('cascades selection: Country -> State -> Cities', async () => {
    renderScreen();

    // Select United Kingdom
    const ukChip = screen.getByLabelText('Country United Kingdom');
    fireEvent.press(ukChip);

    // States for UK should be displayed
    await waitFor(() => {
      expect(screen.getByLabelText('State England')).toBeTruthy();
    });

    // Select a city in England (e.g. London)
    const londonChip = screen.getByLabelText('City London');
    fireEvent.press(londonChip);

    expect(screen.getByText(/3\. Select Cities \(1 selected\)/)).toBeTruthy();
  });

  it('switches to Niche Offers tab and displays default niches with OSM tags', async () => {
    renderScreen();

    const nichesTab = screen.getByLabelText('Niches Tab');
    fireEvent.press(nichesTab);

    expect(screen.getByText('Niche Offer Templates')).toBeTruthy();
    expect(screen.getByText('School / Coaching Institute')).toBeTruthy();
    expect(screen.getByText('Clinic / Dental Practice')).toBeTruthy();
    expect(screen.getByText('Gym / Fitness Studio')).toBeTruthy();
    expect(screen.getByText('Restaurant / Cafe')).toBeTruthy();
  });

  it('displays OpenStreetMap and geographical dataset attribution', () => {
    renderScreen();

    expect(screen.getByText('Geographical Attribution')).toBeTruthy();
    expect(screen.getByText(/© OpenStreetMap contributors/)).toBeTruthy();
  });
});
