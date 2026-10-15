-- The owner's own LINE, for alerts from the LINE OA (owner chose ก, 2026-10-15: a message for
-- every new member; mockup https://claude.ai/artifact/DHiYL1g4nky3yoAbkCEtQp).
--
-- Customers are kept only as a hash; the owner's id is kept as LINE gives it, because a push
-- needs it, and only after the owner typed the code shown on /admin/line into the chat.
-- ins_ai_settings is the service role's alone (RLS on, no grants to anon or authenticated).
alter table public.ins_ai_settings
  add column if not exists owner_line_user_id text,
  add column if not exists owner_line_linked_at timestamptz,
  add column if not exists owner_line_link_code text,
  add column if not exists owner_line_link_expires timestamptz,
  add column if not exists notify_new_member boolean not null default true;
