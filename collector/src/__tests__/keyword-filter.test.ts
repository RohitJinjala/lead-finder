import { describe, it, expect } from 'vitest';
import { passesKeywordFilter } from '../keyword-filter.js';

describe('passesKeywordFilter', () => {
  it('passes when a keyword matches the title', () => {
    expect(passesKeywordFilter('Need React developer', '', {
      keywords: ['react'],
      exclusions: [],
    })).toBe(true);
  });

  it('passes when a keyword matches the body', () => {
    expect(passesKeywordFilter('Developer needed', 'React and Node.js experience required', {
      keywords: ['react'],
      exclusions: [],
    })).toBe(true);
  });

  it('drops when no keyword matches', () => {
    expect(passesKeywordFilter('WordPress plugin needed', 'Need WP developer', {
      keywords: ['react', 'node'],
      exclusions: [],
    })).toBe(false);
  });

  it('drops when exclusion matches even if keyword matches', () => {
    expect(passesKeywordFilter('React developer wanted full-time', 'React full-time job', {
      keywords: ['react'],
      exclusions: ['full-time'],
    })).toBe(false);
  });

  it('passes when no keywords configured (empty array)', () => {
    expect(passesKeywordFilter('Anything', 'At all', {
      keywords: [],
      exclusions: [],
    })).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(passesKeywordFilter('Need REACT Developer', '', {
      keywords: ['react'],
      exclusions: [],
    })).toBe(true);
  });
});

