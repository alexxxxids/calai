import type * as z from 'zod';

// What can come back from the model and how each failure is explained (spec FR-92).
// Pure functions without the SDK, so they are unit-tested; gateway.ts uses them.

/** Why the AI gave no usable draft. Every reason has its own message for the user. */
export type AiFailureReason =
  | 'rate_limited'
  | 'payment_required'
  | 'blocked'
  | 'invalid_output'
  | 'unavailable';

/** Tokens are what Google bills; they are saved in ai_requests to watch the costs. */
export interface AiUsage {
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export type GeminiResult<T> =
  | { ok: true; data: T; usage: AiUsage }
  | { ok: false; reason: AiFailureReason; usage: AiUsage | null };

const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_UNPROCESSABLE = 422;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** The answer of our API for each reason: an HTTP status and a Polish message for the user. */
export const AI_FAILURE = {
  rate_limited: {
    status: HTTP_SERVICE_UNAVAILABLE,
    message: 'Asystent AI jest teraz przeciążony. Spróbuj za kilka minut albo wpisz dane ręcznie.',
  },
  payment_required: {
    status: HTTP_SERVICE_UNAVAILABLE,
    message: 'Asystent AI jest chwilowo niedostępny. Wpisz dane ręcznie.',
  },
  blocked: {
    status: HTTP_UNPROCESSABLE,
    message: 'AI nie przygotowało propozycji dla tego pliku. Spróbuj innego pliku albo wpisz dane ręcznie.',
  },
  invalid_output: {
    status: HTTP_BAD_GATEWAY,
    message: 'AI odpowiedziało w nieoczekiwany sposób. Spróbuj ponownie albo wpisz dane ręcznie.',
  },
  unavailable: {
    status: HTTP_BAD_GATEWAY,
    message: 'Nie udało się połączyć z asystentem AI. Spróbuj ponownie za chwilę.',
  },
} as const satisfies Record<AiFailureReason, { status: number; message: string }>;

/**
 * A thrown SDK error → the reason. API errors of the SDK carry the HTTP `status`;
 * a network failure or a timeout has none and counts as "unavailable".
 */
export function reasonFromError(error: unknown): AiFailureReason {
  const status = httpStatusOf(error);
  if (status === HTTP_TOO_MANY_REQUESTS) {
    return 'rate_limited';
  }
  if (status === HTTP_PAYMENT_REQUIRED) {
    return 'payment_required';
  }
  return 'unavailable';
}

/**
 * A finished interaction → the reason it is unusable, or null when there is an answer to check.
 * 'incomplete' means the model stopped early (safety filters, output limit), and a completed
 * interaction without any text means the model refused to answer: both are "blocked".
 */
export function reasonFromInteraction(
  status: string,
  outputText: string | undefined,
): AiFailureReason | null {
  if (status === 'incomplete') {
    return 'blocked';
  }
  if (status !== 'completed') {
    return 'unavailable';
  }
  const hasText = outputText !== undefined && outputText.trim() !== '';
  return hasText ? null : 'blocked';
}

/**
 * The model's text → data checked by the schema, or null. The model was asked for JSON by the
 * same schema, but that is a request, not a guarantee: only the check makes it data we trust.
 */
export function parseModelOutput<T>(text: string, schema: z.ZodType<T>): T | null {
  const parsed = schema.safeParse(parseJson(text));
  return parsed.success ? parsed.data : null;
}

const MARKDOWN_CODE_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = MARKDOWN_CODE_FENCE.exec(trimmed);
  return match !== null && match[1] !== undefined ? match[1].trim() : trimmed;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(stripMarkdownCodeFence(text));
  } catch {
    return undefined; // not JSON at all: the schema rejects undefined like any other bad value
  }
}

function httpStatusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return typeof error.status === 'number' ? error.status : null;
  }
  return null;
}
