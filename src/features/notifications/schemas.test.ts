import { describe, expect, it } from 'vitest';
import { NotificationPayloadSchema, SubscribePushSchema, UnsubscribePushSchema } from './schemas';

describe('notifications schemas', () => {
  describe('SubscribePushSchema', () => {
    it('accepts valid https subscription parameters', () => {
      const valid = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0BE9I7CsxmxnwtWhlWhetLpIdzGXAfKgsDTICWtgSt80=',
        authSecret: 'tBHItJI5svbpez7KI4CCXg==',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      const result = SubscribePushSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects non-https endpoint', () => {
      const invalid = {
        endpoint: 'http://insecure.endpoint.com/test',
        p256dh: 'valid-p256dh-key',
        authSecret: 'valid-auth-secret',
      };

      const result = SubscribePushSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing p256dh or authSecret', () => {
      const missingKeys = {
        endpoint: 'https://push.example.com/endpoint',
        p256dh: '',
        authSecret: '',
      };

      const result = SubscribePushSchema.safeParse(missingKeys);
      expect(result.success).toBe(false);
    });
  });

  describe('UnsubscribePushSchema', () => {
    it('accepts valid https endpoint', () => {
      const result = UnsubscribePushSchema.safeParse({
        endpoint: 'https://fcm.googleapis.com/fcm/send/sub-123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid endpoint', () => {
      const result = UnsubscribePushSchema.safeParse({
        endpoint: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NotificationPayloadSchema', () => {
    it('validates a complete payload', () => {
      const payload = {
        title: 'CalAI Notification',
        body: 'Upcoming block starting soon',
        icon: '/icon-192.png',
        tag: 'block-123',
        data: { url: '/calendar' },
      };

      const result = NotificationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects empty title or body', () => {
      expect(NotificationPayloadSchema.safeParse({ title: '', body: 'text' }).success).toBe(false);
      expect(NotificationPayloadSchema.safeParse({ title: 'Title', body: '' }).success).toBe(false);
    });
  });
});
