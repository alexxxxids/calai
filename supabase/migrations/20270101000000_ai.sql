-- AI assistant (chapter 25): the log of AI requests, which is also the daily
-- quota, and private storage for the files the user sends to the model.

-- ai_requests ----------------------------------------------------------------

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('decompose', 'timetable')),
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
  model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now()
);

-- start_ai_request() counts the user's requests of the last 24 hours.
create index ai_requests_user_created on public.ai_requests (user_id, created_at desc);

-- No delete: deleting your own rows would reset your quota.
-- Update only of the outcome columns: a user allowed to change created_at
-- could move old requests into the past and escape the daily limit.
revoke all on table public.ai_requests from anon, authenticated, service_role;
grant select, insert on table public.ai_requests to authenticated;
grant update (status, model, input_tokens, output_tokens) on table public.ai_requests to authenticated;
alter table public.ai_requests enable row level security;

create policy "ai_requests: select own" on public.ai_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Inserting a row by hand only spends your own quota, so it is harmless.
create policy "ai_requests: insert own" on public.ai_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "ai_requests: update own" on public.ai_requests
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Reserves one AI request. Raises 'ai_daily_limit_reached' if the user has
-- already made 20 in the last 24 hours (spec FR-93). The limit lives inside
-- the function: a limit passed as a parameter would be chosen by the client.
-- The server calls Gemini only after this function succeeded.
create or replace function public.start_ai_request(p_kind text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_daily_limit constant integer := 20;
  v_user uuid := (select auth.uid());
  v_used integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Two parallel requests of one user queue up here instead of both passing
  -- the check. The lock is released when the transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select count(*) into v_used
  from public.ai_requests
  where user_id = v_user
    and created_at > now() - interval '24 hours';

  if v_used >= c_daily_limit then
    raise exception 'ai_daily_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.ai_requests (kind) values (p_kind) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.start_ai_request(text) from public, anon;
grant execute on function public.start_ai_request(text) to authenticated;

-- Storage for AI uploads (spec FR-90, FR-94) ---------------------------------

-- Private bucket: files are reachable only through the policies below.
-- Storage itself enforces the size limit and the file types. HEIC/HEIF are
-- what iPhones take photos in, and Gemini reads them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-uploads',
  'ai-uploads',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- A file lives at <user_id>/<random name>: the first folder of the path is
-- its owner. The browser uploads straight to Storage (Vercel limits request
-- bodies), the server reads the file as the user and deletes it after the AI
-- answered. No update policy: files are never overwritten.
create policy "ai-uploads: insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ai-uploads: select own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ai-uploads: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
