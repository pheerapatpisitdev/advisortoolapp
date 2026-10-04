# สิทธิ์ ads_management — config ที่สาม

สถานะ: ใช้ Standard Access ของเจ้าของแอปอย่างเดียว ไม่ยื่น App Review และไม่เริ่มยืนยันธุรกิจ
สร้าง config แล้ว (2026-10-04): **Ads manage** ID `1083148447943779`
`FB_ADS_MANAGE_CONFIG_ID` ตั้งบน Vercel แล้ว (production + preview) ใน `.env.local` ยังต้องใส่เองถ้าจะลองบนเครื่อง
โค้ดอ่าน `FB_ADS_MANAGE_CONFIG_ID` ปุ่มเชื่อมอยู่ที่ `/studio/ads` (เจ้าของเท่านั้น) ไม่มี fallback ไป config เดิม

แอป **Advisortool** (ID 1624098972401227, ชื่อเดิม ai chet) พอร์ตโฟลิโอ **Luckyplanner**
ห้ามแก้ config ของเพจ (`FB_LOGIN_CONFIG_ID`, ค่าเดิม `1600660545122340`) และห้ามแก้ config อ่านผล (`FB_ADS_LOGIN_CONFIG_ID`)

การล็อกอินธุรกิจทับสิทธิ์ทั้งชุด การล็อกอินผ่าน config ที่ไม่ได้ติ๊กสิทธิ์เดิมเคยทำให้กล่องข้อความเพจหลุด
ปุ่มเชื่อมของ config นี้อยู่ที่ `/studio/ads` ที่เดียว อย่าเอา config นี้ไปใส่ปุ่มของเพจหรือหน้าอ่านผล

## config ที่สร้างไว้

สามตัวในแอปนี้ อย่าแก้สองตัวแรก

| ชื่อ | ID | ใช้ที่ |
| --- | --- | --- |
| Messenger bot | `1600660545122340` | `FB_LOGIN_CONFIG_ID` ปุ่มเชื่อมเพจ |
| Ads read only | `1088017563717129` | `FB_ADS_LOGIN_CONFIG_ID` หน้า `/admin/ads` |
| Ads manage | `1083148447943779` | `FB_ADS_MANAGE_CONFIG_ID` หน้า `/studio/ads` |

**Ads manage** เป็น General, โทเค็นแบบผู้ใช้ และติ๊กสิทธิ์ 9 ตัว**เท่ากับ Messenger bot ทุกตัว**:
`ads_management`, `ads_read`, `business_management`, `pages_manage_metadata`, `pages_manage_posts`, `pages_messaging`, `pages_read_engagement`, `pages_show_list`, `pages_utility_messaging`

เหตุผล: การล็อกอินธุรกิจทับสิทธิ์ทั้งชุด สิทธิ์ที่ config ไม่ติ๊กจะถูกถอดจากแอป ถ้าตัวนี้ขาด `pages_messaging` อินบ็อกซ์หลุด (เคยเกิดสองครั้ง) ถ้าขาด `ads_read` หน้าอ่านผลพัง
ถ้าวันหน้าเพิ่มสิทธิ์ใน Messenger bot ให้เพิ่มใน Ads manage ด้วย

สิ่งที่เจอในแดชบอร์ดจริง:
- Messenger bot มี `ads_management` อยู่แล้วตั้งแต่ก่อนงานนี้
- โทเค็นแบบผู้ใช้เลือกสินทรัพย์ใน config ไม่ได้ เพจกับบัญชีโฆษณาถูกเลือกในหน้าต่างล็อกอินของ Facebook ตอนกดเชื่อม ให้ติ๊กทุกเพจที่เชื่อมอยู่ ไม่ใช่แค่เพจที่จะลงแอด
- `pages_manage_ads` ไม่มีให้เลือก (แอปยังไม่มีกรณีการใช้งาน Create & manage ads) ถ้าขั้นสร้างครีเอทีฟพังเพราะสิทธิ์เพจ ค่อยเพิ่มกรณีการใช้งานนั้นแล้วติ๊ก `pages_manage_ads` ในทั้ง Ads manage และ Messenger bot

ขั้นถัดไป:
1. **หลังล็อกอินครั้งแรกด้วย config นี้ ก่อนสร้างแอดใดๆ** เปิด `/admin/messenger` แล้วตรวจว่าทุกเพจยังรับและตอบข้อความได้
   ถ้า `/studio/ads` ขึ้นคำเตือนสีแดงเรื่องสิทธิ์เพจ ให้เชื่อมเพจใหม่ที่ `/admin/messenger` ทันที
