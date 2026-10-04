-- How each Messenger Page greets a customer (owner, 2026-10-04), edited on /admin/welcome.
--
-- One row per Page. A Page with no row greets with the built-in three-plan menu, so deleting a
-- row is the "คืนค่าเดิม" button. mode 'menu' replaces the menu's words and keeps its buttons;
-- mode 'one_plan' greets with one plan and takes that plan as the Page's own afterwards.
--
-- pictures are sent in order before the words, on the first message of a conversation. Each is
-- a full URL in the page-welcome bucket, or a path on the site itself (/welcome/...).
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_page_welcome (
  page_id text primary key,
  mode text not null check (mode in ('menu', 'one_plan')),
  product text check (product in ('lifeprotect', 'legacy', 'ishield', 'ihealthy')),
  text text not null check (char_length(text) between 1 and 1500),
  pictures text[] not null default '{}' check (cardinality(pictures) <= 5),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (mode = 'menu' or product is not null)
);

alter table public.ins_page_welcome enable row level security;
revoke all on public.ins_page_welcome from public, anon, authenticated;
grant all on public.ins_page_welcome to service_role;

-- Public: Messenger fetches each picture by its URL, and every one is shown to customers anyway.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-welcome', 'page-welcome', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- LuckyPlanner's welcome, built in code earlier the same day, moved here.
insert into public.ins_page_welcome (page_id, mode, product, text, pictures)
values (
  '105982528649026', 'one_plan', 'lifeprotect',
  E'สวัสดีครับ 🙏 Life Protect — ประกันชีวิต เบี้ยไม่ทิ้ง ขายคืนได้\nขอทราบเพศกับอายุหน่อยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น ช 35)',
  array['/welcome/luckyplanner/agent.jpg', '/welcome/luckyplanner/lifeprotect.jpg']
)
on conflict (page_id) do nothing;
