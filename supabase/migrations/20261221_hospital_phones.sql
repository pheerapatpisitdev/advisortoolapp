-- โรงพยาบาลในเครือ (owner chose ก ×5, 2026-11-25, mockup https://claude.ai/artifact/2pdzVimrFm1xLhR5uSNfv5): the
-- department numbers the Super Admin types on /admin/hospitals, over those read off the hospitals' own websites
-- (data/hospitals/departments.json). One row a hospital, keyed by the insurer list's id, and it stands for the
-- whole of that hospital's row in the file: คืนค่าเดิม deletes it and the file's numbers show again.
-- Additive only. Locked to service_role like every other ins_* table. The pages work without it (the file's
-- numbers show), so it may go in before or after the push; applied to production only on the owner's word.
create table if not exists public.ins_hospital_phones (
  hospital_id text primary key,
  insurance text[] not null default '{}',
  room text[] not null default '{}',
  appointment text[] not null default '{}',
  reception text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.ins_hospital_phones enable row level security;
revoke all on public.ins_hospital_phones from public, anon, authenticated;
grant all on public.ins_hospital_phones to service_role;
comment on table public.ins_hospital_phones is 'advisortool: department phone numbers typed by the Super Admin for โรงพยาบาลในเครือ. service_role only.';
