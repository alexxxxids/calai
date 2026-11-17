import type { Metadata } from 'next';
import { CalendarWorkspace } from '@/components/app/calendar-workspace';

export const metadata: Metadata = {
  title: 'Kalendarz',
};

export default function HomePage() {
  return <CalendarWorkspace />;
}
