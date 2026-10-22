import { isIP } from 'node:net';
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

export const SUBSCRIPTION_NAME_MIN_LENGTH = 1;
export const SUBSCRIPTION_NAME_MAX_LENGTH = 60;

const IPV4_PARTS_COUNT = 4;
const IPV4_OCTET_MIN = 0;
const IPV4_OCTET_MAX = 255;
const IPV4_OCTET_REGEX = /^\d{1,3}$/;

const IPV4_SHIFT_24 = 24;
const IPV4_SHIFT_16 = 16;
const IPV4_SHIFT_8 = 8;
const BYTE_MASK = 0xff;
const HEX_RADIX = 16;

const IPV4_KIND = 4;
const IPV6_KIND = 6;
const IPV6_HEXTETS_COUNT = 8;
const IPV6_HEXTET_REGEX = /^[0-9a-f]{1,4}$/i;

const IPV6_LINK_LOCAL_MASK = 0xffc0;
const IPV6_LINK_LOCAL_PREFIX = 0xfe80;

const IPV6_UNIQUE_LOCAL_MASK = 0xfe00;
const IPV6_UNIQUE_LOCAL_PREFIX = 0xfc00;

const IPV6_MAPPED_PREFIX_LENGTH = 5;
const IPV6_LOOPBACK_PREFIX_LENGTH = 7;
const IPV6_MAPPED_V4_HEXTET = 0xffff;

const PRIVATE_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'] as const;

/**
 * Precomputed IPv4 numeric ranges for private, loopback, link-local, and reserved networks.
 */
const IPV4_PRIVATE_RANGES: ReadonlyArray<{ readonly start: number; readonly end: number }> = [
  // 0.0.0.0/8 (unspecified)
  { start: 0, end: 16777215 },
  // 10.0.0.0/8 (RFC 1918)
  { start: 167772160, end: 184549375 },
  // 100.64.0.0/10 (Carrier-Grade NAT)
  { start: 1681915904, end: 1686110207 },
  // 127.0.0.0/8 (loopback)
  { start: 2130706432, end: 2147483647 },
  // 169.254.0.0/16 (link-local / cloud metadata)
  { start: 2851995648, end: 2852061183 },
  // 172.16.0.0/12 (RFC 1918)
  { start: 2886729728, end: 2887778303 },
  // 192.168.0.0/16 (RFC 1918)
  { start: 3232235520, end: 3232301055 },
  // 255.255.255.255/32 (broadcast)
  { start: 4294967295, end: 4294967295 },
];

/**
 * Normalizes an iCal calendar subscription URL.
 * Trims whitespace and replaces webcal:// protocol with https://.
 */
