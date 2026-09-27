# Sign in with UnitOS, and who may do what — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** advisortool's Studio and back office are reached only by UnitOS agents who sign in with their 6-digit code. The calendar, posting and the back office are for the owner (015495) and the assistants the owner adds.

**Architecture:** advisortool and UnitOS now share one database (UnitClub), so advisortool reads `public.agents` and `public.tenants` directly with its service key. It does not use UnitOS's tenant keys. A signed, http-only cookie holds the agent's id. Every request loads the agent, the room and the staff row again (`React.cache`, one query per request), so an agent removed in UnitOS, a suspended room or a rotated `key_epoch` shuts the door at once. Permissions live in a new table `ins_staff`. What staff do to the Page is written to `ins_audit`. Every server action checks for itself, because a layout does not protect an action.

**Tech Stack:** Next.js 15 (app router, server actions), supabase-js with the service key, vitest.

**Stages.** This plan is stage A: sign-in, gates, staff and the audit log. Stage B follows as its own plan: Studio rows owned per agent and room (`ins_content`, `ins_people`) and per-agent AI quotas, with trial rooms capped lower. Stage C follows as a third plan: the UnitOS menu button, through the `unitos-sso` edge function and a one-time ticket.

**Access decided with the owner (2026-09-27):**

| Who | Can |
|---|---|
| anyone | calculators, sales pages, `/plan`, ถาม AI, `/privacy`, Messenger/LINE bot |
| any UnitOS agent in an open room (`trialing`, `active`, `past_due`; not `features.advisorTool = false`) | Studio: write, hooks, people |
| staff with `can_publish` | the calendar, posting and scheduling to the Page, `/admin/posting` |
| staff with `can_connect` | connecting or disconnecting Pages (`/admin/messenger`, `/api/facebook/connect`) |
| staff with `can_admin` | the rest of `/admin` (overview, CRM, AI, knowledge, ADS, MCP) |
| owner (`is_owner`) | everything, and `/admin/team` |

- An assistant starts with `can_publish` only.
- The owner row is seeded for agent code 015495 in room `83g`.
- The code alone signs in, because codes do not repeat across rooms. If two agents ever share one, sign-in refuses and says to use UnitOS.

---

### Task 1: Tables — `ins_staff`, `ins_audit`

**Files:**
- Create: `supabase/migrations/20260927_staff_and_audit.sql` (apply to UnitClub; record as `advisortool_staff_and_audit`)

- [ ] Write the migration:
  - `ins_staff`: `agent_id` PK → `agents(id)` on delete cascade; `is_owner`, `can_publish` (default true), `can_connect`, `can_admin` booleans; `added_by`; `created_at`.
  - `ins_audit`: identity id, `at`, `agent_id` → `agents(id)` on delete set null, `action`, `target`, `detail jsonb`, with an index on `(target, at desc)`.
  - RLS on for both; revoke all from anon and authenticated.
  - Seed the owner.
- [ ] Apply it, then verify: `select * from ins_staff` shows one owner row for 83g/015495, and anon/authenticated have no grants.
- [ ] Commit.

### Task 2: The session cookie — `src/lib/auth/session.ts`

- Cookie `ins_session` = `<agentId>.<issuedAt>.<expires>.<hmac>`, HMAC-SHA256 with `ADMIN_SESSION_SECRET`.
- The secret is the one the removed PIN session used, so Vercel needs no new variable. It also stays the passphrase of the encrypted columns, so it is never rotated.
- Lasts 7 days, the same as a UnitOS tenant key.
- Pure `encode`/`decode` are exported for tests. `readSession`, `startSession` and `endSession` wrap `next/headers` cookies.
- [ ] Tests first (`tests/auth/session.test.ts`): round trip, expired, tampered mac, tampered agent id, malformed, wrong secret.
- [ ] Implement, pass, commit.

### Task 3: Who is asking — `src/lib/auth/access.ts` (pure) and `src/lib/auth/viewer.ts`

- `access.ts` exports:
  - `admit(agent, tenant, staffRow, issuedAt, now)` → `Viewer | null`. It refuses a missing agent, a room that is not open, `features.advisorTool === false`, or a session issued before `key_epoch`.
  - `can(viewer, perm)`, where perm is `"publish" | "connect" | "admin" | "owner"`. The owner may do everything.
  - `isTrial(viewer)`.
- `viewer.ts` (server only):
  - `getViewer = cache(...)` reads the session, then loads the agent with its room and the staff row in one query.
  - `requireMember()`, `requireStaff(perm)`: for actions; they throw `"กรุณาเข้าสู่ระบบ"` or `"ไม่มีสิทธิ์ใช้ส่วนนี้"`.
  - `gatePage(perm?, next)`: for pages. Signed out, it redirects to `/login?next=`. Without the permission, it redirects to `/studio`.
  - `audit(action, target, detail)` inserts into `ins_audit` with the viewer's agent id.
