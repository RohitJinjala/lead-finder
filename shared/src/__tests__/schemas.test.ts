import { describe, it, expect } from 'vitest';
import { ScoringOutputSchema } from '../schemas.js';

const validOutput = {
  score: 85,
  reason: 'Strong match',
  tags: ['react'],
  service_match: 'React development',
  tech_stack: ['React'],
  budget_signal: 'stated',
  budget_amount: 1500,
  currency: 'USD',
  country: 'US',
  red_flags: [],
  draft_line: 'Hi there!',
};

describe('ScoringOutputSchema', () => {
  it('accepts a valid output', () => {
    expect(() => ScoringOutputSchema.parse(validOutput)).not.toThrow();
  });

  it('rejects extra fields (strict mode)', () => {
    expect(() => ScoringOutputSchema.parse({ ...validOutput, extra: 'bad' })).toThrow();
  });

  it('rejects missing score', () => {
    const invalid: Record<string, unknown> = { ...validOutput };
    delete invalid['score'];
    expect(() => ScoringOutputSchema.parse(invalid)).toThrow();
  });

  it('rejects score out of range (> 100)', () => {
    expect(() => ScoringOutputSchema.parse({ ...validOutput, score: 101 })).toThrow();
  });

  it('rejects score out of range (< 0)', () => {
    expect(() => ScoringOutputSchema.parse({ ...validOutput, score: -1 })).toThrow();
  });

  it('rejects invalid budget_signal', () => {
    expect(() => ScoringOutputSchema.parse({ ...validOutput, budget_signal: 'unknown' })).toThrow();
  });

  it('rejects invalid red_flag value', () => {
    expect(() => ScoringOutputSchema.parse({ ...validOutput, red_flags: ['invalid_flag'] })).toThrow();
  });

  it('accepts null budget_amount', () => {
    expect(() => ScoringOutputSchema.parse({ ...validOutput, budget_amount: null })).not.toThrow();
  });
});
