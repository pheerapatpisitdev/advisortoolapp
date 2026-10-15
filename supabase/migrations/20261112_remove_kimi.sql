-- Kimi (Moonshot) removed from the system (owner, 2026-10-15). The account was never funded,
-- so it never ran a job; its key row and two model rows go. The provider check on
-- model_configs keeps 'moonshot' — loosening nothing, and old ledger rows may still name it.

delete from public.model_configs where provider = 'moonshot';
delete from public.ins_api_keys where provider = 'moonshot';
update public.ins_ai_settings set small_model = null where small_model like 'kimi-%';
update public.ins_ai_settings set large_model = null where large_model like 'kimi-%';
