# สมาชิกทั่วไป (ลูกค้านอก UnitClub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People outside UnitOS sign up at advisortool with phone + a 6-digit PIN they choose, and use Studio exactly like a UnitOS agent who is not staff (10 free rounds, then the wallet).

**Architecture:** A new table `ins_members` holds these accounts. The session cookie keeps carrying one uuid; `getViewer()` looks it up in UnitOS's `agents` first and in `ins_members` second, and returns a `Viewer` with `kind: "unitos" | "member"`. Seven `ins_*` foreign keys to `agents` are dropped so `agent_id` can hold either kind of id; everything that counts or charges by `agent_id` (free rounds, wallet, scope) then works unchanged.

**Tech Stack:** Next.js 15 (app router, server actions), Supabase (UnitClub project `cenysylrzbwfrtuqoeqk`, service-role client), vitest, `node:crypto` scrypt.

**Spec:** `docs/superpowers/specs/2026-10-01-outside-members-design.md`

## Global Constraints

- Branch `outside-members`, worked in place in the main folder (owner declines worktrees). Re-check `git branch --show-current` before every commit.
- Claude does not `git push` or `git fetch` in this repo — the owner pushes `main`.
- `.env.local` points at the **production** database. Never insert test rows there; tests use mocks only.
- PIN: exactly 6 digits; refused when all one digit or a run up/down by one (`000000`, `123456`, `987654`).
- Phone: stored as 10 digits starting with `0`; input may carry spaces, dashes, dots, brackets, `+66` or `66`.
- Signups: at most `3` per IP per 24 hours. Login: `5` failures per IP per 15 minutes (existing), and `5` failures per phone per 15 minutes (new).
- One error for unknown phone / wrong PIN / suspended: `เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก N ครั้ง`.
- Member viewer: `tenantId = null`, `tenantSlug = ""`, `tenantName = "สมาชิกทั่วไป"`, `trial = false`, `staff = null`, `code = phone`.
- Switch `ins_ai_settings.member_signup_enabled` defaults to `false`; contact link `ins_ai_settings.member_contact_url` must start with `https://` or be empty.
- Every exported function in a `"use server"` file under `src/app/admin` or `src/app/studio` opens with `await requireMember(` or `await requireStaff(` (enforced by `tests/auth/guards.test.ts`).
- Server actions return `{ ok: false, error }` rather than throwing (Next hides thrown messages in production).
- Code comments follow the repo's style: English prose explaining *why*, with owner decisions dated.

**Deviations from the spec, decided while planning (owner to confirm when reviewing this plan):**
- The account page is `/studio/account`, not `/account`: it gets Studio's layout, menu and sign-in gate for free, and the guard test already covers `src/app/studio`.
- One release instead of the spec's three steps. Old code's `placedBy()` embeds `agents` through `ins_audit`'s FK; once the FK is dropped that read errors and `placedBy()` already logs and returns `{}` — the calendar's "โดย" is blank for the minutes between the migration and the push, nothing breaks. So: migrate, then push once.
- No sign-up link on the home page or the signed-out menu: the menu's "Studio" link already lands on `/login`, and `/login` carries "สมัครใช้ Studio" while signup is open.

## Review Focus

- A member changes or has their PIN reset: sessions on other devices must stop working at once, and the device that changed it must stay signed in (clock of the app, not of the database, sets `pin_changed_at`). → Task 3 test "shuts out a session issued before the PIN changed", Task 8 test "keeps this device signed in".
- Two people sign up with the same phone at the same moment: the second gets `เบอร์นี้สมัครไว้แล้ว`, not a 500. → Task 5 test "says taken when the phone's unique index refuses the row".
- A phone typed as `+66 81-234-5678` at signup and `0812345678` at login must reach the same account. → Task 2 test "normalizes the ways a Thai mobile is written".
- A UnitOS agent opening `/studio/account` or calling its actions must be refused (they have no PIN here). → Task 8 tests.
- The admin wallet page must list members' wallets too (its SQL joined `agents` only). → Task 1 SQL, verified in Task 10 step "check the wallet summary".

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261001_outside_members.sql`

**Interfaces:**
- Produces: table `public.ins_members (id uuid, phone text, name text, pin_hash text, status text, signup_ip text, created_at timestamptz, pin_changed_at timestamptz)`; columns `ins_ai_settings.member_signup_enabled boolean`, `ins_ai_settings.member_contact_url text`, `ins_login_attempts.phone text`; function `ins_wallet_summary(p_since)` unchanged signature, now listing members too.

- [ ] **Step 1: Write the migration**

```sql
-- สมาชิกทั่วไป: people outside UnitOS who sign up at advisortool itself (owner, 2026-10-01).
--
-- Until now whoever used Studio was a row of UnitOS's `agents`. People with no UnitOS room get
-- an account here instead — never a row in `agents`, whose triggers (seat limit, signup notice,
-- welcome announcement) belong to UnitOS and which would let them into UnitOS itself. They sign
-- in with their phone and a 6-digit PIN they chose; the phone is the name, the PIN the secret.
create table public.ins_members (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null unique check (phone ~ '^0[0-9]{9}$'),
  name           text not null check (char_length(name) between 1 and 60),
  -- scrypt$N$r$p$salt$hash, src/lib/auth/member.ts
  pin_hash       text not null,
  status         text not null default 'active' check (status in ('active', 'suspended')),
  signup_ip      text,
  created_at     timestamptz not null default now(),
  -- a session issued before this is refused: changing or resetting the PIN signs out every other device
  pin_changed_at timestamptz
);
create index ins_members_signup_ip_idx on public.ins_members (signup_ip, created_at desc);
comment on table public.ins_members is 'advisortool members outside UnitOS: phone + hashed PIN. service_role only.';
alter table public.ins_members enable row level security;
revoke all on public.ins_members from anon, authenticated;

-- `agent_id` now holds a UnitOS agent's id or a member's. ins_staff and ins_sso_tickets keep
-- theirs: only UnitOS agents are staff or come in from UnitOS. Dropping the cascade on the
-- wallet tables also means money an agent paid in is no longer deleted with their UnitOS row.
alter table public.ins_content        drop constraint if exists ins_content_agent_id_fkey;
alter table public.ins_people         drop constraint if exists ins_people_agent_id_fkey;
alter table public.ins_audit          drop constraint if exists ins_audit_agent_id_fkey;
alter table public.ins_wallets        drop constraint if exists ins_wallets_agent_id_fkey;
alter table public.ins_wallet_entries drop constraint if exists ins_wallet_entries_agent_id_fkey;
alter table public.ins_wallet_holds   drop constraint if exists ins_wallet_holds_agent_id_fkey;
alter table public.ins_wallet_topups  drop constraint if exists ins_wallet_topups_agent_id_fkey;

-- signup is off until the owner has tried it on production
alter table public.ins_ai_settings
  add column if not exists member_signup_enabled boolean not null default false,
  add column if not exists member_contact_url text;

-- the per-phone lock: five wrong PINs for one phone from any number of addresses
alter table public.ins_login_attempts add column if not exists phone text;
create index if not exists ins_login_attempts_phone_idx
  on public.ins_login_attempts (phone, created_at desc) where phone is not null;

-- The owner's wallet page: members' wallets too, named by their name and phone.
create or replace function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, coalesce(a.name, m.name), coalesce(a.agent_code, m.phone), w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint
  from ins_wallets w
  left join agents a on a.id = w.agent_id
  left join ins_members m on m.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.name, a.agent_code, m.name, m.phone, w.balance_satang
  order by w.balance_satang desc;
$$;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
```

- [ ] **Step 2: Check the constraint names match production** (read-only)

Run through the Supabase MCP `execute_sql` on project `cenysylrzbwfrtuqoeqk`:
```sql
select conname from pg_constraint where confrelid = 'public.agents'::regclass and conrelid::regclass::text like 'ins_%' order by 1;
```
Expected: the seven names above plus `ins_sso_tickets_agent_id_fkey`, `ins_staff_added_by_fkey`, `ins_staff_agent_id_fkey`. Do **not** apply the migration now — Task 10 does.

- [ ] **Step 3: Commit**

```bash
git branch --show-current   # outside-members
git add supabase/migrations/20261001_outside_members.sql
git commit -m "feat(members): migration for accounts outside UnitOS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Phone, PIN and signup rules (pure)

**Files:**
- Create: `src/lib/auth/member.ts`
- Test: `tests/auth/member.test.ts`

**Interfaces:**
- Produces:
  - `SIGNUPS_PER_IP_PER_DAY = 3`, `PHONE_FAILURES = 5`
  - `normalizePhone(raw: unknown): string | null`
  - `weakPin(pin: string): boolean`
  - `pinProblem(pin: unknown, again?: unknown): string | null`
  - `cleanName(raw: unknown): string | null`
  - `readSignup(input: { name: unknown; phone: unknown; pin: unknown; pinAgain: unknown; consent: unknown }): { ok: true; name: string; phone: string; pin: string } | { ok: false; error: string }`
  - `hashPin(pin: string): Promise<string>`, `verifyPin(pin: string, stored: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { cleanName, hashPin, normalizePhone, pinProblem, readSignup, verifyPin, weakPin } from "@/lib/auth/member";

describe("normalizePhone", () => {
  it("normalizes the ways a Thai mobile is written", () => {
    for (const raw of ["0812345678", "081-234-5678", "081 234 5678", "(081) 234.5678", "+66812345678", "+66 81-234-5678", "66812345678"]) {
      expect(normalizePhone(raw)).toBe("0812345678");
    }
  });

  it("refuses what is not ten digits starting with 0", () => {
    for (const raw of ["", "081234567", "08123456789", "1812345678", "08123x5678", null, 812345678]) {
      expect(normalizePhone(raw)).toBeNull();
    }
  });
});

describe("the PIN", () => {
  it("is six digits", () => {
    expect(pinProblem("12345")).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem("1234567")).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem("12a456")).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem(undefined)).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem("280419")).toBeNull();
  });

  it("must be typed the same twice when asked twice", () => {
    expect(pinProblem("280419", "280418")).toBe("PIN สองช่องไม่ตรงกัน");
    expect(pinProblem("280419", "280419")).toBeNull();
  });

  it("refuses one digit repeated and runs up or down", () => {
    for (const pin of ["000000", "999999", "012345", "123456", "456789", "987654", "543210"]) {
      expect(weakPin(pin)).toBe(true);
      expect(pinProblem(pin)).toBe("PIN นี้เดาง่ายเกินไป ลองตั้งใหม่");
    }
    for (const pin of ["280419", "112233", "135790"]) expect(weakPin(pin)).toBe(false);
  });

  it("is hashed, and only the same PIN verifies", async () => {
    const stored = await hashPin("280419");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain("280419");
    expect(await verifyPin("280419", stored)).toBe(true);
    expect(await verifyPin("280418", stored)).toBe(false);
    expect(await hashPin("280419")).not.toBe(stored);
  });

  it("does not verify against a hash it cannot read", async () => {
    expect(await verifyPin("280419", "")).toBe(false);
    expect(await verifyPin("280419", "plain$280419")).toBe(false);
    expect(await verifyPin("280419", "scrypt$16384$8$1$AAAA")).toBe(false);
  });
});

describe("cleanName", () => {
  it("trims, and takes 1 to 60 characters", () => {
    expect(cleanName("  สมชาย ใจดี  ")).toBe("สมชาย ใจดี");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("ก".repeat(61))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe("readSignup", () => {
  const good = { name: "สมชาย", phone: "081-234-5678", pin: "280419", pinAgain: "280419", consent: "on" };

  it("takes a complete form", () => {
    expect(readSignup(good)).toEqual({ ok: true, name: "สมชาย", phone: "0812345678", pin: "280419" });
  });

  it("names the first thing wrong", () => {
    expect(readSignup({ ...good, name: " " })).toEqual({ ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" });
    expect(readSignup({ ...good, phone: "0812" })).toEqual({ ok: false, error: "กรุณากรอกเบอร์มือถือ 10 หลัก" });
    expect(readSignup({ ...good, pinAgain: "280418" })).toEqual({ ok: false, error: "PIN สองช่องไม่ตรงกัน" });
    expect(readSignup({ ...good, pin: "123456", pinAgain: "123456" })).toEqual({ ok: false, error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(readSignup({ ...good, consent: null })).toEqual({ ok: false, error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/auth/member.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/member`.

