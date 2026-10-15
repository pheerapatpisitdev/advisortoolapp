-- LINE OA in the back office (owner chose ข, 2026-10-15; mockup
-- https://claude.ai/artifact/DpCwdLh7Bj8ycVBKbcAGjP): a switch for the LINE bot, broadcasts sent
-- now or at a set time, and the pictures they carry.

-- off while a person answers in LINE OA Manager, whose words the webhook never sees
alter table public.ins_ai_settings
  add column if not exists line_bot_enabled boolean not null default true;

-- One broadcast to every friend of the account. `parts` are the bubbles in order
-- ({type:'text',text} | {type:'image',url}), `replies` the quick-reply buttons on the last one
-- ({label,text}). A row is claimed scheduled → sending before LINE is called, and its id is the
-- retry key LINE is given, so a send that is run twice reaches nobody twice.
create table if not exists public.ins_line_broadcasts (
  id uuid primary key default gen_random_uuid(),
  parts jsonb not null,
  replies jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  send_at timestamptz not null,
  sent_at timestamptz,
  request_id text,
  recipients integer,
  error text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists ins_line_broadcasts_due on public.ins_line_broadcasts (send_at) where status = 'scheduled';

alter table public.ins_line_broadcasts enable row level security;
revoke all on public.ins_line_broadcasts from public, anon, authenticated;
grant all on public.ins_line_broadcasts to service_role;

-- Public: LINE fetches each picture by its URL. JPEG and PNG only, which is what LINE takes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('line-broadcast', 'line-broadcast', true, 4194304, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Every five minutes, the broadcasts whose time has come. The same shared word as the
-- Messenger follow-ups (src/lib/chat/cron-token.ts).
select cron.schedule('line-broadcasts', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/line/broadcasts',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);
