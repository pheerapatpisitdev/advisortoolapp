# โพสต์ iHealthy Ultra สำหรับ Expat เป็นภาษาอังกฤษ — design

วันที่: 2026-10-02 · เจ้าของอนุมัติในแชททีละส่วน (แนวทาง A, ส่วนที่ 1–4: "Ok")

## เป้าหมาย

บางเพจขาย iHealthy Ultra ให้ชาวต่างชาติที่อยู่ไทย และอยากได้โพสต์ภาษาอังกฤษจาก Organic Studio
ตอนนี้ทุกขั้นของการเขียนเป็นภาษาไทย — ทั้งคำสั่ง ด่านตรวจ ส่วนท้ายโพสต์ และโปสเตอร์ — และชิ้นงานไม่มีภาษาติดอยู่เลย

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| ขอบเขต | โพสต์ Organic Studio เท่านั้น (ไม่รวมโฆษณา /admin/ads, คลิป Reels, ลิงก์หน้าขายแบบเปิดเป็นอังกฤษ) |
| ใช้ได้ที่ไหน | ฟอร์ม "แบบประกัน" เมื่อเลือก iHealthy Ultra และ "โพสต์" — ไม่มีในสคริปต์/โฆษณา/ฟอร์มอื่น |
| เลือกภาษายังไง | ทีละชิ้น ด้วยช่องติ๊ก "คอนเทนต์สำหรับ Expat" — ติ๊ก = ภาษาอังกฤษเสมอ (ไม่ได้ตั้งที่เพจ) |
| มุมสำหรับชาวต่างชาติ | เห็นเฉพาะเมื่อติ๊กแล้ว |
| แนวทางเขียน | A: คำสั่ง/กติกา/สูตร/คลังประโยคเปิดยังเป็นไทย + ย่อหน้าคำสั่งให้เขียนเป็นอังกฤษ; ด่านตรวจที่โค้ดทำเองรู้จักภาษาอังกฤษ (ไม่ใช่เขียนไทยแล้วแปล) |
| ข้อเท็จจริงเรื่องชาวต่างชาติ (เจ้าของยืนยัน) | ชาวต่างชาติที่อยู่ไทยซื้อได้ · ใช้ประกอบยื่นวีซ่าได้ · ตัวแทนดูแลเป็นภาษาอังกฤษได้ |
| เรื่องวีซ่า | พูดกว้างๆ แล้วชวนทักมาเช็ก — ห้ามระบุชื่อ/ประเภทวีซ่า ห้ามรับประกันว่าผ่าน |
| ภาษาของหน้าจอ | ปุ่ม เมนู คำเตือน คำแนะนำพิสูจน์อักษร ยังเป็นไทย (ผู้ใช้คือทีมงาน) — เฉพาะตัวโพสต์ที่เป็นอังกฤษ |
| ไม่เปลี่ยน | งบ/โควตา AI · การลงเพจ · ปฏิทิน · `wording.ts` · รายการคำต้องห้ามในฐานข้อมูล · ชิ้นไทยทุกชิ้น |

## สิ่งที่ผู้ใช้เห็น

**ฟอร์ม** (`src/app/studio/ContentStudio.tsx`, โหมด `plan`)

- ในหัวข้อ "เรื่องที่เล่า" เหนือ "มุมที่อยากเล่า": ช่องติ๊ก **☐ คอนเทนต์สำหรับ Expat (เขียนเป็นภาษาอังกฤษ)**
  แสดงเฉพาะเมื่อ `href === "/ihealthy-ultra"` และ `format === "post"`
- **ไม่ติ๊ก:** ฟอร์มเหมือนเดิมทุกอย่าง ไม่มีมุม expat
- **ติ๊ก:**
  - เมนูมุม: มุม expat 6 ข้อขึ้นก่อน ตามด้วยมุมเดิม ยกเว้น "ลดหย่อนภาษี" (`tax`) และ "ซื้อให้ลูก" (`child`)
  - "คนอ่านคือใคร": ชิปกลุ่มคนไทย (`NICHES`) ซ่อน เหลือช่องพิมพ์เอง (placeholder เช่น "retirees, expat families")
    ไม่พิมพ์ = ชาวต่างชาติที่อยู่ไทยทั่วไป
- เปลี่ยนไปแบบประกันอื่น หรือสคริปต์/โฆษณา: ช่องติ๊กหาย ค่าหลุดเป็นไม่ติ๊ก และถ้ามุมที่เลือกอยู่เป็นมุม expat
  มุมกลับเป็น "ให้ AI เลือก" (เหมือนกติกาที่บรรทัด 291 ทำกับมุมที่ใช้ไม่ได้อยู่แล้ว)
