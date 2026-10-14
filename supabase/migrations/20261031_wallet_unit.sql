-- /admin/wallet shows each agent's สังกัด (tenant) and หน่วย beside the name (owner, 2026-10-14, option ข).
-- Adding columns changes the return type, so the function is dropped and made again.
-- The new columns sit at the end: the code before this change reads by name and keeps working.
drop function if exists public.ins_wallet_summary(timestamptz);
create function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint, tenant text, unit text, is_member boolean)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, coalesce(a.name, m.name), coalesce(a.agent_code, m.email), w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint,
    t.name, nullif(btrim(a.unit), ''), a.id is null and m.id is not null
  from ins_wallets w
  left join agents a on a.id = w.agent_id
  left join tenants t on t.id = a.tenant_id
  left join ins_members m on m.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.id, a.name, a.agent_code, a.unit, t.name, m.id, m.name, m.email, w.balance_satang
  order by w.balance_satang desc;
$$;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
