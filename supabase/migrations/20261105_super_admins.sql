-- Super Admin (owner, 2026-10-15; mockup https://claude.ai/artifact/4X65JZ3TLN7VvKjfpDy4MU).
--
-- The back office and the money in it (prices, the member pass, wallet adjustments, the team,
-- the stats) leave every agent, the owner's own UnitOS account included, for a user of its own:
-- somebody who signs in with Google at /backoffice and sees nothing of the front of the app.
-- Only an address listed here gets in; an unknown Gmail is turned away and never made a member.
-- The session cookie carries this row's id, as it carries an agent's or a member's.

-- Dropping a foreign key holds ACCESS EXCLUSIVE on UnitOS's agents until commit.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.ins_super_admins (
  id          uuid primary key default gen_random_uuid(),
  -- matched against Google's verified address, lowercase
  email       text not null unique check (email = lower(email) and email like '%@%'),
  -- filled on the first sign-in; after that the Google account must stay the same one
  google_sub  text unique,
  name        text,
  created_at  timestamptz not null default now(),
  -- set to shut somebody out: sessions issued before it are over
  revoked_at  timestamptz
);
comment on table public.ins_super_admins is 'advisortool back-office users, Google sign-in at /backoffice. service_role only.';
alter table public.ins_super_admins enable row level security;
revoke all on public.ins_super_admins from anon, authenticated;
grant all on public.ins_super_admins to service_role;

-- The team page is the Super Admin's now: who added an assistant may be a Super Admin's id.
alter table public.ins_staff drop constraint if exists ins_staff_added_by_fkey;

-- The address is the owner's to give; added at rollout:
-- insert into public.ins_super_admins (email, name) values ('<gmail>', 'Super Admin');
