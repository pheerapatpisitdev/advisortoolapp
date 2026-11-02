# สลับเว็บจริงกลับไป Vercel

ตั้งแต่ 2 พ.ย. 2569 เว็บจริง (www.advisortool.app) รันบน Cloudflare Worker `advisortool` และ Vercel เป็นตัวสำรอง
Vercel รันโค้ดชุดเดียวกันจาก main อยู่ตลอด เปิดดูได้ที่ https://standby.advisortool.app สลับกลับได้ในไม่กี่นาที
ข้อมูลไม่หาย (ฐานข้อมูลเดียวกัน) และคนที่ล็อกอินอยู่ไม่หลุด

ใช้หน้านี้เมื่อเว็บบน Cloudflare มีปัญหา เช่น เว็บเปิดไม่ได้ บอทเงียบ หรือเติมเงินไม่เข้า

## ก่อนสลับ

1. เปิด https://standby.advisortool.app/api/health ต้องขึ้น `"ok":true` ถ้าไม่ขึ้น แปลว่าตัวสำรองเองก็มีปัญหา ห้ามสลับ ให้แจ้งผมก่อน

## สลับ (ทำตามลำดับ ประมาณ 5 นาที)

ทุกข้อทำในหน้า Cloudflare ของบัญชี Advisortool

1. **ถอด www ออกจาก Worker:** Workers & Pages → `advisortool` → Settings → Domains & Routes → แถว `www.advisortool.app` → Remove
2. **ชี้ www กลับไป Vercel:** advisortool.app → DNS → Records → Add record
   - Type `CNAME`, Name `www`, Target `29a7aa9120116327.vercel-dns-017.com`
   - Proxy status **DNS only** (เมฆสีเทา) → Save
3. **ชี้ advisortool.app กลับไป Vercel:**
   - ลบแถว `A` ของ `advisortool.app` ที่ชี้ `192.0.2.1` (เมฆสีส้ม)
   - Add record: `A`, Name `@`, IPv4 `216.198.79.1`, DNS only → Save
   - Add record: `A`, Name `@`, IPv4 `64.29.17.1`, DNS only → Save
   - Rules → Redirect Rules → ปิดกฎ `advisortool.app → www`
4. **เช็ก:** เปิด https://www.advisortool.app/api/health ต้องขึ้น `"ok":true` บางเครื่องอาจยังเห็นตัวเก่าอีก 1–5 นาที

แถว CAA 3 แถวและ `standby` ไม่ต้องแตะ

## หลังสลับกลับ

- นาฬิกาตั้งเวลา, Facebook, LINE และ Stripe เรียก www.advisortool.app จึงตามไปที่ Vercel เอง ไม่ต้องแก้อะไร
- Vercel เป็นแบบฟรี (Hobby) ซึ่งมีเพดานการใช้งานต่อเดือน ถ้าต้องอยู่บน Vercel นานเกิน 1–2 วัน ให้คิดเรื่องอัปเป็น Pro
- push main แล้ว Cloudflare ยัง build จาก GitHub และขึ้น Worker ตามเดิม (Workers Builds) ไม่เสียหาย เพราะไม่มีใครเข้าเว็บที่นั่น
  ถ้า build ของ Cloudflare ใช้ไม่ได้ ขึ้นจากเครื่องได้ด้วย `scripts/cloudflare-ship.sh`

## สลับกลับมา Cloudflare อีกครั้ง

ทำกลับกันกับขั้น "สลับ": ลบแถว `www` และแถว `A` 2 แถวของ Vercel → เพิ่ม `A @ 192.0.2.1` แบบเมฆสีส้ม และเปิดกฎ redirect →
รัน `npx wrangler deploy` ในโฟลเดอร์โปรเจกต์ (wrangler.jsonc ผูก www กับ Worker ให้เอง) แล้วเช็ก health
