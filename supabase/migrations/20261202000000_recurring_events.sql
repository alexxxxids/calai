-- Recurring hard events such as "every Tuesday 08:00-08:45" (chapter 21).
-- We store the rule, not its occurrences: expandWeekly() in src/domain turns
-- it into instants for any date range. So 08:00 stays 08:00 after a clock
-- change, and editing the rule changes every week at once.

create table public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The type gives the color and the energy of the event.
  type_id uuid not null,
  -- A title is allowed here: an event is context (busy time), not a task.
  title text not null check (char_length(btrim(title)) between 1 and 80),
  -- ISO weekday: 1 = Monday ... 7 = Sunday.
  weekday smallint not null check (weekday between 1 and 7),
  -- Local wall-clock times in the user's time zone (profiles.timezone).
  start_time time not null,
  end_time time not null,
  valid_from date not null,
  -- Inclusive; empty = no end.
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_events_time_order check (end_time > start_time),
  constraint recurring_events_valid_range check (valid_until is null or valid_until >= valid_from),
  constraint recurring_events_type_same_user foreign key (type_id, user_id)
    references public.task_types (id, user_id) on delete restrict
);

create trigger set_updated_at
  before update on public.recurring_events
  for each row execute function public.set_updated_at();

revoke all on table public.recurring_events from anon, authenticated, service_role;
grant select, insert, update, delete on table public.recurring_events to authenticated;
alter table public.recurring_events enable row level security;

create policy "recurring_events: select own" on public.recurring_events
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "recurring_events: insert own" on public.recurring_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "recurring_events: update own" on public.recurring_events
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recurring_events: delete own" on public.recurring_events
  for delete to authenticated
  using (user_id = (select auth.uid()));
