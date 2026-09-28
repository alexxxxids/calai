-- Reflections and statistics (chapter 26): the weekly questionnaire, the
-- monthly review and the per-type statistics shown next to them.

-- weekly_reflections ---------------------------------------------------------

create table public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The Monday of the week (a Polish week starts on Monday).
  week_start date not null check (extract(isodow from week_start) = 1),
  -- Scales 1-5.
  fatigue smallint not null check (fatigue between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  focus smallint not null check (focus between 1 and 5),
  distractions smallint not null check (distractions between 1 and 5),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- "One questionnaire per week" is kept by this constraint, not by careful
  -- code: the server upserts on (user_id, week_start).
  constraint weekly_reflections_one_per_week unique (user_id, week_start)
);

create trigger set_updated_at
  before update on public.weekly_reflections
  for each row execute function public.set_updated_at();

-- A reflection is filled in and corrected, never deleted by hand: it goes
-- away together with the account.
revoke all on table public.weekly_reflections from anon, authenticated, service_role;
grant select, insert, update on table public.weekly_reflections to authenticated;
alter table public.weekly_reflections enable row level security;

create policy "weekly_reflections: select own" on public.weekly_reflections
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "weekly_reflections: insert own" on public.weekly_reflections
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "weekly_reflections: update own" on public.weekly_reflections
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- monthly_reflections --------------------------------------------------------

create table public.monthly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The first day of the month.
  month date not null check (extract(day from month) = 1),
  went_well text check (went_well is null or char_length(went_well) <= 4000),
  went_badly text check (went_badly is null or char_length(went_badly) <= 4000),
  types_review text check (types_review is null or char_length(types_review) <= 4000),
  goals_next text check (goals_next is null or char_length(goals_next) <= 4000),
  priorities_change text check (priorities_change is null or char_length(priorities_change) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_reflections_one_per_month unique (user_id, month)
);

create trigger set_updated_at
  before update on public.monthly_reflections
  for each row execute function public.set_updated_at();

revoke all on table public.monthly_reflections from anon, authenticated, service_role;
grant select, insert, update on table public.monthly_reflections to authenticated;
alter table public.monthly_reflections enable row level security;

create policy "monthly_reflections: select own" on public.monthly_reflections
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "monthly_reflections: insert own" on public.monthly_reflections
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "monthly_reflections: update own" on public.monthly_reflections
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- type_stats -----------------------------------------------------------------

-- Plan versus reality per task type for blocks starting in [p_from, p_to).
-- One query does the sums, instead of a loop over rows in TypeScript.
-- planned_minutes counts closed blocks only (done or missed), so it compares
-- with actual_minutes. Rest blocks have no task, so the join leaves them out.
-- security invoker: runs under the caller's RLS, so nobody else's rows can
-- get into the sums.
create or replace function public.type_stats(p_from timestamptz, p_to timestamptz)
returns table (
  type_id uuid,
  type_name text,
  color text,
  is_one_off boolean,
  planned_minutes bigint,
  actual_minutes bigint,
  done_blocks bigint,
  missed_blocks bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id,
         t.name,
         t.color,
         t.is_one_off,
         coalesce(sum(extract(epoch from (b.ends_at - b.starts_at)) / 60)
                  filter (where b.status in ('done', 'missed')), 0)::bigint,
         coalesce(sum(b.actual_minutes) filter (where b.status = 'done'), 0)::bigint,
         count(*) filter (where b.status = 'done'),
         count(*) filter (where b.status = 'missed')
  from public.blocks b
  join public.tasks k on k.id = b.task_id
  join public.task_types t on t.id = k.type_id
  where b.starts_at >= p_from
    and b.starts_at < p_to
  group by t.id, t.name, t.color, t.is_one_off
  -- Biggest planned time first; the name breaks ties, so the order is stable.
  order by 5 desc, 2;
$$;

revoke execute on function public.type_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.type_stats(timestamptz, timestamptz) to authenticated;
