-- Planning core: task types, tasks and time blocks (chapter 20).
-- Every table below follows the same pattern: the owner is filled in by the
-- database, rights and RLS are explicit, and references to the user's own
-- rows use composite foreign keys (docs/data-model.md §2, §4.1).

-- task_types -----------------------------------------------------------------

create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  -- The database takes the owner from the session, so the client never sends
  -- it. The cascade erases the user's rows when the account is deleted (FR-06).
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Lowercase only, so '#1E90FF' and '#1e90ff' cannot become two colors.
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-f]{6}$'),
  -- 0 restores, 1 light, 2 medium, 3 heavy (spec §3).
  energy smallint not null default 2 check (energy between 0 and 3),
  is_one_off boolean not null default false,
  is_rest boolean not null default false,
  -- "Delete" in the UI archives the type: history and statistics keep it.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The target of composite foreign keys: the pair ties a type to its owner.
  constraint task_types_id_user_unique unique (id, user_id),
  constraint task_types_rest_not_one_off check (not (is_rest and is_one_off)),
  constraint task_types_rest_not_archived check (not (is_rest and archived_at is not null))
);

-- 'Nauka' and 'nauka' are one type; an archived 'Nauka' does not block a new one.
create unique index task_types_active_name_unique
  on public.task_types (user_id, lower(btrim(name)))
  where archived_at is null;

-- At most one rest type per user (spec FR-12).
create unique index task_types_single_rest
  on public.task_types (user_id)
  where is_rest;

create trigger set_updated_at
  before update on public.task_types
  for each row execute function public.set_updated_at();

-- Delete is allowed, but only a type nobody uses can go: tasks, recurring
-- events and calendar subscriptions refer to it with "on delete restrict".
revoke all on table public.task_types from anon, authenticated, service_role;
grant select, insert, update, delete on table public.task_types to authenticated;
alter table public.task_types enable row level security;

create policy "task_types: select own" on public.task_types
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "task_types: insert own" on public.task_types
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "task_types: update own" on public.task_types
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "task_types: delete own" on public.task_types
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- tasks ----------------------------------------------------------------------

-- hard: the app never moves it (a lesson, a dentist); flexible: it may.
create type public.task_fixation as enum ('hard', 'flexible');
create type public.task_status as enum ('active', 'done', 'cancelled');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type_id uuid not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  -- 1 high, 2 medium, 3 low.
  priority smallint not null default 2 check (priority between 1 and 3),
  fixation public.task_fixation not null default 'flexible',
  -- Empty estimate = an idea: the planner leaves it alone (spec FR-30).
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes between 5 and 6000),
  -- Preferred length of one block; empty = the planner's default. The planner
  -- works on a 15-minute grid and never makes a session shorter than 30.
  session_minutes integer check (
    session_minutes is null or (session_minutes between 30 and 180 and session_minutes % 15 = 0)
  ),
  deadline timestamptz,
  status public.task_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_id_user_unique unique (id, user_id),
  -- A foreign key check ignores RLS. With a plain type_id reference, a user
  -- who learned the id of someone else's type could attach it to a task.
  -- The pair (type_id, user_id) only matches a type of the same owner.
  constraint tasks_type_same_user foreign key (type_id, user_id)
    references public.task_types (id, user_id) on delete restrict,
  constraint tasks_done_has_completed_at check ((status = 'done') = (completed_at is not null))
);

create index tasks_user_status on public.tasks (user_id, status);

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

revoke all on table public.tasks from anon, authenticated, service_role;
grant select, insert, update, delete on table public.tasks to authenticated;
alter table public.tasks enable row level security;

create policy "tasks: select own" on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tasks: insert own" on public.tasks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "tasks: update own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "tasks: delete own" on public.tasks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- blocks ---------------------------------------------------------------------

create type public.block_status as enum ('planned', 'done', 'missed');
create type public.block_source as enum ('manual', 'planner', 'ai', 'rest');

-- Lets one GiST index compare user_id with "=" and time ranges with "&&" at
-- the same time: the no-overlap rule below needs both.
create extension if not exists btree_gist with schema extensions;

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Empty only for a rest block (see blocks_rest_xor_task).
  task_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Minutes of estimated work the block covers; its length is work x pace.
  work_minutes integer not null check (work_minutes between 1 and 1440),
  status public.block_status not null default 'planned',
  source public.block_source not null default 'manual',
  -- Placed or moved by hand: the planner never touches it.
  pinned boolean not null default false,
  actual_minutes integer check (actual_minutes is null or actual_minutes between 0 and 1440),
  closed_at timestamptz,
  -- Set by the reminder job, so a block is announced only once.
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blocks_time_order check (ends_at > starts_at),
  constraint blocks_max_duration check (ends_at - starts_at <= interval '12 hours'),
  -- A rest block has no task: a foreign key with a null column is not checked.
  constraint blocks_task_same_user foreign key (task_id, user_id)
    references public.tasks (id, user_id) on delete cascade,
  constraint blocks_rest_xor_task check ((source = 'rest') = (task_id is null)),
  constraint blocks_done_has_actual check (status <> 'done' or actual_minutes is not null),
  constraint blocks_closed_consistency check ((status = 'planned') = (closed_at is null)),
  -- Two live blocks of one user never overlap: not because of a planner bug,
  -- not because of two tabs racing, not through a direct API request.
  -- '[)' is half-open, so 10:00-11:00 and 11:00-12:00 touch without overlapping.
  -- A missed block is history, so it may lie under a new one.
  constraint blocks_no_overlap exclude using gist (
    user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('planned', 'done'))
);

create index blocks_user_starts on public.blocks (user_id, starts_at);
create index blocks_task on public.blocks (task_id);

create trigger set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

revoke all on table public.blocks from anon, authenticated, service_role;
grant select, insert, update, delete on table public.blocks to authenticated;
alter table public.blocks enable row level security;

create policy "blocks: select own" on public.blocks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "blocks: insert own" on public.blocks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "blocks: update own" on public.blocks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "blocks: delete own" on public.blocks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- apply_plan -----------------------------------------------------------------

-- Replaces the planner's old blocks with a new plan in one transaction.
-- Two separate requests could fail in between and leave the calendar empty.
-- If the new plan overlaps anything (the user moved a block meanwhile),
-- blocks_no_overlap aborts the whole call and the old plan stays intact.
-- security invoker: runs with the caller's rights, so RLS limits it to the
-- caller's own blocks.
create or replace function public.apply_plan(p_remove_ids uuid[], p_new_blocks jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  -- Whatever ids arrive, only unpinned planned blocks are the planner's to remove.
  delete from public.blocks
  where id = any (p_remove_ids)
    and status = 'planned'
    and pinned = false;

  insert into public.blocks (task_id, starts_at, ends_at, work_minutes, source)
  select (b ->> 'task_id')::uuid,
         (b ->> 'starts_at')::timestamptz,
         (b ->> 'ends_at')::timestamptz,
         (b ->> 'work_minutes')::integer,
         (b ->> 'source')::public.block_source
  from jsonb_array_elements(p_new_blocks) as b;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Functions get EXECUTE for everyone by default: only signed-in users may plan.
revoke execute on function public.apply_plan(uuid[], jsonb) from public, anon;
grant execute on function public.apply_plan(uuid[], jsonb) to authenticated;