export function normalizeCalendarUrl(url: string): string {
  const trimmed = url.trim();
  if (/^webcal:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice('webcal://'.length)}`;
  }
  return trimmed;
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== IPV4_PARTS_COUNT) {
    return null;
  }
  const numbers: number[] = [];
  for (const part of parts) {
    if (!IPV4_OCTET_REGEX.test(part)) {
      return null;
    }
    const num = Number(part);
    if (num < IPV4_OCTET_MIN || num > IPV4_OCTET_MAX) {
      return null;
    }
    numbers.push(num);
  }
  const [b0, b1, b2, b3] = numbers;
  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    return null;
  }
  return [b0, b1, b2, b3];
}

function ipv4ToNumber(octets: [number, number, number, number]): number {
  const [b0, b1, b2, b3] = octets;
  return ((b0 << IPV4_SHIFT_24) >>> 0) + (b1 << IPV4_SHIFT_16) + (b2 << IPV4_SHIFT_8) + b3;
}

function isPrivateIpv4(ip: string): boolean {
  const octets = parseIpv4Octets(ip);
  if (!octets) {
    return false;
  }
  const num = ipv4ToNumber(octets);
  return IPV4_PRIVATE_RANGES.some((r) => num >= r.start && num <= r.end);
}

function replaceEmbeddedIpv4(ip: string): string | null {
  if (!ip.includes('.')) {
    return ip;
  }
  const lastColon = ip.lastIndexOf(':');
  if (lastColon === -1) {
    return null;
  }
  const octets = parseIpv4Octets(ip.slice(lastColon + 1));
  if (!octets) {
    return null;
  }
  const [p0, p1, p2, p3] = octets;
  const hex1 = (((p0 << IPV4_SHIFT_8) | p1) >>> 0).toString(HEX_RADIX);
  const hex2 = (((p2 << IPV4_SHIFT_8) | p3) >>> 0).toString(HEX_RADIX);
  return `${ip.slice(0, lastColon)}:${hex1}:${hex2}`;
}

function convertHextets(hextets: string[]): number[] | null {
  const result: number[] = [];
  for (const h of hextets) {
    if (!IPV6_HEXTET_REGEX.test(h)) {
      return null;
    }
    result.push(parseInt(h, HEX_RADIX));
  }
  return result;
}

function parseIpv6Hextets(ip: string): number[] | null {
  const normalized = replaceEmbeddedIpv4(ip.toLowerCase());
  if (!normalized) {
    return null;
  }
  const parts = normalized.split('::');
  if (parts.length > 2) {
    return null;
  }
  const [leftStr = '', rightStr] = parts;
  const left = leftStr.length > 0 ? leftStr.split(':') : [];
  const right = rightStr !== undefined && rightStr.length > 0 ? rightStr.split(':') : [];
  const missing = IPV6_HEXTETS_COUNT - (left.length + right.length);
  if (missing < 0) {
    return null;
  }
  const middle = parts.length > 1 ? Array<string>(missing).fill('0') : [];
  const allHextets = [...left, ...middle, ...right];
  if (allHextets.length !== IPV6_HEXTETS_COUNT) {
    return null;
  }
  return convertHextets(allHextets);
}

function checkIpv6MappedV4(w: number[]): boolean {
  if (!w.slice(0, IPV6_MAPPED_PREFIX_LENGTH).every((val) => val === 0)) {
    return false;
  }
  const [, , , , , w5 = 0, w6 = 0, w7 = 0] = w;
  if (w5 !== 0 && w5 !== IPV6_MAPPED_V4_HEXTET) {
    return false;
  }
  const b0 = (w6 >> IPV4_SHIFT_8) & BYTE_MASK;
  const b1 = w6 & BYTE_MASK;
  const b2 = (w7 >> IPV4_SHIFT_8) & BYTE_MASK;
  const b3 = w7 & BYTE_MASK;
  const num = ipv4ToNumber([b0, b1, b2, b3]);
  return IPV4_PRIVATE_RANGES.some((r) => num >= r.start && num <= r.end);
}

function isPrivateIpv6Hextets(w: number[]): boolean {
  const [w0 = 0, , , , , , , w7 = 0] = w;
  if (w.every((val) => val === 0)) {
    return true;
  }
  if (w7 === 1 && w.slice(0, IPV6_LOOPBACK_PREFIX_LENGTH).every((val) => val === 0)) {
    return true;
  }
  if ((w0 & IPV6_LINK_LOCAL_MASK) === IPV6_LINK_LOCAL_PREFIX) {
    return true;
  }
  if ((w0 & IPV6_UNIQUE_LOCAL_MASK) === IPV6_UNIQUE_LOCAL_PREFIX) {
    return true;
  }
  return checkIpv6MappedV4(w);
}

/**
 * Checks whether an IP address belongs to private/internal/reserved ranges
 * to prevent SSRF (Server-Side Request Forgery).
 */
export function isPrivateIpAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === IPV4_KIND) {
    return isPrivateIpv4(ip);
  }
  if (kind === IPV6_KIND) {
    const hextets = parseIpv6Hextets(ip);
    return hextets !== null && isPrivateIpv6Hextets(hextets);
  }
  return false;
}

/**
 * Checks whether a hostname resolves to a private IP, loopback, or private internal domain.
 */
export function isPrivateHostname(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (isPrivateIpAddress(clean)) {
    return true;
  }
  const normalized = clean.endsWith('.') ? clean.slice(0, -1) : clean;
  if (normalized === 'localhost') {
    return true;
  }
  return PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export const addSubscriptionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(SUBSCRIPTION_NAME_MIN_LENGTH, 'Nazwa jest wymagana')
    .max(
      SUBSCRIPTION_NAME_MAX_LENGTH,
      'Nazwa może mieć maksymalnie 60 znaków'
    ),
  url: z
    .string()
    .trim()
    .min(1, 'Adres URL jest wymagany')
    .transform(normalizeCalendarUrl)
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          if (parsed.protocol !== 'https:') {
            return false;
          }
          if (isPrivateHostname(parsed.hostname)) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      {
        message:
          'Nieprawidłowy adres kalendarza (wymagany publiczny adres https://)',
      }
    ),
  typeId: z.string().uuid('Nieprawidłowy identyfikator typu zadania'),
});

export const removeSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('Nieprawidłowy identyfikator subskrypcji'),
});

export const syncSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('Nieprawidłowy identyfikator subskrypcji'),
});

export type AddSubscriptionInput = z.infer<typeof addSubscriptionSchema>;
export type RemoveSubscriptionInput = z.infer<typeof removeSubscriptionSchema>;
export type SyncSubscriptionInput = z.infer<typeof syncSubscriptionSchema>;
