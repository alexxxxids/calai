import { describe, expect, it } from 'vitest';
import {
  addSubscriptionSchema,
  isPrivateHostname,
  isPrivateIpAddress,
  normalizeCalendarUrl,
  removeSubscriptionSchema,
  SUBSCRIPTION_NAME_MAX_LENGTH,
  SUBSCRIPTION_NAME_MIN_LENGTH,
  syncSubscriptionSchema,
} from './schemas';

describe('normalizeCalendarUrl', () => {
  it('converts webcal:// protocol to https://', () => {
    expect(normalizeCalendarUrl('webcal://example.com/feed.ics')).toBe(
      'https://example.com/feed.ics'
    );
  });

  it('handles case-insensitive WEBCAL:// protocol', () => {
    expect(normalizeCalendarUrl('WEBCAL://example.com/feed.ics')).toBe(
      'https://example.com/feed.ics'
    );
    expect(normalizeCalendarUrl('WebCal://example.com/feed.ics')).toBe(
      'https://example.com/feed.ics'
    );
  });

  it('preserves https:// URLs unchanged', () => {
    expect(normalizeCalendarUrl('https://example.com/feed.ics')).toBe(
      'https://example.com/feed.ics'
    );
  });

  it('preserves other schemes (which will fail later in refinement)', () => {
    expect(normalizeCalendarUrl('http://example.com/feed.ics')).toBe(
      'http://example.com/feed.ics'
    );
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeCalendarUrl('  webcal://example.com/feed.ics  ')).toBe(
      'https://example.com/feed.ics'
    );
    expect(normalizeCalendarUrl('   https://example.com/feed.ics\t\n')).toBe(
      'https://example.com/feed.ics'
    );
  });
});

