-- Habits and their daily check marks (chapter 22).

-- habits ---------------------------------------------------------------------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- ISO weekdays the habit is due on, 1 = Monday ... 7 = Sunday.
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_id_user_unique unique (id, user_id)
);

create trigger set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

revoke all on table public.habits from anon, authenticated, service_role;
grant select, insert, update, delete on table public.habits to authenticated;
alter table public.habits enable row level security;

create policy "habits: select own" on public.habits
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "habits: insert own" on public.habits
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "habits: update own" on public.habits
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "habits: delete own" on public.habits
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- habit_checks ---------------------------------------------------------------

-- A check mark is a row: checking inserts it, unchecking deletes it. There is
-- no "done" flag, because two ways of saying one thing would drift apart.
create table public.habit_checks (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The user's LOCAL date: a check at 00:30 in Warsaw belongs to that day,
  -- even though it is still the previous day in UTC.
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day),
  constraint habit_checks_habit_same_user foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

-- No update: a check mark is either there or not.
revoke all on table public.habit_checks from anon, authenticated, service_role;
grant select, insert, delete on table public.habit_checks to authenticated;
alter table public.habit_checks enable row level security;

create policy "habit_checks: select own" on public.habit_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_checks: insert own" on public.habit_checks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "habit_checks: delete own" on public.habit_checks
  for delete to authenticated
  using (user_id = (select auth.uid()));
