import 'server-only';
import { GoogleGenAI } from '@google/genai';
import * as z from 'zod';
import {
  parseModelOutput,
  reasonFromError,
  reasonFromInteraction,
  type AiUsage,
  type GeminiResult,
} from '@/features/ai/results';
import type { AiMimeType } from '@/features/ai/uploads';
import { serverEnv } from '@/lib/env';

// The ONLY door to Gemini (ADR-008): ESLint forbids importing @google/genai anywhere else.
// Interactions API: one call = one interaction; store: false, so Google keeps no copy of it.

/**
 * A file for the model: its type and its bytes as base64.
 *
 * The `data` field must contain a raw base64 string without data: URI scheme prefix
 * (e.g. without 'data:image/...;base64,' or 'data:application/pdf;base64,').
 */
export interface AiFile {
  readonly mimeType: AiMimeType;
  /** Raw base64 string without data: URI scheme prefix. */
  readonly data: string;
}

export interface GeminiRequest<T> {
  /** The answer's shape: sent to the model as JSON Schema and used to check the answer. */
  readonly schema: z.ZodType<T>;
  readonly system: string;
  readonly prompt: string;
  readonly files: readonly AiFile[];
}

/** The routes may run 120 s (maxDuration); the model gets 90 of them, the rest is for storage and the database. */
const GEMINI_TIMEOUT_MS = 90_000;

export async function callGemini<T>(request: GeminiRequest<T>): Promise<GeminiResult<T>> {
  const { GEMINI_API_KEY, GEMINI_MODEL } = serverEnv();
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  try {
    const interaction = await ai.interactions.create(
      {
        model: GEMINI_MODEL,
        store: false,
        system_instruction: request.system,
        input: [...request.files.map(toFileContent), { type: 'text', text: request.prompt }],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: z.toJSONSchema(request.schema),
        },
      },
      { timeout: GEMINI_TIMEOUT_MS },
    );

    const usage: AiUsage = {
      model: interaction.model ?? GEMINI_MODEL,
      inputTokens: interaction.usage?.total_input_tokens ?? null,
      outputTokens: interaction.usage?.total_output_tokens ?? null,
    };
    const failure = reasonFromInteraction(interaction.status, interaction.output_text);
    if (failure !== null) {
      console.error('[ai/gateway] unusable interaction', { status: interaction.status, model: usage.model });
      return { ok: false, reason: failure, usage };
    }
    // reasonFromInteraction returned null, so output_text is a non-empty string here.
    const data = parseModelOutput(interaction.output_text ?? '', request.schema);
    return data === null ? { ok: false, reason: 'invalid_output', usage } : { ok: true, data, usage };
  } catch (error) {
    console.error('[ai/gateway] Gemini call failed', { model: GEMINI_MODEL, error });
    return { ok: false, reason: reasonFromError(error), usage: null };
  }
}

/** PDFs go to the model as documents, photos and screenshots as images. */
function toFileContent(file: AiFile) {
  return file.mimeType === 'application/pdf'
    ? { type: 'document' as const, data: file.data, mime_type: file.mimeType }
    : { type: 'image' as const, data: file.data, mime_type: file.mimeType };
}
