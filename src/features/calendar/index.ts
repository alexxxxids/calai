export { getCalendarItems } from './get-calendar-items';

export {
  calendarQuerySchema,
  MAX_CALENDAR_RANGE_DAYS,
  type CalendarQueryInput,
} from './schemas';

export {
  expandRecurringToCalendarEvents,
  mapBlockToCalendarEvent,
  mapExternalToCalendarEvent,
} from './event-mappers';

export type {
  CalendarEventExtendedProps,
  CalendarEventItem,
  CalendarItemKind,
  CalendarRange,
  TaskTypeItem,
} from './types';
