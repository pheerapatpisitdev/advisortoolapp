-- สมัครสมาชิก (owner, 2026-10-27, mockup 189doYqMskU9fUDbvfHbLU): after Google, a member gives their
-- ชื่อ - นามสกุล and สำนักงาน before using the app. Null means not given yet: every member who joined
-- before this asks once, on their next visit (owner chose ก). Additive only: the code before this
-- change never reads it.
alter table public.ins_members add column if not exists office text
  check (office is null or char_length(office) between 1 and 100);
