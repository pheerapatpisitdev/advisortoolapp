-- สำรวจความคุ้มครอง (owner, 2026-10-22, mockup SWVNeW6CQii59D6nhzUWpx): customers an agent saves
-- from the coverage survey join the FHC list (owner chose the one list), so they share this table.
-- `kind` tells the two apart; every row before this one is an FHC check. A survey row keeps its
-- answers and the meeting in `input`, an empty `gaps` and `snapshot`, and no first_area: the
-- survey prices nothing.
--
-- Additive only: code from before this column reads the table as it did.
alter table ins_fhc_customers add column if not exists kind text not null default 'fhc';
alter table ins_fhc_customers drop constraint if exists ins_fhc_customers_kind;
alter table ins_fhc_customers add constraint ins_fhc_customers_kind check (kind in ('fhc', 'survey'));
