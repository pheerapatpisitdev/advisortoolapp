-- advisortool: saved conversations the owner replays against the bot (/admin/teach ชุดเทส),
-- owner 2026-10-11.
--
-- A test is a conversation as a customer typed it on one Page — `turns` is
-- [{say, contains[], not[]}] — and what each answer should or should not say. Replayed with the
-- inbox's own turn (src/lib/chat/bot-tests.ts) whenever the bot is changed; the last run is kept
-- beside it so the list shows what passed without running anything.

create table if not exists public.ins_bot_tests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  page_id     text,
  came_for    text,
  turns       jsonb not null,
  last_run_at timestamptz,
  last_ok     boolean,
  last_result jsonb,
  created_at  timestamptz not null default now()
);
alter table public.ins_bot_tests enable row level security;
revoke all on public.ins_bot_tests from public, anon, authenticated;
grant all on public.ins_bot_tests to service_role;
comment on table public.ins_bot_tests is 'advisortool: conversations replayed against the bot from /admin/teach; service_role only.';
