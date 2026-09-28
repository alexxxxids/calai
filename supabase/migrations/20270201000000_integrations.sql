-- Integrations (chapter 27): push notifications, the iCal feed of the user's
-- blocks and imported iCal calendars. Also the rights of the server-side jobs
-- (cron, iCal feed) that run with the secret key.

-- push_subscriptions ---------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The push service identifies a browser by its endpoint URL.
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  -- Not "auth": that name is easy to confuse with the auth schema.
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- A browser subscribes only through claim_push_subscription() below, so there
-- is no insert right: one way in, not two that drift apart. It unsubscribes
-- (also on logout) by deleting its own row. A subscription is never edited: a
-- changed one comes with a new endpoint.
revoke all on table public.push_subscriptions from anon, authenticated, service_role;
grant select, delete on table public.push_subscriptions to authenticated;
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: select own" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saves this browser's push subscription for the signed-in user.
-- The problem: a browser has ONE endpoint, whoever uses it. On a shared
-- computer (a school lab) the previous user's row still holds it, so the next
-- user could not subscribe (the endpoint is unique), and the previous user's
-- reminders would keep popping up in front of the next one.
-- The endpoint and its keys belong to the browser, so whoever holds them now
-- is its rightful owner: the old row goes, whoever owned it, and a fresh row
-- is created for the caller.
-- security definer, because the old row belongs to someone else and RLS hides
-- it from the caller. It is the only such function besides handle_new_user(),
-- and it is safe because:
--   * it touches only the row with the endpoint the caller passes, and an
--     endpoint is a secret URL known only to the browser that holds it;
--   * the new row always belongs to the caller (auth.uid()), nobody else;
--   * it returns only the id of that new row: it never reveals another user's
--     data, not even whether the endpoint was taken;
--   * set search_path = '' and schema-qualified names, as in handle_new_user().
create or replace function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- A clear error before anything is deleted.
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'invalid_endpoint' using errcode = '22023';
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth_secret, p_user_agent)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.claim_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text, text) to authenticated;

-- calendar_feeds -------------------------------------------------------------

create table public.calendar_feeds (
  -- One feed per user, so the owner is the key.
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- 64 hex characters from two random UUIDs (about 244 random bits), without
  -- the pgcrypto extension. The token is the password to the feed: never
  -- log it and never show it to anyone else.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- No update: a token is never edited, rotate_calendar_feed() replaces the row.
revoke all on table public.calendar_feeds from anon, authenticated, service_role;
grant select, insert, delete on table public.calendar_feeds to authenticated;
alter table public.calendar_feeds enable row level security;

create policy "calendar_feeds: select own" on public.calendar_feeds
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "calendar_feeds: insert own" on public.calendar_feeds
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "calendar_feeds: delete own" on public.calendar_feeds
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Issues a new secret token for the user's feed (spec FR-110), which also
-- creates the feed the first time. The old link stops working at once.
-- Delete and insert run in one transaction: no moment without a feed.
create or replace function public.rotate_calendar_feed()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_token text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  delete from public.calendar_feeds
  where user_id = v_user;

  insert into public.calendar_feeds (user_id)
  values (v_user)
  returning token into v_token;

  return v_token;
end;
$$;

revoke execute on function public.rotate_calendar_feed() from public, anon;
grant execute on function public.rotate_calendar_feed() to authenticated;

-- calendar_subscriptions -----------------------------------------------------

create table public.calendar_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  url text not null check (url ~ '^https://'),
  -- Imported events take their color and energy from this type.
  type_id uuid not null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_subscriptions_id_user_unique unique (id, user_id),
  constraint calendar_subscriptions_type_same_user foreign key (type_id, user_id)
    references public.task_types (id, user_id) on delete restrict
);

create trigger set_updated_at
  before update on public.calendar_subscriptions
  for each row execute function public.set_updated_at();

revoke all on table public.calendar_subscriptions from anon, authenticated, service_role;
grant select, insert, update, delete on table public.calendar_subscriptions to authenticated;
alter table public.calendar_subscriptions enable row level security;

create policy "calendar_subscriptions: select own" on public.calendar_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "calendar_subscriptions: insert own" on public.calendar_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "calendar_subscriptions: update own" on public.calendar_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "calendar_subscriptions: delete own" on public.calendar_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- external_events ------------------------------------------------------------