- ค่าติ๊กจำใน localStorage แบบเดียวกับค่าอื่นของฟอร์ม

**ชิ้นงาน** — การ์ด (`PieceCard.tsx`) และหน้าแก้ไข (`PieceEditor.tsx`) มีป้าย **EN** เมื่อ `output.lang === "en"`

## ข้อมูล

ไม่มี migration — `ins_content.output` เป็น jsonb อยู่แล้ว

- `ContentOutput.lang?: "en"` (`src/lib/content/output.ts`) — ไม่มีค่า = ไทย (ชิ้นเดิมทั้งหมด)
- `PosterSpec.lang?: "en"` (`src/lib/content/poster.ts`) — โปสเตอร์ถูกวาดจาก spec ของตัวเอง (`drawPoster(spec)`) จึงต้องรู้ภาษาเอง
- ประเภท `Lang = "th" | "en"` และ `langOf(out) = out.lang ?? "th"` ไว้ที่ `output.ts` (browser-safe)
- ภาษาติดไปกับชิ้นทุกที่: แก้ไข พิสูจน์อักษร วาดโปสเตอร์ คัดลอก ลงเพจ — ทุกทางที่บันทึก output ใหม่ต้องเก็บ `lang` ไว้
  (เช่น apply-fix, แก้ข้อความ, วาดโปสเตอร์ใหม่) — แผนต้องไล่ทุกจุดที่สร้าง `ContentOutput`/`PosterSpec` ใหม่จากของเดิม

## การเขียน

### เซิร์ฟเวอร์รับค่าติ๊ก — `src/app/studio/actions.ts` `generateContent`

- `GenerateInput.expat?: boolean`
- `const expat = Boolean(input.expat) && brief.product.href === "/ihealthy-ultra" && input.format === "post"`
  ค่าอื่น (แบบอื่น/สคริปต์/โฆษณา) ไม่สน — กันหน้าเก่าหรือคำขอปลอม
- มุม: `ANGLES` เดิม + `EXPAT_ANGLES` ใหม่ มุม expat รับเฉพาะเมื่อ `expat`; ไม่ติ๊กแต่ส่งมุม expat = `""` (ให้ AI เลือก)
  และติ๊กแต่ส่ง `tax`/`child` = `""` เช่นกัน
- ชิ้นที่ได้: `output.lang = "en"` และ `output.poster.lang = "en"` (รวม poster ที่ `dressed()`/`defaultPoster()` สร้าง)
- การเรียนแม่แบบประโยคเปิด (`learnFormula`, `actions.ts:419-433`) ข้ามชิ้น EN — คลังยังเป็นไทยล้วน
  ส่วนการ "เลือก" แม่แบบไทยมาใช้กับชิ้น EN ทำได้ (AI เอาโครงไปเขียนเป็นอังกฤษ)

### ข้อมูลสินค้า — `src/lib/content/brief.ts`

`briefFor(href, { expat })` ต่อหัวข้อนี้ท้าย brief ของ iHealthy (เขียนเป็นไทยเหมือนส่วนอื่นของ brief):

```
### ข้อมูลสำหรับลูกค้าชาวต่างชาติ (เจ้าของยืนยัน 2026-10-02)
- ชาวต่างชาติที่อาศัยอยู่ในประเทศไทยสมัครได้
- ใช้ประกอบการยื่นขอวีซ่าได้ — ห้ามระบุชื่อหรือประเภทวีซ่า ห้ามบอกว่าใช้กับวีซ่าทุกประเภทหรือรับประกันว่าผ่าน ให้ชวนทักมาเช็กว่าเหมาะกับวีซ่าของเขาไหม
- ตัวแทนดูแลและตอบแชทเป็นภาษาอังกฤษได้
- นอกประเทศไทย คุ้มครองเฉพาะการรักษาฉุกเฉินที่เกิดภายใน 90 วันนับจากวันเดินทาง (สูงสุดถึงวันที่ 90) — ไม่ใช่คุ้มครองทั่วโลก
```

บรรทัด 90 วันมาจาก `iHealthyFacts().terms.outOfTerritoryDays` (ไม่พิมพ์ตัวเลขตายตัว) — brief ไทยเดิมไม่มีข้อนี้
แต่มุม `expat_travel` ต้องใช้ และต้องพูดว่า "ฉุกเฉิน" ตามสัญญา (`terms.outOfTerritory`)

