# Ads Studio: run ads from Organic Studio's posts

Date: 2026-10-07 · Owner request, agreed in chat · Replaces the campaign/writing flow of Ads Studio
(2026-10-04 … 2026-10-06 specs)

## Why

The owner is the only user of Ads Studio and still runs real ads in Meta Ads Manager. Prod data on
2026-10-07: about 6,900 baht and 115 chats came from Ads Manager, against 137 baht and 6 chats from
Ads Studio. There were 4 sends in all, and 2 were switched on and off again within two minutes.
Every ad that ran, from either tool, was Click-to-Messenger.

The owner finds three steps hard in Ads Manager: making the content, setting up the campaign, and
reading results to decide what to do. Ads Studio tried to cover all three but copied Ads Manager's
complexity: about 20 choices before the first ad, and two meanings of "แคมเปญ" (the app's own
campaign, and the new Meta campaign every send made).

Organic Studio is where the owner makes content every day: 93 posts are published or scheduled on
7 Pages, and each has its Facebook post id. So content stays in Organic, and Ads Studio becomes
**pick posts → confirm budget → read results and act**.

## What changes, in one paragraph

Ads Studio no longer writes ads or has campaigns of its own. It has two tabs. **ยิงแอด** lists the
Page's Organic posts. The owner ticks some, enters a budget per post per day and a number of days,
and presses **ยิงเลย**. Each post then runs at once as a Click-to-Messenger ad. A published post is
boosted as it stands; a draft becomes a new ad from its text and picture. **ผลแอด** shows every ad
of the Page, including those built in Ads Manager, one row per post. Each row has spend, chats, cost
per chat and a suggestion (เพิ่มงบ / รอดูต่อ / ควรหยุด) with its reason, and buttons that act on it.

## Out of scope (later, own spec)

Moving the ad-only kinds (แอดยาว + ตารางเบี้ย, ตัวเลขชัดๆ, ความรู้, เล่าเป็นเรื่อง; รีวิวเคลม
already exists in Organic) into Organic Studio as post kinds. Until then those kinds are not
reachable from Ads Studio. Their code stays in the repo for that move.

## The owner's view

### Top bar

The Page picker, the results range (7 / 30 วัน), the two tabs ยิงแอด · ผลแอด, and a settings icon.
The icon opens the ad-account connection, which is the existing connection part of ตั้งค่าเพจ.
The Page contacts form is not shown here: it belongs to the long ad, which moves to Organic later.

### Tab ยิงแอด

- A grid of the Page's Organic posts (`ins_content`, format `post`, this `page_id`, not trashed),
  newest first, with filter chips ขึ้นเพจแล้ว (the default) / ร่าง and a plan filter.
- Each card has the poster thumbnail, the first line of text, and a line that says how it would run:
  - **published** (`publish_state` published, has `fb_post_id`): "บนเพจ" and it is boosted;
  - **draft or used-but-not-posted** (no `fb_post_id`): "ร่าง · ทำเป็นแอดใหม่";
  - **scheduled** and not yet live: "ขึ้นเพจ <date>" and it cannot be ticked. Once it is published
    it becomes boostable;
  - **run before**: "เคยยิง ฿X/แชท" from its last results.
- Tick any number of cards. A bar at the foot says "เลือก N โพสต์" and has **ยิงแอด N โพสต์**.

### Confirm dialog

- Heading "ยิงแอดทักแชท" and one line: the ส่งข้อความ button opens the Page's Messenger chat, where
  its bot answers · Thailand, age 20+.
- **งบต่อโพสต์/วัน** (baht, whole number, default the last one used in this browser, else 200) and
  **นานกี่วัน** (3 / 7 / 14, default 7).
- The ad account picker, only when more than one baht account is connected.
- The sum in plain words: "N โพสต์ × ฿B × D วัน = ใช้สูงสุด ฿T".
- **ยิงเลย** creates everything ACTIVE (the owner chose this; nothing is created paused any more).
- After it returns, one line per post: running, or Meta's reason it was refused. Posts that
  succeeded stay running even when others failed.
- The per-post daily budget is capped by `ADS_MAX_DAILY_BUDGET_THB`, as today.

### Tab ผลแอด

- Three numbers on top for the range: ใช้ไป, แชท, เฉลี่ย/แชท.
- **อัปเดตผลตอนนี้** runs the existing results sync for this Page now. The daily cron at 03:00 UTC
  stays, because Vercel Hobby allows only one run a day.
- One row per ad: thumbnail, first line, status (รัน / หยุด / รอตรวจ / ไม่ผ่าน / จบแล้ว), ใช้ไป,
  แชท, ฿/แชท, the suggestion chip, its reason, and buttons.