create table public.external_events (
  id uuid primary key default gen_random_uuid(),
  -- No default: the nightly sync runs without a user session.
  -- replace_external_events() copies the owner from the subscription.
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid not null,
  -- The UID from the iCal feed; together with starts_at it names one occurrence.
  uid text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null check (char_length(title) <= 200),
  constraint external_events_time_order check (ends_at > starts_at),
  constraint external_events_subscription_same_user foreign key (subscription_id, user_id)
    references public.calendar_subscriptions (id, user_id) on delete cascade,
  constraint external_events_unique_occurrence unique (subscription_id, uid, starts_at)
);

create index external_events_user_starts on public.external_events (user_id, starts_at);

-- Imported events are a read-only copy of someone else's calendar: they are
-- written only by replace_external_events() and never edited, so there is
-- no update. That function is security invoker, so it deletes and inserts
-- with the caller's rights: authenticated needs insert and delete as well.
-- A direct insert is harmless: RLS and the composite foreign key tie it to
-- the caller's own subscription, so users can only clutter their own calendar.
revoke all on table public.external_events from anon, authenticated, service_role;
grant select, insert, delete on table public.external_events to authenticated;
alter table public.external_events enable row level security;

create policy "external_events: select own" on public.external_events
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "external_events: insert own" on public.external_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "external_events: delete own" on public.external_events
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Replaces all events of one subscription with a fresh copy of the feed, in
-- one transaction: the calendar never shows half of the old copy and half of
-- the new one. Called by the "sync now" button (as the user) and by the
-- nightly cron (with the secret key, as service_role, which has no session).
-- security invoker + RLS: for a user, the select below sees only their own
-- subscriptions, so someone else's id looks exactly like a missing one and is
-- refused. The service role bypasses RLS and may sync any subscription.
create or replace function public.replace_external_events(p_subscription_id uuid, p_events jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_inserted integer;
begin
  -- "for update" locks the subscription row: a second sync of the same
  -- subscription waits here until this one commits, instead of mixing its
  -- delete and insert with ours.
  select user_id into v_owner
  from public.calendar_subscriptions
  where id = p_subscription_id
  for update;

  if v_owner is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  delete from public.external_events
  where subscription_id = p_subscription_id;

  -- The owner comes from the subscription, not from the session.
  insert into public.external_events (user_id, subscription_id, uid, starts_at, ends_at, title)
  select v_owner,
         p_subscription_id,
         e ->> 'uid',
         (e ->> 'starts_at')::timestamptz,
         (e ->> 'ends_at')::timestamptz,
         e ->> 'title'
  from jsonb_array_elements(p_events) as e;

  get diagnostics v_inserted = row_count;

  -- Recorded in the same transaction: "synced at" is true exactly when the
  -- events were replaced.
  update public.calendar_subscriptions
  set last_synced_at = now(),
      last_error = null
  where id = p_subscription_id;

  return v_inserted;
end;
$$;

revoke execute on function public.replace_external_events(uuid, jsonb) from public, anon;
grant execute on function public.replace_external_events(uuid, jsonb) to authenticated, service_role;

-- Server-side jobs -----------------------------------------------------------

-- The cron jobs and the iCal feed run without a user session, with the secret
-- key, i.e. as service_role. It bypasses RLS, but not grants, and since May
-- 2026 a new table grants it nothing by default. So it may touch exactly what
-- those jobs need and nothing else. Every query made with it must filter by
-- the owner itself (coding-standards §5.4).

-- Reminders (spec FR-112): upcoming and unclosed blocks with their task and
-- type names, the user's time zone and reflection level, and whether this
-- week's questionnaire is already filled in. notified_at marks a block as
-- announced; the job must not change anything else in it.
grant select on table public.profiles to service_role;
grant select on table public.task_types to service_role;
grant select on table public.tasks to service_role;
grant select, update (notified_at) on table public.blocks to service_role;
grant select on table public.weekly_reflections to service_role;
-- Send to every browser of the user; drop a subscription the push service
-- reports as expired.
grant select, delete on table public.push_subscriptions to service_role;

-- iCal feed (spec FR-110): find the owner by the token, then read the blocks.
grant select on table public.calendar_feeds to service_role;

-- iCal import (spec FR-111): read every subscription, record a failed sync in
-- last_error, replace the events through replace_external_events().
grant select, update (last_synced_at, last_error) on table public.calendar_subscriptions to service_role;
grant select, insert, delete on table public.external_events to service_role;