brief ชุดนี้คือไม้บรรทัดของ `strayNumbers` ด้วย (`yardstick`) เหมือนเดิม

### คำสั่งภาษา — `src/lib/content/prompt.ts`, `plan.ts`

ย่อหน้า `ENGLISH_RULES` ต่อท้าย system ของทั้งตัววางแผน (`planMessages`) และตัวเขียน (`buildMessages`) เมื่อ `lang === "en"`:

- every word the reader sees — hook, body, closing, poster blocks, hashtags — is natural English for expats living in Thailand;
  short sentences, plain international English (many readers are not native speakers)
- the Page speaks as "we"; money is written as "THB 1,000" with digits taken from the brief
- the rules above about Thai particles (ครับ/ค่ะ) and Thai word choices do not apply; every other rule does
- `imagePrompt`: people are Western (European) expats living their life in Thailand (แทน "คนไทย"; เจ้าของเปลี่ยนจาก "หลายเชื้อชาติ" 2026-10-02) — ภาพพื้นหลัง ภาพแบบมี look และภาพสำรองของมุมตัวเลขใช้คำเดียวกัน
- visa: never name a visa type, never promise approval; invite them to message us to check their visa

ตัววางแผน: `hook` เป็นอังกฤษ (เพราะ hook ของชิ้นมาจากแผน, `write.ts`) แต่บรรทัด `angle` ยังเป็นไทย — เป็นโน้ตให้ทีมอ่าน ไม่ได้โพสต์

ไม่ส่ง `lang` = prompt เดิมทุกตัวอักษร (test ยืนยัน)

### มุม expat — `src/lib/content/prompt.ts`

`EXPAT_ANGLES` (ชื่อเมนูไทย, `say` สั่งให้ใช้เฉพาะข้อมูลสินค้า) และ `anglesFor(format, href, expat)`:

| id | ในเมนู | `say` (สาระ) |
|---|---|---|
| `expat_hospital` | ค่าโรงพยาบาลเอกชนในไทย | ค่ารักษาโรงพยาบาลเอกชนสำหรับคนที่ไม่มีสิทธิรัฐ แล้วพาไปที่วงเงินเหมาจ่ายของแบบนี้ — ห้ามยกตัวเลขค่ารักษาที่ไม่มีในข้อมูล |
| `expat_visa` | ประกันสุขภาพกับวีซ่า | ใช้ประกอบการยื่นวีซ่าได้ — พูดกว้างๆ ห้ามชื่อวีซ่า ห้ามรับประกัน ชวนทักมาเช็ก |
| `expat_job` | ประกันบริษัทหมดเมื่อเปลี่ยนงานหรือเกษียณ | ประกันกลุ่มของนายจ้างจบเมื่องานจบ ประกันของตัวเองอยู่ต่อ ต่ออายุได้ถึง 98 |
| `expat_travel` | กลับบ้าน/เที่ยวต่างประเทศ | การรักษาฉุกเฉินนอกไทยภายใน 90 วันนับจากวันเดินทาง — ห้ามพูดว่าคุ้มครองทั่วโลก |
| `expat_longstay` | อยู่ไทยยาว / เกษียณที่ไทย | ต่ออายุได้ถึง 98 ส่วนลดไม่เคลม 3 ปี วงเงินสูงต่อปี |
| `expat_english` | คุยกับตัวแทนเป็นภาษาอังกฤษได้ | ซื้อและเคลมโดยมีตัวแทนดูแลเป็นอังกฤษ ลดความกังวลเรื่องภาษา |

`anglesFor(..., expat=true)` = `EXPAT_ANGLES` + `ANGLES` ที่ไม่ใช่ `tax`/`child`; `expat=false` = เหมือนเดิม
ไฟล์นี้ถึงเบราว์เซอร์ — ฟอร์มกับเซิร์ฟเวอร์ใช้รายการเดียวกัน

### มุม "ตัวเลขชัดๆ" — `numbers.ts`, `numbers-cases/ihealthy.ts`, `numbers-cases/price-lines.ts`

- ฉบับอังกฤษของ: บรรทัดราคา (เช่น "First-year premium THB 12,345 · about THB 1,029/month · about THB 34/day"),
  `sexWord` (female/male), `who`, `sumLine`/`sumNote`, `NUMBERS_CLOSING`, `FALLBACK_HEADLINES`, `poster.small`