- Ads from a new run (one ad set per post) have the buttons **หยุด**, **เปิดต่อ**,
  **เพิ่มงบ** (+50%, confirmed with the new amount, capped) and **ยืดเวลา** (+7 days, confirmed).
- Every other ad (built in Ads Manager, or from an old Ads Studio send, whose ad set holds several
  ads) has **หยุด** / **เปิดต่อ** on the ad itself and **เปิดใน Ads Manager**. These ads have no
  budget buttons, because their budget is shared or set at campaign level.

## Suggestion rules

The baseline is the Page's cost per chat over the last 30 days, across every ad in `ins_ad_daily`.
With no chat in 30 days, the baseline is 60 baht. For one ad over the chosen range:

| Suggestion | When |
|---|---|
| รอดูต่อ | spend < 1 × baseline (too little to judge) |
| ควรหยุด | 0 chats and spend ≥ 2 × baseline |
| ควรหยุด | cost per chat ≥ 1.5 × baseline and spend ≥ 3 × baseline |
| เพิ่มงบ | ≥ 3 chats and cost per chat ≤ 0.7 × baseline |
| รอดูต่อ | anything else |

Rules are checked top to bottom, and the first match wins. The reason shown names the numbers, for
example "ใช้ไป ฿380 = 2 เท่าของค่าเฉลี่ย ยังไม่มีแชท". Paused or ended ads get no suggestion, only
the เปิดต่อ / ยืดเวลา buttons. This is one pure function with unit tests.

## On Meta

- **One standing campaign per Page per ad account**: OUTCOME_ENGAGEMENT, named
  "AdvisorTool · ทักแชท · <Page>". It is made on first use and its id is stored. A run re-checks it
  and makes a new one if it was deleted in Ads Manager.
- **Per post: one ad set and one ad.** The ad set is Messenger destination, as the current messages
  send does: THAILAND_UNIVERSAL, age 20+, verified-identity fields, `daily_budget` and `end_time`
  = now + days. That way หยุด / เพิ่มงบ / ยืดเวลา act on one post.
- **Published post → boost**: the creative uses `object_story_id = <pageId>_<postId>`.
- **Boost refused → new ad from the post**: Meta may not accept an existing post without a send-message
  button for a Messenger ad. The owner chose not to test this live first. So when Meta refuses
  the boost creative for that reason, the run falls back automatically for that post. It makes
  a new creative from the post's text and picture with the ส่งข้อความ button, exactly as the draft
  path does, and records which path was used. The result line says "บูสต์ไม่ได้ ทำเป็นแอดใหม่จากโพสต์แทน".
- **Draft → new ad**: the existing messages creative (picture, text, CTA MESSAGE_PAGE to Messenger).
- Steps are recorded as they complete (campaign → ad set → creative → ad), as sends do today. A
  retry resumes at the step that failed and never duplicates what exists.

## Data

- A new table, one row per post run (name settled in the plan): page, ad account, content id,
  path (boost / new / boost-fell-back), Meta campaign / ad set / creative / ad ids, daily budget,
  end time, step reached, error, created by and at. Same RLS rules as `ins_ad_send`: service role
  only.
- The standing campaign id per Page + ad account, stored in a small table or a column. The plan
  decides which.
- Old `ins_ad_campaign`, `ins_ad_send*` and ad pieces stay untouched. Old sends' ads appear in ผลแอด
  through `ins_ad_daily` like any other ad, with the ad-level buttons.

## What is removed from the UI

The campaign table, campaign room, create drawer, writing form, ad editor, new-campaign form,
campaign settings, the ร่าง / ส่งแล้ว / ถังขยะ tabs, the traffic and lead-form objectives, and the
read-only Meta campaigns list (ผลแอด replaces it). `/studio/ads/[id]` and `/studio/ads/new`
redirect to `/studio/ads`. Server code only used by these screens goes too. Code the later move to
Organic will reuse (ad kinds, ladder sheets, claim ads) stays.

## Errors

- Meta refuses a post: its line in the dialog shows Meta's reason. Other posts are not affected.
- Ad review: the row shows รอตรวจ, or ไม่ผ่าน with the reason when Meta gives one.
- Connection lost mid-run: the dialog says so and points to ผลแอด. Recorded steps let a retry
  resume.
- No baht ad account connected: ยิงแอด says so and links to the settings icon's connection.
- A Page with no Organic posts: the grid invites the owner to make one in Organic Studio, with a link.

## Testing

- Unit tests: suggestion rules (every row of the table, plus the 60-baht fallback); the spend sum
  and cap; how a post would run (published / draft / scheduled / run before); the boost-refused
  fallback decision; resume-from-step.
- Browser check at desktop and phone width with prod data: Organic posts in the grid, results rows.
  No live run without the owner.
- The first live run is the owner's. Then check Ads Manager for one campaign, one ad set per post,
  ACTIVE.
