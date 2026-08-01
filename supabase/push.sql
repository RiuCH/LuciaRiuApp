-- Lucia ♥ Riu — 🔔 push subscriptions
-- Run once in the Supabase SQL editor, after auth_policies.sql (it reuses
-- public.is_us()). Until it's run, the toggle in ⚙️ Settings says so and
-- nothing else in the app changes.
--
-- WHAT A ROW IS
-- One row per phone that has said yes to notifications — so normally two, and
-- more if either of you installs the app somewhere else. `endpoint` is an
-- opaque URL the browser gives us, pointing at Apple's (or Google's) push
-- service; it identifies a device without telling us anything about it.
--
-- WHY THIS ISN'T A localStorage PROBLEM
-- Golden rule 2 bans browser storage, and this doesn't touch it: the
-- subscription lives HERE, in the database, exactly like every other piece of
-- shared state. The browser keeps its own copy internally (that's the Push
-- API's business, not ours) and `js/push.js` never writes to storage.
--
-- WHY p256dh AND auth ARE STORED THOUGH NOTHING USES THEM
-- Those two are the encryption material for push payloads. api/notify.js
-- sends payload-free pushes and needs neither. They're captured anyway so
-- that putting real text on the lock screen later is a change to the sender
-- alone — otherwise both of you would have to turn notifications off and on
-- again to hand over keys we could simply have kept.

create table if not exists push_subs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- The push service URL for one device. Unique, so re-subscribing on the
  -- same phone updates rather than accumulating duplicates that all buzz.
  endpoint text not null unique,
  p256dh text,
  auth text,

  -- Who this phone belongs to. The ACCOUNT, not the `#me` hash param: #me is
  -- per-device and can be unset or swapped, which is fine for "which side am
  -- I playing" and wrong for "whose phone is this". api/notify.js compares it
  -- against the verified JWT to avoid ringing the phone that just posted.
  email text not null,
  -- Cosmetic only ('riu' | 'lucia'), for reading this table by eye.
  who text,
  label text                                      -- "Riu's iPhone", if we ever set it
);

create index if not exists push_subs_email_idx on push_subs (email);

-- ------------------------------------------------------------------------ RLS
-- Same shape as every table since v10: `to authenticated` only, gated by
-- public.is_us(). No policy for anon means no access for anon.
--
-- Both of you can see BOTH rows, which is required — api/notify.js reads the
-- table with the caller's own token precisely so it needs no service-role key.
alter table push_subs enable row level security;
drop policy if exists "us only" on push_subs;
create policy "us only" on push_subs
  for all to authenticated using (public.is_us()) with check (public.is_us());

-- ------------------------------------------------------------------ check it
-- Expect ONE 'us only' policy for {authenticated} and nothing for {anon}.
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public' and tablename = 'push_subs';

-- After both phones have opted in, expect two rows with different emails:
select id, email, who, created_at, left(endpoint, 40) || '…' as endpoint
from push_subs order by created_at;
