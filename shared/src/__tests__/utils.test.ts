import { describe, it, expect } from 'vitest';
import { maskSecret, scrubSecrets, escapeTelegramMarkdown, escapeHtml, makeWebDedupeKey, makeMapsDedupeKey } from '../utils.js';

describe('maskSecret', () => {
  it('shows first 4 and last 2 chars', () => {
    const result = maskSecret('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567');
    expect(result.startsWith('AIza')).toBe(true);
    expect(result.endsWith('67')).toBe(true);
    expect(result).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ12345');
  });

  it('never returns full secret for short secrets', () => {
    expect(maskSecret('abc')).toBe('***');
  });
});

describe('scrubSecrets', () => {
  it('scrubs Google API key', () => {
    const msg = 'Error with key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678';
    expect(scrubSecrets(msg)).not.toContain('AIzaSy');
    expect(scrubSecrets(msg)).toContain('[REDACTED_GOOGLE_KEY]');
  });

  it('scrubs JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzNDU2Nzg5MCJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(scrubSecrets(jwt)).toContain('[REDACTED_JWT]');
  });

  it('leaves normal text unchanged', () => {
    expect(scrubSecrets('Database connection failed')).toBe('Database connection failed');
  });
});

describe('escapeTelegramMarkdown', () => {
  it('escapes special characters', () => {
    expect(escapeTelegramMarkdown('Hello! Score: 85.')).toContain('\\!');
    expect(escapeTelegramMarkdown('React-Node')).toContain('\\-');
  });
});

describe('escapeHtml', () => {
  it('escapes < > & characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

describe('makeWebDedupeKey', () => {
  it('generates consistent key from URL', () => {
    const key1 = makeWebDedupeKey('https://www.reddit.com/r/forhire/comments/abc123/post_title/');
    const key2 = makeWebDedupeKey('https://www.reddit.com/r/forhire/comments/abc123/post_title');
    expect(key1).toBe(key2);
  });
});

describe('makeMapsDedupeKey', () => {
  it('generates consistent key from OSM type and ID', () => {
    expect(makeMapsDedupeKey('node', '12345678')).toBe('maps:osm:node:12345678');
  });
});

