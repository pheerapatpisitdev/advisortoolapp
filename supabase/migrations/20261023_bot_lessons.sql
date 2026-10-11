-- advisortool: answers the owner teaches word for word (/admin/teach), owner 2026-10-11.
--
-- They live in ins_faq beside the notes the model reads, so the owner keeps one list: strict
-- marks a row the bot sends exactly as written (src/lib/assistant/lessons.ts) rather than a
-- note the model words for itself. phrasings are other ways a customer writes the question;
-- page_id narrows a lesson to one Facebook Page (null is everywhere). hits counts customers
-- answered by it, so the owner can see which lessons are earning their place.

alter table public.ins_faq
  add column if not exists strict      boolean not null default false,
  add column if not exists phrasings   text[]  not null default '{}',
  add column if not exists page_id     text,
  add column if not exists picture     text,
  add column if not exists hits        integer not null default 0,
  add column if not exists last_hit_at timestamptz;

comment on column public.ins_faq.strict is 'advisortool: true = the bot sends this answer word for word (บังคับตอบ); false = a note the model reads.';

create or replace function public.ins_faq_hit(faq_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ins_faq set hits = hits + 1, last_hit_at = now() where id = faq_id;
$$;
revoke all on function public.ins_faq_hit(uuid) from public, anon, authenticated;
grant execute on function public.ins_faq_hit(uuid) to service_role;
