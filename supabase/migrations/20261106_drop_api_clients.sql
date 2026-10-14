-- MCP / API out (owner, 2026-10-15; mockup https://claude.ai/artifact/M8kuVTUvqSNizeJYB2MvdG).
--
-- The keys other systems called the premium calculator with (/api/v1, /admin/api). Nobody ever
-- held one: the table was empty when the owner took the feature out. The function that counted
-- a key's calls goes with it.
drop function if exists public.ins_api_client_use(text);
drop table if exists public.ins_api_clients;
