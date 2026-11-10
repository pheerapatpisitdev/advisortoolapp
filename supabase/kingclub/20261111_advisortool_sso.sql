-- Applied to KingClub's own database (project zhkdupxxefszetgtqdeq), NOT to UnitClub: KingClub moved
-- out of UnitClub's project into one of its own on 2026-11-11, keeping its room's id (ga83i) and every
-- agent's id. Its menu's unitos-sso now writes the one-time ticket here, so advisortool takes it from
-- here (owner chose plan ข and ก, 2026-11-11; mockup https://claude.ai/artifact/5shfQXpgA1kqogXTapsT3W).
--
-- advisortool holds no key of KingClub's that could read anything else: it calls these two functions
-- with KingClub's publishable key and a lookup key of its own. Only the key's sha256 is kept here, in a
-- schema the API does not serve; the key itself is advisortool's KINGCLUB_LOOKUP_KEY. To set it, run in
-- KingClub's SQL editor, with the key in place of <key>:
--
--   insert into advisortool_private.lookup_keys (key_hash, note)
--   values (encode(extensions.digest('<key>', 'sha256'), 'hex'), 'advisortool');
--
-- To change it, insert the new hash, set the env, then delete the old row.
--
-- Same shape as Bluewealth's (supabase/bluewealth/20261024_advisortool_lookup.sql): an agent's row is
-- answered as advisortool reads UnitClub's (src/lib/auth/viewer.ts, AGENT_COLUMNS), with of the room's
-- config only what its gate reads.

create schema if not exists advisortool_private;
revoke all on schema advisortool_private from public, anon, authenticated;

create table if not exists advisortool_private.lookup_keys (
  key_hash   text primary key,
  note       text,
  created_at timestamptz not null default now()
);
revoke all on advisortool_private.lookup_keys from public, anon, authenticated;

create or replace function advisortool_private.key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key is not null and exists (
    select 1 from advisortool_private.lookup_keys
    where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  );
$$;
revoke all on function advisortool_private.key_ok(text) from public, anon, authenticated;

-- The ticket unitos-sso wrote, taken: deleted as it is read, so it works once, and only while it is
-- younger than its 60 seconds. Tickets nobody used are swept a day after they ran out. Answers the
-- agent's id, or null for a ticket that is not there, used or old.
create or replace function public.advisortool_take_ticket(p_key text, p_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_agent uuid;
begin
  if not advisortool_private.key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_id is null then return null; end if;
  delete from ins_sso_tickets where id = p_id and expires_at > now() returning agent_id into v_agent;
  delete from ins_sso_tickets where expires_at < now() - interval '1 day';
  return v_agent;
end;
$$;

revoke all on function public.advisortool_take_ticket(text, uuid) from public;
grant execute on function public.advisortool_take_ticket(text, uuid) to anon, authenticated, service_role;

create or replace function public.advisortool_agents(p_key text, p_id uuid default null, p_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not advisortool_private.key_ok(p_key) then
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
