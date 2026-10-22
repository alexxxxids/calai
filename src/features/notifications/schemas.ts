import * as z from 'zod';

const USER_AGENT_MAX_LENGTH = 500;
const NOTIFICATION_TITLE_MAX_LENGTH = 200;
const NOTIFICATION_BODY_MAX_LENGTH = 1000;

export const SubscribePushSchema = z.object({
  endpoint: z.string().url().regex(/^https:\/\//, 'Endpoint must use HTTPS'),
  p256dh: z.string().min(1, 'Missing p256dh key'),
  authSecret: z.string().min(1, 'Missing authSecret key'),
  userAgent: z.string().max(USER_AGENT_MAX_LENGTH).optional(),
});

export type SubscribePushInput = z.infer<typeof SubscribePushSchema>;

export const UnsubscribePushSchema = z.object({
  endpoint: z.string().url().regex(/^https:\/\//, 'Endpoint must use HTTPS'),
});

export type UnsubscribePushInput = z.infer<typeof UnsubscribePushSchema>;

export const NotificationPayloadSchema = z.object({
  title: z.string().min(1).max(NOTIFICATION_TITLE_MAX_LENGTH),
  body: z.string().min(1).max(NOTIFICATION_BODY_MAX_LENGTH),
  icon: z.string().optional(),
  badge: z.string().optional(),
  tag: z.string().optional(),
  data: z
    .object({
      url: z.string(),
    })
    .optional(),
});

export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
