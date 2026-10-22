export { CalendarFeedSettings } from './components/calendar-feed-settings';
export type { CalendarFeedSettingsProps } from './components/calendar-feed-settings';

export { CalendarSubscriptionsSettings } from './components/calendar-subscriptions-settings';
export type {
  CalendarSubscriptionsSettingsProps,
  TaskTypeOption,
} from './components/calendar-subscriptions-settings';

export {
  rotateFeedToken,
  getFeedTokenAction,
  addSubscription,
  removeSubscription,
  syncSubscriptionAction,
} from './actions';
export type { RotateFeedTokenResult, GetFeedTokenResult } from './actions';

export { getCalendarFeedToken, listCalendarSubscriptions } from './queries';
export type { CalendarSubscriptionWithDetails } from './queries';

export {
  syncSubscription,
  syncAllSubscriptions,
  fetchIcalFeed,
  formatSyncError,
} from './sync-subscription';
export type {
  SyncSubscriptionResult,
  SyncItemSummary,
  SyncAllSummary,
} from './sync-subscription';

export { parseAndExpandIcal } from './parse-ical';
export type { ExternalEventPayload, ParseIcalOptions } from './parse-ical';

export {
  feedTokenSchema,
  isValidFeedToken,
  FEED_TOKEN_LENGTH,
  FEED_TOKEN_REGEX,
  addSubscriptionSchema,
  removeSubscriptionSchema,
  syncSubscriptionSchema,
  normalizeCalendarUrl,
  isPrivateHostname,
  isPrivateIpAddress,
} from './schemas';
export type {
  AddSubscriptionInput,
  RemoveSubscriptionInput,
  SyncSubscriptionInput,
} from './schemas';

export {
  generateIcsFeed,
  getFeedDateRange,
  FEED_PAST_DAYS,
  FEED_FUTURE_DAYS,
  MS_PER_DAY,
  REST_FALLBACK_TITLE,
  TASK_FALLBACK_TITLE,
  CALENDAR_NAME,
} from './feed-generator';

export type { FeedBlockItem, FeedDateRange } from './feed-generator';
