# สมาชิกทั่วไป sign in with Google — design

Owner, 2026-10-02. Replaces the phone + PIN accounts of 2026-10-01
(docs/superpowers/specs/2026-10-01-outside-members-design.md).

## Decisions (owner)

- Google only. Phone + PIN go away for members: no PIN form, no "ลืม PIN?", no PIN reset, no PIN lock.
- The one existing member ("บอย", a test account) is deleted with their content; nobody is migrated.
- Our own OAuth (authorization code + PKCE) against Google, not Supabase Auth (the database is
  shared with UnitOS) and not NextAuth (a second session system). Sessions stay `ins_session`.
- Any Google account with a verified email (not only @gmail.com). Name from the Google profile,
  editable at /studio/account. Consent is a line under the button, not a checkbox.
- Sign-up limits stay: the owner's switch (`member_signup_enabled`) and 3 accounts per IP per day.

## What people see

- /login, member tab: one button "ดำเนินการต่อด้วย Google" (a plain link, works before
  hydration). Under it, while sign-up is open: "ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร ฟรี 10 รอบ".
  A privacy line links /privacy. The UnitOS tab is unchanged.
- An existing member is signed in; a new Google account is created while sign-up is open and
  refused ("ยังไม่เปิดรับสมัคร") while it is closed.
- Failures come back to /login?error=<code>&next=… and show Thai words above the button:
  cancelled, state (expired/forged), unverified email, suspended, closed, IP limit, broken, unconfigured.
- /signup redirects to /login (keeping `next`), so ถาม AI's links still work.
- /studio/account: name only, plus the Google email shown. /admin/members: email column, no PIN
  reset, no contact link. /admin/wallet: members named by email.

## Flow

1. `GET /auth/google?next=` — signed-in visitors go straight to `next`. Otherwise make `state`,
   PKCE `verifier`, `nonce`; put them with `next` in a signed, 10-minute, httpOnly, lax cookie
   `ins_google` scoped to `/auth/google/callback`; redirect to Google
   (`scope=openid email profile`, `code_challenge_method=S256`, `prompt=select_account`).
2. `GET /auth/google/callback` — the cookie is spent whatever happens. `error` → cancelled.
   The cookie must verify and its state equal the query's state. The code is exchanged at
   Google's token endpoint with the verifier and the client secret. The ID token comes straight
   from Google over TLS, so its signature is not checked (OIDC Core 3.1.3.7); its claims are:
   `iss` Google, `aud` our client id, unexpired, `nonce` ours, `email_verified` true, `sub` present.
3. Member by `google_sub`: suspended → refused; else keep the email fresh and sign in. None:
   sign-up must be open and the IP under its limit; insert, re-count the IP (a burst is undone),
   sign in. A unique violation on `google_sub` (two tabs at once) reads the winner and signs in.
4. `startSession(id)`, redirect to `next` (safeNext keeps it on the site).

Config: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. The redirect URI is
`<origin>/auth/google/callback`, origin from the forwarded headers; production and
http://localhost:3000 are registered on the OAuth client.

## Data

Migration `20261002_members_google.sql`: delete members' content and people, delete every
member; drop `phone` and `pin_hash`; rename `pin_changed_at` to `revoked_at` (suspension still
ends old sessions); add `google_sub text not null unique` and `email text not null`; `ins_wallet_summary`
names members by email. `member_contact_url` and `ins_login_attempts.phone` stay, unused by members.

## Rollout

Owner creates the OAuth client (Google Cloud, project advisortool-video) and sets the two env
vars on Vercel. Then apply the migration and push main together: between them the old code
cannot read members (there are none after the delete).

## Testing

Unit: the ID-token checks, the state cookie (tamper, expiry, path), the member decision
(existing, suspended, closed, limit, burst, race), the routes with Google's endpoint stubbed,
the login form's member tab, the account and admin pages without PIN. Browser: the button
reaches Google's chooser locally once the client id is set.
