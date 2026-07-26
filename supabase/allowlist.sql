-- Lucia ♥ Riu — who is allowed to sign up at all.
--
-- Run this AFTER supabase/auth_policies.sql (it calls public.is_us()).
--
-- WHY THIS EXISTS
-- public.is_us() already stops a stranger seeing any data — they can sign in
-- and get a valid session, but every policy returns them zero rows. This adds
-- the layer in front: a Before User Created hook that refuses the signup
-- outright, so `auth.users` never collects junk rows and an outsider gets an
-- honest "you can't sign in" instead of an app that loads and is empty.
--
-- WHY A TABLE AND NOT THE DASHBOARD TOGGLE
-- Supabase's "Allow new users to sign up" is a project setting, changeable
-- only through the Management API — whose token can modify or delete the whole
-- project. Reaching that from the app would mean parking such a token behind
-- an HTTP endpoint, which is a spectacularly bad trade for the convenience of
-- not visiting a dashboard. This table does the same job with no credential at
-- all: it's ordinary Postgres, gated by the same RLS as everything else, and
-- the app edits it with the JWT you already have.

-- ------------------------------------------------------------- the allowlist
create table if not exists allowed_emails (
  email    text primary key,
  note     text,                                    -- "Riu", "Lucia" — for the UI
  added_at timestamptz not null default now()
);

alter table allowed_emails enable row level security;

drop policy if exists "us only" on allowed_emails;
create policy "us only" on allowed_emails
  for all to authenticated using (public.is_us()) with check (public.is_us());

-- Seed with the two of us. 👉 EDIT LUCIA'S ADDRESS before running, and keep it
-- consistent with public.is_us() in auth_policies.sql — is_us() decides what
-- you can SEE, this table decides who can SIGN UP, and they should agree.
insert into allowed_emails (email, note) values
  ('rew.cherdchu@gmail.com', 'Riu'),
  ('lucia@example.com',      'Lucia')     -- ← replace
on conflict (email) do nothing;


-- --------------------------------------------------------------- the hook
-- Runs inside GoTrue before a user row is created. Returning an `error`
-- object with a 4xx code blocks the signup and shows the message to the user.
--
-- FAILS OPEN ON PURPOSE, in exactly one case: if the allowlist is empty, let
-- everyone through. An empty table almost certainly means a botched migration
-- rather than "nobody may sign in", and the cost of guessing wrong is locking
-- BOTH of you out of your own app with no way back in except SQL. is_us()
-- still guards every byte of data in that state, so failing open here costs
-- nothing real. Every other path fails closed.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  known     boolean;
  populated boolean;
begin
  candidate := lower(trim(event -> 'user' ->> 'email'));

  select exists (select 1 from allowed_emails) into populated;
  if not populated then
    return '{}'::jsonb;            -- see "FAILS OPEN" above
  end if;

  if candidate is null or candidate = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This app needs an email address to let you in.'));
  end if;

  select exists (
    select 1 from allowed_emails where lower(email) = candidate
  ) into known;

  if known then
    return '{}'::jsonb;            -- empty object = proceed
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This app is for two people, and you are not one of them 😌'));
end;
$$;

-- Only GoTrue may call it. Without the revoke, any signed-in client could
-- invoke the hook directly, which isn't dangerous here but is untidy.
grant execute on function public.hook_before_user_created to supabase_auth_admin;
revoke execute on function public.hook_before_user_created from authenticated, anon, public;

-- The hook needs to read the table as the auth admin role, which is not
-- covered by the "us only" policy above.
grant usage on schema public to supabase_auth_admin;
grant select on table allowed_emails to supabase_auth_admin;
drop policy if exists "auth admin reads" on allowed_emails;
create policy "auth admin reads" on allowed_emails
  for select to supabase_auth_admin using (true);


-- ------------------------------------------------------------------ check it
select * from allowed_emails order by added_at;

-- Should return {} for an allowed address and an error object for anything else:
select public.hook_before_user_created(
  jsonb_build_object('user', jsonb_build_object('email', 'rew.cherdchu@gmail.com')));
select public.hook_before_user_created(
  jsonb_build_object('user', jsonb_build_object('email', 'stranger@gmail.com')));


-- ============================================================ ENABLE IT
-- The function does nothing until the hook is switched on:
--   Dashboard → Authentication → Hooks → "Before User Created"
--   → Postgres function → public.hook_before_user_created → Enable
--
-- Existing users are unaffected — this only runs when a NEW auth.users row
-- would be created, so sign this out/in test with a third Google account, not
-- with yours.

-- ================================================================= ROLLBACK
-- drop policy if exists "auth admin reads" on allowed_emails;
-- drop function if exists public.hook_before_user_created(jsonb);
-- drop table if exists allowed_emails;
-- (and turn the hook off in the dashboard first, or signups will error)
