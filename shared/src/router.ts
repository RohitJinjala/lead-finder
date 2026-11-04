import { z } from 'zod';
import { ScoringOutputSchema, type ScoringOutput, type ModelEntry, type ModelStatusValue } from './schemas.js';
import { buildSystemMessage, buildUserMessage, PROMPT_VERSION, type PromptContext, type LeadTextInput } from './prompt.js';
import { scrubSecrets } from './utils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelRuntimeStatus {
  status: ModelStatusValue;
  consecutive_failures: number;
  resets_at: string | null;
  requests_today: number;
  errors_today: number;
  leads_scored_today: number;
  daily_limit: number | null;
  limit_hit_at?: string | null;
}

export interface RouterDependencies {
  /** Fetches the secret value for the given secret_name. Never logs or stores the returned value. */
  getSecret: (secretName: string) => Promise<string>;
  /** Gets the current runtime status for a model. */
  getModelStatus: (modelId: string) => Promise<ModelRuntimeStatus | null>;
  /** Updates the runtime status for a model after a call. */
  updateModelStatus: (modelId: string, update: Partial<ModelRuntimeStatus> & { last_error?: string | null }) => Promise<void>;
  /** Current time, injectable for testing. */
  now?: () => Date;
}

export interface ScoringResult {
  output: ScoringOutput;
  scored_by: string;        // model name
  scored_provider: string;  // provider name
  is_fallback: boolean;     // true if not the first enabled model
  prompt_version: string;
  model_id: string;
}

