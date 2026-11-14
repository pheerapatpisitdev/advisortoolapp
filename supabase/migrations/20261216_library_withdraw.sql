-- คลังแอนิเมชัน: ถอนออกจากคลัง (spec docs/superpowers/specs/2026-11-14-library-withdraw-design.md, "Data"): the owner
-- may take an approved part or style back out of the library, which leaves the row in a new state, gone, with
-- the reason. 20261215 declared the state check inline on the column, so Postgres named it
-- ins_library_uploads_state_check; it is dropped and added back with gone among the states. Nothing else.
-- Applied to production only on the owner's word, before the push.

alter table public.ins_library_uploads drop constraint if exists ins_library_uploads_state_check;
alter table public.ins_library_uploads add constraint ins_library_uploads_state_check check (state in ('wait', 'ok', 'no', 'queue', 'closed', 'gone'));