2. เพดานงบรายวัน `ADS_MAX_DAILY_BUDGET_THB` (ไม่ตั้ง = 500 บาท ใส่เลขบาทเต็ม) ตอนนี้ยังไม่ได้ตั้งบน Vercel จึงใช้ 500

## ผู้ลงโฆษณาที่ยืนยันตัวตนแล้ว (บังคับสำหรับแอดในไทย)

ลองยิงจริงครั้งแรก (2026-10-04) Meta ปฏิเสธที่ขั้นชุดโฆษณาสองเรื่อง
1. กลุ่มเป้าหมายต้องอายุ 20 ขึ้นไปในไทย — แก้ในโค้ดแล้ว (`age_min: 20`)
2. ต้องระบุผู้ลงโฆษณาและผู้ชำระเงินที่ยืนยันตัวตนแล้ว — ต้องให้เจ้าของทำ

ชุดโฆษณาที่สร้างผ่าน API ไม่รับค่าเริ่มต้นของบัญชีโฆษณา และ Meta ไม่มี API ให้ดึง ID นี้ จึงต้องตั้งเอง

1. Meta Business Suite → การตั้งค่า → **การอนุญาตและการตรวจสอบยืนยัน** → "ตรวจสอบยืนยันตัวคุณเองหรือองค์กร" ยืนยันให้เสร็จ (Meta ตรวจราว 2 วันทำการ)
2. คัดลอก ID ของตัวตนที่ยืนยันแล้ว ใส่ `META_TH_VERIFIED_IDENTITY_ID` บน Vercel (และ `.env.local` ถ้าจะลองในเครื่อง) แล้ว redeploy
3. โค้ดส่ง `regional_regulated_categories: ["THAILAND_UNIVERSAL"]` กับ `universal_beneficiary` และ `universal_payer` เป็น ID เดียวกัน
4. ยังไม่ตั้งค่านี้ หน้ายิงแอดขึ้นคำเตือน และปุ่มบันทึกถูกปฏิเสธก่อนถาม Meta

อ้างอิง: [Marketing API ad set](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/)

## สิ่งที่รอบแรกทำ

เจ้าของกดเชื่อมที่ `/studio/ads` แถวโทเค็นเก็บเป็น `facebook_ads_manage:act_…` ใน `ins_channel_auth`
สิทธิ์ที่ได้มาจาก config Ads manage ข้างบน (`ADS_MANAGE_SCOPES` ในโค้ดใช้เฉพาะตอนไม่มี config)
ถ้าล็อกอินกลับมาโดยไม่มี `pages_messaging` ระบบยังเก็บการเชื่อมไว้ แต่ `/studio/ads` ขึ้นคำเตือนให้เชื่อมเพจใหม่
ตาราง `ins_ad_launch` (migration `20261004_ad_launch.sql` รันบนโปรดักชันแล้ว 2026-10-04)
แอดสร้างครบ 4 ขั้น (แคมเปญ ชุดโฆษณา ครีเอทีฟ แอด) เป็น PAUSED ทั้งหมด ทำต่อจากขั้นที่พังได้ ปุ่มเปิดใช้แยกต่างหาก
สร้างทับแอดชุดเดิมที่สร้างแคมเปญไว้แล้ว (เปิดใช้หรือยังไม่เปิด) จะหยุดแคมเปญเก่าก่อน
จำกัด: บัญชีสกุลบาทเท่านั้น รูปเดียว วัตถุประสงค์ OUTCOME_TRAFFIC ปุ่ม Click-to-Website
ส่ง `is_adset_budget_sharing_enabled=false` ตอนสร้างแคมเปญ (งบอยู่ที่ชุดโฆษณา Meta บางบัญชีไม่รับถ้าไม่ระบุ) รายละเอียดอยู่ในคอมเมนต์หัว `src/lib/ads/launch.ts`

## Standard Access

เอกสาร Marketing API บอกว่าแอปประเภทธุรกิจได้ Standard Access ของสิทธิ์ที่ใช้ได้กับแอปชนิดนี้อยู่แล้ว
พอสำหรับเจ้าของแอปที่จัดการบัญชีโฆษณาของตัวเอง คนที่กดอนุญาตต้องมีบทบาทในแอปและมีสิทธิ์ในบัญชีโฆษณานั้น
ไม่ขอ Advanced Access

แหล่งที่อิง: [Marketing API authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)
