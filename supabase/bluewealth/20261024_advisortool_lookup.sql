-- Applied to Bluewealth's own database (project tmbbxahyxwkshxuxphcb), NOT to UnitClub: Bluewealth
-- runs a copy of UnitOS, and its agents sign in to advisortool with their 6-digit code like UnitOS
-- agents (owner, 2026-10-24; mockup QtMeowzf8BfkaBXgSksLzY).
--
-- advisortool holds no key of Bluewealth's that could read anything else: it calls this one
-- function with Bluewealth's publishable key and a lookup key of its own. Only the key's sha256 is
-- kept here, in a schema the API does not serve; the key itself is advisortool's
-- BLUEWEALTH_LOOKUP_KEY. To change it, insert the new hash, set the env, then delete the old row.
--
-- The answer is shaped like the row advisortool reads from UnitClub (src/lib/auth/viewer.ts,
-- AGENT_COLUMNS) and carries of the room's config only what its gate reads.

create schema if not exists advisortool_private;
revoke all on schema advisortool_private from public, anon, authenticated;

create table if not exists advisortool_private.lookup_keys (
  key_hash   text primary key,
  note       text,
  created_at timestamptz not null default now()
);
revoke all on advisortool_private.lookup_keys from public, anon, authenticated;

create or replace function public.advisortool_agents(p_key text, p_id uuid default null, p_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_key is null or not exists (
    select 1 from advisortool_private.lookup_keys
    where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (p_id is null) = (p_code is null) then
    raise exception 'give an id or a code' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'agent_code', a.agent_code, 'name', a.name, 'unit', a.unit,
      'role', a.role, 'is_admin', a.is_admin, 'member_tier', a.member_tier,
      'membership_expires_at', a.membership_expires_at, 'created_at', a.created_at,
      'tenant', case when t.id is null then null else jsonb_build_object(
        'id', t.id, 'slug', t.slug, 'name', t.name, 'status', t.status, 'key_epoch', t.key_epoch,
        'config', jsonb_build_object(
          'features', t.config -> 'features',
          'isDemo', t.config -> 'isDemo',
          'premiumOnly', t.config -> 'premiumOnly',
          'flags', jsonb_build_object('memberFee', t.config -> 'flags' -> 'memberFee')
        )
      ) end
    ))
    from (
      select * from agents
      where (p_id is not null and id = p_id) or (p_code is not null and agent_code = p_code)
      limit 2
    ) a
    left join tenants t on t.id = a.tenant_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.advisortool_agents(text, uuid, text) from public;
grant execute on function public.advisortool_agents(text, uuid, text) to anon, authenticated, service_role;
