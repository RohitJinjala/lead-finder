import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ModelsScreen from '../../app/settings/models';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === 'secret_meta') {
      return {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { name: 'GROQ_API_KEY', masked_preview: 'gsk_****12', status: 'valid' },
          ],
          error: null,
        }),
      };
    }

    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'model-1',
            module: 'web',
            name: 'Groq Llama 3',
            provider: 'groq',
            base_url: 'https://api.groq.com/openai/v1',
            model_id: 'llama-3.3-70b-versatile',
            secret_name: 'GROQ_API_KEY',
            priority: 1,
            enabled: true,
            daily_limit: 500,
            reset_tz: 'Asia/Kolkata',
            reset_hour: 0,
          },
          {
            id: 'model-2',
            module: 'web',
            name: 'Gemini Flash',
            provider: 'gemini',
            base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
            model_id: 'gemini-2.5-flash',
            secret_name: 'GEMINI_API_KEY',
            priority: 2,
            enabled: true,
            daily_limit: 1500,
            reset_tz: 'Asia/Kolkata',
            reset_hour: 0,
          },
        ],
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    };
  });

  return {
    supabase: {
      from: fromMock,
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: { status: 'valid', message: 'Tested successfully' }, error: null }),
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
      <ModelsScreen />
    </ThemeContext.Provider>
  );
}

describe('ModelsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, module tabs, and configured models', async () => {
    renderScreen();
    expect(screen.getByText('AI Model Chain')).toBeTruthy();
    expect(screen.getByText('Web Module')).toBeTruthy();
    expect(screen.getByText('Maps Module')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Groq Llama 3')).toBeTruthy();
      expect(screen.getByText('Gemini Flash')).toBeTruthy();
    });
  });

  it('renders priority badges and reorder buttons', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
      expect(screen.getByLabelText('Move Groq Llama 3 down')).toBeTruthy();
      expect(screen.getByLabelText('Move Gemini Flash up')).toBeTruthy();
    });
  });

  it('reorders models when arrow button is pressed', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Move Groq Llama 3 down')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Move Groq Llama 3 down'));
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('model_chain');
    });
  });

  it('shows add model form with provider presets, API key input, and test model button', async () => {
    renderScreen();
    const addButton = screen.getByLabelText('Add Model to Chain');
    fireEvent.press(addButton);

    await waitFor(() => {
      expect(screen.getByText('GROQ')).toBeTruthy();
      expect(screen.getByText('GEMINI')).toBeTruthy();
      expect(screen.getByText('NVIDIA')).toBeTruthy();
      expect(screen.getByText('MISTRAL')).toBeTruthy();
      expect(screen.getByText('OPENROUTER')).toBeTruthy();
      expect(screen.getByLabelText('Model Friendly Name')).toBeTruthy();
      expect(screen.getByLabelText('API Key')).toBeTruthy();
      expect(screen.getByLabelText('Test Model Configuration')).toBeTruthy();
    });
  });

  it('tests model configuration from the add form using saved secret', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Add Model to Chain'));

    await waitFor(() => {
      expect(screen.getByLabelText('Test Model Configuration')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Test Model Configuration'));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('test-secret', {
        body: expect.objectContaining({
          name: 'GROQ_API_KEY',
          test_type: 'ai_model',
          model_id: 'llama-3.3-70b-versatile',
        }),
      });
    });
  });
});