- [ ] Tests first for `admit` and `can` (`tests/auth/access.test.ts`).
- [ ] Implement, pass, commit.

### Task 4: `/login` and signing out

- `src/app/login/page.tsx` renders `LoginForm` with a `next` value, cleaned to a same-site path.
- `src/app/login/actions.ts`:
  - `signIn(fd)`:
    - A code must be 6 digits.
    - At most 5 failures per IP in 15 minutes, counted in `ins_login_attempts`.
    - Looks the code up in `agents` with its room, then applies `admit`.
    - On success, starts the session and redirects to `next` or `/studio`.
  - `signOut()` ends the session and redirects to `/`.
- `LoginForm.tsx` is recovered from the PIN version (commit ff09900), re-worded for agents: "เข้าสู่ระบบด้วยรหัสตัวแทน 6 หลัก (รหัสเดียวกับ UnitOS)".
- [ ] Implement.
- [ ] Manual check on `npm run dev`: a wrong code shows the remaining tries, 015495 lands on `/studio`, and signing out works.
- [ ] Commit.

### Task 5: Gates on pages, and a menu that knows who is looking

- `src/app/studio/layout.tsx` uses `gatePage()` (member), and `src/app/studio/calendar/page.tsx` uses `gatePage("publish")`.
- `src/app/admin/layout.tsx`:
  - The layout requires any staff permission.
  - Each page calls `gatePage(perm)`:
    - `publish` for posting;
    - `connect` for messenger;
    - `admin` for overview, crm, ai, knowledge, ads, api;
    - `owner` for team.
- `AppShell` and `Sidebar` take a small `who` prop: name, room and permissions.
  - The back-office menu lists only what the viewer may open, plus ทีมงาน for the owner.
  - Studio's menu hides ปฏิทินโพสต์ without `publish`.
  - The foot of the menu shows the name with ออกจากระบบ, or เข้าสู่ระบบ when signed out.
- The main menu keeps its Studio link; it leads to `/login` when signed out.
- [ ] Implement, check each route signed out, as an agent and as the owner, commit.

### Task 6: Gates on every server action and route

- `requireStaff("admin")` at the top of every export of `admin/{ai,ads,api,crm,knowledge}/actions.ts`, `admin/ai/budget.ts` and `admin/overview.ts`.
- `requireStaff("connect")` for `admin/messenger/actions.ts`.
- `requireStaff("publish")` for `studio/publish.ts` and the exported functions of `lib/content/publish-flow.ts`, which is a "use server" file, so each export is a public endpoint.
  - `verifyDue` is called only from the calendar page, which is already gated.
- `requireMember()` for every export of `studio/actions.ts` and every `api/content-*` route.
- `api/facebook/connect` and its callback need `connect` for Pages and `admin` for `?for=ads`.
- `ออโต้โพสต์` and ADS actions follow the table above.
- [ ] Write `audit()` calls:
  - publish now: `post`;
  - schedule: `schedule`;
  - move: `reschedule`;
  - withdraw: `unschedule`;
  - connect/disconnect Page: `connect-page` / `disconnect-page`;
  - staff changes: `staff-add`, `staff-update`, `staff-remove`.
- [ ] Grep check: every `export async function` in a "use server" file under `src/app/admin`, `src/app/studio` and `src/lib/content/publish-flow.ts` calls a `require*` first.
- [ ] Commit.

### Task 7: ทีมงาน — `/admin/team` (owner only)

- The page lists `ins_staff` joined to agents: name, code, room, and the three switches.
- It has an add box: type a 6-digit code, see the name and room from UnitOS, then press เพิ่ม.
- Actions `addStaff`, `setStaffFlags` and `removeStaff` use `requireStaff("owner")` and are audited. The owner row cannot be removed or demoted.
- [ ] Implement, check, commit.

### Task 8: Who did it, on the calendar

- `listAudit(targets)` returns the latest post/schedule/reschedule for each piece, with the agent's name.
- `CalendarBoard` shows `โดย <ชื่อ>` under each scheduled or posted piece.
- [ ] Implement, check, commit.

### Task 9: Ship

- [ ] `npm run verify` passes.
- [ ] Merge `move-to-unitclub` into `main`, push, and watch the Vercel build.
- [ ] Check on production:
  - signed out, `/admin` and `/studio` go to `/login`;
  - 015495 signs in and reaches everything;
  - a non-staff agent reaches Studio but not the calendar or `/admin`;
  - the bot still answers, and `/api/health` is ok.
