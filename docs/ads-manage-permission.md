# สิทธิ์ ads_management — config ที่สาม

สถานะ: ตัดสินใจแล้วว่าใช้ Standard Access ของเจ้าของแอปอย่างเดียว ไม่ยื่น App Review และไม่เริ่มยืนยันธุรกิจ
ยังไม่ได้สร้าง config ในแดชบอร์ด Meta จากที่นี่
โค้ดอ่าน `FB_ADS_MANAGE_CONFIG_ID` แล้ว ปุ่มเชื่อมอยู่ที่ `/studio/ads` (เจ้าของเท่านั้น)
ค่าใน `.env.example` ว่างไว้ ไม่มี fallback ไป config เดิม ถ้าไม่ตั้ง ปุ่มเชื่อมจะไม่ทำงาน

แอป **ai chet** (ID 1624098972401227) พอร์ตโฟลิโอ **Luckyplanner**
ห้ามแก้ config ของเพจ (`FB_LOGIN_CONFIG_ID`, ค่าเดิม `1600660545122340`) และห้ามแก้ config อ่านผล (`FB_ADS_LOGIN_CONFIG_ID`)

การล็อกอินธุรกิจทับสิทธิ์ทั้งชุด การล็อกอินผ่าน config ที่ไม่ได้ติ๊กสิทธิ์เดิมเคยทำให้กล่องข้อความเพจหลุด
ปุ่มเชื่อมของ config นี้อยู่ที่ `/studio/ads` ที่เดียว อย่าเอา config นี้ไปใส่ปุ่มของเพจหรือหน้าอ่านผล

## สร้าง config

1. เปิด [แอป ai chet](https://developers.facebook.com/apps/1624098972401227/dashboard/)
2. กรณีการใช้งาน → เพิ่ม **Create & manage ads with Marketing API** ถ้า `ads_management` ยังไม่โผล่ในรายการสิทธิ์
   กรณีวัดผลที่มีอยู่แล้วเป็นคนละอัน อย่าไปแก้ของเดิม
3. เมนูซ้าย **Facebook Login for Business → การกำหนดค่า** → สร้างการกำหนดค่าใหม่ ไม่ใช้เทมเพลต
4. ตั้งชื่อให้จำได้ว่าเป็นตัวสร้างแอด เช่น `Ads manage`
5. ชนิดโทเค็น: **ผู้ใช้** ไม่ใช่ผู้ใช้ระบบ
6. สิทธิ์ที่ติ๊ก: `ads_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` (สามตัวหลังครีเอทีฟใช้ ขาด `pages_manage_ads` ขั้นสร้างครีเอทีฟพัง)
   ไม่ติ๊ก `pages_messaging`
   ถ้าหน้านี้บังคับสิทธิ์ที่ถอดออกจากกรณีการใช้งานไม่ได้ ให้เหลือเท่าที่บังคับ แล้วหยุด ไม่เอาไปรวมกับ config เพจหรือ config อ่านผล
7. สินทรัพย์: บัญชีโฆษณา และเพจที่แอดจะลงภายใต้
8. บันทึก แล้วคัดลอก **ID การกำหนดค่า** ไปใส่ `FB_ADS_MANAGE_CONFIG_ID` ใน `.env.local` และบน Vercel
9. ตั้งเพดานงบรายวันที่ `ADS_MAX_DAILY_BUDGET_THB` ใน `.env.local` และบน Vercel (ไม่ตั้ง = 500 บาท ใส่เลขบาทเต็ม)

## สิ่งที่รอบแรกทำ

เจ้าของกดเชื่อมที่ `/studio/ads` แถวโทเค็นเก็บเป็น `facebook_ads_manage:act_…` ใน `ins_channel_auth`
สิทธิ์ที่ขอ: `ads_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`
ตาราง `ins_ad_launch` (migration `20261004_ad_launch.sql` ยังไม่รันบนโปรดักชัน)
แอดสร้างครบ 4 ขั้น (แคมเปญ ชุดโฆษณา ครีเอทีฟ แอด) เป็น PAUSED ทั้งหมด ทำต่อจากขั้นที่พังได้ ปุ่มเปิดใช้แยกต่างหาก
สร้างทับแอดที่เปิดใช้แล้ว จะหยุดแคมเปญเก่าก่อน
จำกัด: บัญชีสกุลบาทเท่านั้น รูปเดียว วัตถุประสงค์ OUTCOME_TRAFFIC ปุ่ม Click-to-Website
ส่ง `is_adset_budget_sharing_enabled=false` ตอนสร้างแคมเปญ (งบอยู่ที่ชุดโฆษณา Meta บางบัญชีไม่รับถ้าไม่ระบุ) รายละเอียดอยู่ในคอมเมนต์หัว `src/lib/ads/launch.ts`

## Standard Access

เอกสาร Marketing API บอกว่าแอปประเภทธุรกิจได้ Standard Access ของสิทธิ์ที่ใช้ได้กับแอปชนิดนี้อยู่แล้ว
พอสำหรับเจ้าของแอปที่จัดการบัญชีโฆษณาของตัวเอง คนที่กดอนุญาตต้องมีบทบาทในแอปและมีสิทธิ์ในบัญชีโฆษณานั้น
ไม่ขอ Advanced Access

แหล่งที่อิง: [Marketing API authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)
