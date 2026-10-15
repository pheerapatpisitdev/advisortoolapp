-- เพดานงบใช้ฟรีต่อเดือน (owner, 2026-10-15; mockup https://claude.ai/artifact/3TVTjpUcpnPz9ApRNjV241,
-- option ก): the most the AI behind agents' free rounds and free clips may cost in a month.
-- Once it is reached, agents' free rounds and clips pause until the 1st; the wallet still pays.
-- It takes the place of งบสร้างคอนเทนต์ (content_budget_thb), which is left in place, unread.
--
-- free_budget_thb: null = no limit. Set to ฿300, the figure the owner chose.
-- free_alerted: the last LINE alert sent to the owner, as "2026-10:80" or "2026-10:100", so each
-- is sent once a month however many rounds start at once.
--
-- Additive only.

alter table public.ins_ai_settings
  add column if not exists free_budget_thb numeric check (free_budget_thb is null or free_budget_thb >= 0),
  add column if not exists free_alerted text;

update public.ins_ai_settings set free_budget_thb = 300 where free_budget_thb is null;
