/**
 * Public Supabase settings. Both values are safe to ship to the browser:
 * the publishable key only allows what Row Level Security allows.
 *
 * `process.env.NEXT_PUBLIC_*` must be written out literally: Next.js inlines
 * these values into the browser bundle at build time and cannot inline
 * a dynamic lookup such as `process.env[name]`.
 */
export function supabaseConfig(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).',
    );
  }
  return { url, publishableKey };
}