export interface RouterOptions {
  /** Maximum wait before giving up on a single model call (ms). Default: 30000 */
  timeoutMs?: number;
  /** Short cooldown after 5xx / timeout (ms). Default: 120000 (2 min) */
  shortCooldownMs?: number;
  /** Cooldown after 3 consecutive failures (ms). Default: 900000 (15 min) */
  failureCooldownMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SHORT_COOLDOWN_MS = 2 * 60 * 1000;
const DEFAULT_FAILURE_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

// ─── OpenAI-compatible chat-completions call ──────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function callChatCompletion(
  baseUrl: string,
  modelId: string,
  apiKey: string,
  messages: ChatMessage[],
  timeoutMs: number
): Promise<{ content: string; usage?: ChatCompletionResponse['usage'] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : null;
    throw new RateLimitError(retryMs);
  }

  if (response.status === 401 || response.status === 403) {
    throw new InvalidKeyError(`HTTP ${response.status}`);
  }

  if (response.status >= 500) {
    throw new ServerError(`HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new ServerError(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message?.content ?? '';
  return { content, usage: data.usage };
}

// ─── Custom error types ───────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number | null) {
    super('Rate limited');
    this.name = 'RateLimitError';
  }
}

export class InvalidKeyError extends Error {
  constructor(detail: string) {
    super(`Invalid key: ${detail}`);
    this.name = 'InvalidKeyError';
  }
}

export class ServerError extends Error {
  constructor(detail: string) {
    super(`Server error: ${detail}`);
    this.name = 'ServerError';
  }
}

export class AllModelsFailedError extends Error {
  constructor() {
    super('All models failed or are unavailable');
    this.name = 'AllModelsFailedError';
  }
}

// ─── Main router ──────────────────────────────────────────────────────────────

/**
 * Scores a lead using the model chain.
 * Tries models in priority order, skipping unavailable ones.
 * Returns a ScoringResult or throws AllModelsFailedError.
 */
export async function scoreWithChain(
  lead: LeadTextInput,
  models: ModelEntry[],
  ctx: PromptContext,
  deps: RouterDependencies,
  opts: RouterOptions = {}
): Promise<ScoringResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const shortCooldownMs = opts.shortCooldownMs ?? DEFAULT_SHORT_COOLDOWN_MS;
  const failureCooldownMs = opts.failureCooldownMs ?? DEFAULT_FAILURE_COOLDOWN_MS;
  const now = deps.now ?? (() => new Date());

  // Sort by priority ascending (lower number = higher priority)
  const sorted = [...models]
    .filter((m) => m.enabled)
    .sort((a, b) => a.priority - b.priority);

  const systemMessage = buildSystemMessage(ctx);
  const userMessage = buildUserMessage(lead);

  let firstEnabledIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    const model = sorted[i];
    if (!model) continue;

    const status = await deps.getModelStatus(model.id);

    // Check if model is available
    if (status) {
      if (status.status === 'disabled') continue;
      if (status.status === 'invalid_key') continue;

      if (status.status === 'cooling_down' || status.status === 'limit_reached') {
        // Check if cooldown has expired
        if (status.resets_at && new Date(status.resets_at) > now()) {
          continue; // still cooling down
        }
        // Cooldown expired — reset to available
        await deps.updateModelStatus(model.id, { status: 'available', resets_at: null, consecutive_failures: 0 });
      }

      if (status.status === 'limit_reached') {
        // Also skip if daily limit is reached and not yet reset
        if (status.resets_at && new Date(status.resets_at) > now()) {
          continue;
        }
      }

      // Check daily limit
      if (model.daily_limit !== null && status.requests_today >= model.daily_limit) {
        const resetTime = computeResetTime(model.reset_tz, model.reset_hour, now());
        await deps.updateModelStatus(model.id, {
          status: 'limit_reached',
          limit_hit_at: now().toISOString(),
          resets_at: resetTime.toISOString(),
        });
        continue;
      }
    }

    // Try to get the API key
    let apiKey: string;
    try {
      apiKey = await deps.getSecret(model.secret_name);
    } catch {
      await deps.updateModelStatus(model.id, { status: 'invalid_key', last_error: 'Could not retrieve secret' });
      continue;
    }

    const isFirstEnabled = i === firstEnabledIndex;

    // Attempt the call
    try {
      const result = await callChatCompletion(
        model.base_url,
        model.model_id,
        apiKey,
        [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        timeoutMs
      );

      // Parse and validate JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        throw new ParseError('Invalid JSON response');
      }

      const validated = ScoringOutputSchema.parse(parsed);

      // Success — update counters
      const prevStatus = status ?? { requests_today: 0, leads_scored_today: 0, errors_today: 0, consecutive_failures: 0 };
      await deps.updateModelStatus(model.id, {
        status: 'available',
        requests_today: prevStatus.requests_today + 1,
        leads_scored_today: prevStatus.leads_scored_today + 1,
        consecutive_failures: 0,
        last_error: null,
      });

      return {
        output: validated,
        scored_by: model.name,
        scored_provider: model.provider,
        is_fallback: !isFirstEnabled,
        prompt_version: PROMPT_VERSION,
        model_id: model.id,
      };
    } catch (err) {
      const prevStatus = status ?? { requests_today: 0, errors_today: 0, consecutive_failures: 0, resets_at: null, leads_scored_today: 0 };
      const newConsecutive = prevStatus.consecutive_failures + 1;
      const scrubbedError = err instanceof Error ? scrubSecrets(err.message) : 'Unknown error';

      if (err instanceof RateLimitError) {
        const cooldownMs = err.retryAfterMs ?? shortCooldownMs;
        const resetsAt = new Date(now().getTime() + cooldownMs).toISOString();
        const newStatus: ModelStatusValue = 'cooling_down';
        await deps.updateModelStatus(model.id, {
          status: newStatus,
          resets_at: resetsAt,
          errors_today: prevStatus.errors_today + 1,
          requests_today: prevStatus.requests_today + 1,
          consecutive_failures: newConsecutive,
          last_error: scrubbedError,
        });
        continue;
      }

      if (err instanceof InvalidKeyError) {
        await deps.updateModelStatus(model.id, {
          status: 'invalid_key',
          errors_today: prevStatus.errors_today + 1,
          consecutive_failures: newConsecutive,
          last_error: scrubbedError,
        });
        continue;
      }

      // ServerError, ParseError, timeout (AbortError), or unknown
      const isCoolingDown = newConsecutive >= MAX_CONSECUTIVE_FAILURES;
      const resetsAt = isCoolingDown
        ? new Date(now().getTime() + failureCooldownMs).toISOString()
        : new Date(now().getTime() + shortCooldownMs).toISOString();

      await deps.updateModelStatus(model.id, {
        status: 'cooling_down',
        resets_at: resetsAt,
        requests_today: prevStatus.requests_today + 1,
        errors_today: prevStatus.errors_today + 1,
        consecutive_failures: newConsecutive,
        last_error: scrubbedError,
      });
      continue;
    }

    // Track firstEnabled for is_fallback
    firstEnabledIndex++;
  }

  throw new AllModelsFailedError();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class ParseError extends Error {
  constructor(detail: string) {
    super(`Parse error: ${detail}`);
    this.name = 'ParseError';
  }
}

function computeResetTime(tz: string, hour: number, from: Date): Date {
  // Find the next occurrence of `hour` in the given timezone
  const candidate = new Date(from);
  // Set to today at `hour:00:00` in `tz`
  const todayStr = candidate.toLocaleDateString('en-CA', { timeZone: tz });
  const resetCandidate = new Date(`${todayStr}T${String(hour).padStart(2, '0')}:00:00`);
  // If that time is in the past, add a day
  if (resetCandidate <= from) {
    resetCandidate.setDate(resetCandidate.getDate() + 1);
  }
  return resetCandidate;
}

// Suppress unused import warning — z is used transitively by re-exported schemas
void z;
