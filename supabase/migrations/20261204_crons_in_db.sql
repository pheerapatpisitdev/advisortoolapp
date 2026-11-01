-- Every scheduled call to the site made by the database, through advisortool.app (Cloudflare move step 2, owner
-- chose ก 2026-11-02, mockup https://claude.ai/artifact/AZyE2MYMK1f66JSta6cxN7): whichever host the domain points at
-- runs them, so a standby copy of the app never runs a job twice. The routes take the token in ins_cron_secret
-- (src/lib/cron-auth.ts).

-- 1. The five daily jobs that were in vercel.json, at the same times (UTC). Each route does its work before it
--    answers, so the call waits as long as the route may run.
select cron.schedule('index-levels-sync', '0 0 * * *', $cron$
  select net.http_get(
    url := 'https://www.advisortool.app/api/index-levels/sync',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')),
    timeout_milliseconds := 60000
  );
$cron$);
select cron.schedule('chat-review', '0 1 * * *', $cron$
  select net.http_get(
    url := 'https://www.advisortool.app/api/chat-review',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')),
    timeout_milliseconds := 300000
  );
$cron$);
select cron.schedule('facebook-ads-sync', '0 3 * * *', $cron$
  select net.http_get(
    url := 'https://www.advisortool.app/api/facebook/ads/sync',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')),
    timeout_milliseconds := 60000
  );
$cron$);
select cron.schedule('content-video-sweep', '0 4 * * *', $cron$
  select net.http_get(
    url := 'https://www.advisortool.app/api/content-video/sweep',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')),
    timeout_milliseconds := 300000
  );
$cron$);
select cron.schedule('quote-video-sweep', '30 4 * * *', $cron$
  select net.http_get(
    url := 'https://www.advisortool.app/api/quote-video/sweep',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')),
    timeout_milliseconds := 300000
  );
$cron$);

-- 2. The minute hand wakes the site only when a follow-up is due (owner's CPU cut, fix 1, 2026-10-31): the same
--    test ins_claim_followups makes, less the decryption. It woke the site 1,440 times a day for about nothing.
select cron.schedule('messenger-followups', '* * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/facebook/followups',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (
    select 1
      from public.ins_chat_followups f
      join public.ins_chat_sessions s on s.channel = f.channel and s.user_hash = f.user_hash
     where f.channel = 'facebook'
       and f.sent_at is null
       and f.psid_cipher is not null
       and f.due_at <= now()
       and f.expires_at > now()
       and s.updated_at <= f.quoted_at
       and (s.muted_until is null or s.muted_until < now())
  );
$cron$);

-- the follow-ups past Meta's 24 hours, with the customer ids they hold, cleared every hour by the database itself:
-- the route sweeps only when it is called, which is now only when something is due
select cron.schedule('followups-sweep', '10 * * * *', 'select public.ins_sweep_followups()');

-- 3. A LINE broadcast likewise: the site is called only when one is due (sendDue's own test).
select cron.schedule('line-broadcasts', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/line/broadcasts',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.ins_line_broadcasts where status = 'scheduled' and send_at <= now());
$cron$);
