# Workflow ของ insurance-calc (AdvisorTool)

วาดจากโครงสร้างโค้ดที่มีอยู่ ไม่รวมฟีเจอร์ที่ยังไม่มี เช่น Meta Pixel และ Conversions API

## 1. ทางเข้า

```mermaid
flowchart TD
  user[ผู้ใช้] --> web["เว็บ / แชท AdvisorTool"]
  user --> msg["Facebook Messenger"]
  user --> line["LINE"]
  user --> calc["หน้าคำนวณเบี้ย"]
  staff[ทีมงาน] --> studio["/studio"]
  staff --> admin["/admin"]

  web --> shell["AppShell หน้าแรก"]
  msg --> fbHook["POST /api/facebook/webhook"]
  line --> lineHook["POST /api/line/webhook"]
  calc --> pages["เส้นทางแบบประกัน"]
```

## 2. บอทตอบแชท และจับคู่แอด

```mermaid
flowchart TD
  fbHook["/api/facebook/webhook"] --> events["อ่าน referral: source, ad_id, ref"]
  events --> record["บันทึกบทสนทนา"]
  record --> crm[("Supabase: บทสนทนาและลีด")]
  events --> fromAd["from-ad: เดาแบบจากชื่อโฆษณา"]
  fromAd --> assistant["บอทตอบใน Messenger"]
  assistant --> fbHook
  lineHook["/api/line/webhook"] --> lineBot["บอท LINE"]
  cronReview["cron 01:00 /api/chat-review"] --> crm
  follow["/api/facebook/followups"] --> assistant
```

## 3. เครื่องคำนวณเบี้ย

```mermaid
flowchart TD
  pages["หน้าแบบ"] --> engine["src/calc: quote, lookup, rules, money"]
  engine --> rates[("data/: rates, rules, cash-values, riders, bundles")]
  pages --> lp["/lifeprotect"]
  pages --> ihu["/ihealthy-ultra"]
  pages --> fhc["/fhc"]
  pages --> others["/plb /easyprotect /lifetreasure /legacy /ishield /ci123 /cancer /bumnan95 /group-insurance /other-plans"]
  plan["/plan"] -->|redirect| fhc
  engine --> pdf["/api/quote-pdf และ /api/card"]
  pdf --> fonts["ฟอนต์ไทย, satori, Chromium"]
```

## 4. สตูดิโอคอนเทนต์

```mermaid
flowchart TD
  studio["/studio"] --> write["/studio/write"]
  studio --> cal["/studio/calendar"]
  studio --> hooks["/studio/hooks"]
  studio --> people["/studio/people"]
  studio --> wallet["/studio/wallet"]
  studio --> account["/studio/account"]
  write --> gen["API content-generate, draft, poster, claim, recruit, video"]
  gen --> db[("Supabase: content")]
  gen --> video["วิดีโอ: lambda, cloudrun, rendi"]
  video --> sweep["cron 04:00 /api/content-video/sweep"]
  contentOld["/content และ /maryjane"] -->|redirect| studio
  wallet --> stripe["Stripe webhook /api/stripe/webhook"]
```

## 5. หลังบ้าน CRM Messenger และโฆษณา

```mermaid
flowchart TD
  admin["/admin"] --> crmPage["/admin/crm"]
  admin --> msgPage["/admin/messenger"]
  admin --> adsPage["/admin/ads"]
  admin --> more["/admin/ai /wallet /members /knowledge /posting /api"]
  admin --> team["/admin/team เฉพาะเจ้าของ"]
  msgPage --> connect["/api/facebook/connect และ callback"]
  connect --> auth[("ins_channel_auth")]
  adsPage --> adsConnect["เชื่อมด้วย FB_ADS_LOGIN_CONFIG_ID สิทธิ์ ads_read"]
  adsConnect --> auth
  adsPage --> syncNow["ปุ่มดึงตอนนี้"]
  cronAds["cron 03:00 /api/facebook/ads/sync"] --> meta["Meta Marketing API v23 insights"]
  syncNow --> meta
  meta --> daily[("ins_ad_daily")]
  daily --> join["จับคู่ ad_id กับลีดและบทสนทนา"]
  crmPage --> join
  adsPage --> join
```

## 6. ข้อมูลและทางเข้าอื่น

```mermaid
flowchart TD
  app["แอป Next.js"] --> sb["Supabase service role ฝั่งเซิร์ฟเวอร์"]
  app --> json[("ไฟล์ JSON ใน data/")]
  app --> xlsx["ไฟล์คำนวณ .xlsx ผ่านสคริปต์ extract และ golden"]
  publicApi["/api/v1 quote, plans, mcp"] --> engine["src/calc"]
  google["/auth/google"] --> session["เซสชัน"]
  sso["/sso"] --> session
  vercel["Vercel region sin1"] --> app
```
