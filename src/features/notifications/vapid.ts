import 'server-only';

import webpush from 'web-push';
import { serverEnv } from '@/lib/env';

export interface VapidConfig {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
}

export function getVapidConfig(): VapidConfig | null {
  const env = serverEnv();
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { subject, publicKey, privateKey };
}

let isConfigured = false;

/**
 * Lazily configures global web-push with VAPID details if all 3 keys are present.
 * Returns true if configured and ready, false if keys are missing.
 */
export function ensureVapidConfigured(): boolean {
  if (isConfigured) {
    return true;
  }

  const config = getVapidConfig();
  if (!config) {
    return false;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  isConfigured = true;
  return true;
}