- [ ] **Step 3: Implement**

```ts
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * สมาชิกทั่วไป: the rules for an account outside UnitOS (owner, 2026-10-01). Pure, apart from
 * the hashing, so the rules can be tested without a database; src/lib/auth/member-store.ts
 * reads and writes the rows.
 *
 * The phone is the account's name and the PIN its secret. A PIN alone would not do, because
 * the members choose their own: two would choose the same one, and a sign-up page refusing a
 * PIN as taken would tell anybody which PINs sign somebody in.
 */

/** accounts one address may open in a day — the free rounds are real money (owner, 2026-10-01) */
export const SIGNUPS_PER_IP_PER_DAY = 3;
/** wrong PINs for one phone, from any address, before it waits (the same window as the IP's) */
export const PHONE_FAILURES = 5;

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_BYTES = 32;
const scrypt = promisify(scryptCallback) as (
  pin: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** Ten digits starting with 0, however it was typed: `+66 81-234-5678` is `0812345678`. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+66")) digits = `0${digits.slice(3)}`;
  else if (/^66\d{9}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

/** One digit six times, or a run up or down by one: the first PINs anybody tries. */
export function weakPin(pin: string): boolean {
  const d = [...pin].map(Number);
  const steps = d.slice(1).map((x, i) => x - d[i]);
  return [0, 1, -1].some((step) => steps.every((s) => s === step));
}

/** What is wrong with a new PIN, or null. `again` is the second box, when there is one. */
export function pinProblem(pin: unknown, again?: unknown): string | null {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) return "PIN ต้องเป็นตัวเลข 6 หลัก";
  if (again !== undefined && pin !== again) return "PIN สองช่องไม่ตรงกัน";
  if (weakPin(pin)) return "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่";
  return null;
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export type SignupInput = { name: unknown; phone: unknown; pin: unknown; pinAgain: unknown; consent: unknown };

/** The sign-up form, checked in the order it is filled in; the first thing wrong is the one said. */
export function readSignup(input: SignupInput): { ok: true; name: string; phone: string; pin: string } | { ok: false; error: string } {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "กรุณากรอกเบอร์มือถือ 10 หลัก" };
  const problem = pinProblem(input.pin, input.pinAgain);
  if (problem) return { ok: false, error: problem };
  if (input.consent !== "on") return { ok: false, error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" };
  return { ok: true, name, phone, pin: input.pin as string };
}

/** `scrypt$N$r$p$salt$hash`, so the cost can be raised later without losing the old hashes. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEY_BYTES, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const want = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || want.length === 0) return false;
  const got = await scrypt(pin, salt, want.length, { N, r, p });
  return timingSafeEqual(got, want);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/auth/member.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # outside-members
git add src/lib/auth/member.ts tests/auth/member.test.ts
git commit -m "feat(members): phone, PIN and signup rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: A member as a Viewer

**Files:**
- Modify: `src/lib/auth/access.ts` (types `Viewer`; `admit`; add `MemberRow`, `MEMBER_ROOM`, `admitMember`)
- Modify: `src/lib/auth/scope.ts:29` (`owner.tenantId: string | null`)
- Modify: `tests/helpers/signed-in.ts`, `tests/auth/quota.test.ts`, `tests/wallet/take-round.test.ts`, `tests/wallet/topup-actions.test.ts` (add `kind: "unitos"` to each `Viewer` literal)
- Test: `tests/auth/access.test.ts` (append)

**Interfaces:**
- Produces:
  - `Viewer.kind: "unitos" | "member"`; `Viewer.tenantId: string | null`
  - `interface MemberRow { id: string; phone: string; name: string; status: string; pin_changed_at: string | null }`
  - `MEMBER_ROOM = "สมาชิกทั่วไป"`
  - `admitMember(member: MemberRow | null, issuedAt: number): Viewer | null`

- [ ] **Step 1: Write the failing test** — append to `tests/auth/access.test.ts` (and add `admitMember, type MemberRow` to its import from `@/lib/auth/access`):

```ts
describe("admitMember (owner, 2026-10-01)", () => {
  const member = (over: Partial<MemberRow> = {}): MemberRow => ({
    id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null, ...over,
  });

  it("lets an active member in with Studio only and no room", () => {
    expect(admitMember(member(), Date.now())).toEqual({
      kind: "member", agentId: "m1", code: "0812345678", name: "สมชาย",
      tenantId: null, tenantSlug: "", tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
    });
  });

  it("names a member with a blank name by their phone", () => {
    expect(admitMember(member({ name: "  " }), Date.now())?.name).toBe("0812345678");
  });

  it("shuts out a member who is gone or suspended", () => {
    expect(admitMember(null, Date.now())).toBeNull();
    expect(admitMember(member({ status: "suspended" }), Date.now())).toBeNull();
  });

  it("shuts out a session issued before the PIN changed", () => {
    const at = "2026-10-01T05:00:00Z";
    expect(admitMember(member({ pin_changed_at: at }), Date.parse(at) - 1)).toBeNull();
    expect(admitMember(member({ pin_changed_at: at }), Date.parse(at))).not.toBeNull();
  });

  it("marks a UnitOS agent as one", () => {
    expect(admit(agent(), null, Date.now())?.kind).toBe("unitos");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/auth/access.test.ts`
Expected: FAIL — `admitMember` is not exported.

- [ ] **Step 3: Implement** — in `src/lib/auth/access.ts`:

Change the `Viewer` interface's first lines and `tenantId`:
```ts
export interface Viewer {
  /** a UnitOS agent, or a member who signed up here (src/lib/auth/member.ts, owner 2026-10-01) */
  kind: "unitos" | "member";
  agentId: string;
  /** the agent's 6-digit code; a member's phone */
  code: string;
  name: string;
  /** null for a member: no UnitOS room */
  tenantId: string | null;
```
(the remaining fields stay as they are).

In `admit()`'s returned object add `kind: "unitos",` as its first key.

Append after `admit()`:
```ts
/** A member's row in ins_members, as src/lib/auth/viewer.ts reads it. */
export interface MemberRow {
  id: string;
  phone: string;
  name: string;
  status: string;
  pin_changed_at: string | null;
}

/** What a member's menu says in place of a room. */
export const MEMBER_ROOM = "สมาชิกทั่วไป";

/**
 * A member outside UnitOS (owner, 2026-10-01): Studio as any agent who is not staff has it —
 * the free rounds, then their own wallet — and nothing of the Page or the back office. A PIN
 * changed or reset after the session was issued ends it, as a room's key_epoch does.
 */
export function admitMember(member: MemberRow | null, issuedAt: number): Viewer | null {
  if (!member || member.status !== "active") return null;
  if (member.pin_changed_at && issuedAt < Date.parse(member.pin_changed_at)) return null;
  return {
    kind: "member",
    agentId: member.id,
    code: member.phone,
    name: member.name.trim() || member.phone,
    tenantId: null,
    tenantSlug: "",
    tenantName: MEMBER_ROOM,
    trial: false,
    staff: null,
  };
}
```

In `src/lib/auth/scope.ts` change the `owner` field of `Scope`:
```ts
  owner: { agentId: string; tenantId: string | null } | null;
```

In each of `tests/helpers/signed-in.ts`, `tests/auth/quota.test.ts`, `tests/wallet/take-round.test.ts`, `tests/wallet/topup-actions.test.ts`, add `kind: "unitos",` as the first key of every object typed `Viewer` (find them with `grep -n "tenantSlug" <file>`).

- [ ] **Step 4: Run tests and the type check**

Run: `npx vitest run tests/auth tests/wallet && npx tsc --noEmit`
Expected: PASS, and no type errors.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # outside-members
git add src/lib/auth/access.ts src/lib/auth/scope.ts tests/helpers/signed-in.ts tests/auth/access.test.ts tests/auth/quota.test.ts tests/wallet/take-round.test.ts tests/wallet/topup-actions.test.ts
git commit -m "feat(members): a member is a Viewer of its own kind, with no room

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: getViewer finds members; names without the FK

**Files:**
- Create: `tests/helpers/fake-db.ts`
- Modify: `src/lib/auth/viewer.ts` (add `memberById`, `displayNames`; change `getViewer`, `placedBy`)
- Test: `tests/auth/viewer.test.ts`

**Interfaces:**
- Consumes: `admitMember`, `MemberRow` (Task 3)
- Produces:
  - `memberById(id: string): Promise<MemberRow | null>`
  - `displayNames(ids: string[]): Promise<Record<string, string>>` — a UnitOS agent's name or code, a member's name or phone
  - `tests/helpers/fake-db.ts` exports `db` (`db.client`, `db.on(table, answer | handler)`, `db.reset()`, `db.log`) and `has(steps, method, ...args)`

- [ ] **Step 1: Write the fake database helper**

```ts
/**
 * A stand-in for the service-role Supabase client, for code that builds queries itself.
 *
 *   vi.mock("@/lib/supabase/admin", async () => {
 *     const { db } = await import("../helpers/fake-db");
 *     return { supabaseAdmin: () => db.client };
 *   });
 *
 * Every `from(table)` records the calls made on it (`select`, `eq`, `insert`, …) and, when
 * awaited, answers with what `db.on(table, …)` said — a fixed answer, or a function of the
 * calls so one table can answer two different questions. `rpc(fn, args)` is table `rpc:fn`.
 */
export type Step = { method: string; args: unknown[] };
export type Answer = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
type Handler = (steps: Step[]) => Answer;

function query(table: string, first?: Step) {
  const steps: Step[] = first ? [first] : [];
  db.log.push({ table, steps });
  const chain: object = new Proxy({}, {
    get(_target, method) {
      if (method === "then") {
        const answer = (db.handlers.get(table) ?? (() => ({})))(steps);
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null, count: null, ...answer }).then(ok, bad);
      }
      return (...args: unknown[]) => {
        steps.push({ method: String(method), args });
        return chain;
      };
    },
  });
  return chain as never;
}

export const db = {
  handlers: new Map<string, Handler>(),
  log: [] as { table: string; steps: Step[] }[],
  on(table: string, answer: Answer | Handler) {
    this.handlers.set(table, typeof answer === "function" ? answer : () => answer);
  },
  reset() {
    this.handlers.clear();
    this.log.length = 0;
  },
  /** the calls of every query on a table that began with `method` (insert, update, …) */
  writes(table: string, method: string): Step[][] {
    return this.log.filter((l) => l.table === table && l.steps.some((s) => s.method === method)).map((l) => l.steps);
  },
  client: {
    from: (table: string) => query(table),
    rpc: (fn: string, args?: unknown) => query(`rpc:${fn}`, { method: "rpc", args: [args] }),
  },
};

/** whether a query called `method` with these leading arguments */
export function has(steps: Step[], method: string, ...args: unknown[]): boolean {
  return steps.some((s) => s.method === method && args.every((a, i) => s.args[i] === a));
}
```

- [ ] **Step 2: Write the failing test** — `tests/auth/viewer.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const session = vi.hoisted(() => ({ value: null as null | { agentId: string; issuedAt: number } }));
vi.mock("@/lib/auth/session", () => ({ readSession: async () => session.value }));
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const { displayNames, getViewer, placedBy } = await import("@/lib/auth/viewer");

const AGENT_ROW = {
  id: "a1", agent_code: "015495", name: "บอย",
  tenant: { id: "t1", slug: "83g", name: "83G", status: "active", config: null, key_epoch: null },
};
const MEMBER_ROW = { id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null };

beforeEach(() => {
  db.reset();
  session.value = null;
});

describe("getViewer", () => {
  it("is nobody without a session", async () => {
    expect(await getViewer()).toBeNull();
  });

  it("finds a UnitOS agent first", async () => {
    session.value = { agentId: "a1", issuedAt: Date.now() };
    db.on("agents", { data: AGENT_ROW });
    db.on("ins_staff", { data: null });
    const v = await getViewer();
    expect(v?.kind).toBe("unitos");
    expect(v?.tenantSlug).toBe("83g");
    expect(db.log.some((l) => l.table === "ins_members")).toBe(false);
  });

  it("finds a member when UnitOS has nobody by that id", async () => {
    session.value = { agentId: "m1", issuedAt: Date.now() };
    db.on("agents", { data: null });
    db.on("ins_staff", { data: null });
    db.on("ins_members", { data: MEMBER_ROW });
    const v = await getViewer();
    expect(v).toMatchObject({ kind: "member", agentId: "m1", tenantId: null, tenantName: "สมาชิกทั่วไป", staff: null });
  });

  it("shuts out a suspended member, and an id found nowhere", async () => {
    session.value = { agentId: "m1", issuedAt: Date.now() };
    db.on("agents", { data: null });
    db.on("ins_staff", { data: null });
    db.on("ins_members", { data: { ...MEMBER_ROW, status: "suspended" } });
    expect(await getViewer()).toBeNull();
    db.on("ins_members", { data: null });
    expect(await getViewer()).toBeNull();
  });
});

describe("displayNames", () => {
  it("names agents by name or code, and members by name or phone", async () => {
    db.on("agents", { data: [{ id: "a1", name: "บอย", agent_code: "015495" }, { id: "a2", name: " ", agent_code: "000111" }] });
    db.on("ins_members", { data: [{ id: "m1", name: "", phone: "0812345678" }] });
    expect(await displayNames(["a1", "a2", "m1", "a1"])).toEqual({ a1: "บอย", a2: "000111", m1: "0812345678" });
  });

  it("asks nothing for no ids", async () => {
    expect(await displayNames([])).toEqual({});
    expect(db.log).toHaveLength(0);
  });
});

describe("placedBy", () => {
  it("names who last placed each piece without joining agents through a foreign key", async () => {
    db.on("ins_audit", {
      data: [
        { target: "p1", agent_id: "m1" },
        { target: "p2", agent_id: "a1" },
        { target: "p1", agent_id: "a1" },
        { target: "p3", agent_id: null },
      ],
    });
    db.on("agents", { data: [{ id: "a1", name: "บอย", agent_code: "015495" }] });
    db.on("ins_members", { data: [{ id: "m1", name: "สมชาย", phone: "0812345678" }] });
    expect(await placedBy(["p1", "p2", "p3"])).toEqual({ p1: "สมชาย", p2: "บอย" });
    const audit = db.log.find((l) => l.table === "ins_audit")!;
    expect(String(audit.steps.find((s) => s.method === "select")?.args[0])).not.toContain("agents");
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/auth/viewer.test.ts`
Expected: FAIL — `displayNames` is not exported; the member case returns null.

- [ ] **Step 4: Implement** — in `src/lib/auth/viewer.ts`:

Change the import from `./access` to:
```ts
import { admit, admitMember, can, type AgentRow, type MemberRow, type Perm, type StaffRow, type Viewer } from "./access";
```

Add after `agentsByCode`:
```ts
const MEMBER_COLUMNS = "id, phone, name, status, pin_changed_at";

/** A member who signed up here (src/lib/auth/member.ts), or null. */
export async function memberById(id: string): Promise<MemberRow | null> {
  const { data, error } = await supabaseAdmin().from("ins_members").select(MEMBER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลสมาชิกไม่ได้: ${error.message}`);
  return (data as MemberRow | null) ?? null;
}
```

Replace the body of `getViewer`:
```ts
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;
  const [agent, staff] = await Promise.all([agentById(session.agentId), staffRow(session.agentId)]);
  if (agent) return admit(agent, staff, session.issuedAt);
  // not UnitOS's: a member who signed up here, or nobody (owner, 2026-10-01)
  return admitMember(await memberById(session.agentId), session.issuedAt);
});
```

Add `displayNames` above `placedBy`, and replace `placedBy`:
```ts
/**
 * What to call each id in a list: a UnitOS agent's name or code, a member's name or phone.
 * Two plain reads rather than a join — since 2026-10-01 an `agent_id` may be either kind,
 * and the foreign keys that joins went through are gone. An id found in neither is left out.
 */
export async function displayNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const [agents, members] = await Promise.all([
    supabaseAdmin().from("agents").select("id, name, agent_code").in("id", unique),
    supabaseAdmin().from("ins_members").select("id, name, phone").in("id", unique),
  ]);
  if (agents.error) console.error("agent names unreadable:", agents.error.message);
  if (members.error) console.error("member names unreadable:", members.error.message);
  const names: Record<string, string> = {};
  for (const m of (members.data ?? []) as { id: string; name: string | null; phone: string }[]) names[m.id] = m.name?.trim() || m.phone;
  for (const a of (agents.data ?? []) as { id: string; name: string | null; agent_code: string }[]) names[a.id] = a.name?.trim() || a.agent_code;
  return names;
}

/**
 * Who last posted, scheduled or moved each piece, by name — the calendar's "โดย". Staff share
 * one Page, so a post nobody remembers making should say whose it was. Pieces placed before
 * the log began (2026-09-27) have no line and show no name.
 */
export async function placedBy(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabaseAdmin().from("ins_audit")
    .select("target, agent_id")
    .in("target", ids).in("action", ["post", "schedule", "reschedule"])
    .order("at", { ascending: false });
  if (error) {
    console.error("placed-by unreadable:", error.message);
    return {};
  }
  const rows = (data ?? []) as { target: string; agent_id: string | null }[];
  const latest: Record<string, string> = {};
  for (const row of rows) if (!latest[row.target] && row.agent_id) latest[row.target] = row.agent_id;
  const names = await displayNames(Object.values(latest));
  const by: Record<string, string> = {};
  for (const [target, agentId] of Object.entries(latest)) if (names[agentId]) by[target] = names[agentId];
  return by;
}
```

Rows come newest first and rows with no `agent_id` are skipped, so each piece is named after the newest placer who has one — as before.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/auth && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # outside-members
git add tests/helpers/fake-db.ts tests/auth/viewer.test.ts src/lib/auth/viewer.ts
git commit -m "feat(members): getViewer finds members; names read without the agents FK

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Member reads and writes

**Files:**
- Create: `src/lib/auth/member-store.ts`
- Test: `tests/auth/member-store.test.ts`

**Interfaces:**
- Consumes: `MemberRow` (Task 3), `AI_ROUNDS`, `FREE_ROUNDS`, `FREE_ROUNDS_FROM` from `src/lib/auth/quota.ts`
- Produces:
  - `type MemberWithPin = MemberRow & { pin_hash: string }`
  - `memberByPhone(phone: string): Promise<MemberWithPin | null>`
  - `createMember(m: { phone: string; name: string; pinHash: string; ip: string }): Promise<{ ok: true; id: string } | { ok: false; taken: true }>`
  - `setPin(id: string, pinHash: string, at: Date): Promise<void>`
  - `setName(id: string, name: string): Promise<void>`
  - `setStatus(id: string, status: "active" | "suspended"): Promise<void>`
  - `signupsFromIp(ip: string, since: Date): Promise<number>`
  - `phoneFailures(phone: string, since: Date): Promise<number>`
  - `interface MemberSettings { signupOpen: boolean; contactUrl: string | null }`
  - `memberSettings(): Promise<MemberSettings>`, `saveMemberSettings(s: MemberSettings): Promise<void>`
  - `interface MemberSummary { id: string; name: string; phone: string; status: "active" | "suspended"; createdAt: string; balanceSatang: number; freeUsed: number }`
  - `listMembers(limit?: number): Promise<MemberSummary[]>`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});
vi.mock("@/lib/wallet/store", () => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));

import { db, has } from "../helpers/fake-db";
const store = await import("@/lib/auth/member-store");

beforeEach(() => db.reset());

describe("createMember", () => {
  it("writes the row and returns its id", async () => {
    db.on("ins_members", { data: { id: "m1" } });
    expect(await store.createMember({ phone: "0812345678", name: "สมชาย", pinHash: "scrypt$x", ip: "1.2.3.4" })).toEqual({ ok: true, id: "m1" });
    const [insert] = db.writes("ins_members", "insert");
    expect(insert[0].args[0]).toEqual({ phone: "0812345678", name: "สมชาย", pin_hash: "scrypt$x", signup_ip: "1.2.3.4" });
  });

  it("says taken when the phone's unique index refuses the row", async () => {
    db.on("ins_members", { error: { message: "duplicate key", code: "23505" } });
    expect(await store.createMember({ phone: "0812345678", name: "ก", pinHash: "h", ip: "ip" })).toEqual({ ok: false, taken: true });
  });

  it("throws on any other failure", async () => {
    db.on("ins_members", { error: { message: "boom" } });
    await expect(store.createMember({ phone: "0812345678", name: "ก", pinHash: "h", ip: "ip" })).rejects.toThrow("boom");
  });
});

describe("setPin", () => {
  it("stamps the change with the app's clock, not the database's", async () => {
    const at = new Date("2026-10-01T05:00:00.123Z");
    await store.setPin("m1", "scrypt$y", at);
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ pin_hash: "scrypt$y", pin_changed_at: "2026-10-01T05:00:00.123Z" });
    expect(has(update, "eq", "id", "m1")).toBe(true);
  });
});

describe("memberSettings", () => {
  it("is closed with no contact link when nothing is saved", async () => {
    db.on("ins_ai_settings", { data: null });
    expect(await store.memberSettings()).toEqual({ signupOpen: false, contactUrl: null });
  });

  it("reads what was saved", async () => {
    db.on("ins_ai_settings", { data: { member_signup_enabled: true, member_contact_url: "https://lin.ee/x" } });
    expect(await store.memberSettings()).toEqual({ signupOpen: true, contactUrl: "https://lin.ee/x" });
  });
});

describe("counts", () => {
  it("counts sign-ups from an address since a moment", async () => {
    db.on("ins_members", (steps) => ({ count: has(steps, "eq", "signup_ip", "1.2.3.4") ? 2 : 0 }));
    expect(await store.signupsFromIp("1.2.3.4", new Date(0))).toBe(2);
  });

  it("counts a phone's failed sign-ins since a moment", async () => {
    db.on("ins_login_attempts", (steps) => ({ count: has(steps, "eq", "phone", "0812345678") && has(steps, "eq", "ok", false) ? 4 : 0 }));
    expect(await store.phoneFailures("0812345678", new Date(0))).toBe(4);
  });
});

describe("listMembers", () => {
  it("lists members newest first with balance and free rounds used, capped at ten", async () => {
    db.on("ins_members", { data: [
      { id: "m2", name: "ข", phone: "0822222222", status: "suspended", created_at: "2026-10-02T00:00:00Z" },
      { id: "m1", name: "ก", phone: "0811111111", status: "active", created_at: "2026-10-01T00:00:00Z" },
    ] });
    db.on("ins_wallets", { data: [{ agent_id: "m1", balance_satang: 5000 }] });
    db.on("ins_audit", (steps) => ({ count: has(steps, "eq", "agent_id", "m1") ? 14 : 3 }));
    expect(await store.listMembers()).toEqual([
      { id: "m2", name: "ข", phone: "0822222222", status: "suspended", createdAt: "2026-10-02T00:00:00Z", balanceSatang: 0, freeUsed: 3 },
      { id: "m1", name: "ก", phone: "0811111111", status: "active", createdAt: "2026-10-01T00:00:00Z", balanceSatang: 5000, freeUsed: 10 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/auth/member-store.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/member-store`.

- [ ] **Step 3: Implement**

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MemberRow } from "./access";
import { AI_ROUNDS, FREE_ROUNDS, FREE_ROUNDS_FROM } from "./quota";

/**
 * The reads and writes of ins_members (supabase/migrations/20261001_outside_members.sql) and
 * of the two settings that go with it. The rules they are checked against are in ./member.ts.
 */

export type MemberWithPin = MemberRow & { pin_hash: string };

export async function memberByPhone(phone: string): Promise<MemberWithPin | null> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .select("id, phone, name, status, pin_changed_at, pin_hash").eq("phone", phone).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลสมาชิกไม่ได้: ${error.message}`);
  return (data as MemberWithPin | null) ?? null;
}

/** `taken` when the phone is already somebody's — the unique index decides, so two at once cannot both win. */
export async function createMember(m: { phone: string; name: string; pinHash: string; ip: string }): Promise<{ ok: true; id: string } | { ok: false; taken: true }> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .insert({ phone: m.phone, name: m.name, pin_hash: m.pinHash, signup_ip: m.ip }).select("id").single();
  if (error?.code === "23505") return { ok: false, taken: true };
  if (error) throw new Error(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`);
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * A new PIN, and every session issued before `at` ends (src/lib/auth/access.ts admitMember).
 * `at` is the app's clock, the one sessions are stamped with: the database's could run a few
 * milliseconds ahead and end the session the caller is about to start as well.
 */
export async function setPin(id: string, pinHash: string, at: Date): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members")
    .update({ pin_hash: pinHash, pin_changed_at: at.toISOString() }).eq("id", id);
  if (error) throw new Error(`เปลี่ยน PIN ไม่สำเร็จ: ${error.message}`);
}

export async function setName(id: string, name: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members").update({ name }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนชื่อไม่สำเร็จ: ${error.message}`);
}

export async function setStatus(id: string, status: "active" | "suspended"): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members").update({ status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
}

export async function signupsFromIp(ip: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin().from("ins_members").select("id", { count: "exact", head: true })
    .eq("signup_ip", ip).gte("created_at", since.toISOString());
  if (error) throw new Error(`นับการสมัครไม่ได้: ${error.message}`);
  return count ?? 0;
}

export async function phoneFailures(phone: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin().from("ins_login_attempts").select("id", { count: "exact", head: true })
    .eq("phone", phone).eq("ok", false).gte("created_at", since.toISOString());
  if (error) throw new Error(`นับการเข้าสู่ระบบไม่ได้: ${error.message}`);
  return count ?? 0;
}

export interface MemberSettings {
  /** /signup takes new members (owner's switch, off until they have tried it) */
  signupOpen: boolean;
  /** where "ลืม PIN? ติดต่อแอดมิน" goes; null shows the words alone */
  contactUrl: string | null;
}

export async function memberSettings(): Promise<MemberSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings")
    .select("member_signup_enabled, member_contact_url").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าสมาชิกไม่ได้: ${error.message}`);
  const url = typeof data?.member_contact_url === "string" && data.member_contact_url ? data.member_contact_url : null;
  return { signupOpen: data?.member_signup_enabled === true, contactUrl: url };
}

export async function saveMemberSettings(s: MemberSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, member_signup_enabled: s.signupOpen, member_contact_url: s.contactUrl, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าสมาชิกไม่ได้: ${error.message}`);
}

export interface MemberSummary {
  id: string;
  name: string;
  phone: string;
  status: "active" | "suspended";
  createdAt: string;
  balanceSatang: number;
  /** free rounds used, at most FREE_ROUNDS */
  freeUsed: number;
}

/** The newest members for the owner's page, each with their wallet and their free rounds. */
export async function listMembers(limit = 200): Promise<MemberSummary[]> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .select("id, name, phone, status, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านรายชื่อสมาชิกไม่ได้: ${error.message}`);
  const rows = (data ?? []) as { id: string; name: string; phone: string; status: "active" | "suspended"; created_at: string }[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: wallets, error: walletError } = await supabaseAdmin().from("ins_wallets")
    .select("agent_id, balance_satang").in("agent_id", ids);
  if (walletError) throw new Error(`อ่านกระเป๋าสมาชิกไม่ได้: ${walletError.message}`);
  const balance = new Map(((wallets ?? []) as { agent_id: string; balance_satang: number }[]).map((w) => [w.agent_id, Number(w.balance_satang)]));
  // one count per member: a select of the rounds themselves would stop at 1000 rows
  const used = await Promise.all(rows.map(async (r) => {
    const { count, error: e } = await supabaseAdmin().from("ins_audit").select("id", { count: "exact", head: true })
      .eq("agent_id", r.id).in("action", [...AI_ROUNDS]).gte("at", FREE_ROUNDS_FROM.toISOString());
    if (e) throw new Error(`อ่านรอบฟรีไม่ได้: ${e.message}`);
    return Math.min(count ?? 0, FREE_ROUNDS);
  }));
  return rows.map((r, i) => ({
    id: r.id, name: r.name, phone: r.phone, status: r.status, createdAt: r.created_at,
    balanceSatang: balance.get(r.id) ?? 0, freeUsed: used[i],
  }));
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/auth/member-store.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # outside-members
git add src/lib/auth/member-store.ts tests/auth/member-store.test.ts
git commit -m "feat(members): member rows, settings and the owner's list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Signing in with phone + PIN

**Files:**
- Modify: `src/app/login/actions.ts` (add `memberSignIn`; factor the IP count)
- Modify: `src/app/login/LoginForm.tsx` (two tabs, links)
- Modify: `src/app/login/page.tsx` (read settings, pass them down)
- Test: `tests/auth/member-login.test.ts`

**Interfaces:**
- Consumes: `normalizePhone`, `verifyPin`, `PHONE_FAILURES` (Task 2); `memberByPhone`, `phoneFailures`, `memberSettings` (Task 5); `startSession(agentId)` (existing)
- Produces: server action `memberSignIn(formData: FormData): Promise<{ error: string } | undefined>` (fields `phone`, `pin`, `next`); `LoginForm` props `{ next: string; signupOpen: boolean; contactUrl: string | null }`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPin } from "@/lib/auth/member";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);
const auth = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
vi.mock("@/lib/auth/viewer", () => ({ agentsByCode: vi.fn(), staffRow: vi.fn() }));
const store = vi.hoisted(() => ({ memberByPhone: vi.fn(), phoneFailures: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db, has } from "../helpers/fake-db";
const { memberSignIn } = await import("@/app/login/actions");

const form = (phone: string, pin: string, next = "/studio/write") => {
  const fd = new FormData();
  fd.set("phone", phone);
  fd.set("pin", pin);
  fd.set("next", next);
  return fd;
};
let STORED = "";

beforeEach(async () => {
  vi.clearAllMocks();
  db.reset();
  db.on("ins_login_attempts", { count: 0 });
  store.phoneFailures.mockResolvedValue(0);
  STORED ||= await hashPin("280419");
  store.memberByPhone.mockResolvedValue({ id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null, pin_hash: STORED });
});

const attempts = () => db.writes("ins_login_attempts", "insert").map((s) => s[0].args[0]);

describe("memberSignIn", () => {
  it("signs a member in with their phone however typed, and goes on", async () => {
    expect(await memberSignIn(form("081-234-5678", "280419"))).toBeUndefined();
    expect(store.memberByPhone).toHaveBeenCalledWith("0812345678");
    expect(auth.startSession).toHaveBeenCalledWith("m1");
    expect(nav.redirect).toHaveBeenCalledWith("/studio/write");
    expect(attempts()).toEqual([{ ip: "1.2.3.4", ok: true, phone: "0812345678" }]);
  });

  it("gives one answer for a wrong PIN, an unknown phone and a suspended member", async () => {
    const wrong = await memberSignIn(form("0812345678", "280418"));
    store.memberByPhone.mockResolvedValueOnce(null);
    const unknown = await memberSignIn(form("0899999999", "280419"));
    store.memberByPhone.mockResolvedValueOnce({ id: "m1", phone: "0812345678", name: "ก", status: "suspended", pin_changed_at: null, pin_hash: STORED });
    const suspended = await memberSignIn(form("0812345678", "280419"));
    for (const r of [wrong, unknown, suspended]) expect(r).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก 4 ครั้ง" });
    expect(auth.startSession).not.toHaveBeenCalled();
    expect(attempts().every((a) => (a as { ok: boolean }).ok === false)).toBe(true);
  });

  it("counts down by whichever of the address and the phone is nearer its limit", async () => {
    store.phoneFailures.mockResolvedValue(3);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก 1 ครั้ง" });
    store.phoneFailures.mockResolvedValue(4);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง ถูกระงับชั่วคราว" });
  });

  it("makes a phone with five wrong PINs wait, from any address, without looking it up", async () => {
    store.phoneFailures.mockResolvedValue(5);
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "เบอร์นี้กรอก PIN ผิดหลายครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });

  it("makes an address with five failures wait, as the agent code does", async () => {
    db.on("ins_login_attempts", (steps) => ({ count: has(steps, "eq", "ip", "1.2.3.4") ? 5 : 0 }));
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "กรอกผิดเกิน 5 ครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });

  it("asks for a phone and a PIN before looking anything up", async () => {
    expect(await memberSignIn(form("0812", "280419"))).toEqual({ error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" });
    expect(await memberSignIn(form("0812345678", "28041"))).toEqual({ error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/auth/member-login.test.ts`
Expected: FAIL — `memberSignIn` is not exported.

- [ ] **Step 3: Implement the action** — in `src/app/login/actions.ts`:

Add imports:
```ts
import { normalizePhone, PHONE_FAILURES, verifyPin } from "@/lib/auth/member";
import { memberByPhone, phoneFailures } from "@/lib/auth/member-store";
```

Add, above `signIn`, a helper and replace the count block inside `signIn` with a call to it (`const count = await ipFailures(ip, since);` then `if (count >= MAX_FAILURES) …`, and use `count` where `count ?? 0` was used):
```ts
/** Failed sign-ins from one address in the window — the agent code's and the members' alike. */
async function ipFailures(ip: string, since: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("ins_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("created_at", since);
  return count ?? 0;
}
```

Add after `signIn`:
```ts
/**
 * Signing in as a member outside UnitOS: phone and the PIN they chose (owner, 2026-10-01).
 *
 * The address's count is the agent code's, so switching tabs buys no more guesses. The phone
 * has a count of its own as well, so many addresses cannot share out the guessing of one
 * member's PIN. A phone that does not exist, a PIN that is wrong and a member who is suspended
 * get the same words — sign-up already says whether a phone is taken, but it need not be said
 * twice.
 */
export async function memberSignIn(formData: FormData): Promise<{ error: string } | undefined> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const pin = String(formData.get("pin") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const ip = clientIp(await headers());
  const sinceDate = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const since = sinceDate.toISOString();

  const fromIp = await ipFailures(ip, since);
  if (fromIp >= MAX_FAILURES) return { error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
  if (!phone || !/^\d{6}$/.test(pin)) return { error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" };
  const fromPhone = await phoneFailures(phone, sinceDate);
  if (fromPhone >= PHONE_FAILURES) return { error: `เบอร์นี้กรอก PIN ผิดหลายครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };

  const member = await memberByPhone(phone);
  const ok = Boolean(member && member.status === "active" && (await verifyPin(pin, member.pin_hash)));
  await supabaseAdmin().from("ins_login_attempts").insert({ ip, ok, phone });

  if (!ok || !member) {
    const left = Math.min(MAX_FAILURES - fromIp, PHONE_FAILURES - fromPhone) - 1;
    const why = "เบอร์หรือ PIN ไม่ถูกต้อง";
    return { error: left > 0 ? `${why} เหลืออีก ${left} ครั้ง` : `${why} ถูกระงับชั่วคราว` };
  }
  await startSession(member.id);
  redirect(next);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/auth/member-login.test.ts`
Expected: PASS.

- [ ] **Step 5: The page and the form** — `src/app/login/page.tsx`, replace the component:

```tsx
import { memberSettings } from "@/lib/auth/member-store";
// …existing imports stay

/**
 * The door for UnitOS agents (their code) and, since 2026-10-01, for members who signed up
 * here (phone + PIN). Somebody already signed in goes straight on to where they were headed.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  // settings that cannot be read hide the sign-up link rather than the door
  const settings = await memberSettings().catch(() => ({ signupOpen: false, contactUrl: null }));
  return <LoginForm next={next} signupOpen={settings.signupOpen} contactUrl={settings.contactUrl} />;
}
```

`src/app/login/LoginForm.tsx`, full replacement:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { memberSignIn, signIn } from "./actions";

type Tab = "member" | "unitos";

export function LoginForm({ next, signupOpen, contactUrl }: { next: string; signupOpen: boolean; contactUrl: string | null }) {
  const [tab, setTab] = useState<Tab>("member");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = (action: (fd: FormData) => Promise<{ error: string } | undefined>) => (fd: FormData) =>
    start(async () => {
      const res = await action(fd);
      if (res?.error) setError(res.error);
    });
  const pick = (t: Tab) => {
    setTab(t);
    setError(undefined);
  };
  const tabClass = (t: Tab) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${tab === t ? "bg-[var(--bot-navy)] text-white" : "text-[var(--bot-ink-mute)]"}`;
  const pinClass = "w-full rounded-md border px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-center text-xl font-semibold">เข้าสู่ระบบ</h1>

        <div role="tablist" className="mt-4 flex gap-1 rounded-lg border p-1">
          <button type="button" role="tab" aria-selected={tab === "member"} className={tabClass("member")} onClick={() => pick("member")}>สมาชิกทั่วไป</button>
          <button type="button" role="tab" aria-selected={tab === "unitos"} className={tabClass("unitos")} onClick={() => pick("unitos")}>ตัวแทน UnitOS</button>
        </div>

        {tab === "member" ? (
          <form className="mt-5 space-y-3" action={submit(memberSignIn)}>
            <input type="hidden" name="next" value={next} />
            <input
              name="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder="เบอร์มือถือ"
              aria-label="เบอร์มือถือ" className="w-full rounded-md border px-4 py-3 text-base"
              onChange={() => setError(undefined)}
            />
            <input
              name="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6}
              pattern="\d{6}" placeholder="PIN 6 หลัก" aria-label="PIN 6 หลัก" className={pinClass}
              onChange={() => setError(undefined)}
            />
            <button disabled={pending}
                    className="w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        ) : (
          <form className="mt-5" action={submit(signIn)}>
            <p className="mb-3 text-center text-sm text-[var(--bot-ink-mute)]">รหัสตัวแทน 6 หลัก — รหัสเดียวกับที่ใช้เข้า UnitOS</p>
            <input type="hidden" name="next" value={next} />
            <input
              name="code" inputMode="numeric" autoComplete="username" maxLength={6} autoFocus
              pattern="\d{6}" placeholder="••••••" aria-label="รหัสตัวแทน 6 หลัก" className={pinClass}
              onChange={() => setError(undefined)}
            />
            <button disabled={pending}
                    className="mt-4 w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-3 text-center text-sm text-[var(--bot-red-ink)]">{error}</p>}

        {tab === "member" && (
          <div className="mt-5 space-y-2 text-center text-sm">
            {signupOpen && (
              <p>ยังไม่มีบัญชี? <Link href="/signup" className="font-medium text-[var(--bot-navy)] underline">สมัครใช้ Studio</Link></p>
            )}
            <p className="text-[var(--bot-ink-mute)]">
              ลืม PIN?{" "}
              {contactUrl
                ? <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="underline">ติดต่อแอดมิน</a>
                : "ติดต่อแอดมิน"}
            </p>
          </div>
        )}
        <Link href="/" className="mt-6 block text-center text-sm text-[var(--bot-ink-mute)] underline">กลับไปหน้าแรก</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run the auth tests, the type check and lint**

Run: `npx vitest run tests/auth && npx tsc --noEmit && npm run lint`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # outside-members
git add src/app/login tests/auth/member-login.test.ts
git commit -m "feat(members): sign in with phone + PIN, beside the agent code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sign-up page

**Files:**
- Create: `src/app/signup/page.tsx`, `src/app/signup/SignupForm.tsx`, `src/app/signup/actions.ts`
- Test: `tests/auth/signup.test.ts`

**Interfaces:**
- Consumes: `readSignup`, `hashPin`, `SIGNUPS_PER_IP_PER_DAY` (Task 2); `memberByPhone`, `createMember`, `signupsFromIp`, `memberSettings` (Task 5); `startSession`
- Produces: server action `signUp(formData: FormData): Promise<{ error: string; taken?: boolean } | undefined>` (fields `name`, `phone`, `pin`, `pinAgain`, `consent`)

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);
const auth = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
const store = vi.hoisted(() => ({ memberSettings: vi.fn(), signupsFromIp: vi.fn(), memberByPhone: vi.fn(), createMember: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { signUp } = await import("@/app/signup/actions");

const form = (over: Record<string, string | null> = {}) => {
  const fields: Record<string, string | null> = { name: "สมชาย", phone: "081-234-5678", pin: "280419", pinAgain: "280419", consent: "on", ...over };
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== null) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  store.memberSettings.mockResolvedValue({ signupOpen: true, contactUrl: null });
  store.signupsFromIp.mockResolvedValue(0);
  store.memberByPhone.mockResolvedValue(null);
  store.createMember.mockResolvedValue({ ok: true, id: "m9" });
});

describe("signUp", () => {
  it("opens an account, signs it in and goes to Studio", async () => {
    expect(await signUp(form())).toBeUndefined();
    const made = store.createMember.mock.calls[0][0];
    expect(made).toMatchObject({ phone: "0812345678", name: "สมชาย", ip: "1.2.3.4" });
    expect(made.pinHash).toMatch(/^scrypt\$/);
    expect(auth.startSession).toHaveBeenCalledWith("m9");
    expect(nav.redirect).toHaveBeenCalledWith("/studio");
  });

  it("takes nobody while the owner has sign-up off", async () => {
    store.memberSettings.mockResolvedValue({ signupOpen: false, contactUrl: null });
    expect(await signUp(form())).toEqual({ error: "ยังไม่เปิดรับสมัคร" });
    expect(store.createMember).not.toHaveBeenCalled();
  });

  it("takes three accounts from one address a day", async () => {
    store.signupsFromIp.mockResolvedValue(3);
    expect(await signUp(form())).toEqual({ error: "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้" });
    const since = store.signupsFromIp.mock.calls[0][1] as Date;
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(store.createMember).not.toHaveBeenCalled();
  });

  it("says what is wrong with the form before anything is looked up", async () => {
    expect(await signUp(form({ pin: "123456", pinAgain: "123456" }))).toEqual({ error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(await signUp(form({ consent: null }))).toEqual({ error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });

  it("says a phone already taken, whether seen first or refused by the index", async () => {
    store.memberByPhone.mockResolvedValueOnce({ id: "m1" });
    expect(await signUp(form())).toEqual({ error: "เบอร์นี้สมัครไว้แล้ว", taken: true });
    store.createMember.mockResolvedValueOnce({ ok: false, taken: true });
    expect(await signUp(form())).toEqual({ error: "เบอร์นี้สมัครไว้แล้ว", taken: true });
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("says the system failed, without its words, when the database does", async () => {
    store.createMember.mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await signUp(form())).toEqual({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/auth/signup.test.ts`
Expected: FAIL — cannot resolve `@/app/signup/actions`.

- [ ] **Step 3: Implement the action** — `src/app/signup/actions.ts`:

```ts
"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/assistant/rate-limit";
import { hashPin, readSignup, SIGNUPS_PER_IP_PER_DAY } from "@/lib/auth/member";
import { createMember, memberByPhone, memberSettings, signupsFromIp } from "@/lib/auth/member-store";
import { startSession } from "@/lib/auth/session";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Opening an account outside UnitOS (owner, 2026-10-01): a name, a phone and a PIN the member
 * chooses, then straight into Studio with the free rounds. Open to anybody, so it is not a
 * door the guard test asks to be gated; what holds it is the owner's switch and three
 * accounts an address a day. A phone already taken is said so — a phone alone signs nobody in.
 */
export async function signUp(formData: FormData): Promise<{ error: string; taken?: boolean } | undefined> {
  let id: string;
  try {
    if (!(await memberSettings()).signupOpen) return { error: "ยังไม่เปิดรับสมัคร" };
    const ip = clientIp(await headers());
    if ((await signupsFromIp(ip, new Date(Date.now() - DAY_MS))) >= SIGNUPS_PER_IP_PER_DAY) {
      return { error: "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้" };
    }
    const form = readSignup({
      name: formData.get("name"), phone: formData.get("phone"), pin: formData.get("pin"),
      pinAgain: formData.get("pinAgain"), consent: formData.get("consent"),
    });
    if (!form.ok) return { error: form.error };
    if (await memberByPhone(form.phone)) return { error: "เบอร์นี้สมัครไว้แล้ว", taken: true };
    const made = await createMember({ phone: form.phone, name: form.name, pinHash: await hashPin(form.pin), ip });
    if (!made.ok) return { error: "เบอร์นี้สมัครไว้แล้ว", taken: true };
    id = made.id;
  } catch (e) {
    console.error("signup failed:", e);
    return { error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" };
  }
  // outside the try: redirect() works by throwing, and must not be caught as a failure
  await startSession(id);
  redirect("/studio");
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/auth/signup.test.ts`
Expected: PASS.

- [ ] **Step 5: The page and the form**

`src/app/signup/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { memberSettings } from "@/lib/auth/member-store";
import { getViewer } from "@/lib/auth/viewer";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมัครใช้ Studio | advisortool" };

/** Sign-up for people outside UnitOS (owner, 2026-10-01); closed until the owner switches it on. */
export default async function SignupPage() {
  if (await getViewer()) redirect("/studio");
  const open = (await memberSettings().catch(() => null))?.signupOpen === true;
  if (!open) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <div className="rounded-lg border bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">ยังไม่เปิดรับสมัคร</h1>
          <p className="mt-2 text-sm text-[var(--bot-ink-mute)]">ตัวแทนใน UnitOS เข้าสู่ระบบด้วยรหัสตัวแทนได้เลย</p>
          <Link href="/login" className="mt-6 block text-sm underline">ไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </main>
    );
  }
  return <SignupForm />;
}
```

`src/app/signup/SignupForm.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { signUp } from "./actions";

export function SignupForm() {
  const [error, setError] = useState<{ error: string; taken?: boolean }>();
  const [pending, start] = useTransition();
  const field = "w-full rounded-md border px-4 py-3 text-base";
  const pin = "w-full rounded-md border px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums";
  const clear = () => setError(undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-center text-xl font-semibold">สมัครใช้ Studio</h1>
        <p className="mt-1 text-center text-sm text-[var(--bot-ink-mute)]">ใช้ AI เขียนคอนเทนต์ฟรี 10 รอบ แล้วเติมเงินใช้ต่อได้</p>

        <form className="mt-6 space-y-3" action={(fd) => start(async () => {
          const res = await signUp(fd);
          if (res) setError(res);
        })}>
          <input name="name" autoComplete="name" maxLength={60} placeholder="ชื่อที่แสดง" aria-label="ชื่อที่แสดง" className={field} onChange={clear} />
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="เบอร์มือถือ" aria-label="เบอร์มือถือ" className={field} onChange={clear} />
          <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="\d{6}"
                 placeholder="ตั้ง PIN 6 หลัก" aria-label="ตั้ง PIN 6 หลัก" className={pin} onChange={clear} />
          <input name="pinAgain" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="\d{6}"
                 placeholder="PIN อีกครั้ง" aria-label="PIN อีกครั้ง" className={pin} onChange={clear} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-1" onChange={clear} />
            <span>ยอมรับ <Link href="/privacy" target="_blank" className="underline">นโยบายความเป็นส่วนตัว</Link></span>
          </label>
          <button disabled={pending}
                  className="w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "กำลังสมัคร…" : "สมัครและเข้าใช้งาน"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--bot-red-ink)]">
            {error.error}
            {error.taken && <> — <Link href="/login" className="underline">เข้าสู่ระบบ</Link></>}
          </p>
        )}
        <p className="mt-6 text-center text-xs text-[var(--bot-ink-mute)]">จำ PIN ไว้ให้ดี ถ้าลืมต้องติดต่อแอดมินให้ตั้งใหม่</p>
        <Link href="/login" className="mt-2 block text-center text-sm text-[var(--bot-ink-mute)] underline">มีบัญชีแล้ว? เข้าสู่ระบบ</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Check `/privacy` exists, then run tests, types and lint**

Run: `ls src/app/privacy/page.tsx && npx vitest run tests/auth && npx tsc --noEmit && npm run lint`
Expected: the file is listed; PASS; no errors.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # outside-members
git add src/app/signup tests/auth/signup.test.ts
git commit -m "feat(members): sign-up page, behind the owner's switch and three a day per address

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: บัญชีของฉัน (`/studio/account`) and the member's menu

**Files:**
- Create: `src/app/studio/account/page.tsx`, `src/app/studio/account/AccountForm.tsx`, `src/app/studio/account/actions.ts`
- Modify: `src/lib/shell/menu.ts` (`Who.member`, `studioMenu`, `BACK_OFFICE_PERM` type)
- Modify: `src/lib/auth/viewer.ts` (`whoOf` sets `member`)
- Modify: `src/components/shell/Sidebar.tsx` (room line for members)
- Modify: `tests/helpers/signed-in.ts` (add `memberById: async () => null, displayNames: async () => ({})` to `asOwner`)
- Test: `tests/auth/account.test.ts`, `tests/calc/shell-menu.test.ts` (append)

**Interfaces:**
- Consumes: `pinProblem`, `cleanName`, `hashPin`, `verifyPin` (Task 2); `memberByPhone`, `setPin`, `setName` (Task 5); `requireMember`, `gatePage` (existing)
- Produces: server actions `changePin(oldPin: string, pin: string, pinAgain: string): Promise<Result>`, `renameMe(name: string): Promise<Result>` where `type Result = { ok: true } | { ok: false; error: string }`; `Who.member?: boolean`

- [ ] **Step 1: Write the failing tests**

`tests/auth/account.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { hashPin } from "@/lib/auth/member";

const MEMBER: Viewer = {
  kind: "member", agentId: "m1", code: "0812345678", name: "สมชาย", tenantId: null, tenantSlug: "",
  tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const auth = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
const store = vi.hoisted(() => ({ memberByPhone: vi.fn(), setPin: vi.fn(), setName: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { changePin, renameMe } = await import("@/app/studio/account/actions");
let STORED = "";

beforeEach(async () => {
  vi.clearAllMocks();
  who.viewer = MEMBER;
  STORED ||= await hashPin("280419");
  store.memberByPhone.mockResolvedValue({ id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null, pin_hash: STORED });
});

describe("changePin", () => {
  it("takes the old PIN, sets the new one, and keeps this device signed in", async () => {
    const before = Date.now();
    expect(await changePin("280419", "730512", "730512")).toEqual({ ok: true });
    const [id, hash, at] = store.setPin.mock.calls[0];
    expect(id).toBe("m1");
    expect(hash).toMatch(/^scrypt\$/);
    expect((at as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(auth.startSession).toHaveBeenCalledWith("m1");
    // the new session is issued after the change, so admitMember lets it in
    expect(store.setPin.mock.invocationCallOrder[0]).toBeLessThan(auth.startSession.mock.invocationCallOrder[0]);
  });

  it("refuses a wrong old PIN and a weak new one", async () => {
    expect(await changePin("280418", "730512", "730512")).toEqual({ ok: false, error: "PIN เดิมไม่ถูกต้อง" });
    expect(await changePin("280419", "111111", "111111")).toEqual({ ok: false, error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(store.setPin).not.toHaveBeenCalled();
  });

  it("is not for a UnitOS agent, who has no PIN here", async () => {
    who.viewer = { ...MEMBER, kind: "unitos", tenantId: "t1" };
    expect(await changePin("280419", "730512", "730512")).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });
});

describe("renameMe", () => {
  it("sets a cleaned name", async () => {
    expect(await renameMe("  สมชาย  ใจดี ")).toEqual({ ok: true });
    expect(store.setName).toHaveBeenCalledWith("m1", "สมชาย ใจดี");
  });

  it("refuses a blank name, and a UnitOS agent", async () => {
    expect(await renameMe("  ")).toEqual({ ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" });
    who.viewer = { ...MEMBER, kind: "unitos" };
    expect(await renameMe("ก")).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" });
    expect(store.setName).not.toHaveBeenCalled();
  });
});
```

Append to `tests/calc/shell-menu.test.ts`, inside `describe("Studio's own menu", …)` (import `studioMenu` is already there; if the file builds `Who` objects with a helper, reuse it — otherwise use the literal below):
```ts
  it("gives a member outside UnitOS their account page, and nobody else (owner, 2026-10-01)", () => {
    const base = { name: "ก", room: "สมาชิกทั่วไป", publish: false, connect: false, admin: false, owner: false, wallet: true };
    const hrefs = (who: typeof base & { member?: boolean }) => studioMenu(who).flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs({ ...base, member: true })).toContain("/studio/account");
    expect(hrefs(base)).not.toContain("/studio/account");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/auth/account.test.ts tests/calc/shell-menu.test.ts`
Expected: FAIL — cannot resolve the actions; the menu has no account link.

- [ ] **Step 3: Implement the actions** — `src/app/studio/account/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { cleanName, hashPin, pinProblem, verifyPin } from "@/lib/auth/member";
import { memberByPhone, setName, setPin } from "@/lib/auth/member-store";
import { startSession } from "@/lib/auth/session";
import { requireMember } from "@/lib/auth/viewer";

export type Result = { ok: true } | { ok: false; error: string };

const MEMBERS_ONLY: Result = { ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" };

/**
 * A member's own PIN (owner, 2026-10-01). Every other device is signed out by the change
 * (pin_changed_at); this one is signed in again straight after, so the member stays where
 * they are. A UnitOS agent has no PIN here — their code is UnitOS's.
 */
export async function changePin(oldPin: string, pin: string, pinAgain: string): Promise<Result> {
  const viewer = await requireMember();
  if (viewer.kind !== "member") return MEMBERS_ONLY;
  const member = await memberByPhone(viewer.code);
  if (!member || typeof oldPin !== "string" || !(await verifyPin(oldPin, member.pin_hash))) {
    return { ok: false, error: "PIN เดิมไม่ถูกต้อง" };
  }
  const problem = pinProblem(pin, pinAgain);
  if (problem) return { ok: false, error: problem };
  try {
    await setPin(member.id, await hashPin(pin), new Date());
  } catch (e) {
    console.error("pin change failed:", e);
    return { ok: false, error: "เปลี่ยน PIN ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await startSession(member.id);
  return { ok: true };
}

export async function renameMe(name: string): Promise<Result> {
  const viewer = await requireMember();
  if (viewer.kind !== "member") return MEMBERS_ONLY;
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" };
  try {
    await setName(viewer.agentId, clean);
  } catch (e) {
    console.error("rename failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidatePath("/studio", "layout");
  return { ok: true };
}
```

- [ ] **Step 4: The page and the form**

`src/app/studio/account/page.tsx`:
```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";
import { AccountForm } from "./AccountForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "บัญชีของฉัน | advisortool" };

/** A member's name and PIN (owner, 2026-10-01). UnitOS agents manage theirs in UnitOS. */
export default async function AccountPage() {
  const viewer = await gatePage("/studio/account");
  if (viewer.kind !== "member") redirect("/studio");
  return <AccountForm name={viewer.name} phone={viewer.code} />;
}
```

`src/app/studio/account/AccountForm.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { changePin, renameMe, type Result } from "./actions";

function Note({ result, done }: { result?: Result; done: string }) {
  if (!result) return null;
  return result.ok
    ? <p role="status" className="mt-2 text-sm text-[var(--bot-green-ink,#1a7f37)]">{done}</p>
    : <p role="alert" className="mt-2 text-sm text-[var(--bot-red-ink)]">{result.error}</p>;
}

export function AccountForm({ name, phone }: { name: string; phone: string }) {
  const [nameResult, setNameResult] = useState<Result>();
  const [pinResult, setPinResult] = useState<Result>();
  const [pending, start] = useTransition();
  const field = "w-full rounded-md border px-3 py-2 text-base";
  const button = "mt-3 rounded-md bg-[var(--bot-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
      <p className="text-sm text-[var(--bot-ink-mute)]">เบอร์ที่ใช้เข้าสู่ระบบ: <span className="tabular-nums">{phone}</span></p>

      <form className="rounded-lg border bg-white p-4" action={(fd) => start(async () => setNameResult(await renameMe(String(fd.get("name") ?? ""))))}>
        <label className="block text-sm font-medium" htmlFor="name">ชื่อที่แสดง</label>
        <input id="name" name="name" defaultValue={name} maxLength={60} className={`${field} mt-1`} />
        <button disabled={pending} className={button}>บันทึกชื่อ</button>
        <Note result={nameResult} done="บันทึกแล้ว" />
      </form>

      <form className="rounded-lg border bg-white p-4" action={(fd) => start(async () => {
        const res = await changePin(String(fd.get("oldPin") ?? ""), String(fd.get("pin") ?? ""), String(fd.get("pinAgain") ?? ""));
        setPinResult(res);
      })}>
        <p className="text-sm font-medium">เปลี่ยน PIN</p>
        <p className="text-xs text-[var(--bot-ink-mute)]">เครื่องอื่นที่เข้าไว้จะต้องเข้าสู่ระบบใหม่</p>
        {(["oldPin", "pin", "pinAgain"] as const).map((n) => (
          <input key={n} name={n} type="password" inputMode="numeric" maxLength={6} pattern="\d{6}"
                 autoComplete={n === "oldPin" ? "current-password" : "new-password"}
                 placeholder={n === "oldPin" ? "PIN เดิม" : n === "pin" ? "PIN ใหม่" : "PIN ใหม่อีกครั้ง"}
                 aria-label={n === "oldPin" ? "PIN เดิม" : n === "pin" ? "PIN ใหม่" : "PIN ใหม่อีกครั้ง"}
                 className={`${field} mt-2 tracking-[0.3em] tabular-nums`} />
        ))}
        <button disabled={pending} className={button}>เปลี่ยน PIN</button>
        <Note result={pinResult} done="เปลี่ยน PIN แล้ว" />
      </form>
    </div>
  );
}
```

- [ ] **Step 5: The menu**

In `src/lib/shell/menu.ts`, add to `interface Who` after `wallet?`:
```ts
  /** a member outside UnitOS (owner, 2026-10-01): their account page, and no room to name */
  member?: boolean;
```
Change the `BACK_OFFICE_PERM` type to `Record<string, keyof Omit<Who, "name" | "room" | "wallet" | "member">>`.

In `studioMenu`, add to `links` after the wallet entry:
```ts
    // a member's own name and PIN; UnitOS agents manage theirs in UnitOS (owner, 2026-10-01)
    { href: "/studio/account", label: "บัญชีของฉัน", icon: "key", hue: "#2e4a7a" },
```
and add to the `hidden` set:
```ts
    ...(who?.member ? [] : ["/studio/account"]),
```

In `src/lib/auth/viewer.ts` `whoOf`, add to the returned object:
```ts
    member: viewer.kind === "member",
```

In `src/components/shell/Sidebar.tsx` `Account`, replace the room line:
```tsx
            <p className="truncate text-[0.7rem]" style={{ color: "var(--shell-mute)" }}>{who.member ? who.room : `ห้อง ${who.room}`}</p>
```

In `tests/helpers/signed-in.ts` add to `asOwner`: `memberById: async () => null, displayNames: async () => ({}),` and add `member: false` to the object its `whoOf` returns.

- [ ] **Step 6: Run everything touched, types and lint**

Run: `npx vitest run tests/auth tests/calc/shell-menu.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS (including `guards.test.ts`, which now reads `src/app/studio/account/actions.ts`), no errors.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # outside-members
git add src/app/studio/account src/lib/shell/menu.ts src/lib/auth/viewer.ts src/components/shell/Sidebar.tsx tests/helpers/signed-in.ts tests/auth/account.test.ts tests/calc/shell-menu.test.ts
git commit -m "feat(members): บัญชีของฉัน — a member's name and PIN, in Studio's menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: สมาชิกทั่วไป in the back office (`/admin/members`)

**Files:**
- Create: `src/app/admin/members/page.tsx`, `src/app/admin/members/MembersAdmin.tsx`, `src/app/admin/members/actions.ts`
- Modify: `src/lib/shell/menu.ts` (`menuGroups` link, `BACK_OFFICE_PERM["/admin/members"] = "admin"`)
- Test: `tests/admin/members-actions.test.ts`

**Interfaces:**
- Consumes: `pinProblem`, `hashPin` (Task 2); `listMembers`, `memberSettings`, `saveMemberSettings`, `setPin`, `setStatus`, `MemberSummary`, `MemberSettings` (Task 5); `requireStaff`, `audit`, `gatePage` (existing)
- Produces: server actions `saveSignupSettings(open: boolean, contactUrl: string): Promise<Result>`, `resetMemberPin(id: string, pin: string): Promise<Result>`, `setMemberStatus(id: string, status: string): Promise<Result>`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "owner" })), audit: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const store = vi.hoisted(() => ({ saveMemberSettings: vi.fn(), setPin: vi.fn(), setStatus: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { resetMemberPin, saveSignupSettings, setMemberStatus } = await import("@/app/admin/members/actions");
const ID = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => vi.clearAllMocks());

describe("the back office's members", () => {
  it("asks for the admin permission every time", async () => {
    await saveSignupSettings(true, "");
    await resetMemberPin(ID, "730512");
    await setMemberStatus(ID, "suspended");
    expect(viewer.requireStaff).toHaveBeenCalledTimes(3);
    expect(viewer.requireStaff).toHaveBeenCalledWith("admin");
  });

  it("switches sign-up and keeps an https contact link, or none", async () => {
    expect(await saveSignupSettings(true, " https://lin.ee/abc ")).toEqual({ ok: true });
    expect(store.saveMemberSettings).toHaveBeenLastCalledWith({ signupOpen: true, contactUrl: "https://lin.ee/abc" });
    expect(await saveSignupSettings(false, "")).toEqual({ ok: true });
    expect(store.saveMemberSettings).toHaveBeenLastCalledWith({ signupOpen: false, contactUrl: null });
    expect(await saveSignupSettings(true, "http://x.test")).toEqual({ ok: false, error: "ลิงก์ติดต่อต้องขึ้นต้นด้วย https://" });
    expect(viewer.audit).toHaveBeenCalledWith("member-signup-switch", null, { open: true });
  });

  it("resets a PIN with the same rules as signing up, and writes it down", async () => {
    expect(await resetMemberPin(ID, "123456")).toEqual({ ok: false, error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(await resetMemberPin(ID, "730512")).toEqual({ ok: true });
    const [id, hash, at] = store.setPin.mock.calls[0];
    expect(id).toBe(ID);
    expect(hash).toMatch(/^scrypt\$/);
    expect(at).toBeInstanceOf(Date);
    expect(viewer.audit).toHaveBeenCalledWith("member-pin-reset", ID);
  });

  it("suspends and reinstates, and nothing else", async () => {
    expect(await setMemberStatus(ID, "suspended")).toEqual({ ok: true });
    expect(await setMemberStatus(ID, "active")).toEqual({ ok: true });
    expect(await setMemberStatus(ID, "deleted")).toEqual({ ok: false, error: "สถานะไม่ถูกต้อง" });
    expect(viewer.audit).toHaveBeenCalledWith("member-suspend", ID);
    expect(viewer.audit).toHaveBeenCalledWith("member-reinstate", ID);
  });

  it("refuses an id that is not a uuid", async () => {
    expect(await resetMemberPin("x", "730512")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
    expect(await setMemberStatus("x", "active")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/admin/members-actions.test.ts`
Expected: FAIL — cannot resolve `@/app/admin/members/actions`.

- [ ] **Step 3: Implement the actions** — `src/app/admin/members/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { hashPin, pinProblem } from "@/lib/auth/member";
import { saveMemberSettings, setPin, setStatus } from "@/lib/auth/member-store";
import { audit, requireStaff } from "@/lib/auth/viewer";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND: Result = { ok: false, error: "ไม่พบสมาชิกนี้" };
const FAILED: Result = { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };

/** The owner's switch for /signup, and where "ลืม PIN? ติดต่อแอดมิน" goes (owner, 2026-10-01). */
export async function saveSignupSettings(open: boolean, contactUrl: string): Promise<Result> {
  await requireStaff("admin");
  const url = typeof contactUrl === "string" ? contactUrl.trim() : "";
  if (url && !/^https:\/\/\S+$/.test(url)) return { ok: false, error: "ลิงก์ติดต่อต้องขึ้นต้นด้วย https://" };
  if (url.length > 300) return { ok: false, error: "ลิงก์ยาวเกินไป" };
  try {
    await saveMemberSettings({ signupOpen: open === true, contactUrl: url || null });
  } catch (e) {
    console.error("member settings not saved:", e);
    return FAILED;
  }
  await audit("member-signup-switch", null, { open: open === true });
  revalidatePath("/admin/members");
  return { ok: true };
}

/**
 * A forgotten PIN: the admin sets one and tells the member by LINE or phone — there is no OTP
 * (owner, 2026-10-01). The member's other sessions end with it.
 */
export async function resetMemberPin(id: string, pin: string): Promise<Result> {
  await requireStaff("admin");
  if (typeof id !== "string" || !UUID.test(id)) return NOT_FOUND;
  const problem = pinProblem(pin);
  if (problem) return { ok: false, error: problem };
  try {
    await setPin(id, await hashPin(pin), new Date());
  } catch (e) {
    console.error("member pin reset failed:", e);
    return FAILED;
  }
  await audit("member-pin-reset", id);
  return { ok: true };
}

/** A suspended member is out on their next click (src/lib/auth/access.ts admitMember). */
export async function setMemberStatus(id: string, status: string): Promise<Result> {
  await requireStaff("admin");
  if (typeof id !== "string" || !UUID.test(id)) return NOT_FOUND;
  if (status !== "active" && status !== "suspended") return { ok: false, error: "สถานะไม่ถูกต้อง" };
  try {
    await setStatus(id, status);
  } catch (e) {
    console.error("member status not saved:", e);
    return FAILED;
  }
  await audit(status === "suspended" ? "member-suspend" : "member-reinstate", id);
  revalidatePath("/admin/members");
  return { ok: true };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/admin/members-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: The page, the table and the menu**

`src/app/admin/members/page.tsx`:
```tsx
import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { listMembers, memberSettings } from "@/lib/auth/member-store";
import { FREE_ROUNDS } from "@/lib/auth/quota";
import { Card } from "../ui";
import { MembersAdmin } from "./MembersAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมาชิกทั่วไป | advisortool" };

/** People outside UnitOS who signed up at /signup (owner, 2026-10-01): the switch, the list, PIN and suspension. */
export default async function MembersPage() {
  await gatePage("/admin/members", "admin");
  const [settings, members] = await Promise.all([
    memberSettings().catch((e) => {
      console.error("member settings unreadable:", e);
      return null;
    }),
    listMembers().catch((e) => {
      console.error("members unreadable:", e);
      return null;
    }),
  ]);
  return (
    <Card title="สมาชิกทั่วไป" hint="คนนอก UnitOS ที่สมัครเองด้วยเบอร์มือถือและ PIN 6 หลัก ใช้ Studio ได้เหมือนตัวแทนทั่วไป — รอบฟรี 10 รอบ แล้วเติมเงินในกระเป๋า">
      <MembersAdmin settings={settings} members={members} freeRounds={FREE_ROUNDS} />
    </Card>
  );
}
```

`src/app/admin/members/MembersAdmin.tsx`:
```tsx
"use client";
import { useMemo, useState, useTransition } from "react";
// types only: member-store and quota read the database, and this runs in the browser
import type { MemberSettings, MemberSummary } from "@/lib/auth/member-store";
import { resetMemberPin, saveSignupSettings, setMemberStatus, type Result } from "./actions";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });

export function MembersAdmin({ settings, members, freeRounds }: { settings: MemberSettings | null; members: MemberSummary[] | null; freeRounds: number }) {
  const [open, setOpen] = useState(settings?.signupOpen ?? false);
  const [contact, setContact] = useState(settings?.contactUrl ?? "");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean }>();
  const [pending, start] = useTransition();
  const say = (r: Result, done: string) => setNote(r.ok ? { text: done, ok: true } : { text: r.error, ok: false });

  const shown = useMemo(() => {
    const q = query.trim().replace(/-/g, "");
    return (members ?? []).filter((m) => !q || m.name.includes(q) || m.phone.includes(q));
  }, [members, query]);

  const resetPin = (m: MemberSummary) => {
    const pin = window.prompt(`ตั้ง PIN ชั่วคราว 6 หลักให้ ${m.name} (${m.phone}) แล้วแจ้งเขาเอง`);
    if (pin === null) return;
    start(async () => say(await resetMemberPin(m.id, pin.trim()), `ตั้ง PIN ใหม่ให้ ${m.name} แล้ว`));
  };

  return (
    <div className="space-y-5">
      {settings === null ? (
        <p className="text-sm text-[var(--bot-red-ink)]">อ่านการตั้งค่าไม่ได้ ลองรีเฟรช</p>
      ) : (
        <form className="space-y-3 rounded-lg border p-4" action={() => start(async () => say(await saveSignupSettings(open, contact), "บันทึกแล้ว"))}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
            เปิดรับสมัครสมาชิกทั่วไป (หน้า /signup)
          </label>
          <label className="block text-sm">
            ลิงก์ติดต่อแอดมิน (แสดงที่ &ldquo;ลืม PIN?&rdquo; หน้าเข้าสู่ระบบ)
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="https://lin.ee/…"
                   className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <button disabled={pending} className="rounded-md bg-[var(--bot-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">บันทึก</button>
        </form>
      )}

      {note && <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "" : "text-[var(--bot-red-ink)]"}`}>{note.text}</p>}

      {members === null ? (
        <p className="text-sm text-[var(--bot-red-ink)]">อ่านรายชื่อสมาชิกไม่ได้ ลองรีเฟรช</p>
      ) : (
        <>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อหรือเบอร์"
                 className="w-full rounded-md border px-3 py-2 text-sm sm:w-72" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--bot-ink-mute)]">
                  <th className="py-2 pr-3">ชื่อ</th><th className="pr-3">เบอร์</th><th className="pr-3">สมัคร</th>
                  <th className="pr-3">สถานะ</th><th className="pr-3 text-right">กระเป๋า</th><th className="pr-3 text-right">รอบฟรี</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 pr-3">{m.name}</td>
                    <td className="pr-3 tabular-nums">{m.phone}</td>
                    <td className="pr-3">{day(m.createdAt)}</td>
                    <td className="pr-3">{m.status === "active" ? "ใช้งาน" : <span className="text-[var(--bot-red-ink)]">ระงับ</span>}</td>
                    <td className="pr-3 text-right tabular-nums">{baht(m.balanceSatang)}</td>
                    <td className="pr-3 text-right tabular-nums">{m.freeUsed}/{freeRounds}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <button type="button" disabled={pending} onClick={() => resetPin(m)} className="mr-2 underline">รีเซ็ต PIN</button>
                      <button type="button" disabled={pending} className="underline"
                              onClick={() => start(async () => say(
                                await setMemberStatus(m.id, m.status === "active" ? "suspended" : "active"),
                                m.status === "active" ? `ระงับ ${m.name} แล้ว` : `เปิดคืนให้ ${m.name} แล้ว`,
                              ))}>
                        {m.status === "active" ? "ระงับ" : "เปิดคืน"}
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-[var(--bot-ink-mute)]">{members.length ? "ไม่พบ" : "ยังไม่มีสมาชิก"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

In `src/lib/shell/menu.ts` `menuGroups`, under the "ผู้ช่วย AI" group, after the `/admin/wallet` entry:
```ts
          // members outside UnitOS who signed up themselves (owner, 2026-10-01)
          { href: "/admin/members", label: "สมาชิกทั่วไป", icon: "users", hue: "#33638a" },
```
and add to `BACK_OFFICE_PERM`: `"/admin/members": "admin",`

- [ ] **Step 6: Run the whole suite, types and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all PASS (`shell-menu.test.ts` "is a page that exists" now finds `/admin/members`; `shell-contrast.test.ts` passes with the reused hue), no errors.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # outside-members
git add src/app/admin/members src/lib/shell/menu.ts tests/admin/members-actions.test.ts
git commit -m "feat(members): the back office's list — signup switch, PIN reset, suspend

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Spec touch-up, build, migrate, release

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-outside-members-design.md` (the three deviations at the top of this plan)

- [ ] **Step 1: Bring the spec in line** — in the spec: `/account` → `/studio/account` everywhere; replace "ลำดับการปล่อย" steps 1–3 with "migration แล้ว push ครั้งเดียว (ช่วงระหว่างนั้น 'โดย' ในปฏิทินว่างไม่กี่นาที — placedBy เดิม log แล้วคืน {} ไม่พัง)"; replace "ลิงก์ 'สมัครใช้ Studio' จากหน้าแรกและเมนู…" with "ลิงก์ 'สมัครใช้ Studio' อยู่ที่หน้า /login (เมนู Studio พาไป /login อยู่แล้ว)". Commit:

```bash
git add docs/superpowers/specs/2026-10-01-outside-members-design.md
git commit -m "docs(members): spec follows the plan's three decisions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Full local verification**

Run: `npm test && npx tsc --noEmit && npm run lint && NEXT_DIST_DIR=.next-build npx next build`
Expected: all green; the build lists `/signup`, `/studio/account`, `/admin/members`.

- [ ] **Step 3: Ask the owner before touching production.** Show them: the migration file, that it drops seven foreign keys, and that the push must follow within minutes. Wait for a yes.

- [ ] **Step 4: Apply the migration** — Supabase MCP `apply_migration` on `cenysylrzbwfrtuqoeqk`, name `outside_members`, the file's SQL. Then verify (read-only):

```sql
select count(*) from public.ins_members;                                   -- 0
select conname from pg_constraint where confrelid = 'public.agents'::regclass and conrelid::regclass::text like 'ins_%';
                                                                            -- only ins_sso_tickets / ins_staff ×2
select member_signup_enabled, member_contact_url from public.ins_ai_settings; -- false, null
select * from public.ins_wallet_summary(now() - interval '30 days') limit 3;  -- check the wallet summary: same rows as before
```

- [ ] **Step 5: Hand the push to the owner** — merge `outside-members` into `main` locally (`git switch main && git merge --no-ff outside-members`), re-check `git branch --show-current`, then tell the owner to run:

```bash
git push origin main
```

- [ ] **Step 6: Smoke test on production (owner, with Claude watching logs via the Vercel MCP)**
  1. `/login` shows two tabs; the UnitOS code still signs the owner in; the calendar's "โดย" shows names.
  2. Owner switches sign-up on at `/admin/members`, signs up at `/signup` with their own spare phone in a private window, lands in Studio with 10 free rounds, runs one round, tops up ฿50 (PromptPay), sees the balance.
  3. At `/admin/members` the member is listed with balance and 1/10; "รีเซ็ต PIN" signs the private window out on its next click.
  4. Owner decides whether sign-up stays on.

- [ ] **Step 7: Update memory** — add a line to the project memory (`unitos-merge-plan.md` or a new `outside-members.md`) saying members outside UnitOS live in `ins_members`, `agent_id` is either kind, and seven FKs to `agents` are gone.
