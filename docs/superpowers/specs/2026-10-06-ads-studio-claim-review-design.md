# Ads Studio — รีวิวเคลม content type (round 2)

Date: 2026-10-06 · Round 2 of the content types
(`2026-10-06-ads-studio-content-types-design.md`). The owner's choices are listed below. Design parts 1–2 were
approved in chat ("ok ไปต่อ", "ทำอะไรต่อ").

## Owner's choices
- **Picture:** the real claim papers with stickers, on the poster with "ประกันจ่ายให้ X บาท"
  (as in Organic).
- **Premium table:** chosen per round with the switch "ใส่ตารางเบี้ย" (default on). When on, the
  campaign plan's table is added after the claim story.
- **Plan match:** a claim paper need not match the campaign's plan. The claim story never names a
  plan.
- **Expat Pages:** the papers are read in Thai, and the ad is written in English under the same
  rules.

## Flow (create drawer, campaign open)
1. Kind chip **รีวิวเคลม** (`kind: "claim"`, added to `AD_KINDS`). The form shows:
   - 1–6 photos (JPG/PNG/WebP, ≤4 MB each, shrunk in the browser as today);
   - the customer-consent tick (required);
   - **ใส่ตารางเบี้ย** (default on);
   - the angle, from Organic's `CLAIM_ANGLES` (ยอดเงิน, เล่าเรื่อง, บทเรียน, ถ้าไม่มีประกัน,
     อนุมัติไว) or a typed one;
   - the count (1–3).
   The age/sex/row pickers show only when the table is on.
2. **อ่านใบเคลม** takes one `ai-claim` round and uses the existing `readClaim`. The drawer then shows:
   - the facts (bill, paid, self-paid, nights, illness, sex and age band);
   - the papers with the AI stickers burnt in (`burn`); the owner may add stickers.
   If the facts are too thin (`tooThin`), the round stops with the existing message. The read is
   held only in the drawer's state; closing the drawer drops it.
3. **สร้าง** takes one `ai-claim` round. The server:
   - re-checks consent;
   - runs `cleanFacts`;
   - writes 1–3 ads from the facts alone (it never sees the images).
   It uses Organic's claim rules: facts only, numbers verbatim, no names, hospital, doctor, dates or
   plan name, and no superlatives. Field limits are those of `AD_LIMITS`.

   The system then assembles each ad:
   - the claim story (hook, body, closing);
   - when the table is on, the table block (`tableText` for the chosen age, no 💁/💰 headline
     lines, no owner line);
   - the Page contacts;
   - the claim caution (`DISCLAIMER`; English: "Claim results depend on policy terms.");
   - hashtags.

   Headline and description: at most 27 characters, otherwise the fallback (as for ตัวเลขชัดๆ).

   Each ad gets its own copy of the stickered papers in `output.poster.documents`, plus
   `paperChecked: false`.
4. The ad shows a chip **ยังไม่ตรวจใบเคลม**. In the full-screen editor the owner checks the papers
   (`ClaimPaperCheck`, `checkPaper`) and presses ตรวจแล้ว.

## Data
- No migration. Rows are ordinary campaign pieces (`format: "ad"`, `campaign_id`).
- `output.ad` gains `kind: "claim"` and `claimTable: boolean`, plus `age`/`sex` when the table is on.
- `output.fact` holds the cleaned facts.
- Papers live in the private `content-media` bucket under `<pieceId>/`. They are removed with the
  piece. The original photos are never stored.

## Checks (warning chips, as now)
- `strayNumbers` against the facts block plus the table text.
- `checkPolicy`, including `health_you`.
- `scrub` on the facts and the owner note.
- When the table is on, the premium flags apply (the AI writes no premiums). The claim's own
  sex/age band is not an "other person".
- English: the same checks with the English matchers; money is written as "25,000 THB" (`thbAfter`).

## Sending
- The send dialog leaves out claim ads with `paperChecked === false` and says how many were left out.
- The server send/launch action refuses them with `PAPER_UNCHECKED`.
- After a send, `checkPaper` refuses (existing rule).

## Cost and limits
- Two `ai-claim` rounds per run (read, write). The owner is staff and pays nothing.
- Rate limits are those of `/api/content-claim`.
- The ad paths stay owner-only, as Ads Studio is today.

## Not in this round
- Blur instead of stickers.
- Video.
- Reusing a read across campaigns or sessions.
- Organic's own `ADS_MOVED` paths stay as they are.

## Testing
- Pure functions: claim ad assembly with and without the table (th/en); stray-number and premium
  flags; the 27-character fallback; the send filter for unchecked papers.
- Server functions with the DB mocked:
  - consent missing → refused;
  - not a campaign owner → refused;
  - unchecked ad at send → `PAPER_UNCHECKED`.
- Browser: look only (`.env.local` is production), with no read, create or send pressed.
