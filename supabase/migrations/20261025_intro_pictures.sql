-- advisortool: the pictures sent once ahead of a customer's first quotation (Life Protect and
-- iShield, Messenger and LINE), set in /admin/teach (owner, 2026-10-11).
--
-- scope '*' is the set for every Page and LINE; a Page id is that Page's own set, which wins
-- over '*'. No row at all is the built-in picture; a row with no pictures sends none.

create table if not exists public.ins_intro_pictures (
  scope      text primary key,
  pictures   text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.ins_intro_pictures enable row level security;
revoke all on public.ins_intro_pictures from public, anon, authenticated;
grant all on public.ins_intro_pictures to service_role;
comment on table public.ins_intro_pictures is 'advisortool: pictures ahead of a first quotation, per Page or * for all; service_role only.';