- ตัวเลขทุกตัวยังมาจากตารางเบี้ย (`numberSheets`) — เปลี่ยนแค่คำรอบตัวเลข
- `headlineMessages` ต่อ `ENGLISH_RULES`; `numbersPoster` ตัดบรรทัดต่อวันด้วยรูปแบบอังกฤษ (`/per day|\/day/`) เมื่อ EN
- ที่ไม่ใช่ iHealthy ไม่ต้องมีฉบับอังกฤษ (Expat ใช้ได้แค่ iHealthy)

## ด่านตรวจ ส่วนท้าย และโปสเตอร์

หลัก: **ด่านที่ตรวจด้วยรูปแบบ รันทั้งสองภาษากับทุกชิ้นเสมอ** (กฎไทยไม่ตรงข้อความอังกฤษ และกลับกัน) —
จึงไม่ต้องส่ง `lang` เข้าไปทุกที่ที่เรียก `flagsFor`/`checkPolicy`/`strayNumbers`
ส่วนที่ต้องเลือกถ้อยคำ (ส่วนท้าย โปสเตอร์ พิสูจน์อักษร) อ่าน `lang` ของชิ้น

### กฎโฆษณา Facebook — `src/lib/content/policy.ts`

`POLICY_RULES_EN` รวมเข้า `checkPolicy` คู่กับ `POLICY_RULES` (ทุกชิ้น ทุกครั้ง รวม `comparePosterRead`):

| code | ความรุนแรง | จับ | ไม่จับ |
|---|---|---|---|
| `health_you_en` | block | "are you sick", "you have diabetes", "you're overweight" | "if you get sick", "when you need a hospital" |
| `debt_you_en` | block | "are you in debt", "your debts" | "medical bills can turn into debt" |
| `age_you_en` | block | "you're 40", "at your age", "now that you're over 50" | "renewable up to age 98" |
| `job_you_en` | block | "lost your job", "are you unemployed" | "when you change jobs", "when your contract ends" |
| `guarantee_en` | block | "100% approved", "guaranteed approval/acceptance", "everyone is accepted", "no one is rejected" | "renewable up to age 98" |
| `pii_request_en` | block | ขอ passport / ID / bank account number | "bring your passport when you visit" |
| `superlative_en` | warn | "best in Thailand", "#1", "number one" | |
| `visa_type_en` | block | O-A, O-X, Non-O / Non-Immigrant, LTR, DTV, Elite, "retirement visa" | "visa", "your visa" |
| `visa_promise_en` | block | "visa approved", "guaranteed visa", "works for every visa" | "message us to check your visa" |

ความรุนแรงตรงกับกฎไทยคู่กัน (`health_you` … `superlative`); กฎวีซ่าเป็นของใหม่และเป็น block
`message`/`fix` เป็นไทย (ทีมอ่าน) ตัวอย่างใน `fix` เป็นอังกฤษ — block ยังกันการลงเพจเหมือนเดิม (`publish-flow.ts`)
ตัวกัน "สมมติ" แบบ `SUPPOSING` ของไทย: ฝั่งอังกฤษเขียน pattern ให้จับเฉพาะประโยคยืนยัน ("are you"/"you are"/"you have")
แทนการมองย้อนหาคำว่า if/when

### ตัวตรวจตัวเลข — `src/lib/content/check.ts`

`AMOUNT` อ่านรูปแบบอังกฤษด้วย: `THB 1,000` · `1,000 baht` · `฿1,000` · `1.5 million` · `100M` · `50k`
ได้ค่าเดียวกับ "1.5 ล้านบาท" ใน brief; สกุลเงินนับเป็น `priced` เหมือน "บาท" — ทุกการใช้เดิม (`numbersIn`, `claimedNumbers`,
`strayNumbers`) ได้ผลเท่าเดิมกับข้อความไทย

### ส่วนท้ายโพสต์ — `src/lib/content/output.ts`

- `DISCLAIMER_EN` = "Please make sure you understand the coverage details and conditions before deciding to buy insurance."
- `INSURER_LINE_EN` = "Underwritten by Krungthai-AXA Life Insurance PCL"
- `footer(out)`: ชิ้น EN ใช้สองบรรทัดนี้ ไม่เติม `TAX_LINE` (ไม่มีมุมภาษี และ regex ภาษีเป็นไทย)
- ชิ้น EN เก็บ `disclaimer: DISCLAIMER_EN` ตอนสร้าง (`write.ts` `parsePieces` และมุมตัวเลข)
- **ถ้อยคำสองบรรทัดนี้รอเจ้าของยืนยันตอนอ่าน spec**

### โปสเตอร์ — `poster.ts`, `poster-draw.tsx`, `background.ts`, `poster-text.ts`

