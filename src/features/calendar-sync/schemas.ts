import * as z from 'zod';

export const FEED_TOKEN_LENGTH = 64;
export const FEED_TOKEN_REGEX = /^[0-9a-f]{64}$/;

export const feedTokenSchema = z
  .string()
  .length(FEED_TOKEN_LENGTH, 'Token musi mieć dokładnie 64 znaki')
  .regex(FEED_TOKEN_REGEX, 'Nieprawidłowy format tokenu');

export function isValidFeedToken(token: unknown): token is string {
  return typeof token === 'string' && FEED_TOKEN_REGEX.test(token);
}