describe('isPrivateIpAddress', () => {
  it('identifies loopback IPv4 addresses (127.0.0.0/8)', () => {
    expect(isPrivateIpAddress('127.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('127.255.255.255')).toBe(true);
    expect(isPrivateIpAddress('127.1.2.3')).toBe(true);
  });

  it('identifies RFC 1918 private IPv4 ranges', () => {
    // 10.0.0.0/8
    expect(isPrivateIpAddress('10.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('10.255.255.255')).toBe(true);

    // 172.16.0.0/12
    expect(isPrivateIpAddress('172.16.0.1')).toBe(true);
    expect(isPrivateIpAddress('172.31.255.255')).toBe(true);
    expect(isPrivateIpAddress('172.15.255.255')).toBe(false);
    expect(isPrivateIpAddress('172.32.0.1')).toBe(false);

    // 192.168.0.0/16
    expect(isPrivateIpAddress('192.168.0.1')).toBe(true);
    expect(isPrivateIpAddress('192.168.255.255')).toBe(true);
    expect(isPrivateIpAddress('192.169.0.1')).toBe(false);
  });

  it('identifies cloud metadata and link-local IPv4 (169.254.0.0/16)', () => {
    expect(isPrivateIpAddress('169.254.169.254')).toBe(true);
    expect(isPrivateIpAddress('169.254.1.1')).toBe(true);
  });

  it('identifies CGNAT range (100.64.0.0/10)', () => {
    expect(isPrivateIpAddress('100.64.0.1')).toBe(true);
    expect(isPrivateIpAddress('100.127.255.255')).toBe(true);
    expect(isPrivateIpAddress('100.63.255.255')).toBe(false);
    expect(isPrivateIpAddress('100.128.0.1')).toBe(false);
  });

  it('identifies unspecified and broadcast IPv4', () => {
    expect(isPrivateIpAddress('0.0.0.0')).toBe(true);
    expect(isPrivateIpAddress('255.255.255.255')).toBe(true);
  });

  it('identifies public IPv4 addresses as non-private', () => {
    expect(isPrivateIpAddress('8.8.8.8')).toBe(false);
    expect(isPrivateIpAddress('1.1.1.1')).toBe(false);
    expect(isPrivateIpAddress('140.82.121.3')).toBe(false);
  });

  it('identifies IPv6 loopback and unspecified addresses', () => {
    expect(isPrivateIpAddress('::1')).toBe(true);
    expect(isPrivateIpAddress('::')).toBe(true);
  });

  it('identifies IPv6 link-local (fe80::/10) and unique local (fc00::/7)', () => {
    expect(isPrivateIpAddress('fe80::1')).toBe(true);
    expect(isPrivateIpAddress('fe80::dead:beef')).toBe(true);
    expect(isPrivateIpAddress('febf::1')).toBe(true);

    expect(isPrivateIpAddress('fc00::1')).toBe(true);
    expect(isPrivateIpAddress('fd00::1')).toBe(true);
    expect(isPrivateIpAddress('fd12:3456:789a::1')).toBe(true);
  });

  it('identifies IPv4-mapped and IPv4-compatible IPv6 addresses', () => {
    expect(isPrivateIpAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIpAddress('::ffff:192.168.1.1')).toBe(true);
    expect(isPrivateIpAddress('::ffff:8.8.8.8')).toBe(false);

    expect(isPrivateIpAddress('::127.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('::8.8.8.8')).toBe(false);
  });

  it('identifies public IPv6 addresses as non-private', () => {
    expect(isPrivateIpAddress('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIpAddress('2607:f8b0:4005:805::200e')).toBe(false);
  });

  it('returns false for invalid IP strings', () => {
    expect(isPrivateIpAddress('not-an-ip')).toBe(false);
    expect(isPrivateIpAddress('example.com')).toBe(false);
    expect(isPrivateIpAddress('')).toBe(false);
  });
});

describe('isPrivateHostname', () => {
  it('detects localhost and its subdomains', () => {
    expect(isPrivateHostname('localhost')).toBe(true);
    expect(isPrivateHostname('LOCALHOST')).toBe(true);
    expect(isPrivateHostname('  localhost  ')).toBe(true);
    expect(isPrivateHostname('sub.localhost')).toBe(true);
    expect(isPrivateHostname('api.dev.localhost')).toBe(true);
  });

  it('detects .local and .internal domains', () => {
    expect(isPrivateHostname('printer.local')).toBe(true);
    expect(isPrivateHostname('my-machine.local')).toBe(true);
    expect(isPrivateHostname('metadata.internal')).toBe(true);
    expect(isPrivateHostname('service.internal')).toBe(true);
  });

  it('detects IP address hostnames (with or without brackets)', () => {
    expect(isPrivateHostname('127.0.0.1')).toBe(true);
    expect(isPrivateHostname('169.254.169.254')).toBe(true);
    expect(isPrivateHostname('192.168.1.1')).toBe(true);
    expect(isPrivateHostname('10.0.0.1')).toBe(true);
    expect(isPrivateHostname('[::1]')).toBe(true);
    expect(isPrivateHostname('::1')).toBe(true);
    expect(isPrivateHostname('[fe80::1]')).toBe(true);
  });

  it('allows public domain names and public IPs', () => {
    expect(isPrivateHostname('example.com')).toBe(false);
    expect(isPrivateHostname('calendar.google.com')).toBe(false);
    expect(isPrivateHostname('outlook.office365.com')).toBe(false);
    expect(isPrivateHostname('8.8.8.8')).toBe(false);
    expect(isPrivateHostname('[2001:4860:4860::8888]')).toBe(false);
  });

  it('does not false-positive on domains containing localhost/local as part of label', () => {
    expect(isPrivateHostname('localhost.com')).toBe(false);
    expect(isPrivateHostname('mylocalhost.org')).toBe(false);
    expect(isPrivateHostname('localization.net')).toBe(false);
    expect(isPrivateHostname('internal.com')).toBe(false);
  });
});

describe('addSubscriptionSchema', () => {
  const validTypeId = 'c281df68-5a4f-4d92-9118-a6f95874288b';
  const validUrl = 'https://calendar.google.com/calendar/ical/test/basic.ics';

  it('accepts valid input with https:// URL', () => {
    const input = {
      name: 'Google Calendar',
      url: validUrl,
      typeId: validTypeId,
    };
    const result = addSubscriptionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Google Calendar');
      expect(result.data.url).toBe(validUrl);
      expect(result.data.typeId).toBe(validTypeId);
    }
  });

  it('normalizes webcal:// to https:// in output', () => {
    const input = {
      name: 'iCloud Work',
      url: 'webcal://calendar.example.com/work.ics',
      typeId: validTypeId,
    };
    const result = addSubscriptionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://calendar.example.com/work.ics');
    }
  });

  describe('name length validation', () => {
    it(`accepts name of length ${SUBSCRIPTION_NAME_MIN_LENGTH}`, () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'A',
        url: validUrl,
        typeId: validTypeId,
      });
      expect(result.success).toBe(true);
    });

    it(`accepts name of length ${SUBSCRIPTION_NAME_MAX_LENGTH}`, () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'A'.repeat(SUBSCRIPTION_NAME_MAX_LENGTH),
        url: validUrl,
        typeId: validTypeId,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = addSubscriptionSchema.safeParse({
        name: '',
        url: validUrl,
        typeId: validTypeId,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Nazwa jest wymagana');
      }
    });

    it('rejects whitespace-only name', () => {
      const result = addSubscriptionSchema.safeParse({
        name: '   ',
        url: validUrl,
        typeId: validTypeId,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Nazwa jest wymagana');
      }
    });

    it(`rejects name longer than ${SUBSCRIPTION_NAME_MAX_LENGTH}`, () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'A'.repeat(SUBSCRIPTION_NAME_MAX_LENGTH + 1),
        url: validUrl,
        typeId: validTypeId,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Nazwa może mieć maksymalnie 60 znaków'
        );
      }
    });
  });

  describe('url and SSRF validation', () => {
    it('rejects plain http:// URLs', () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'HTTP Calendar',
        url: 'http://example.com/feed.ics',
        typeId: validTypeId,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Nieprawidłowy adres kalendarza (wymagany publiczny adres https://)'
        );
      }
    });

    it('rejects non-URL strings', () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'Bad URL',
        url: 'not-a-url',
        typeId: validTypeId,
      });
      expect(result.success).toBe(false);
    });

    it('rejects private IPv4 addresses (SSRF protection)', () => {
      const privateUrls = [
        'https://127.0.0.1/feed.ics',
        'webcal://127.0.0.1/feed.ics',
        'https://10.0.0.1/feed.ics',
        'https://192.168.1.1/feed.ics',
        'https://172.16.0.1/feed.ics',
        'https://169.254.169.254/latest/meta-data/',
      ];

      for (const url of privateUrls) {
        const result = addSubscriptionSchema.safeParse({
          name: 'Private IP',
          url,
          typeId: validTypeId,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            'Nieprawidłowy adres kalendarza (wymagany publiczny adres https://)'
          );
        }
      }
    });

    it('rejects private hostnames (localhost, .local, .internal)', () => {
      const privateHosts = [
        'https://localhost/feed.ics',
        'https://sub.localhost/feed.ics',
        'https://my-server.local/feed.ics',
        'https://metadata.internal/feed.ics',
      ];

      for (const url of privateHosts) {
        const result = addSubscriptionSchema.safeParse({
          name: 'Private Host',
          url,
          typeId: validTypeId,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            'Nieprawidłowy adres kalendarza (wymagany publiczny adres https://)'
          );
        }
      }
    });

    it('rejects IPv6 private addresses (SSRF protection)', () => {
      const privateIpv6Urls = [
        'https://[::1]/feed.ics',
        'https://[fe80::1]/feed.ics',
        'https://[fc00::1]/feed.ics',
      ];

      for (const url of privateIpv6Urls) {
        const result = addSubscriptionSchema.safeParse({
          name: 'Private IPv6',
          url,
          typeId: validTypeId,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            'Nieprawidłowy adres kalendarza (wymagany publiczny adres https://)'
          );
        }
      }
    });
  });

  describe('typeId validation', () => {
    it('accepts valid UUID for typeId', () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'Valid Type',
        url: validUrl,
        typeId: validTypeId,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID typeId', () => {
      const result = addSubscriptionSchema.safeParse({
        name: 'Invalid Type',
        url: validUrl,
        typeId: 'invalid-uuid-123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Nieprawidłowy identyfikator typu zadania'
        );
      }
    });
  });
});

describe('removeSubscriptionSchema', () => {
  it('accepts valid UUID subscriptionId', () => {
    const validUuid = 'c281df68-5a4f-4d92-9118-a6f95874288b';
    const result = removeSubscriptionSchema.safeParse({
      subscriptionId: validUuid,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscriptionId).toBe(validUuid);
    }
  });

  it('rejects invalid subscriptionId', () => {
    const result = removeSubscriptionSchema.safeParse({
      subscriptionId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Nieprawidłowy identyfikator subskrypcji'
      );
    }
  });
});

describe('syncSubscriptionSchema', () => {
  it('accepts valid UUID subscriptionId', () => {
    const validUuid = 'c281df68-5a4f-4d92-9118-a6f95874288b';
    const result = syncSubscriptionSchema.safeParse({
      subscriptionId: validUuid,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscriptionId).toBe(validUuid);
    }
  });

  it('rejects invalid subscriptionId', () => {
    const result = syncSubscriptionSchema.safeParse({
      subscriptionId: 'bad-id',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Nieprawidłowy identyfikator subskrypcji'
      );
    }
  });
});
