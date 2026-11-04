import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SecretsScreen from '../../app/settings/secrets';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => {
  const fromMock = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: [
        {
          name: 'GROQ_API_KEY',
          kind: 'api_key',
          module: 'web',
          masked_preview: 'gsk_***12',
          status: 'valid',
          last_tested_at: '2026-11-04T12:00:00Z',
        },
      ],
      error: null,
    }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  });

  const functionsInvokeMock = jest.fn().mockResolvedValue({
    data: { success: true },
    error: null,
  });

  return {
    supabase: {
      from: fromMock,
      functions: {
        invoke: functionsInvokeMock,
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
      <SecretsScreen />
    </ThemeContext.Provider>
  );
}

describe('SecretsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and sections correctly', async () => {
    renderScreen();
    expect(screen.getByText('Secrets & Integrations')).toBeTruthy();
    expect(screen.getByText('AI Model Keys')).toBeTruthy();
    expect(screen.getByText('Telegram Alerts')).toBeTruthy();
    expect(screen.getByText('Push Notifications')).toBeTruthy();
  });

  it('renders existing secret with masked preview and status', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('GROQ_API_KEY')).toBeTruthy();
      expect(screen.getByText('gsk_***12')).toBeTruthy();
      expect(screen.getByText('valid')).toBeTruthy();
    });
  });

  it('opens Add Secret form when Add Key button is pressed', async () => {
    renderScreen();
    await screen.findByText('GROQ_API_KEY');

    const addButton = screen.getByLabelText('Add Secret');
    fireEvent.press(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Secret Name')).toBeTruthy();
      expect(screen.getByLabelText('Secret Value')).toBeTruthy();
      expect(screen.getByLabelText('Save Secret')).toBeTruthy();
    });
  });

  it('invokes save-secret edge function when form is submitted', async () => {
    renderScreen();
    await screen.findByText('GROQ_API_KEY');

    const addButton = screen.getByLabelText('Add Secret');
    fireEvent.press(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Secret Name')).toBeTruthy();
    });

    const nameInput = screen.getByLabelText('Secret Name');
    const valInput = screen.getByLabelText('Secret Value');
    const saveButton = screen.getByLabelText('Save Secret');

    fireEvent.changeText(nameInput, 'GEMINI_API_KEY');
    fireEvent.changeText(valInput, 'AIzaSySecretTestKey123');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('save-secret', {
        body: expect.objectContaining({
          name: 'GEMINI_API_KEY',
          value: 'AIzaSySecretTestKey123',
        }),
      });
    });
  });

  it('invokes detect-telegram-chat when Detect Chat is pressed', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        chats: [{ id: '123456789', username: 'testuser' }],
      },
      error: null,
    });

    renderScreen();
    await screen.findByText('GROQ_API_KEY');

    const detectButton = screen.getByLabelText('Detect Telegram Chat');
    fireEvent.press(detectButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('detect-telegram-chat');
    });
  });
});
