# Ads Studio desktop redesign (Ads Manager style)

Date: 2026-10-05 · Owner request: "design every part to suit desktop, like Meta's", read ads in
full, create faster, manage many campaigns/Pages, see results of sent ads. Mockup approved in chat;
the owner said "สร้างเลย". Builds on branch `claude/ads-headline-choice` (headline pick, campaign
list, delete-anytime).

## Layout (desktop ≥ 1024px; below that the same parts stack in one column)

1. **Top bar** — `Ads Studio`, Page select, the connected ad account (name · currency, or
   "ยังไม่เชื่อมบัญชีโฆษณา" linking to ตั้งค่าเพจ), a date-range select (7 / 30 วัน, default 7,
   kept in the address `?days=`), and **+ สร้าง** (a menu: แคมเปญใหม่ · โฆษณาในแคมเปญนี้ — the
   second only when a campaign is open).
2. **Tabs** — แคมเปญ · โฆษณา · ตั้งค่าเพจ, in the address `?tab=campaigns|ads|page` (default
   campaigns when no campaign is open, ads when `?campaign=` is given).
3. **แคมเปญ tab** — one table of the Page's campaigns, one row each:
   | column | source |
   |---|---|
   | เปิด/หยุด switch | a campaign is "on" when any of its sends is switched on (`switchedOn`). Turning off pauses every on send; turning on asks to switch on its latest send (existing activate/pause actions, with their existing confirm text). Disabled when it has no send. |
   | ชื่อแคมเปญ + status chip (กำลังวิ่ง / หยุดไว้ / ร่าง) and the plan name under it | campaign |
   | ร่าง · ส่งแล้ว | piece counts |
   | งบ/วัน | sum of daily budgets of its switched-on sends; "—" when none |
   | ใช้ไป · การแสดงผล · คลิก · แชท · บาท/แชท | `ins_ad_daily` summed over the range for the Meta ad ids of the campaign's send items; "—" without rows |
   Clicking a name opens it on the โฆษณา tab. A row menu (⋯) has ลบแคมเปญ (existing delete with its confirm). Totals row at the foot.
4. **โฆษณา tab** (a campaign open) — two panes:
   - **left (list)**: sub-tabs ร่าง · ส่งแล้ว · ถังขยะ with counts; rows with tick (ร่าง only),
     thumbnail, headline, chips (เพศ อายุ · ทุน), flag warning, and for sent rows the per-ad
     spend/แชท from `ins_ad_daily`. Under the list: **ส่งขึ้น Facebook (N)** and **สร้างโฆษณาเพิ่ม**
     (opens the create drawer). The sent sub-tab keeps the batch panels (SentSend) with their
     เปิดใช้ทั้งชุด / หยุดทั้งชุด / ลองใหม่.
   - **right (preview)**: the selected ad as a Facebook feed post — Page name, "ได้รับการสนับสนุน",
     full primary text (no ดูเพิ่มเติม cut; the 125-character fold marked with a thin rule), the
     poster image, headline + description + CTA button (by the send objective, default ส่งข้อความ).
     Actions above it: แก้ไข (opens the existing full-screen editor), ทิ้ง / กู้คืน, วาดรูปใหม่.
     The first ad of the sub-tab is selected by default; `?ad=<id>` keeps the selection.
5. **ตั้งค่าเพจ tab** — the existing PageSettings content (contacts + ad-account connection) and
   ตั้งค่าแคมเปญ (when a campaign is open) side by side.
6. **Create drawer** (right side, ~720px, over the page with a dim backdrop, Esc / ✕ closes):
   - *แคมเปญใหม่*: the NewCampaignForm fields.
   - *โฆษณา*: WriteForm fields (มุม, คนอ่าน, อายุ, เพศในหัวแอด, ทุนในหัวแอด, จำนวน) on the left and
     on the right a live **headline preview** (the 💁‍♀️/💰 lines and the table for the chosen age,
     from `tableRows`/a new read of the headline text) so the owner sees the figures before paying.
     The press at the drawer's foot; when a round finishes the drawer closes and the new ads are
     selected in the list.

## Not changing

Server rules: figures from code, owner line, premium flags, send/activate/pause, delete. The
full-screen ad editor. Mobile works but is not designed beyond stacking.

## Data

No migration. New read-only server function: `campaignResults(pageId, days)` → per campaign and
per piece `{ spend, impressions, clicks, messaging }` from `ins_ad_daily` joined via
`ins_ad_send_item.ad_id`. Results lag up to a day (nightly sync); the table says
"อัปเดตล่าสุด <fetched_at>".

## Testing

Pure helpers tested (results aggregation, campaign on/state, totals, date-range parsing, fold
position). Server function tested with the DB mocked. Browser look-only at 1440px and 375px.
