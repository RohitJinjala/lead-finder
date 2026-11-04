import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../../app/auth';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => {
  const getSessionMock = jest.fn().mockResolvedValue({ data: { session: null } });
  const onAuthStateChangeMock = jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
  const signInWithPasswordMock = jest.fn().mockResolvedValue({ data: {}, error: null });
  const signOutMock = jest.fn().mockResolvedValue({ error: null });
  const rpcMock = jest.fn();

  return {
    supabase: {
      auth: {
        getSession: getSessionMock,
        onAuthStateChange: onAuthStateChangeMock,
        signInWithPassword: signInWithPasswordMock,
        signOut: signOutMock,
      },
      rpc: rpcMock,
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
      <AuthScreen />
    </ThemeContext.Provider>
  );
}

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
  });

  it('renders the public signup security warning banner', () => {
    renderScreen();
    expect(screen.getByLabelText('Security banner')).toBeTruthy();
    expect(screen.getByText(/Security Notice: Public Sign-ups/)).toBeTruthy();
    expect(screen.getByText(/Disable public sign-ups in your Supabase Dashboard/)).toBeTruthy();
  });

  it('renders email, password inputs and sign-in button when logged out', () => {
    renderScreen();
    expect(screen.getByLabelText('Email input')).toBeTruthy();
    expect(screen.getByLabelText('Password input')).toBeTruthy();
    expect(screen.getByLabelText('Sign in with email and password')).toBeTruthy();
  });

  it('shows error if sign in is attempted with empty fields', async () => {
    renderScreen();
    const signInButton = screen.getByLabelText('Sign in with email and password');
    fireEvent.press(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter both email and password.')).toBeTruthy();
    });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('calls signInWithPassword with entered credentials', async () => {
    renderScreen();
    const emailInput = screen.getByLabelText('Email input');
    const passInput = screen.getByLabelText('Password input');
    const signInButton = screen.getByLabelText('Sign in with email and password');

    fireEvent.changeText(emailInput, 'owner@example.com');
    fireEvent.changeText(passInput, 'secretpassword');
    fireEvent.press(signInButton);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'secretpassword',
      });
    });
  });

  it('shows owner status and Claim Ownership button when signed in as non-owner', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'owner@example.com' },
        },
      },
    });
    (supabase.rpc as jest.Mock).mockImplementation((name: string) => {
      if (name === 'is_owner') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('owner@example.com')).toBeTruthy();
      expect(screen.getByText('Non-Owner')).toBeTruthy();
      expect(screen.getByLabelText('Claim ownership of this Lead Finder instance')).toBeTruthy();
    });
  });

  it('successfully claims owner when Claim Ownership is pressed', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'owner@example.com' },
        },
      },
    });
    (supabase.rpc as jest.Mock).mockImplementation((name: string) => {
      if (name === 'is_owner') return Promise.resolve({ data: false, error: null });
      if (name === 'claim_owner') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText('Claim ownership of this Lead Finder instance')).toBeTruthy();
    });

    const claimButton = screen.getByLabelText('Claim ownership of this Lead Finder instance');
    fireEvent.press(claimButton);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('claim_owner');
      expect(screen.getByText(/Congratulations! You are now the registered owner/)).toBeTruthy();
      expect(screen.getByText('Verified Owner')).toBeTruthy();
    });
  });

  it('shows Verified Owner badge when user is already the owner', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'owner@example.com' },
        },
      },
    });
    (supabase.rpc as jest.Mock).mockImplementation((name: string) => {
      if (name === 'is_owner') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Verified Owner')).toBeTruthy();
      expect(screen.queryByLabelText('Claim ownership of this Lead Finder instance')).toBeNull();
    });
  });
});

