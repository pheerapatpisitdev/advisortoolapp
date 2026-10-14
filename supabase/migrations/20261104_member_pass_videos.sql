-- วิดีโอนำเสนอ free clips per member pass period (owner, 2026-10-14; mockup
-- https://claude.ai/artifact/YK9xNTXvwU57GHAv66Qp43, option ก).
--
-- A member with a live pass gets this many free clips counted afresh from the period's start,
-- as member_pass_rounds does for Studio rounds. UnitOS agents keep their two clips, once.

alter table public.ins_ai_settings
  add column if not exists member_pass_videos int not null default 2
    check (member_pass_videos >= 0);
