-- Profiles: one row of settings per user (chapters 16-19).
-- Also defines two helpers that later migrations reuse:
-- set_updated_at() and is_valid_timezone().

-- Stamps updated_at on every update. The database does it, so no code path
-- can forget to.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- true if tz is a real IANA time zone name such as 'Europe/Warsaw'.
-- We look the name up in the list of zones instead of trying
-- "at time zone tz": that also accepts abbreviations ('PST' means fixed
-- UTC-8 to Postgres, but Los Angeles time with daylight saving to JavaScript)
-- and POSIX strings ('ABC3') that the browser rejects. 'Factory' is on the
-- list but means "zone not set", not a place, so it is refused too.
-- The function keeps the default EXECUTE for everyone: every role that
-- writes a profile runs this check, and it reveals nothing.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = tz
      and name <> 'Factory'
  );
$$;

-- Cumulative levels (spec FR-11): each level adds one more questionnaire.
create type public.reflection_level as enum ('basic', 'analytic', 'strategic');

create table public.profiles (
  -- The same id as the auth user: exactly one profile per account.
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 50),
  timezone text not null default 'Europe/Warsaw' check (public.is_valid_timezone(timezone)),
  reflection_level public.reflection_level not null default 'basic',
  day_start time not null default '08:00',
  day_end time not null default '22:00',
  daily_energy_limit smallint not null default 20 check (daily_energy_limit between 4 and 60),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The working window may not cross midnight (spec §7.4).
  constraint profiles_day_window check (day_end > day_start)
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Since May 2026 new Supabase projects grant nothing on new tables, while
-- older projects granted everything to anon, authenticated and service_role.
-- Revoke first, then grant exactly what the app needs: the result is the
-- same in every project.
-- No insert (the trigger below creates the row) and no delete (the row goes
-- away together with the user, by cascade).
revoke all on table public.profiles from anon, authenticated, service_role;
grant select, update on table public.profiles to authenticated;
alter table public.profiles enable row level security;

-- (select auth.uid()) instead of auth.uid(): Postgres computes it once per
-- query, not once per row.
create policy "profiles: select own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- An update must also pass "select own": you can only change what you see.
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Creates the profile the moment Supabase Auth creates the user.
-- security definer: the function runs with the rights of its owner, because
-- the role of the Auth service has no rights on our tables.
-- set search_path = '': with the owner's rights, never look names up in a
-- search_path someone else may control; every name below is schema-qualified.
-- Keep it minimal: if this function fails, the sign-up fails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- A trigger fires without the EXECUTE right, so nobody else needs it: the
-- function must not be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
