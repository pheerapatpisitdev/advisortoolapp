-- The history table (20261012) was first made with agent_id referencing public.agents, which
-- no สมาชิกทั่วไป is a row of: their history saved nothing (final review, 2026-10-08). The file
-- 20261012 no longer has the key; this takes it off a table that was made with it. Harmless on
-- one that never had it.
--
-- Dropping a foreign key holds ACCESS EXCLUSIVE on the referenced table (UnitOS's agents) until
-- commit: give up rather than queue every read of agents behind a busy UnitOS transaction.
-- On a timeout, run it again at a quiet moment.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.ins_describe_history drop constraint if exists ins_describe_history_agent_id_fkey;
