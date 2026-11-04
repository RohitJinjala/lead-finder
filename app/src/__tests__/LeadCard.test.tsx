import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { LeadCard } from '../components/LeadCard';
import { ThemeContext } from '../hooks/useTheme';
import { lightColors } from '../types/theme';
import type { Lead } from '../types/lead';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

const mockTheme = {
  mode: 'light' as const,
  setMode: jest.fn(),
  colors: lightColors,
  isDark: false,
};

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeContext.Provider value={mockTheme}>
      {ui}
    </ThemeContext.Provider>
  );
}

const baseWebLead: Lead = {
  id: '00000000-0000-0000-0000-000000000001',
  lead_code: '04-11-WEB-0001',
  module: 'web',
  source: 'reddit:r/forhire',
  source_url: 'https://reddit.com/r/forhire/comments/abc',
  dedupe_key: 'web:www.reddit.com/r/forhire/comments/abc',
  title: 'Need React developer for SaaS project',
  body: 'Looking for experienced React developer, budget $1500.',
  found_at: new Date(Date.now() - 3600000).toISOString(),
  posted_at: null,
  status: 'new',
  reject_reason: null,
  scored: true,
  score: 85,
  reason: 'Strong match for React developer',
  tags: ['react', 'node'],
  service_match: 'React development',
  tech_stack: ['React', 'Node.js'],
  budget_signal: 'stated',
  budget_amount: 1500,
  currency: 'USD',
  country: 'US',
  timezone: null,
  red_flags: [],
  draft_line: 'Hi, I noticed you need a React developer — I have 5 years of experience.',
  scored_by: 'Groq Llama',
  scored_provider: 'Groq',
  is_fallback: false,
  prompt_version: '1.0.0',
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

const baseMapsLead: Lead = {
  ...baseWebLead,
  id: '00000000-0000-0000-0000-000000000002',
  lead_code: '04-11-MAP-0001',
  module: 'maps',
  source: 'openstreetmap',
  source_url: 'https://www.openstreetmap.org/node/12345678',
  dedupe_key: 'maps:osm:node:12345678',
  title: 'The Grand Cafe',
  body: 'Business: The Grand Cafe\nNiche: restaurant_cafe\nCity: Mumbai',
  country: 'IN',
  budget_signal: null,
  budget_amount: null,
  currency: null,
  tech_stack: [],
  tags: [],
  red_flags: [],
  business_name: 'The Grand Cafe',
  niche: 'restaurant_cafe',
  city: 'Mumbai',
  state: 'Maharashtra',
  address: '123 Main St, Mumbai',
  phone: '+919876543210',
  whatsapp_url: 'https://wa.me/919876543210',
  website_status: 'none',
  social_links: { facebook: 'https://facebook.com/thegrandcafe' },
  osm_type: 'node',
  osm_id: '12345678',
  lat: 19.076,
  lon: 72.8777,
};

describe('LeadCard — Web lead', () => {
  it('renders lead code', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText('04-11-WEB-0001')).toBeTruthy();
  });

  it('renders title safely (no HTML injection)', () => {
    const lead = { ...baseWebLead, title: '<script>alert("xss")</script> React dev needed' };
    renderWithTheme(<LeadCard lead={lead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/<script>alert\("xss"\)<\/script> React dev needed/)).toBeTruthy();
  });

  it('renders score and reason', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/85\/100/)).toBeTruthy();
    expect(screen.getByText('Strong match for React developer')).toBeTruthy();
  });

  it('renders "Scored by" badge', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/Scored by: Groq Llama/)).toBeTruthy();
  });

  it('shows (fallback) when is_fallback is true', () => {
    const lead = { ...baseWebLead, is_fallback: true };
    renderWithTheme(<LeadCard lead={lead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/fallback/)).toBeTruthy();
  });

  it('shows Unscored state', () => {
    const lead = { ...baseWebLead, scored: false, score: null, reason: null, scored_by: null, tags: ['Unscored'] };
    renderWithTheme(<LeadCard lead={lead} onRefresh={jest.fn()} />);
    expect(screen.getAllByText(/Unscored/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows country and source', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/🌍 US/)).toBeTruthy();
    expect(screen.getByText(/reddit:r\/forhire/)).toBeTruthy();
  });

  it('shows budget when stated', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/1500/)).toBeTruthy();
  });

  it('shows draft line', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/I noticed you need a React developer/)).toBeTruthy();
  });

  it('shows status badge', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByText('new')).toBeTruthy();
  });

  it('renders Accept button with correct accessibility label', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByLabelText('Accept lead 04-11-WEB-0001')).toBeTruthy();
  });

  it('renders Delete button', () => {
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    expect(screen.getByLabelText('Delete lead 04-11-WEB-0001')).toBeTruthy();
  });

  it('renders very long title without crash', () => {
    const lead = { ...baseWebLead, title: 'A'.repeat(500) };
    expect(() => renderWithTheme(<LeadCard lead={lead} onRefresh={jest.fn()} />)).not.toThrow();
  });

  it('renders emoji in title without crash', () => {
    const lead = { ...baseWebLead, title: '🚀 React developer needed 🎯 $5000 budget 💰' };
    expect(() => renderWithTheme(<LeadCard lead={lead} onRefresh={jest.fn()} />)).not.toThrow();
  });
});

describe('LeadCard — Maps lead', () => {
  it('renders business name', () => {
    renderWithTheme(<LeadCard lead={baseMapsLead} onRefresh={jest.fn()} />);
    expect(screen.getAllByText(/The Grand Cafe/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Found via: OpenStreetMap" attribution', () => {
    renderWithTheme(<LeadCard lead={baseMapsLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/Found via: OpenStreetMap/)).toBeTruthy();
  });

  it('shows WhatsApp button when phone present', () => {
    renderWithTheme(<LeadCard lead={baseMapsLead} onRefresh={jest.fn()} />);
    expect(screen.getByText('WhatsApp')).toBeTruthy();
  });

  it('shows city', () => {
    renderWithTheme(<LeadCard lead={baseMapsLead} onRefresh={jest.fn()} />);
    expect(screen.getByText(/Mumbai/)).toBeTruthy();
  });

  it('renders lead code MAP format', () => {
    renderWithTheme(<LeadCard lead={baseMapsLead} onRefresh={jest.fn()} />);
    expect(screen.getByText('04-11-MAP-0001')).toBeTruthy();
  });
});

describe('LeadCard — Confirmation dialogs', () => {
  it('Accept dialog shows correct lead code and title', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    renderWithTheme(<LeadCard lead={baseWebLead} onRefresh={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Accept lead 04-11-WEB-0001'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Accept Lead',
      expect.stringContaining('04-11-WEB-0001'),
      expect.any(Array)
    );
  });
});
