-- advisortool's two jobs, moved from DATA2.0 with the rest of its data (2026-09-27).
select cron.schedule('ins_prune_hourly', '5 * * * *', 'select public.ins_prune()');
select cron.schedule('messenger-followups', '* * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/facebook/followups',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);
