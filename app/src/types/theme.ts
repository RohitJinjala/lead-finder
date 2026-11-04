export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  text: string;
  textSecondary: string;
  error: string;
  success: string;
  warning: string;
  score: {
    high: string;
    medium: string;
    low: string;
  };
  statusBadge: {
    new: string;
    acceptable: string;
    rejected: string;
    contacted: string;
    replied: string;
    won: string;
    lost: string;
  };
}

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  primary: '#007AFF',
  primaryForeground: '#FFFFFF',
  secondary: '#E5E7EB',
  secondaryForeground: '#1F2937',
  muted: '#F3F4F6',
  mutedForeground: '#6B7280',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#6B7280',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  score: {
    high: '#10B981',
    medium: '#F59E0B',
    low: '#EF4444',
  },
  statusBadge: {
    new: '#3B82F6',
    acceptable: '#10B981',
    rejected: '#EF4444',
    contacted: '#8B5CF6',
    replied: '#F59E0B',
    won: '#059669',
    lost: '#9CA3AF',
  },
};

export const darkColors: ThemeColors = {
  background: '#111827',
  surface: '#1F2937',
  primary: '#3B82F6',
  primaryForeground: '#FFFFFF',
  secondary: '#374151',
  secondaryForeground: '#F9FAFB',
  muted: '#374151',
  mutedForeground: '#9CA3AF',
  border: '#374151',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  error: '#F87171',
  success: '#34D399',
  warning: '#FCD34D',
  score: {
    high: '#34D399',
    medium: '#FCD34D',
    low: '#F87171',
  },
  statusBadge: {
    new: '#60A5FA',
    acceptable: '#34D399',
    rejected: '#F87171',
    contacted: '#A78BFA',
    replied: '#FCD34D',
    won: '#6EE7B7',
    lost: '#6B7280',
  },
};

