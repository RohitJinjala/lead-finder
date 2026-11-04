/**
 * Shared utility functions — web-standard APIs only.
 * No Node.js or Deno specifics.
 */

/**
 * Truncates a string to maxLength characters, appending "..." if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Scrubs potential secret patterns from an error message string.
 * Used before logging errors to ensure no key leaks.
 */
export function scrubSecrets(message: string): string {
  return message
    // Google API keys
    .replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_GOOGLE_KEY]')
    // OpenAI-style keys
    .replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_SK_KEY]')
    // Groq keys
    .replace(/gsk_[A-Za-z0-9]{20,}/g, '[REDACTED_GROQ_KEY]')
    // NVIDIA NIM
    .replace(/nvapi-[A-Za-z0-9_-]{20,}/g, '[REDACTED_NVAPI_KEY]')
    // Telegram bot tokens
    .replace(/\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b/g, '[REDACTED_TG_TOKEN]')
    // JWT-shaped strings (Supabase service keys etc.)
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]');
}

/**
 * Returns a masked preview of a secret: first 4 + last 2 chars, rest replaced with *.
 * Never returns the full secret.
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 6) return '***';
  const first = secret.slice(0, 4);
  const last = secret.slice(-2);
  const middle = '*'.repeat(Math.min(secret.length - 6, 20));
  return `${first}${middle}${last}`;
}

/**
 * Escapes plain text for safe inclusion in a Telegram message (MarkdownV2 format).
 * Per Telegram docs, these characters must be escaped: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
export function escapeTelegramMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, (c) => `\\${c}`);
}

/**
 * Escapes HTML special characters for safe rendering.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates a dedupe key for a web lead from its URL.
 */
export function makeWebDedupeKey(sourceUrl: string): string {
  // Normalize the URL: strip trailing slashes and query params that change but don't identify the post
  const url = new URL(sourceUrl);
  // For Reddit, the path alone is sufficient
  return `web:${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/, '');
}

/**
 * Generates a dedupe key for a Maps lead from its OSM type and ID.
 */
export function makeMapsDedupeKey(osmType: string, osmId: string): string {
  return `maps:osm:${osmType}:${osmId}`;
}

/**
 * Formats a date as Asia/Kolkata date string YYYY-MM-DD.
 */
export function toKolkataDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'en-CA' gives YYYY-MM-DD
}

/**
 * Sleeps for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }
  throw lastError;
}