- ฟอนต์: IBM Plex Sans Thai มีตัวละตินครบ (ตรวจ cmap แล้ว 2026-10-02) — ไม่เพิ่มฟอนต์
- `InsurerLine` ใช้ `INSURER_LINE_EN` เมื่อ `spec.lang === "en"`
- `defaultPoster(hook, name, lang)` ท้ายโปสเตอร์ "Message us to ask" แทน "ทักแชทสอบถามได้เลย"
- `withBreaks`/`clip` (Intl.Segmenter "th"): กับข้อความอังกฤษตัดตามคำอยู่แล้ว ไม่ต้องแยกทาง — test ยืนยันว่าไม่ตัดกลางคำ
- โปสเตอร์ที่ AI วาดตัวหนังสือ (`posterPrompt`): "The words on the image, in English — … clearly legible typeface";
  พื้นหลัง (`backgroundPrompt` ฯลฯ): "English headline text will be placed on top" — เลือกจาก `poster.lang`
- `comparePosterRead`: เทียบแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ (lowercase ทั้งสองฝั่ง ไทยไม่กระทบ)

### สูตรอ่าน-ดูจนจบ — `src/lib/content/finish-check.ts`

- `PREAMBLE`/`WEAK_OPENERS` เพิ่มรายการอังกฤษ (เช่น "Today we'd like to", "Hello everyone", "Did you know")
- `COUNT` เพิ่มคำนับอังกฤษ ("3 reasons", "5 things", "4 tips", "2 mistakes")
- `MOBILE_LINE`, `JARGON` (OPD, co-pay ต้องอธิบาย) ใช้เกณฑ์เดิม

### พิสูจน์อักษร — `src/lib/content/proofread.ts`

ชิ้น EN ใช้ system ภาษาอังกฤษ: spelling, grammar, awkward or unnatural phrasing for a non-native reader;
ห้ามแก้ตัวเลข ชื่อแบบประกัน แฮชแท็ก; `why` เขียนเป็นไทย — รูปแบบ JSON และ `parseProof` เดิม
`proofreadPiece` (`actions.ts:382-401`) เลือกจาก `langOf(item.output)`

## การทดสอบ

**Unit** (`tests/content/`, vitest)

- เซิร์ฟเวอร์ (`actions-page.test.ts` แบบ mock): `expat` ถูกทิ้งเมื่อไม่ใช่ iHealthy+โพสต์; มุม expat โดยไม่ติ๊ก → `""`;
  ติ๊กแล้วส่ง `tax` → `""`; ชิ้นที่ได้มี `lang: "en"` ใน output และ poster; ชิ้น EN ไม่เรียน hook template
- `brief`: expat ได้หัวข้อชาวต่างชาติพร้อม 90 วันจากข้อมูล; ไม่ expat = brief เดิมทุกตัวอักษร
- `prompt`/`plan`: EN มี `ENGLISH_RULES`; ไทย = เดิมทุกตัวอักษร; `anglesFor` สามกรณี
- `policy`: ทุกกฎอังกฤษมีเคสจับและเคสปล่อย (ตามตาราง); กฎไทยเดิมผ่านเท่าเดิม
- `check`: THB / baht / ฿ / million / M / k ได้ค่าเท่าหน่วยไทย; test ไทยเดิมผ่าน
- `output`: footer EN / ไทย; `fullText` EN ไม่มีบรรทัดไทย
- `poster`/`poster-text`/`background`: บรรทัดผู้รับประกันและคำสั่งภาพตามภาษา; read-back ไม่สนตัวพิมพ์
- `finish-check`, `proofread`, `numbers`: ฉบับอังกฤษเมื่อ EN; ชิ้นไทยได้ผลเท่าเดิม
- `npm test` ทั้งชุดผ่าน และ `tsc`/lint สะอาด

**เบราว์เซอร์** (dev server, `.env.local` = DB จริง)

- ติ๊ก Expat → เห็นมุม 6 ข้อ ไม่เห็นภาษี/ลูก ชิปคนอ่านซ่อน; เอาติ๊กออก → กลับเหมือนเดิม; เปลี่ยนแบบประกัน → ช่องติ๊กหาย
- สร้างจริง 1 ชิ้นในเพจทดสอบ (เสียค่า AI จริง เขียนแถวจริงลง `ins_content`) ดูโพสต์และโปสเตอร์ EN แล้วย้ายลงถังขยะ
  — ถ้าเจ้าของไม่อยากให้มีแถวจริง ทดสอบแค่ฟอร์ม
