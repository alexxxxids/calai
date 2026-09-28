import 'server-only';
import * as z from 'zod';

/** Vercel's documented minimum for a cron secret. */
const CRON_SECRET_MIN_LENGTH = 16;

/**
 * Server-only secrets, validated on first use. Validation is lazy on purpose:
 * `next build` runs without secrets, and a module that throws at import time
 * would break the build instead of the one request that needs the key.
 */
const ServerEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  CRON_SECRET: z.string().min(CRON_SECRET_MIN_LENGTH),
  APP_URL: z.url(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().startsWith('mailto:').optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) {
    return cached;
  }
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server environment variables: ${invalid} (see .env.example).`);
  }
  cached = parsed.data;
  return cached;
}
