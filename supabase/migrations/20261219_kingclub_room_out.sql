-- KingClub's room leaves UnitClub's rows for good (owner chose ข, 2026-11-20; comparison
-- https://claude.ai/artifact/1w163xdBBTxQ5S2zwDkcXm). KingClub (room ga83i, id 9f35fe97…) moved to its
-- own Supabase on 2026-11-11 (./20261208_kingclub_agents.sql, src/lib/auth/kingclub.ts) and UnitOS now
-- deletes UnitClub's copy of the room: its tenants row, its 35 agents and everything under them.
--
-- Two things here kept that copy needed:
-- 1. ins_content.tenant_id and ins_people.tenant_id were foreign keys to public.tenants
--    (./20260927_studio_owners.sql). A KingClub agent's room id is still 9f35fe97…, read from KingClub,
--    so with UnitClub's row gone every piece or person they save would be refused. The columns stay,
--    with the same values and indexes; they simply no longer need a UnitClub row behind them, as
--    ins_kingclub_agents.tenant_id and ins_agent_line.agent_id already do not.
-- 2. 10 of the 35 never signed in since the move, so ins_kingclub_agents does not know them yet and
--    the back office would lose their names. They are copied in from UnitClub's rows as they are now,
--    before UnitOS deletes them. seen_at is the copy's time, not a sign-in.
--
-- Run on prod (cenysylrzbwfrtuqoeqk) BEFORE UnitOS deletes the room. Re-runnable.

alter table public.ins_content drop constraint if exists ins_content_tenant_id_fkey;
alter table public.ins_people  drop constraint if exists ins_people_tenant_id_fkey;

insert into public.ins_kingclub_agents (id, agent_code, name, unit, tenant_id, tenant_name, seen_at)
select a.id, a.agent_code, a.name, a.unit, a.tenant_id, coalesce(nullif(trim(t.name), ''), t.slug), now()
  from public.agents a
  join public.tenants t on t.id = a.tenant_id
 where t.id = '9f35fe97-f6f2-4c9d-ad47-d904025c37e6'
on conflict (id) do nothing;
