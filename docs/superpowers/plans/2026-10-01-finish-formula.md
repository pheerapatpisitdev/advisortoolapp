# สูตรอ่าน-ดูจนจบ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มสูตรการเขียนตัวที่สอง "สูตรอ่าน-ดูจนจบ" ให้ตัวแทนเลือกแทนสูตรคอนเทนต์โปรได้ในทั้งห้าโหมดของ Studio แล้วแสดงการ์ดเช็กลิสต์บนชิ้นงานที่เขียนด้วยสูตรนี้

**Architecture:**
- เปลี่ยนค่า `pro: boolean` ที่ส่งต่อกันทุกจุด เป็น `formula: "pro" | "finish" | null`
- กฎของสูตรใหม่อยู่ใน `finish.ts` วางแบบเดียวกับ `pro.ts`
- `formula.ts` เป็นจุดเดียวที่เลือกว่าจะใช้กฎของสูตรไหน และติดป้ายสูตรให้ชิ้นงาน ทำให้เลือกได้ทีละสูตรตั้งแต่ระดับชนิดข้อมูล
- การ์ดเช็กลิสต์คือฟังก์ชันล้วนใน `finish-check.ts` คำนวณบนหน้าจอจากข้อความที่กำลังแก้ ส่วนข้อที่ตัวแทนติ๊กเก็บใน `output.finishTicks`
- ไม่มี migration

**Tech Stack:** Next.js 15 (App Router, server actions), TypeScript, React, Tailwind, vitest

**Spec:** `docs/superpowers/specs/2026-10-01-finish-formula-design.md`

## ต่างจาก spec (ตัดสินตอนเขียนแผน เพื่อให้เข้ากับโค้ดจริง)

- **`formula.ts` มีฟังก์ชันเพิ่มสามตัว** นอกจาก `readFormula` / `outputFormula`:
  - `formulaOf` อ่านค่าจากทางเข้า รับ `pro` แบบเก่าได้ด้วย
  - `formulaRules` / `formulaHookRules` เลือกกฎของสูตรเดียว
  - `markFormula` ติดป้ายสูตรให้ชิ้นงานที่เขียนเสร็จ
  ทำให้ตัวเขียนทั้งหกตัวและตัวรันทั้งสี่ตัวเรียกฟังก์ชันเดียวกัน แทนที่จะเขียน `if` ซ้ำสิบจุด
- **ฟิลด์ใหม่ใน `ContentOutput`** เขียนชนิดแบบ literal ในไฟล์ ไม่ import จาก `formula.ts` / `finish.ts` เพื่อไม่ให้ `output.ts` (ที่หน้าเว็บใช้) ต้องดึงกฎการเขียนมาด้วย
- **ข้อ "ตัวเลขที่พูดขึ้นจอ"** นับเฉพาะตัวเลขที่เป็นการอ้าง คือตั้งแต่ 100 ขึ้นไป หรือมีบาท/% กำกับ ใช้เกณฑ์เดียวกับ `strayNumbers` ถ้านับทุกตัว คำอย่าง "3 ข้อ" หรือ "2 นาที" จะถูกเตือนทุกคลิป จึงเพิ่ม `claimedNumbers()` ใน `check.ts`
- **ข้อ "ย่อหน้า" และ "ช่วงข้อความ" ของสคริปต์** อ่านจากบทพูดแต่ละช่วงเวลา (`scenes().say`) เพราะสคริปต์ไม่มีย่อหน้าแบบโพสต์
- **ข้อความ `where` บนการ์ด** เป็นข้อความสั้นอย่างเดียว กดเพื่อหาในข้อความไม่ได้ เพราะข้อความถูกตัดสั้นแล้วจะหาไม่เจอ
- **การติ๊ก** บันทึกผ่าน server action ใหม่ `saveFinishTicks` ที่ใช้ `saveOutputIf` แบบเดียวกับ `saveContentEdits` (อ่านใหม่แล้วลองซ้ำเมื่อชิ้นงานเปลี่ยนระหว่างบันทึก)

## Global Constraints

- ชื่อสูตร: `"สูตรอ่าน-ดูจนจบ"` (`FINISH_NAME`) · ป้ายสั้นบนการ์ด: `"สูตรอ่าน-ดูจนจบ"` · ป้ายสั้นของสูตรโปร: `"สูตรโปร"` (เหมือนเดิม)
- ค่า formula ที่รับ: `"pro" | "finish"` เท่านั้น ค่าอื่นเป็น `null` · รูปแบบโฆษณาได้ `null` เสมอ
- ความยาว hook: `FINISH_HOOK_MAX = 80` ตัวอักษรที่มองเห็น · บรรทัดมือถือ: `MOBILE_LINE = 36` · ย่อหน้าไม่เกิน 4 บรรทัด · ช่วงข้อความไม่เกิน 2 บรรทัด · ลูปไม่เกิน `MAX_LOOPS = 5`
- `shareWhy`: `"use" | "insider" | "voice"` เท่านั้น
- กฎเดิมห้ามแตะ: CORE_RULES ข้อ 6 (ห้ามแต่งเรื่องลูกค้าจริง) และข้อ 8 (น้ำเสียงเป็นกลาง ไม่มี ผม/ครับ/ค่ะ) · POLICY_RULES_TH · LOOP_RULES มาก่อนการปิดท้ายของคลิปวนลูป
- การ์ดเช็กลิสต์เตือนอย่างเดียว ไม่บล็อกการโพสต์หรือการบันทึก
- ชิ้นเก่าที่มี `pro: true` อ่านเป็นสูตรโปร ห้ามเขียนทับข้อมูลในฐานข้อมูล
- ทุก commit ต้องผ่าน `npm run verify` ก่อน push (ระหว่าง task ใช้ `npx vitest run <ไฟล์>` + `npx tsc --noEmit`)
- ทำงานบน branch `studio-finish-formula` ในโฟลเดอร์หลัก เช็ก `git status -sb` ก่อนทุก commit เพราะ session อื่นเคยสลับ branch ในโฟลเดอร์นี้
- ท้าย commit message ต้องมี `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **ชิ้นเก่าที่เขียนด้วยสูตรโปร** (`output.pro: true` ไม่มี `formula`) ต้องยังขึ้นป้าย "สูตรโปร" ไม่มีการ์ดเช็กลิสต์ และแก้แล้วบันทึกได้โดย `pro` ไม่หาย เทสต์อยู่ใน Task 2 (`outputFormula`) และ Task 3 (`formulaBadge`) ส่วนการบันทึก `saveContentEdits` รวม `...item.output` อยู่แล้ว
2. **ตัวแทนแก้ชิ้นงานจนข้อความเฉลยของลูปหายไป** ข้อ "ลูปปิดครบ" ต้องเปลี่ยนเป็นไม่ผ่านทันทีพร้อมบอกว่าลูปไหน ไม่ใช่ค้างผลเดิม เทสต์อยู่ใน Task 3
3. **หน้าเว็บที่เปิดค้างไว้ก่อน deploy** ส่ง `pro: true` หรือฟอร์ม `pro=on` มา ต้องยังได้สูตรโปร เทสต์ `formulaOf` อยู่ใน Task 2 และ route ส่ง `pro` ต่อใน Task 5
4. **มีคน (หรือโค้ดเก่า) ส่ง `formula: "finish"` มาพร้อมรูปแบบโฆษณา** ต้องได้ `null` ไม่มีกฎและไม่มีป้าย เทสต์อยู่ใน Task 2 และ Task 5
5. **AI ตอบ `loops` หรือ `shareWhy` ผิดรูป หรือ ownerWording แก้คำจนข้อความลูปไม่ตรง** ชิ้นงานต้องยังบันทึกได้ และการ์ดขึ้นว่า "ไม่มีข้อมูลลูป ตรวจเองนะครับ" เทสต์อยู่ใน Task 1 (`withFinish` กับ `"{}"`) และ Task 3

---

### Task 1: กฎของสูตร — `finish.ts`

**Files:**
- Create: `src/lib/content/finish.ts`
- Modify: `src/lib/content/output.ts` (เพิ่มฟิลด์ใน `ContentOutput` ต่อจาก `pro?: boolean`)
- Test: `tests/content/finish.test.ts`

**Interfaces:**
- Consumes: `FOLD`, `ContentOutput` จาก `output.ts` · `Format`, `Length` จาก `prompt.ts` (type only) · `parseJsonReply` จาก `@/lib/ai/json-reply`
- Produces:
  - `FINISH_NAME: string`, `FINISH_HOOK_MAX = 80`, `MAX_LOOPS = 5`
  - `type ShareWhy = "use" | "insider" | "voice"`, `SHARE_WHY: Record<ShareWhy, { label: string; say: string }>`, `readShareWhy(v: unknown): ShareWhy | null`
  - `interface Loop { open: string; close: string }`
  - `FINISH_PRINCIPLES: { name: string; what: string }[]`
  - `FINISH_HOOK_RULES: string`
  - `finishRules(format: Format, length?: Length | null, loop?: boolean, oneCall?: boolean): string`
  - `loopText(out: Pick<ContentOutput, "hooks" | "body" | "closing">): string`
  - `parseLoops(raw: unknown, text: string): Loop[]`
  - `withFinish(output: ContentOutput, reply: string, planned?: ShareWhy | null): ContentOutput`

- [ ] **Step 1: Write the failing test**

`tests/content/finish.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FINISH_HOOK_RULES, MAX_LOOPS, finishRules, parseLoops, readShareWhy, withFinish,
} from "@/lib/content/finish";
import type { ContentOutput } from "@/lib/content/output";

/** สูตรอ่าน-ดูจนจบ: the owner's two guides as rules for the writers (finish.ts). */

const out = (over: Partial<ContentOutput> = {}): ContentOutput => ({
  hooks: ["หัว"], body: "เนื้อ", closing: "ปิด", hashtags: [], imagePrompt: "", disclaimer: "", ...over,
});

describe("the hook rules", () => {
  it("open from what the reader half knows, keep Facebook's rule, and ask for a reason to share", () => {
    expect(FINISH_HOOK_RULES).toContain("รู้อยู่แล้วครึ่งหนึ่ง");
    expect(FINISH_HOOK_RULES).toContain("บุคคลที่สาม");
    expect(FINISH_HOOK_RULES).toContain("ไม่เกิน 80 ตัวอักษร");
    for (const k of ["use", "insider", "voice"]) expect(FINISH_HOOK_RULES).toContain(`${k} =`);
  });
});

describe("the writer's rules", () => {
  it("give a post the fold, the four-line paragraph and the loops to report", () => {
    const r = finishRules("post");
    expect(r).toContain("ดูเพิ่มเติม");
    expect(r).toContain("4 บรรทัด");
    expect(r).toContain('"loops"');
    expect(r).not.toContain("โครงเวลา");
  });

  it("give each clip length its own timing, and every figure said on screen", () => {
    expect(finishRules("script", "30")).toContain("ภายใน 8 วิ");
    expect(finishRules("script", "60")).toContain("วินาที 15 และ 30");
    expect(finishRules("script", "180")).toContain("ทุกราว 30 วินาที");
    expect(finishRules("script", "60")).toContain("{จอ: …}");
  });

  it("leave a looped clip's ending to the loop rules", () => {
    expect(finishRules("script", "60", true)).toContain("กฎการปิดท้ายของคลิปวนลูปมาก่อน");
    expect(finishRules("script", "60", false)).not.toContain("คลิปวนลูป");
  });

  it("ask a writer that writes its own hook for the reason to share, and a planned one not", () => {
    expect(finishRules("post", null, false, true)).toContain('"shareWhy"');
    expect(finishRules("post")).not.toContain('"shareWhy"');
  });

  it("carry none of สูตรคอนเทนต์โปร's own rules", () => {
    for (const r of [finishRules("post"), finishRules("script", "60")]) {
      for (const w of ["Hook Stacking", "B-roll", "Mid-CTA", "สูตรคอนเทนต์โปร"]) expect(r).not.toContain(w);
    }
  });

  it("write an ad as before", () => {
    expect(finishRules("ad")).toBe("");
  });
});

describe("the reason to share", () => {
  it("is one of three, or nothing", () => {
    expect(readShareWhy("use")).toBe("use");
    expect(readShareWhy("voice")).toBe("voice");
    for (const v of ["fear", "", null, undefined, 1]) expect(readShareWhy(v)).toBeNull();
  });
});

describe("the loops a writer reports", () => {
  const text = "มี 3 จุดที่คนข้าม ข้อสุดท้ายเจอบ่อยสุด\nจุดแรกคือค่าห้อง\nข้อสุดท้ายคือค่าผ่าตัด";

  it("keep a loop whose words are there, opened before it is closed", () => {
    expect(parseLoops([{ open: "ข้อสุดท้ายเจอบ่อยสุด", close: "ข้อสุดท้ายคือค่าผ่าตัด" }], text))
      .toEqual([{ open: "ข้อสุดท้ายเจอบ่อยสุด", close: "ข้อสุดท้ายคือค่าผ่าตัด" }]);
  });

  it("drop one quoting words the piece does not have, closed before opened, or not a pair", () => {
    expect(parseLoops([{ open: "ไม่มีในนี้", close: "ข้อสุดท้ายคือค่าผ่าตัด" }], text)).toEqual([]);
    expect(parseLoops([{ open: "ข้อสุดท้ายคือค่าผ่าตัด", close: "มี 3 จุด" }], text)).toEqual([]);
    expect(parseLoops([{ open: "มี 3 จุด" }, "x", null], text)).toEqual([]);
    expect(parseLoops("not a list", text)).toEqual([]);
  });

  it(`keep at most ${MAX_LOOPS}`, () => {
    const many = Array.from({ length: 8 }, () => ({ open: "มี 3 จุด", close: "ค่าผ่าตัด" }));
    expect(parseLoops(many, text)).toHaveLength(MAX_LOOPS);
  });
});

describe("a piece marked as written to the guides", () => {
  const piece = out({ hooks: ["เดี๋ยวบอกข้อที่พลาดบ่อย"], body: "จุดแรกคือค่าห้อง\nข้อที่พลาดบ่อยคือค่าผ่าตัด" });
  const loops = [{ open: "เดี๋ยวบอกข้อที่พลาดบ่อย", close: "ข้อที่พลาดบ่อยคือค่าผ่าตัด" }];

  it("takes the loops and the reason from a one-piece reply", () => {
    const reply = JSON.stringify({ hook: "x", body: "y", loops, shareWhy: "insider" });
    expect(withFinish(piece, reply)).toMatchObject({ formula: "finish", shareWhy: "insider", loops });
  });

  it("reads a planned writer's {pieces:[…]}, and keeps the planner's reason over the writer's", () => {
    const reply = JSON.stringify({ pieces: [{ body: "y", loops, shareWhy: "voice" }] });
    expect(withFinish(piece, reply, "use")).toMatchObject({ formula: "finish", shareWhy: "use", loops });
  });

  it("still marks a piece whose reply had neither, or could not be read", () => {
    for (const reply of ["{}", "ขอโทษครับ"]) {
      const got = withFinish(piece, reply);
      expect(got.formula).toBe("finish");
      expect(got.loops).toBeUndefined();
      expect(got.shareWhy).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/finish.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/content/finish"`

- [ ] **Step 3: Add the fields to `ContentOutput`**

ใน `src/lib/content/output.ts` ต่อจากบรรทัด `pro?: boolean;` (ใต้คอมเมนต์ `/** written with สูตรคอนเทนต์โปร ticked (pro.ts) */`) เพิ่ม:

```ts
  /**
   * The writing formula the piece was written with (formula.ts). Pieces written before there
   * were two carry `pro` instead, and are read as "pro" (outputFormula).
   */
  formula?: "pro" | "finish";
  /** สูตรอ่าน-ดูจนจบ: why a reader would pass the piece on, as the planner or writer chose it (finish.ts) */
  shareWhy?: "use" | "insider" | "voice";
  /** สูตรอ่าน-ดูจนจบ: each loop the writer opened and where it closed, in the piece's own words */
  loops?: { open: string; close: string }[];
  /** สูตรอ่าน-ดูจนจบ: the checklist items the agent ticked (finish-check.ts) */
  finishTicks?: string[];
```

- [ ] **Step 4: Write `finish.ts`**

`src/lib/content/finish.ts`:

```ts
import { parseJsonReply } from "@/lib/ai/json-reply";
import { FOLD, type ContentOutput } from "./output";
import type { Format, Length } from "./prompt";

/**
 * สูตรอ่าน-ดูจนจบ (owner, 2026-10-01): the owner's two guides on being read and watched to the
 * end — the curiosity gap, how a phone is scanned, loops opened and closed, one person in one
 * scene, a reason to pass it on — put to work as rules for the writers when the owner picks it.
 *
 * Picked instead of สูตรคอนเทนต์โปร, never with it (formula.ts): the two overlap by half and
 * disagree on the hook. The rules that cannot be broken, the regulator's and Facebook's come
 * first, as for สูตรโปร. What the code can check afterwards is finish-check.ts's.
 * See docs/superpowers/specs/2026-10-01-finish-formula-design.md.
 */

export const FINISH_NAME = "สูตรอ่าน-ดูจนจบ";

/** two seconds of Thai, read or said; the guides give no figure, and สูตรโปร's 60 left no room for a detail */
export const FINISH_HOOK_MAX = 80;
export const MAX_LOOPS = 5;
/** a quote longer than this is a paragraph, not the words that open or close a loop */
const MAX_QUOTE = 200;

export type ShareWhy = "use" | "insider" | "voice";

/** The guide's three reasons a reader passes a piece on (Berger's practical value and social currency). */
export const SHARE_WHY: Record<ShareWhy, { label: string; say: string }> = {
  use: { label: "ของใช้ได้ทันที", say: "ของใช้ได้ทันที — ตัวเลข วิธีเช็ก หรือเช็กลิสต์ที่คนอ่านเซฟไว้ใช้เองได้" },
  insider: { label: "ความรู้วงใน", say: "ความรู้วงใน — สิ่งที่คนในวงการรู้แต่ลูกค้าไม่รู้ ต้องมาจากข้อมูลผลิตภัณฑ์เท่านั้น" },
  voice: { label: "พูดแทนความรู้สึก", say: "พูดแทนความรู้สึก — สิ่งที่ลูกค้าคิดอยู่แต่ไม่กล้าพูด" },
};

export function readShareWhy(v: unknown): ShareWhy | null {
  return v === "use" || v === "insider" || v === "voice" ? v : null;
}

export interface Loop {
  open: string;
  close: string;
}

/** what the picker lists when this formula is opened */
export const FINISH_PRINCIPLES: { name: string; what: string }[] = [
  { name: "ช่องว่างขนาดกลาง", what: "เปิดจากเรื่องที่คนอ่านรู้อยู่ครึ่งหนึ่ง แล้วเปิดปมตรงนั้น" },
  { name: "บรรทัดแรกเฉพาะเจาะจง", what: "รายละเอียดจริงแทนคำคุณศัพท์ ไม่เกริ่น ไม่โอ้อวด บอกชัดว่าจะได้อะไร" },
  { name: "อ่านแบบกวาดตาได้", what: "ย่อหน้าละไอเดียเดียว ขึ้นต้นด้วยคำที่มีเนื้อหา ไม่เกิน 4 บรรทัดบนมือถือ" },
  { name: "ภาษาง่าย", what: "ศัพท์เทคนิคมีคำแปลตามทันที" },
  { name: "ปมเปิด-ปิด", what: "เปิดปมอย่างน้อย 1 จุด และเฉลยครบทุกปม" },
  { name: "เรื่องเล่า", what: "หนึ่งคน หนึ่งฉาก — เรื่องจริงที่ให้มา หรือบอกชัดว่าสมมติ" },
  { name: "เหตุผลที่คนแชร์", what: "ของใช้ได้ทันที · ความรู้วงใน · พูดแทนความรู้สึก" },
  { name: "โครงเวลาคลิป", what: "คุณค่าชิ้นแรกใน 10 วิ ดึงกลับที่วิ 15 และ 30 เปลี่ยนภาพทุก 5–7 วิ ตัวเลขขึ้นจอ" },
  { name: "เช็กลิสต์ก่อนโพสต์", what: "ระบบตรวจให้ 8–10 ข้อ ที่เหลือติ๊กเองในหน้าแก้ชิ้นงาน" },
];

/** The hook, wherever one is written: the planner's, and the one-call writers' (รีวิวเคลม, หาทีม, ความรู้, เขียนเอง). */
export const FINISH_HOOK_RULES = [
  `${FINISH_NAME} — hook (กฎนี้แทนเรื่องความยาวของ hook ด้านบน แต่กฎที่ห้ามละเมิดและกฎ Facebook มาก่อนเสมอ):`,
  "- เปิดจากเรื่องที่คนอ่านรู้อยู่แล้วครึ่งหนึ่ง เช่น เบี้ยที่จ่ายอยู่ บรรทัดหนึ่งในกรมธรรม์ หรือความเชื่อที่มีอยู่ แล้วเปิดปมตรงนั้น ห้ามเปิดแบบตำรา เช่น “X คืออะไร” “ทำความเข้าใจ X”",
  "- ใช้รายละเอียดจริงหนึ่งอย่างแทนคำคุณศัพท์ มีตัวเลขได้ไม่เกิน 1 ตัว และต้องคัดลอกจากข้อมูลตรงตัว",
  "- ห้ามคำโอ้อวดที่คนอ่านจะค้านในใจทันทีว่า “ไม่จริงหรอก”",
  "- ห้ามคำทักทายหรือประโยคนำ เช่น สวัสดี วันนี้จะมา… หลายคนถามมาว่า…",
  "- บอกให้ชัดว่าอ่านหรือดูจบแล้วจะได้อะไร และต้องทำได้จริงจากข้อมูลที่มี",
  "- พูดถึงกลุ่มคนแบบบุคคลที่สาม ห้ามทักคนอ่านว่าเป็นคนกลุ่มนั้น (กฎ Facebook) และห้ามมีคำชวน เช่น ทักแชท คอมเมนต์ กดติดตาม",
  `- ยาวไม่เกิน ${FINISH_HOOK_MAX} ตัวอักษร`,
  `- เลือกเหตุผลที่คนจะแชร์ชิ้นนี้ 1 อย่าง (shareWhy): ${(Object.keys(SHARE_WHY) as ShareWhy[]).map((k) => `${k} = ${SHARE_WHY[k].say}`).join(" · ")} — ถ้าเป้าหมายคือให้ทักแชท ก็ยังเลือก แต่เป็นเรื่องรองของชิ้น`,
].join("\n");

const HEAD = [
  `${FINISH_NAME} (เจ้าของเพจเลือกใช้ กฎที่ห้ามละเมิด กฎ คปภ. และกฎ Facebook มาก่อนเสมอ):`,
  "- ชื่อเทคนิคด้านล่าง (open loop, pattern interrupt ฯลฯ) เป็นคำสั่งให้คุณ ห้ามเขียนชื่อเทคนิคลงในชิ้นงาน",
].join("\n");

const SHARED = [
  "- ย่อหน้าหนึ่งมีไอเดียเดียว ขึ้นต้นย่อหน้า bullet และหัวข้อด้วยคำที่มีเนื้อหา (คนกวาดตาอ่านแค่สองคำแรก) ห้ามขึ้นต้นด้วย “เราขอแนะนำว่า” “ซึ่ง” “ทั้งนี้” “อย่างไรก็ตาม”",
  "- ศัพท์เทคนิคทุกคำต้องมีคำแปลตามทันที ในวงเล็บหรือประโยคถัดไป",
  "- เปิดปมค้างไว้อย่างน้อย 1 จุด เช่น “เดี๋ยวบอกว่าข้อไหนพลาดบ่อยสุด” และต้องเฉลยทุกปมก่อนจบ ประโยคท้ายย่อหน้าต้องพาไปย่อหน้าถัดไป",
  "- ถ้าเล่าเป็นเรื่อง: หนึ่งคน หนึ่งฉาก ปัญหาที่จับต้องได้ เล่าตามลำดับเวลา ใช้เรื่องจริงที่เจ้าของเพจให้มา หรือเขียนบอกชัดว่าสมมติ ห้ามตั้งชื่อหรืออายุให้ตัวละครที่ไม่มีในเรื่องจริง",
  "- ทำให้เหตุผลที่คนจะแชร์ (shareWhy) ของชิ้นนี้เกิดขึ้นจริงในเนื้อหา ถ้าเป้าหมายคือให้คนเห็นเยอะ ให้ปิดด้วยสิ่งที่คนอ่านเอาไปทำต่อเองได้โดยไม่ต้องทักมา",
  "- ห้ามใช้ความกลัวเป็นตัวขับหลัก สิ่งที่ hook สัญญาต้องได้ครบในเนื้อหา",
];

function jsonLines(oneCall: boolean): string[] {
  return [
    `- ใน JSON ของชิ้นงาน เพิ่มช่อง "loops":[{"open":"…","close":"…"}] — open คือข้อความที่เปิดปม close คือข้อความที่เฉลย คัดลอกจากชิ้นงานตรงตัวทุกตัวอักษร สั้นที่สุดที่ยังชัด ไม่เกิน ${MAX_LOOPS} ปม`,
    ...(oneCall ? ['- และเพิ่มช่อง "shareWhy" เป็น "use", "insider" หรือ "voice" ตามที่เลือก'] : []),
  ];
}

function timing(length: Length, loop: boolean): string {
  const end = loop ? "เหตุผลที่ควรเซฟหรือแชร์ไปอยู่กลางคลิป" : "ปิดด้วยเหตุผลที่ควรเซฟหรือแชร์";
  if (length === "30") {
    return `- โครงเวลา: [0–2 วิ] hook → ภายใน 8 วิ ให้คำตอบทันที ไม่ยืด → ขยายด้วยตัวอย่าง 1 เรื่อง → สรุปเป็นประโยคเดียวที่จำง่าย → ${end}`;
  }
  const middle = length === "180" ? "มีประโยคดึงความสนใจกลับทุกราว 30 วินาที" : "มีประโยคดึงความสนใจกลับที่ราววินาที 15 และ 30";
  return `- โครงเวลา: [0–3 วิ] hook → ขยายความและเปิดปม → ส่งคุณค่าชิ้นแรกภายใน 10 วิ → เคสตามกฎเรื่องเล่า → ${middle} → เฉลยปม → ${end}`;
}

/**
 * The rest of the guides, for the one writing the body. `oneCall`: the call writes its own
 * hook and has no planner, so it also names the reason to share.
 */
export function finishRules(format: Format, length: Length | null = null, loop = false, oneCall = false): string {
  if (format === "ad") return "";
  if (format === "post") {
    return [
      HEAD,
      ...SHARED,
      `- พีระมิดหัวกลับ: ข้อสรุปต้องอยู่ใน hook กับต้น body ก่อน “ดูเพิ่มเติม” (ราว ${FOLD} ตัวอักษรแรก)`,
      "- ย่อหน้ายาวไม่เกิน 4 บรรทัดบนมือถือ ช่วงข้อความระหว่างช่องว่างไม่เกิน 2 บรรทัด ใช้ bullet แทนย่อหน้ายาว",
      ...jsonLines(oneCall),
    ].join("\n");
  }
  return [
    HEAD,
    ...SHARED,
    timing(length ?? "60", loop),
    "- เปลี่ยนภาพทุก 5–7 วินาที (ขนาดภาพ มุมกล้อง ภาพแทรก ข้อความขึ้นจอ) เขียนในวงเล็บ เช่น (ตัดเป็นภาพใกล้)",
    "- ตัวเลขทุกตัวที่พูดต้องขึ้นจอด้วยเป็น {จอ: …} ในช่วงเวลาเดียวกัน เพราะคนดูจำนวนมากปิดเสียง",
    "- หนึ่งคลิป หนึ่งประเด็น ไม่มีช่วงเงียบ ไม่มีคำเกริ่น",
    ...(loop ? ["- คลิปวนลูป: กฎการปิดท้ายของคลิปวนลูปมาก่อน ย้ายเหตุผลที่ควรเซฟหรือแชร์ไปไว้กลางคลิป เป็นประโยคสั้นประโยคเดียว"] : []),
    ...jsonLines(oneCall),
  ].join("\n");
}

/** the words a loop is looked for in: the hook, the body and the closing, in that order */
export function loopText(out: Pick<ContentOutput, "hooks" | "body" | "closing">): string {
  return [out.hooks[0] ?? "", out.body, out.closing].join("\n");
}

/**
 * The loops a writer reported, each kept only if both quotes are in `text` and it closes after
 * it opens — the rule parseProof keeps: a quote that is not there cannot be checked later.
 */
export function parseLoops(raw: unknown, text: string): Loop[] {
  if (!Array.isArray(raw)) return [];
  const out: Loop[] = [];
  for (const l of raw) {
    const r = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    const open = typeof r.open === "string" ? r.open.trim() : "";
    const close = typeof r.close === "string" ? r.close.trim() : "";
    if (!open || !close || open.length > MAX_QUOTE || close.length > MAX_QUOTE) continue;
    const at = text.indexOf(open);
    if (at < 0 || text.indexOf(close, at + open.length) < 0) continue;
    out.push({ open, close });
  }
  return out.slice(0, MAX_LOOPS);
}

/**
 * A written piece marked as สูตรอ่าน-ดูจนจบ's, with what its writer reported. A planned writer
 * answers {pieces:[…]} and the planner chose the reason, which wins; a one-call writer answers
 * the piece itself. What cannot be read is left off — the card then asks the agent to look.
 */
export function withFinish(output: ContentOutput, reply: string, planned: ShareWhy | null = null): ContentOutput {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  const first = raw && Array.isArray(raw.pieces) ? raw.pieces[0] : raw;
  const src = (first && typeof first === "object" ? first : {}) as Record<string, unknown>;
  const loops = parseLoops(src.loops, loopText(output));
  const shareWhy = planned ?? readShareWhy(src.shareWhy);
  return { ...output, formula: "finish", ...(shareWhy ? { shareWhy } : {}), ...(loops.length ? { loops } : {}) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/content/finish.test.ts && npx tsc --noEmit`
Expected: PASS ทุกข้อ, tsc ไม่มี error

- [ ] **Step 6: Commit**

```bash
git status -sb
git add src/lib/content/finish.ts src/lib/content/output.ts tests/content/finish.test.ts
git commit -m "feat(studio): สูตรอ่าน-ดูจนจบ's writing rules, and the loops and reason to share a writer reports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: เลือกได้ทีละสูตร — `formula.ts`

**Files:**
- Create: `src/lib/content/formula.ts`
- Test: `tests/content/formula.test.ts`

**Interfaces:**
- Consumes: Task 1: `FINISH_HOOK_RULES`, `FINISH_NAME`, `finishRules`, `withFinish`, `type ShareWhy` · `PRO_HOOK_RULES`, `PRO_NAME`, `proRules` จาก `pro.ts` · `ContentOutput`
- Produces:
  - `type Formula = "pro" | "finish"`
  - `FORMULA_NAME: Record<Formula, string>`, `FORMULA_SHORT: Record<Formula, string>`
  - `readFormula(v: unknown): Formula | null`
  - `formulaOf(input: { formula?: unknown; pro?: unknown }, format: string): Formula | null`
  - `outputFormula(o: { formula?: unknown; pro?: unknown }): Formula | null`
  - `formulaHookRules(f: Formula | null): string`
  - `formulaRules(f: Formula | null, format: Format, length: Length | null, loop: boolean, oneCall?: boolean): string`
  - `markFormula(output: ContentOutput, f: Formula | null, reply: string, planned?: ShareWhy | null): ContentOutput`

- [ ] **Step 1: Write the failing test**

`tests/content/formula.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FORMULA_NAME, formulaHookRules, formulaOf, formulaRules, markFormula, outputFormula, readFormula,
} from "@/lib/content/formula";
import { FINISH_HOOK_RULES, FINISH_NAME, finishRules } from "@/lib/content/finish";
import { PRO_HOOK_RULES, PRO_NAME, proRules } from "@/lib/content/pro";
import type { ContentOutput } from "@/lib/content/output";

/** Two writing formulas, one at a time (formula.ts). */

const piece: ContentOutput = { hooks: ["หัว"], body: "เนื้อ", closing: "", hashtags: [], imagePrompt: "", disclaimer: "" };

describe("reading a pick", () => {
  it("knows the two formulas and nothing else", () => {
    expect(readFormula("pro")).toBe("pro");
    expect(readFormula("finish")).toBe("finish");
    for (const v of ["", "none", "PRO", true, null, undefined, 1]) expect(readFormula(v)).toBeNull();
  });

  it("takes a page loaded before there were two, and gives an ad none", () => {
    expect(formulaOf({ pro: true }, "post")).toBe("pro");
    expect(formulaOf({ formula: "finish", pro: true }, "script")).toBe("finish");
    expect(formulaOf({ formula: "finish" }, "ad")).toBeNull();
    expect(formulaOf({ pro: true }, "ad")).toBeNull();
    expect(formulaOf({ formula: "junk" }, "post")).toBeNull();
    expect(formulaOf({ formula: "" , pro: false }, "post")).toBeNull();
  });

  it("reads a piece written before formulas as สูตรคอนเทนต์โปร", () => {
    expect(outputFormula({ pro: true })).toBe("pro");
    expect(outputFormula({ formula: "finish" })).toBe("finish");
    expect(outputFormula({})).toBeNull();
    expect(FORMULA_NAME).toEqual({ pro: PRO_NAME, finish: FINISH_NAME });
  });
});

describe("one formula at a time", () => {
  it("gives the planner one formula's hook rules", () => {
    expect(formulaHookRules("pro")).toBe(PRO_HOOK_RULES);
    expect(formulaHookRules("finish")).toBe(FINISH_HOOK_RULES);
    expect(formulaHookRules(null)).toBe("");
  });

  it("gives a writer one formula's rules and never the other's", () => {
    const pro = formulaRules("pro", "post", null, false);
    const finish = formulaRules("finish", "post", null, false);
    expect(pro).toBe(proRules("post"));
    expect(finish).toBe(finishRules("post"));
    expect(pro).not.toContain(FINISH_NAME);
    expect(finish).not.toContain(PRO_NAME);
  });

  it("puts the hook rules in front for a writer that writes its own hook", () => {
    expect(formulaRules("finish", "script", "60", false, true)).toBe(`${FINISH_HOOK_RULES}\n${finishRules("script", "60", false, true)}`);
    expect(formulaRules("pro", "post", null, false, true)).toBe(`${PRO_HOOK_RULES}\n${proRules("post")}`);
  });

  it("writes nothing for no formula, or for an ad", () => {
    expect(formulaRules(null, "post", null, false, true)).toBe("");
    expect(formulaRules("finish", "ad", null, false, true)).toBe("");
    expect(formulaRules("pro", "ad", null, false, true)).toBe("");
  });
});

describe("marking a written piece", () => {
  it("names สูตรโปร, adds the guides' reports for สูตรอ่าน-ดูจนจบ, and leaves a piece with none alone", () => {
    expect(markFormula(piece, "pro", "{}")).toEqual({ ...piece, formula: "pro" });
    expect(markFormula(piece, null, "{}")).toBe(piece);
    expect(markFormula(piece, "finish", JSON.stringify({ shareWhy: "use" }))).toMatchObject({ formula: "finish", shareWhy: "use" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/formula.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/content/formula"`

- [ ] **Step 3: Write `formula.ts`**

`src/lib/content/formula.ts`:

```ts
import { FINISH_HOOK_RULES, FINISH_NAME, finishRules, withFinish, type ShareWhy } from "./finish";
import type { ContentOutput } from "./output";
import { PRO_HOOK_RULES, PRO_NAME, proRules } from "./pro";
import type { Format, Length } from "./prompt";

/**
 * The writing formulas a round may be written to, one at a time (owner, 2026-10-01): สูตรคอนเทนต์โปร
 * (pro.ts) or สูตรอ่าน-ดูจนจบ (finish.ts). They overlap by half and disagree on the hook, so
 * the choice is one value rather than two boxes — no path can hand a writer both.
 * Every writer and runner asks this file which rules and which mark; none of them names a
 * formula itself. Browser-safe.
 */

export type Formula = "pro" | "finish";

export const FORMULA_NAME: Record<Formula, string> = { pro: PRO_NAME, finish: FINISH_NAME };
/** the card's word for it; "สูตรโปร" is what cards said before there were two */
export const FORMULA_SHORT: Record<Formula, string> = { pro: "สูตรโปร", finish: FINISH_NAME };

export function readFormula(v: unknown): Formula | null {
  return v === "pro" || v === "finish" ? v : null;
}

/**
 * The formula a round asked for. A page loaded before there were two sends `pro: true`; it is
 * still สูตรโปร. An ad's lengths are Ads Manager's, so an ad is written to none.
 */
export function formulaOf(input: { formula?: unknown; pro?: unknown }, format: string): Formula | null {
  if (format === "ad") return null;
  return readFormula(input.formula) ?? (input.pro === true ? "pro" : null);
}

/** a stored piece's formula; one written before there were two carries `pro: true` */
export function outputFormula(o: { formula?: unknown; pro?: unknown }): Formula | null {
  return readFormula(o.formula) ?? (o.pro === true ? "pro" : null);
}

/** the hook's rules, for the planner */
export function formulaHookRules(f: Formula | null): string {
  return f === "pro" ? PRO_HOOK_RULES : f === "finish" ? FINISH_HOOK_RULES : "";
}

/**
 * The rules for the one writing the body. `oneCall`: the call writes its own hook too
 * (รีวิวเคลม, หาทีม, ความรู้, เขียนเอง), so the hook's rules go first.
 */
export function formulaRules(f: Formula | null, format: Format, length: Length | null, loop: boolean, oneCall = false): string {
  if (!f || format === "ad") return "";
  const body = f === "pro" ? proRules(format, length, loop) : finishRules(format, length, loop, oneCall);
  return oneCall ? `${formulaHookRules(f)}\n${body}` : body;
}

/** A written piece with its formula named, and สูตรอ่าน-ดูจนจบ's reports read from the reply. */
export function markFormula(output: ContentOutput, f: Formula | null, reply: string, planned: ShareWhy | null = null): ContentOutput {
  if (f === "finish") return withFinish(output, reply, planned);
  return f === "pro" ? { ...output, formula: "pro" } : output;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/content/formula.test.ts tests/content/finish.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git status -sb
git add src/lib/content/formula.ts tests/content/formula.test.ts
git commit -m "feat(studio): one writing formula at a time, chosen in one place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: การ์ดเช็กลิสต์ (ส่วนตรรกะ) — `finish-check.ts`

**Files:**
- Create: `src/lib/content/finish-check.ts`
- Modify: `src/lib/content/check.ts` (เพิ่ม `claimedNumbers`)
- Test: `tests/content/finish-check.test.ts`, `tests/content/check.test.ts` (เพิ่ม 1 เทสต์)

**Interfaces:**
- Consumes: Task 1: `FINISH_HOOK_MAX`, `loopText` · Task 2: `outputFormula`, `FORMULA_SHORT` · `scenes()` จาก `script.ts` · `ContentOutput`
- Produces:
  - `claimedNumbers(text: string): number[]` ใน `check.ts`
  - `type FinishFormat = "post" | "script"`
  - `visibleLength(s: string): number`, `MOBILE_LINE = 36`, `paragraphs(text: string): string[]`
  - `PREAMBLE`, `WEAK_OPENERS`, `JARGON: string[]`
  - `type FinishCheckId`, `FINISH_AUTO: { id: FinishCheckId; label: string; script?: true }[]`
  - `interface FinishResult { id: FinishCheckId; label: string; ok: boolean; where: string[] }`
  - `finishChecks(out: ContentOutput, format: FinishFormat): FinishResult[]`
  - `ticksFor(format: string): { id: string; label: string }[]`
  - `cleanTicks(v: unknown, format: string): string[]`
  - `formulaBadge(out: ContentOutput, format: string): string`

- [ ] **Step 1: Write the failing tests**

ต่อท้าย `tests/content/check.test.ts` (เพิ่ม `claimedNumbers` ใน import ของ `@/lib/content/check` ที่มีอยู่):

```ts
describe("claimedNumbers", () => {
  it("keeps what is said in baht, as a percentage, or a hundred and more — not the copy's own counting", () => {
    expect(claimedNumbers("3 ข้อ เบี้ย 1,200 บาท ลด 5% ทุน 500,000 ภายใน 2 นาที")).toEqual([1200, 5, 500000]);
  });
});
```

`tests/content/finish-check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MOBILE_LINE, cleanTicks, finishChecks, formulaBadge, paragraphs, ticksFor, visibleLength, type FinishFormat,
} from "@/lib/content/finish-check";
import type { ContentOutput } from "@/lib/content/output";

/** สูตรอ่าน-ดูจนจบ's checklist: what the code can read of the guides' own checklists. */

const post = (over: Partial<ContentOutput> = {}): ContentOutput => ({
  hooks: ["ค่าห้อง 4,000 ในกรมธรรม์ โรงพยาบาลคิด 6,500"],
  body: "จุดที่คนข้ามคือค่าห้องต่อคืน\n\nเช็กเลขนี้เทียบกับโรงพยาบาลที่ไปจริง",
  closing: "เก็บไว้เช็กกรมธรรม์ตัวเองได้เลย",
  hashtags: [], imagePrompt: "", disclaimer: "",
  formula: "finish",
  loops: [{ open: "ค่าห้อง 4,000", close: "ค่าห้องต่อคืน" }],
  ...over,
});
const script = (body: string, over: Partial<ContentOutput> = {}) => post({
  hooks: ["จุดที่คนข้ามในตารางผลประโยชน์"],
  body,
  closing: "[40–45 วิ] เอาไปเช็กได้เลย (ชี้กล้อง)",
  loops: [{ open: "จุดที่คนข้าม", close: "เช็กได้" }],
  ...over,
});
const check = (o: ContentOutput, id: string, format: FinishFormat = "post") => finishChecks(o, format).find((r) => r.id === id)!;

describe("a clean piece", () => {
  it("passes all eight on a post, and a post is not read for a script's checks", () => {
    const r = finishChecks(post(), "post");
    expect(r.map((x) => x.id)).toEqual(["no-preamble", "hook-short", "para-lines", "run-lines", "lead-words", "jargon", "list-count", "loops-closed"]);
    expect(r.filter((x) => !x.ok)).toEqual([]);
  });

  it("gives a script all ten", () => {
    const r = finishChecks(script("[3–10 วิ] เบี้ย 1,200 บาทต่อเดือน {จอ: 1,200 บาท/เดือน} (ภาพใกล้)"), "script");
    expect(r).toHaveLength(10);
    expect(r.filter((x) => !x.ok)).toEqual([]);
  });
});

describe("Thai on a phone", () => {
  it("counts a vowel or tone mark above or below a letter as no width", () => {
    expect(visibleLength("ผู้")).toBe(1);
    expect(visibleLength("ที่")).toBe(1);
    expect(visibleLength("กำ")).toBe(2);
  });

  it("splits paragraphs at blank lines, and makes each list item its own", () => {
    expect(paragraphs("ก\nข\n\n- ค\n- ง\nจ")).toEqual(["ก\nข", "- ค", "- ง", "จ"]);
  });

  it("fails a paragraph past four lines, and not a long list of short items", () => {
    expect(check(post({ body: Array(4).fill("ก".repeat(MOBILE_LINE)).join("\n") }), "para-lines").ok).toBe(true);
    expect(check(post({ body: Array(5).fill("ก".repeat(MOBILE_LINE)).join("\n") }), "para-lines").ok).toBe(false);
    expect(check(post({ body: Array(8).fill("- ข้อสั้น").join("\n") }), "para-lines").ok).toBe(true);
  });

  it("fails a run of words past two lines, but not a hashtag", () => {
    const r = check(post({ body: "ก".repeat(MOBILE_LINE * 2 + 1) }), "run-lines");
    expect(r.ok).toBe(false);
    expect(r.where).toHaveLength(1);
    expect(check(post({ body: `#${"ก".repeat(100)}` }), "run-lines").ok).toBe(true);
  });
});

describe("how it opens", () => {
  it("fails a greeting or a preamble, a script's time marker aside", () => {
    expect(check(post({ hooks: ["สวัสดีครับ วันนี้มาคุยเรื่องประกัน"] }), "no-preamble").ok).toBe(false);
    expect(check(post({ hooks: ["[0–3 วิ] วันนี้จะมาเล่าเรื่องค่าห้อง"] }), "no-preamble").ok).toBe(false);
  });

  it("fails a hook past eighty visible characters", () => {
    expect(check(post({ hooks: ["ก".repeat(81)] }), "hook-short").ok).toBe(false);
    expect(check(post({ hooks: ["ที่".repeat(80)] }), "hook-short").ok).toBe(true);
  });

  it("fails a paragraph that opens on an empty word, past its bullet", () => {
    const r = check(post({ body: "ซึ่งแบบนี้คุ้มครอง\n\n- และยังมีอีก\n\n✅ ทบทวนกรมธรรม์ทุกปี" }), "lead-words");
    expect(r.ok).toBe(false);
    expect(r.where).toHaveLength(2);
  });
});

describe("technical words", () => {
  it("want a meaning right after, or around them in brackets", () => {
    expect(check(post({ body: "ดู IRR ของกรมธรรม์" }), "jargon").where).toEqual(["IRR"]);
    expect(check(post({ body: "ดู IRR (ผลตอบแทนเฉลี่ยต่อปี)" }), "jargon").ok).toBe(true);
    expect(check(post({ body: "IRR คือผลตอบแทนต่อปี" }), "jargon").ok).toBe(true);
    expect(check(post({ body: "ค่ารักษาผู้ป่วยใน (IPD)" }), "jargon").ok).toBe(true);
    expect(check(post({ body: "มี Co-Payment 30% ทุกเคลม" }), "jargon").ok).toBe(false);
  });
});

describe("a hook that promises a count", () => {
  it("wants each item in the body", () => {
    const hooks = ["3 จุดที่คนข้ามในตาราง"];
    expect(check(post({ hooks, body: "1. ค่าห้อง\n2. ค่าผ่าตัด" }), "list-count").where[0]).toContain("ข้อ 3");
    expect(check(post({ hooks, body: "1. ค่าห้อง\n2. ค่าผ่าตัด\n3. ค่ายา" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks, body: "ข้อแรก ค่าห้อง ข้อสอง ค่าผ่าตัด ข้อสาม ค่ายา" }), "list-count").ok).toBe(true);
    expect(check(post({ hooks: ["๓ ข้อที่ต้องเช็ก"], body: "1️⃣ ค่าห้อง\n2️⃣ ค่าผ่าตัด\n3️⃣ ค่ายา" }), "list-count").ok).toBe(true);
  });
});

describe("loops", () => {
  it("fail when the writer reported none", () => {
    const r = check(post({ loops: undefined }), "loops-closed");
    expect(r.ok).toBe(false);
    expect(r.where).toEqual(["ไม่มีข้อมูลลูป ตรวจเองนะครับ"]);
  });

  it("fail as soon as an edit takes the closing words out, or puts them first", () => {
    expect(check(post({ body: "เช็กเลขนี้เทียบกับโรงพยาบาลที่ไปจริง" }), "loops-closed").ok).toBe(false);
    expect(check(post({ loops: [{ open: "ค่าห้องต่อคืน", close: "ค่าห้อง 4,000" }] }), "loops-closed").ok).toBe(false);
  });
});

describe("a script's own checks", () => {
  it("want every amount said on the screen of its own stretch", () => {
    const r = check(script("[3–10 วิ] เบี้ย 1,200 บาทต่อเดือน (ภาพใกล้)"), "numbers-on-screen", "script");
    expect(r.ok).toBe(false);
    expect(r.where[0]).toContain("3–10 วิ");
    expect(check(script("[3–10 วิ] มี 3 จุด (ภาพใกล้)"), "numbers-on-screen", "script").ok).toBe(true);
  });

  it("want a change of picture in any stretch longer than seven seconds", () => {
    expect(check(script("[3–15 วิ] พูดยาวไม่มีภาพเปลี่ยน"), "cuts", "script").ok).toBe(false);
    expect(check(script("[3–15 วิ] พูดยาว (ตัดเป็นภาพใกล้)"), "cuts", "script").ok).toBe(true);
    expect(check(script("[3–8 วิ] สั้น"), "cuts", "script").ok).toBe(true);
  });
});

describe("the agent's ticks", () => {
  it("ask a script whether it reads muted, and a post not", () => {
    expect(ticksFor("script").map((t) => t.id)).toContain("muted");
    expect(ticksFor("post").map((t) => t.id)).not.toContain("muted");
    expect(ticksFor("ad")).toEqual([]);
  });

  it("keep only the format's own, once each", () => {
    expect(cleanTicks(["no-fear", "muted", "junk", "no-fear", 3], "post")).toEqual(["no-fear"]);
    expect(cleanTicks("no-fear", "post")).toEqual([]);
    expect(cleanTicks(["no-fear"], "ad")).toEqual([]);
  });
});

describe("the card's label", () => {
  it("names the formula, with the score for สูตรอ่าน-ดูจนจบ", () => {
    expect(formulaBadge(post(), "post")).toBe("สูตรอ่าน-ดูจนจบ · ตรวจ 8/8");
    expect(formulaBadge(post({ formula: undefined, pro: true }), "post")).toBe("สูตรโปร");
    expect(formulaBadge(post({ formula: undefined }), "post")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/content/finish-check.test.ts tests/content/check.test.ts`
Expected: FAIL — `finish-check` resolve ไม่ได้ และ `claimedNumbers is not a function`

- [ ] **Step 3: Add `claimedNumbers` to `check.ts`**

ใน `src/lib/content/check.ts` แทน `strayNumbers` เดิมทั้งฟังก์ชัน (ตั้งแต่คอมเมนต์ `/** The amounts in \`output\` that \`brief\` never had.` จนจบฟังก์ชัน) ด้วย:

```ts
/**
 * Small bare numbers are the copy's own counting — "3 เหตุผล", "2 นาที" — and are left alone;
 * anything of a hundred or more, or said in baht or as a percentage, is a claim.
 */
const claimed = (a: Amount) => a.value >= 100 || a.priced;

/** The amounts in a text that are claims rather than counting (สูตรอ่าน-ดูจนจบ's on-screen check). */
export function claimedNumbers(text: string): number[] {
  return amounts(text).filter(claimed).map((a) => a.value);
}

/**
 * The amounts in `output` that `brief` never had: every claim has to be one the model was
 * handed. `every`: no counting is spared — for ความรู้, written from general knowledge, where
 * "ระยะรอคอย 30 วัน" is a claim about somebody's policy.
 */
export function strayNumbers(output: string, brief: string, opts: { every?: boolean } = {}): string[] {
  const allowed = new Set(numbersIn(brief).map(key));
  const stray = amounts(output)
    .filter((a) => opts.every || claimed(a))
    .filter((a) => !allowed.has(key(a.value)))
    .map((a) => a.raw);
  return [...new Set(stray)];
}
```

- [ ] **Step 4: Write `finish-check.ts`**

`src/lib/content/finish-check.ts`:

```ts
import { claimedNumbers } from "./check";
import { FINISH_HOOK_MAX, loopText } from "./finish";
import { FORMULA_SHORT, outputFormula } from "./formula";
import type { ContentOutput } from "./output";
import { scenes } from "./script";

/**
 * สูตรอ่าน-ดูจนจบ's checklist card (finish.ts): the guides' own checklists, the half a rule can
 * read done by the code, the rest ticked by the agent. Pure and without a model, so it costs
 * nothing and runs on the words on screen as they are typed. It warns and never blocks — the
 * owner decides, as with check.ts.
 */

export type FinishFormat = "post" | "script";

/** Thai vowels and tone marks above or below a letter take no width of their own */
const MARKS = /[ัิ-ฺ็-๎]/g;

export function visibleLength(s: string): number {
  return [...s.replace(MARKS, "")].length;
}

/** characters of Thai to a phone's line in a Facebook post, near enough; the guides' "บรรทัดบนมือถือ" */
export const MOBILE_LINE = 36;

export const PREAMBLE = ["สวัสดี", "วันนี้จะมา", "วันนี้เรามา", "วันนี้ขอ", "ก่อนอื่น", "หลายคนถาม", "ขอเล่า", "มาทำความรู้จัก", "ทำความเข้าใจ"];
export const WEAK_OPENERS = ["เราขอแนะนำ", "ขอแนะนำ", "ซึ่ง", "ทั้งนี้", "อย่างไรก็ตาม", "นอกจากนี้", "ดังนั้น", "และ", "ก็", "จริงๆแล้ว", "จริง ๆ แล้ว"];
/** words a reader of a Thai insurance post may not know; each wants a meaning where it first appears */
export const JARGON = ["IRR", "co-payment", "copayment", "co-pay", "copay", "deductible", "annuity", "rider", "unit linked", "unit-linked", "cash value", "IPD", "OPD"];

export type FinishCheckId =
  | "no-preamble" | "hook-short" | "para-lines" | "run-lines" | "lead-words" | "jargon" | "list-count" | "loops-closed"
  | "numbers-on-screen" | "cuts";

export const FINISH_AUTO: { id: FinishCheckId; label: string; script?: true }[] = [
  { id: "no-preamble", label: "เปิดไม่เกริ่น" },
  { id: "hook-short", label: "hook สั้นพอ" },
  { id: "para-lines", label: "ย่อหน้าไม่เกิน 4 บรรทัดบนมือถือ" },
  { id: "run-lines", label: "ช่วงข้อความไม่เกิน 2 บรรทัด" },
  { id: "lead-words", label: "ขึ้นต้นย่อหน้าด้วยคำที่มีเนื้อหา" },
  { id: "jargon", label: "ศัพท์เทคนิคมีคำแปล" },
  { id: "list-count", label: "hook บอกกี่ข้อ เนื้อหามีครบ" },
  { id: "loops-closed", label: "ลูปปิดครบ" },
  { id: "numbers-on-screen", label: "ตัวเลขที่พูดขึ้นจอ", script: true },
  { id: "cuts", label: "เปลี่ยนภาพสม่ำเสมอ", script: true },
];

/** what only the agent can judge; a label per format, none where it does not apply */
const FINISH_TICKS: { id: string; post?: string; script?: string }[] = [
  { id: "lead-first", post: "ข้อสรุปอยู่ต้นเรื่อง", script: "ส่งคุณค่าชิ้นแรกภายใน 10 วินาที" },
  { id: "promise-kept", post: "hook สัญญาอะไร เนื้อหาให้ครบ", script: "hook สัญญาอะไร เนื้อหาให้ครบ" },
  { id: "share-reason", post: "มีเหตุผลให้คนแชร์", script: "มีเหตุผลให้คนแชร์" },
  { id: "one-scene", post: "ถ้าเล่าเป็นเรื่อง: หนึ่งคน หนึ่งฉาก", script: "ถ้าเล่าเป็นเรื่อง: หนึ่งคน หนึ่งฉาก" },
  { id: "no-fear", post: "ไม่ใช้ความกลัวเป็นตัวขับหลัก", script: "ไม่ใช้ความกลัวเป็นตัวขับหลัก" },
  { id: "old-client", post: "ถ้าลูกค้าเก่าอ่านเจอ เขาจะยังไว้ใจเราเหมือนเดิม", script: "ถ้าลูกค้าเก่าดูเจอ เขาจะยังไว้ใจเราเหมือนเดิม" },
  { id: "muted", script: "ดูแบบปิดเสียงแล้วยังเข้าใจ" },
];

export function ticksFor(format: string): { id: string; label: string }[] {
  if (format !== "post" && format !== "script") return [];
  return FINISH_TICKS.flatMap((t) => (t[format] ? [{ id: t.id, label: t[format]! }] : []));
}

/** the ticks as sent from a browser: the format's own ids, once each */
export function cleanTicks(v: unknown, format: string): string[] {
  const known = new Set(ticksFor(format).map((t) => t.id));
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && known.has(x)))] : [];
}

export interface FinishResult {
  id: FinishCheckId;
  label: string;
  ok: boolean;
  /** the words where it failed, cut short, so the agent knows where to look */
  where: string[];
}

const clip = (s: string, n = 40) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const arabic = (t: string) => t.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** a bullet, a number, a keycap: a line that starts one is a list item, a paragraph of its own */
const LIST_ITEM = /^\s*(?:[-•*▪✅✔👉]|\d+\s*[.)]|[๐-๙]+\s*[.)]|\d️?⃣)/u;

/** The text in the paragraphs a reader meets: split at blank lines, each list item its own. */
export function paragraphs(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    let prose: string[] = [];
    for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (!LIST_ITEM.test(line)) { prose.push(line); continue; }
      if (prose.length) out.push(prose.join("\n"));
      prose = [];
      out.push(line);
    }
    if (prose.length) out.push(prose.join("\n"));
  }
  return out;
}

const mobileLines = (p: string) => p.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(visibleLength(l) / MOBILE_LINE)), 0);

/** a paragraph's first words, past its bullet, number or emoji */
const opening = (p: string) => p.replace(/^[\s\-•*▪✅✔👉\d.)๐-๙⃣️\p{Extended_Pictographic}]+/u, "");

/** the hook without a script's time marker in front of it */
const bareHook = (out: ContentOutput) => (out.hooks[0] ?? "").replace(/^\s*\[[^\]]*\]\s*/, "").trim();

/** what the paragraph checks read: a post's paragraphs, or what is said in each stretch of a script */
function units(out: ContentOutput, format: FinishFormat): string[] {
  if (format === "script") return scenes(out.hooks[0] ?? "", out.body, out.closing).map((s) => s.say).filter(Boolean);
  return [...paragraphs(out.body), ...paragraphs(out.closing)];
}

const COUNT = /(\d+)\s*(?:ข้อ|เรื่อง|จุด|อย่าง|วิธี|เหตุผล|สิ่ง)/;
const COUNT_WORDS: Record<number, string[]> = {
  1: ["แรก", "หนึ่ง"], 2: ["สอง"], 3: ["สาม"], 4: ["สี่"], 5: ["ห้า"], 6: ["หก"], 7: ["เจ็ด"], 8: ["แปด"], 9: ["เก้า"], 10: ["สิบ"],
};

function listCount(out: ContentOutput): string[] {
  const m = COUNT.exec(arabic(bareHook(out)));
  const n = m ? Number(m[1]) : 0;
  if (n < 2 || n > 10) return [];
  const text = arabic(`${out.body}\n${out.closing}`);
  const missing: string[] = [];
  for (let k = 1; k <= n; k++) {
    const names = [String(k), ...COUNT_WORDS[k]].join("|");
    const item = new RegExp(`(?:^|\\n)\\s*(?:${k}\\s*[.)]|${k}\\uFE0F?\\u20E3)|ข้อ(?:ที่)?\\s*(?:${names})(?!\\d)`);
    if (!item.test(text)) missing.push(`ข้อ ${k}`);
  }
  return missing.length ? [`hook บอก ${n} ข้อ แต่ไม่พบ ${missing.join(", ")}`] : [];
}

function jargon(out: ContentOutput): string[] {
  const all = [bareHook(out), out.body, out.closing].join("\n");
  const where: string[] = [];
  for (const term of JARGON) {
    const m = new RegExp(`(?<![A-Za-z])${escape(term)}(?![A-Za-z])`, "i").exec(all);
    if (!m) continue;
    // "ผู้ป่วยใน (IPD)": the meaning came first, and the word is its bracket
    if (/\(\s*$/.test(all.slice(Math.max(0, m.index - 3), m.index))) continue;
    const after = all.slice(m.index + m[0].length, m.index + m[0].length + 30);
    if (/^\s*\(|คือ|หมายถึง|แปลว่า|หรือ/.test(after)) continue;
    where.push(m[0]);
  }
  return where;
}

function loopsOpen(out: ContentOutput): string[] {
  if (!out.loops?.length) return ["ไม่มีข้อมูลลูป ตรวจเองนะครับ"];
  const text = loopText(out);
  return out.loops.flatMap((l) => {
    const at = text.indexOf(l.open);
    const closed = at >= 0 && text.indexOf(l.close, at + l.open.length) >= 0;
    return closed ? [] : [`“${clip(l.open)}” ยังไม่ได้เฉลย`];
  });
}

const key = (n: number) => n.toFixed(2);
const SPAN = /(\d+)\s*[–-]\s*(\d+)/;

function numbersOnScreen(out: ContentOutput): string[] {
  return scenes(out.hooks[0] ?? "", out.body, out.closing).flatMap((s) => {
    const shown = new Set(claimedNumbers(s.screen.join(" ")).map(key));
    const unshown = claimedNumbers(s.say).filter((n) => !shown.has(key(n)));
    return unshown.length ? [`${s.time ?? "ต้นคลิป"}: ${clip(s.say)}`] : [];
  });
}

function cuts(out: ContentOutput): string[] {
  return scenes(out.hooks[0] ?? "", out.body, out.closing).flatMap((s) => {
    const m = s.time ? SPAN.exec(arabic(s.time)) : null;
    if (!m || Number(m[2]) - Number(m[1]) <= 7 || s.acts.length > 0) return [];
    return [`${s.time}: ${clip(s.say)}`];
  });
}

export function finishChecks(out: ContentOutput, format: FinishFormat): FinishResult[] {
  const hook = bareHook(out);
  const paras = units(out, format);
  const where: Record<FinishCheckId, () => string[]> = {
    "no-preamble": () => (PREAMBLE.some((p) => hook.startsWith(p)) ? [clip(hook)] : []),
    "hook-short": () => (visibleLength(hook) > FINISH_HOOK_MAX ? [`${visibleLength(hook)}/${FINISH_HOOK_MAX} ตัวอักษร`] : []),
    "para-lines": () => paras.filter((p) => mobileLines(p) > 4).map((p) => clip(p)),
    "run-lines": () => paras
      .flatMap((p) => p.split(/\s+/))
      .filter((r) => !r.startsWith("#") && !r.startsWith("http") && visibleLength(r) > MOBILE_LINE * 2)
      .map((r) => clip(r)),
    "lead-words": () => paras
      .filter((p) => WEAK_OPENERS.some((w) => opening(p).startsWith(w)))
      .map((p) => clip(p)),
    jargon: () => jargon(out),
    "list-count": () => listCount(out),
    "loops-closed": () => loopsOpen(out),
    "numbers-on-screen": () => numbersOnScreen(out),
    cuts: () => cuts(out),
  };
  return FINISH_AUTO
    .filter((c) => format === "script" || !c.script)
    .map((c) => {
      const found = where[c.id]();
      return { id: c.id, label: c.label, ok: found.length === 0, where: found };
    });
}

/** the card's word for the piece's formula, with the checks passed for สูตรอ่าน-ดูจนจบ; "" for none */
export function formulaBadge(out: ContentOutput, format: string): string {
  const f = outputFormula(out);
  if (!f) return "";
  if (f !== "finish" || (format !== "post" && format !== "script")) return FORMULA_SHORT[f];
  const r = finishChecks(out, format);
  return `${FORMULA_SHORT.finish} · ตรวจ ${r.filter((x) => x.ok).length}/${r.length}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/content/finish-check.test.ts tests/content/check.test.ts && npx tsc --noEmit`
Expected: PASS

ถ้าข้อไหนไม่ผ่าน ให้แก้โค้ดใน `finish-check.ts` **ไม่ใช่แก้เทสต์** ยกเว้นเทสต์ผิดจากสิ่งที่ spec บอกจริงๆ

- [ ] **Step 6: Calibrate `MOBILE_LINE`**

ใช้ข้อความโพสต์จริง 3 ย่อหน้าจากชิ้นงานที่มีอยู่ (เปิด `/studio/write` ดูชิ้นใดก็ได้ หรือโพสต์บนเพจ) นับบรรทัดที่เห็นบนมือถือจริง (หรือ Chrome DevTools ขนาด 390px ในหน้า FeedPreview) เทียบกับ `mobileLines()`
- ถ้าต่างเกิน 1 บรรทัด ให้ปรับ `MOBILE_LINE` และเทสต์ `Array(4).fill("ก".repeat(MOBILE_LINE))` ยังผ่านเพราะอ้างค่าคงที่
- เขียนผลการวัดสั้นๆ ไว้ในคอมเมนต์เหนือ `MOBILE_LINE` เช่น `measured 2026-10-01 in FeedPreview at 390px: 34–38`

- [ ] **Step 7: Commit**

```bash
git status -sb
git add src/lib/content/finish-check.ts src/lib/content/check.ts tests/content/finish-check.test.ts tests/content/check.test.ts
git commit -m "feat(studio): สูตรอ่าน-ดูจนจบ's checklist, read by the code from the words on screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: โหมดแบบประกัน — ตัววางแผนและตัวเขียน

**Files:**
- Modify: `src/lib/content/plan.ts` (import, `PiecePlan`, `planMessages`, `parsePlans`)
- Modify: `src/lib/content/prompt.ts` (import, `Ask`, `planLines`, `buildMessages`)
- Modify: `src/lib/content/write.ts` (`write()`)
- Modify: `src/app/studio/actions.ts` (`GenerateInput`, `generateContent`)
- Modify: `tests/content/pro.test.ts` (บรรทัด 26–27 และ 38–42)
- Test: `tests/content/finish-plan.test.ts`

**Interfaces:**
- Consumes: Task 1 `readShareWhy`, `SHARE_WHY`, `type ShareWhy` · Task 2 `formulaHookRules`, `formulaRules`, `markFormula`, `formulaOf`, `type Formula`
- Produces:
  - `PiecePlan { angle: string; hook: string; shareWhy?: ShareWhy }`
  - `planMessages(opts: { …; formula?: Formula | null })` แทน `pro?: boolean`
  - `Ask.formula?: Formula | null` แทน `Ask.pro`
  - `GenerateInput.formula?: Formula | null` (ยังรับ `pro?: boolean` จากหน้าที่เปิดค้าง)

- [ ] **Step 1: Write the failing test**

`tests/content/finish-plan.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FINISH_HOOK_RULES, FINISH_NAME, SHARE_WHY, finishRules } from "@/lib/content/finish";
import { parsePlans, planMessages } from "@/lib/content/plan";
import { buildMessages, type Ask } from "@/lib/content/prompt";
import { PRO_HOOK_RULES, PRO_NAME } from "@/lib/content/pro";

/** สูตรอ่าน-ดูจนจบ in a plan's round: the planner picks the reason to share, the writer reports its loops. */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
const { write } = await import("@/lib/content/write");

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const planOpts = { brief: "ข้อมูล", count: 1, angle: "", avoid: [], template: null };
const ask = (over: Partial<Ask> = {}): Ask => ({
  brief: "ข้อมูล", format: "post", angle: "", custom: "", length: null, plans: [{ angle: "มุม", hook: "หัว" }], ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("the planner", () => {
  it("gets the guide's hook rules and is asked for a reason to share", () => {
    const t = text(planMessages({ ...planOpts, formula: "finish" }));
    expect(t).toContain(FINISH_HOOK_RULES);
    expect(t).toContain('"shareWhy"');
    expect(t).not.toContain(PRO_HOOK_RULES);
  });

  it("is asked for no reason under สูตรโปร or no formula", () => {
    expect(text(planMessages({ ...planOpts, formula: "pro" }))).not.toContain('"shareWhy"');
    expect(text(planMessages(planOpts))).not.toContain(FINISH_NAME);
  });

  it("keeps a known reason from its reply and drops an unknown one", () => {
    const reply = JSON.stringify({ plans: [{ angle: "a", hook: "h", shareWhy: "insider" }, { angle: "b", hook: "i", shareWhy: "fear" }] });
    expect(parsePlans(reply, 2)).toEqual([{ angle: "a", hook: "h", shareWhy: "insider" }, { angle: "b", hook: "i" }]);
  });
});

describe("the writer", () => {
  it("is told the piece's reason to share and the guide's rules, and nothing of สูตรโปร", () => {
    const t = text(buildMessages(ask({ formula: "finish", plans: [{ angle: "มุม", hook: "หัว", shareWhy: "use" }] })));
    expect(t).toContain(finishRules("post"));
    expect(t).toContain(SHARE_WHY.use.say);
    expect(t).not.toContain(PRO_NAME);
  });

  it("marks each piece with its plan's reason and the loops it reported", async () => {
    const loops = [{ open: "เดี๋ยวบอกข้อที่พลาดบ่อย", close: "ข้อที่พลาดบ่อยคือค่าห้อง" }];
    ai.chat.mockResolvedValue({ text: JSON.stringify({ pieces: [{ body: "ข้อที่พลาดบ่อยคือค่าห้อง", loops, shareWhy: "voice" }] }), model: "m", costThb: 0.5, outputTokens: 10 });
    const round = await write(ask({ formula: "finish", plans: [{ angle: "มุม", hook: "เดี๋ยวบอกข้อที่พลาดบ่อย", shareWhy: "use" }] }));
    expect(round.pieces[0].output).toMatchObject({ formula: "finish", shareWhy: "use", loops });
  });

  it("marks a สูตรโปร piece as such, with nothing of the guides", async () => {
    ai.chat.mockResolvedValue({ text: JSON.stringify({ pieces: [{ body: "เนื้อ" }] }), model: "m", costThb: 0.5, outputTokens: 10 });
    const out = (await write(ask({ formula: "pro" }))).pieces[0].output;
    expect(out.formula).toBe("pro");
    expect(out.loops).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/finish-plan.test.ts`
Expected: FAIL — ตัววางแผนยังไม่มีกฎของสูตรใหม่ และชิ้นงานยังไม่มี `formula`

- [ ] **Step 3: Update `plan.ts`**

แทน import:

```ts
import { PRO_HOOK_RULES } from "./pro";
```

ด้วย:

```ts
import { readShareWhy, type ShareWhy } from "./finish";
import { formulaHookRules, type Formula } from "./formula";
```

แก้ `PiecePlan`:

```ts
export interface PiecePlan {
  /** one Thai sentence: the angle this piece takes, and who it talks to */
  angle: string;
  hook: string;
  /** สูตรอ่าน-ดูจนจบ: why a reader would pass this piece on (finish.ts); the writer writes to it */
  shareWhy?: ShareWhy;
}
```

ใน `planMessages` แทนสองบรรทัดนี้ใน type ของ opts:

```ts
  /** สูตรคอนเทนต์โปร: the hook is stacked (pro.ts) */
  pro?: boolean;
```

ด้วย:

```ts
  /** the writing formula: its hook rules (formula.ts) */
  formula?: Formula | null;
```

แทน `opts.pro ? PRO_HOOK_RULES : "",` ด้วย:

```ts
    formulaHookRules(opts.formula ?? null),
```

และแทน:

```ts
      'รูปแบบ: {"plans":[{"angle":"…","hook":"…"}]} ห้ามมีช่องอื่น',
```

ด้วย:

```ts
      opts.formula === "finish"
        ? 'รูปแบบ: {"plans":[{"angle":"…","hook":"…","shareWhy":"use"}]} ห้ามมีช่องอื่น'
        : 'รูปแบบ: {"plans":[{"angle":"…","hook":"…"}]} ห้ามมีช่องอื่น',
```

ใน `parsePlans` แทน `return [{ angle, hook }];` ด้วย:

```ts
    const shareWhy = readShareWhy(r.shareWhy);
    return [{ angle, hook, ...(shareWhy ? { shareWhy } : {}) }];
```

- [ ] **Step 4: Update `prompt.ts`**

แทน `import { proRules } from "./pro";` ด้วย:

```ts
import { SHARE_WHY } from "./finish";
import { formulaRules, type Formula } from "./formula";
```

ใน `interface Ask` แทน:

```ts
  /** สูตรคอนเทนต์โปร (pro.ts): posts and scripts, when the owner ticks it */
  pro?: boolean;
```

ด้วย:

```ts
  /** the writing formula the owner picked (formula.ts): posts and scripts */
  formula?: Formula | null;
```

แทน `planLines` ทั้งฟังก์ชันด้วย:

```ts
export function planLines(plans: PiecePlan[]): string {
  return [
    "แผนของแต่ละชิ้น:",
    ...plans.map((p, i) => [
      `ชิ้นที่ ${i + 1}\n  มุม: ${p.angle}\n  hook: ${p.hook}`,
      p.shareWhy ? `\n  เหตุผลที่คนจะแชร์: ${SHARE_WHY[p.shareWhy].say}` : "",
    ].join("")),
  ].join("\n");
}
```

ใน `buildMessages` แทน `a.pro ? proRules(a.format, a.length, a.loop) : ""` ด้วย:

```ts
formulaRules(a.formula ?? null, a.format, a.length, Boolean(a.loop))
```

- [ ] **Step 5: Update `write.ts`**

เพิ่ม import `import { markFormula } from "./formula";`

ใน `write()` แทน:

```ts
    return { output, model: r.model, costThb: r.costThb };
```

ด้วย:

```ts
    // the formula named on the piece; สูตรอ่าน-ดูจนจบ's reason is the planner's, its loops the writer's
    return { output: markFormula(output, ask.formula ?? null, r.text, p.shareWhy ?? null), model: r.model, costThb: r.costThb };
```

- [ ] **Step 6: Update `actions.ts`**

เพิ่ม import `import { formulaOf, type Formula } from "@/lib/content/formula";`

ใน `GenerateInput` แทน:

```ts
  /** สูตรคอนเทนต์โปร (posts and scripts; pro.ts) */
  pro?: boolean;
```

ด้วย:

```ts
  /** the writing formula (formula.ts); posts and scripts */
  formula?: Formula | null;
  /** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */
  pro?: boolean;
```

ใน `generateContent` แทน `const pro = input.format !== "ad" && input.pro === true;` ด้วย:

```ts
  const formula = formulaOf(input, input.format);
```

แทนสามบรรทัด:

```ts
      const planned = await plan({ brief: brief.text, count, angle: told, avoid, template, reader, goal, fact, loop, pro });
      const written = await write({ brief: brief.text, format: input.format, angle, custom, length, loop, pro, plans: planned.plans, reader, goal, fact }, { prefer: writeWith });
      const marked = (o: ContentOutput): ContentOutput => (pro ? { ...o, pro: true } : o);
```

ด้วย:

```ts
      const planned = await plan({ brief: brief.text, count, angle: told, avoid, template, reader, goal, fact, loop, formula });
      // the writer names the formula on each piece (markFormula), so nothing is added here
      const written = await write({ brief: brief.text, format: input.format, angle, custom, length, loop, formula, plans: planned.plans, reader, goal, fact }, { prefer: writeWith });
```

และแทน:

```ts
        output: marked(input.format === "script" ? { ...w.output, ...(fact ? { fact } : {}), ...(loop ? { loop: true } : {}) } : dressed(fact ? { ...w.output, fact } : w.output)),
```

ด้วย:

```ts
        output: input.format === "script" ? { ...w.output, ...(fact ? { fact } : {}), ...(loop ? { loop: true } : {}) } : dressed(fact ? { ...w.output, fact } : w.output),
```

`ContentOutput` ยังใช้ใน `saveContentEdits` อยู่ ไม่ต้องลบ import

- [ ] **Step 7: Update `tests/content/pro.test.ts`**

แทน `planMessages({ ...planOpts, pro: true })` ด้วย `planMessages({ ...planOpts, formula: "pro" })`
แทน `ask({ pro: true })` ด้วย `ask({ formula: "pro" })` และ `ask({ format: "script", length: "60", pro: true })` ด้วย `ask({ format: "script", length: "60", formula: "pro" })`

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/content/finish-plan.test.ts tests/content/pro.test.ts tests/content/plan.test.ts tests/content/write.test.ts tests/content/plan-actions.test.ts && npx tsc --noEmit`
Expected: PASS ทั้ง vitest และ tsc (`claimSystem(…, true)` ใน pro.test.ts ยังถูกชนิด เพราะ claim ยังรับ `pro: boolean` จนถึง Task 5)

- [ ] **Step 9: Commit**

```bash
git status -sb
git add src/lib/content/plan.ts src/lib/content/prompt.ts src/lib/content/write.ts src/app/studio/actions.ts tests/content/finish-plan.test.ts tests/content/pro.test.ts
git commit -m "feat(studio): a plan's round written to the chosen formula; สูตรอ่าน-ดูจนจบ's planner picks the reason to share

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: โหมดที่ไม่มีตัววางแผน — รีวิวเคลม หาทีม ความรู้ เขียนเอง

**Files:**
- Modify: `src/lib/content/claim.ts` (import บรรทัด 7, `claimSystem` บรรทัด ~286–336, `claimMessages`)
- Modify: `src/lib/content/recruit.ts` (import บรรทัด 8, `recruitSystem` บรรทัด 146–188, `recruitMessages`)
- Modify: `src/lib/content/knowledge.ts` (import บรรทัด 6, `knowledgeSystem` บรรทัด 121–152, `knowledgeMessages`)
- Modify: `src/lib/content/draft.ts` (import บรรทัด 7, `draftSystem` บรรทัด 58–94, `draftMessages`)
- Modify: `src/lib/content/one-call-run.ts`, `claim-run.ts`, `recruit-run.ts`, `knowledge-run.ts`, `draft-run.ts`
- Modify: `src/app/api/content-claim/route.ts` (บรรทัด ~92)
- Modify tests: `tests/content/pro.test.ts` (บรรทัด 66), `tests/content/knowledge.test.ts` (38, 46, 50), `tests/content/draft.test.ts` (24, 31, 32, 36), `tests/content/mode-checks.test.ts` (39, 45), `tests/content/one-call-run.test.ts` (21, 72–73)
- Test: `tests/content/finish-writers.test.ts`

**Interfaces:**
- Consumes: Task 2 `formulaRules`, `formulaOf`, `markFormula`, `type Formula` · Task 1 `FINISH_HOOK_RULES`, `FINISH_NAME`, `finishRules`
- Produces:
  - `claimSystem(format, length?, loop?, formula?: Formula | null)`, `claimMessages(…, formula?: Formula | null)`
  - `recruitSystem(format, length?, loop?, formula?: Formula | null)`, `recruitMessages(…, formula?: Formula | null)`
  - `knowledgeMessages(subject, piece, reader, format, length, loop, formula: Formula | null)`
  - `draftMessages(draft, piece, reader, format, length, loop, formula: Formula | null)`
  - `OneCallRound.formula: Formula | null` แทน `pro: boolean`
  - input ของทุกโหมด: `formula?: string | null` (ยังรับ `pro?: boolean`)

- [ ] **Step 1: Write the failing test**

`tests/content/finish-writers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { claimSystem } from "@/lib/content/claim";
import { draftMessages } from "@/lib/content/draft";
import { FINISH_HOOK_RULES, FINISH_NAME, finishRules } from "@/lib/content/finish";
import { knowledgeMessages, subjectOf } from "@/lib/content/knowledge";
import { PRO_HOOK_RULES, PRO_NAME } from "@/lib/content/pro";
import { LOOP_RULES } from "@/lib/content/prompt";
import { recruitSystem } from "@/lib/content/recruit";
import type { Formula } from "@/lib/content/formula";

/** The four writers with no planner write their own hook, so they take a formula's hook rules too. */

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const systems = (f: Formula | null) => [
  claimSystem("post", null, false, f),
  recruitSystem("post", null, false, f),
  text(knowledgeMessages(subjectOf("quote", "family", "")!, 0, "", "post", null, false, f)),
  text(draftMessages("ร่างของเจ้าของเพจ", 0, "", "post", null, false, f)),
];

describe("the one-call writers", () => {
  it("take the guides' hook and body rules, and are asked for the reason to share", () => {
    for (const s of systems("finish")) {
      expect(s).toContain(FINISH_HOOK_RULES);
      expect(s).toContain(finishRules("post", null, false, true));
      expect(s).not.toContain(PRO_NAME);
    }
  });

  it("take สูตรโปร's and nothing of the guides when สูตรโปร is picked", () => {
    for (const s of systems("pro")) {
      expect(s).toContain(PRO_HOOK_RULES);
      expect(s).not.toContain(FINISH_NAME);
    }
  });

  it("take neither with no formula", () => {
    for (const s of systems(null)) {
      expect(s).not.toContain(FINISH_NAME);
      expect(s).not.toContain(PRO_NAME);
    }
  });

  it("write an ad as before, whatever was picked", () => {
    expect(claimSystem("ad", null, false, "finish")).not.toContain(FINISH_NAME);
    expect(recruitSystem("ad", null, false, "finish")).not.toContain(FINISH_NAME);
    expect(text(draftMessages("ร่าง", 0, "", "ad", null, false, "finish"))).not.toContain(FINISH_NAME);
  });

  it("hand a looped clip's ending to the loop rules", () => {
    const s = claimSystem("script", "60", true, "finish");
    expect(s).toContain(LOOP_RULES);
    expect(s).toContain(finishRules("script", "60", true, true));
  });
});
```

ต่อท้าย `describe("a one-call round", …)` ใน `tests/content/one-call-run.test.ts`:

```ts
  it("marks a สูตรอ่าน-ดูจนจบ piece with the loops and the reason its writer reported", async () => {
    ai.chat.mockImplementation(async () => ({
      text: JSON.stringify({ loops: [{ open: "หัว", close: "เฉลย" }], shareWhy: "voice" }), model: "m", costThb: 0.5, outputTokens: 10,
    }));
    await oneCallRound({ ...base, count: 1, formula: "finish", yardstick: "", parse: () => piece("ปมนี้ เฉลย") });
    expect(store.saveContent.mock.calls[0][0].output).toMatchObject({ formula: "finish", shareWhy: "voice", loops: [{ open: "หัว", close: "เฉลย" }] });
  });
```

- [ ] **Step 2: Update the existing tests to the new parameter**

- `tests/content/one-call-run.test.ts`: บรรทัด 21 `loop: false, pro: false,` → `loop: false, formula: null,` · บรรทัด 72 `loop: true, pro: true,` → `loop: true, formula: "pro",` · บรรทัด 73 `toMatchObject({ loop: true, pro: true })` → `toMatchObject({ loop: true, formula: "pro" })`
- `tests/content/pro.test.ts` บรรทัด 66: `claimSystem("post", null, false, true), recruitSystem("post", null, false, true)` → `claimSystem("post", null, false, "pro"), recruitSystem("post", null, false, "pro")`
- `tests/content/knowledge.test.ts`: บรรทัด 38 และ 46 `false, false)` → `false, null)` · บรรทัด 50 `false, true)` → `false, "pro")`
- `tests/content/draft.test.ts` บรรทัด 24, 31, 32, 36 และ `tests/content/mode-checks.test.ts` บรรทัด 39, 45: `false, false)` → `false, null)`

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/content/finish-writers.test.ts tests/content/one-call-run.test.ts`
Expected: FAIL — ตัวเขียนยังได้ `"finish"` เป็นค่า truthy ของ `pro` จึงใส่กฎสูตรโปร และ runner ยังไม่มี `formula`

- [ ] **Step 4: Update the four writers**

ทั้งสี่ไฟล์ทำแบบเดียวกัน:

**`claim.ts`** — แทน `import { PRO_HOOK_RULES, proRules } from "./pro";` ด้วย `import { formulaRules, type Formula } from "./formula";`
แทน signature ของ `claimSystem` ส่วน `loop = false, pro = false` ด้วย `loop = false, formula: Formula | null = null` แล้วแทนสองบรรทัดท้าย:

```ts
    // สูตรคอนเทนต์โปร: this call writes the hook too, so it takes the hook's rules as well (pro.ts)
    ...(pro && format !== "ad" ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
```

ด้วย:

```ts
    // the writing formula: this call writes the hook too, so it takes the hook's rules as well (formula.ts)
    ...[formulaRules(formula, format, length, loop, true)].filter(Boolean),
```

ใน `claimMessages` แทน `loop = false, pro = false,` ด้วย `loop = false, formula: Formula | null = null,` และ `claimSystem(format, length, loop, pro)` ด้วย `claimSystem(format, length, loop, formula)`

**`recruit.ts`** — เหมือน claim ทุกจุด (import บรรทัด 8, `recruitSystem` บรรทัด 146 และ 185–186, `recruitMessages` บรรทัด 191 และ 194)

**`knowledge.ts`** — แทน import บรรทัด 6 เหมือนกัน · `knowledgeSystem(…, loop: boolean, pro: boolean)` → `loop: boolean, formula: Formula | null` · แทน `...(pro ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),` ด้วย `...[formulaRules(formula, format, length, loop, true)].filter(Boolean),` · `knowledgeMessages(…, loop: boolean, pro: boolean,)` → `loop: boolean, formula: Formula | null,` และส่ง `formula` ต่อให้ `knowledgeSystem`

**`draft.ts`** — แทน import บรรทัด 7 เหมือนกัน · `draftSystem(format, length, loop: boolean, pro: boolean)` → `formula: Formula | null` · แทน `...(pro && format !== "ad" ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),` ด้วย `...[formulaRules(formula, format, length, loop, true)].filter(Boolean),` · `draftMessages(…, loop: boolean, pro: boolean)` → `formula: Formula | null` และส่งต่อ

ตรวจว่าไม่มีการอ้าง `PRO_HOOK_RULES` / `proRules` ในสี่ไฟล์นี้เหลืออยู่: `grep -n "PRO_HOOK_RULES\|proRules\|\bpro\b" src/lib/content/{claim,recruit,knowledge,draft}.ts` ต้องไม่เจออะไร

- [ ] **Step 5: Update the runners**

**`one-call-run.ts`** — เพิ่ม `import { markFormula, type Formula } from "./formula";` · ใน `OneCallRound` แทน `pro: boolean;` ด้วย:

```ts
  /** the writing formula the round was picked with (formula.ts) */
  formula: Formula | null;
```

แทน:

```ts
          ...output, ...(r.loop ? { loop: true } : {}), ...(r.pro ? { pro: true } : {}),
```

ด้วย:

```ts
          ...markFormula(output, r.formula, reply.text), ...(r.loop ? { loop: true } : {}),
```

**`claim-run.ts`** — เพิ่ม `import { formulaOf, markFormula } from "./formula";` · ใน input interface แทน:

```ts
  /** สูตรคอนเทนต์โปร (posts and scripts; pro.ts) */
  pro?: boolean;
```

ด้วย:

```ts
  /** the writing formula (formula.ts); posts and scripts */
  formula?: string | null;
  /** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */
  pro?: boolean;
```

แทน `const pro = format !== "ad" && input.pro === true;` ด้วย `const formula = formulaOf(input, format);`
แทน `claimMessages(facts, a, reader, format, length, loop, pro)` ด้วย `claimMessages(facts, a, reader, format, length, loop, formula)`
แทน `output: { ...output, ...(loop ? { loop: true } : {}), ...(pro ? { pro: true } : {}), ...(logo && output.poster ? { poster: { ...output.poster, logo } } : {}) },` ด้วย:

```ts
        output: { ...markFormula(output, formula, r.text), ...(loop ? { loop: true } : {}), ...(logo && output.poster ? { poster: { ...output.poster, logo } } : {}) },
```

**`recruit-run.ts`** — เหมือน claim-run ทุกจุด (interface บรรทัด 38–39, บรรทัด 60, 76, 87)

**`knowledge-run.ts`** — เพิ่ม `import { formulaOf } from "./formula";` · interface: แทน `pro?: boolean;` ด้วย `formula?: string | null;` + `/** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */ pro?: boolean;` · แทน `const pro = input.pro === true;` ด้วย `const formula = formulaOf(input, format);` · ใน `oneCallRound({ … loop, pro, …` แทน `pro` ด้วย `formula` · `knowledgeMessages(subject, i, reader, format, length, loop, pro)` → `formula`

**`draft-run.ts`** — เหมือน knowledge-run (แทน `const pro = format !== "ad" && input.pro === true;` ด้วย `const formula = formulaOf(input, format);`)

**`src/app/api/content-claim/route.ts`** — แทน `loop: form.get("loop") === "on", pro: form.get("pro") === "on",` ด้วย:

```ts
      loop: form.get("loop") === "on", formula: String(form.get("formula") ?? ""), pro: form.get("pro") === "on",
```

ตรวจว่าไม่มี `pro` แบบเก่าเหลือ: `grep -rnw "pro" src/lib/content/*-run.ts src/lib/content/claim.ts src/lib/content/recruit.ts src/lib/content/knowledge.ts src/lib/content/draft.ts src/app/api/content-claim/route.ts` ต้องเหลือแค่บรรทัด `pro?: boolean;` ของ input แบบเก่า และ `pro: form.get("pro") === "on"` ใน route

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/content && npx tsc --noEmit`
Expected: PASS ทั้งโฟลเดอร์ (รวม claim-route, knowledge-route, draft-route, loop, pro)

- [ ] **Step 7: Commit**

```bash
git status -sb
git add src/lib/content src/app/api/content-claim/route.ts tests/content
git commit -m "feat(studio): รีวิวเคลม, หาทีม, ความรู้ and เขียนเอง written to the chosen formula

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ปุ่มเลือกสูตรในฟอร์มทั้งห้า

**Files:**
- Modify: `src/app/studio/ui/form-parts.tsx` (แทน `PRO_KEY` / `usePro` / `ProToggle` บรรทัด ~187–234)
- Modify: `src/app/studio/ContentStudio.tsx` (บรรทัด 41, 318, 582, 1061)
- Modify: `src/app/studio/claim/ClaimTools.tsx` (17, 74, 115, 166, 223)
- Modify: `src/app/studio/recruit/RecruitTools.tsx` (16, 69, 85, 127)
- Modify: `src/app/studio/knowledge/KnowledgeTools.tsx` (16, 67, 82, 132)
- Modify: `src/app/studio/draft/DraftTools.tsx` (14, 62, 77, 114)
- Test: `tests/content/form-parts.test.ts`

**Interfaces:**
- Consumes: Task 1 `FINISH_PRINCIPLES` · Task 2 `FORMULA_NAME`, `readFormula`, `type Formula` · `PRO_NAME`, `PRO_PRINCIPLES`
- Produces: `startingFormula(kept: string | null, legacyPro: string | null): Formula | null`, `useFormula(): [Formula | null, (f: Formula | null) => void]`, `FormulaPicker({ value, onChange })`

- [ ] **Step 1: Write the failing test**

ต่อท้าย `tests/content/form-parts.test.ts` (เพิ่ม `startingFormula` ใน import จาก `@/app/studio/ui/form-parts`):

```ts
describe("the formula the picker starts on", () => {
  it("is the last one picked in this browser, 'none' included", () => {
    expect(startingFormula("finish", null)).toBe("finish");
    expect(startingFormula("none", "on")).toBeNull();
  });

  it("is สูตรโปร where it was ticked before there were two, and none otherwise", () => {
    expect(startingFormula(null, "on")).toBe("pro");
    expect(startingFormula(null, "off")).toBeNull();
    expect(startingFormula(null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/form-parts.test.ts`
Expected: FAIL — `startingFormula is not a function`

- [ ] **Step 3: Replace the pro toggle in `form-parts.tsx`**

แก้ import บรรทัด 4:

```ts
import { PRO_NAME, PRO_PRINCIPLES } from "@/lib/content/pro";
import { FINISH_NAME, FINISH_PRINCIPLES } from "@/lib/content/finish";
import { FORMULA_NAME, readFormula, type Formula } from "@/lib/content/formula";
```

แทนตั้งแต่ `const PRO_KEY = "content-pro";` จนจบฟังก์ชัน `ProToggle` ด้วย:

```tsx
const PRO_KEY = "content-pro";
const FORMULA_KEY = "content-formula";

/**
 * The formula the picker starts on: the one last picked in this browser ("none" is a pick),
 * or สูตรคอนเทนต์โปร where its box was ticked before there were two to pick from (2026-10-01).
 */
export function startingFormula(kept: string | null, legacyPro: string | null): Formula | null {
  if (kept !== null) return readFormula(kept);
  return legacyPro === "on" ? "pro" : null;
}

/** the writing formula, remembered per browser like คลิปวนลูป; none until the owner picks one */
export function useFormula(): [Formula | null, (f: Formula | null) => void] {
  const [formula, setFormulaState] = useState<Formula | null>(null);
  useEffect(() => {
    try { setFormulaState(startingFormula(localStorage.getItem(FORMULA_KEY), localStorage.getItem(PRO_KEY))); } catch { /* storage unavailable */ }
  }, []);
  const setFormula = (f: Formula | null) => {
    setFormulaState(f);
    try { localStorage.setItem(FORMULA_KEY, f ?? "none"); } catch { /* not kept */ }
  };
  return [formula, setFormula];
}

const FORMULA_OPTIONS: { id: Formula | null; label: string; hint: string }[] = [
  { id: null, label: "ไม่ใช้สูตร", hint: "เขียนตามปกติ" },
  { id: "pro", label: `${PRO_NAME} (13 ข้อ)`, hint: "ประโยคเปิดซ้อน 3 ชั้น · ดึงคนกลับกลางเรื่อง · ชวนเซฟ · สคริปต์มี B-roll" },
  { id: "finish", label: FINISH_NAME, hint: "เปิดจากเรื่องที่คนรู้ครึ่งเดียว · ปมต้องเฉลยครบ · อ่านง่ายบนมือถือ · มีเช็กลิสต์ก่อนโพสต์" },
];

/**
 * The writing formula, one at a time (formula.ts): สูตรคอนเทนต์โปร (pro.ts) or สูตรอ่าน-ดูจนจบ
 * (finish.ts). A radio group rather than two boxes, because the two cannot be written together.
 */
export function FormulaPicker({ value, onChange }: { value: Formula | null; onChange: (f: Formula | null) => void }) {
  const [open, setOpen] = useState(false);
  const list = useId();
  const name = useId();
  const rules = value === "pro"
    ? PRO_PRINCIPLES.map((p) => ({ name: p.name, what: `${p.what}${p.ai ? "" : " (ทำเองหลังโพสต์ AI ทำแทนไม่ได้)"}` }))
    : value === "finish" ? FINISH_PRINCIPLES : [];
  return (
    <fieldset className={`rounded-lg border p-3 text-sm ${value ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)]"}`}>
      <legend className="px-1 font-medium">
        สูตรการเขียน <span className="font-normal text-[var(--ct-mute)]">(เลือกได้ทีละสูตร · ระบบจำไว้ให้)</span>
      </legend>
      <div className="space-y-0.5">
        {FORMULA_OPTIONS.map((o) => (
          <label key={o.id ?? "none"} className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1">
            <input type="radio" name={name} checked={value === o.id} onChange={() => { onChange(o.id); setOpen(false); }} className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="font-medium">{o.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {value && (
        <>
          <button
            type="button" aria-expanded={open} aria-controls={list} onClick={() => setOpen((o) => !o)}
            className="ml-7 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[var(--ct-accent)]"
          >
            <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /> ดูกฎของ{FORMULA_NAME[value]}
          </button>
          {open && (
            <ol id={list} className="ml-7 mt-1 list-decimal space-y-1.5 pl-4 text-xs">
              {rules.map((r) => (
                <li key={r.name}>
                  <span className="font-medium">{r.name}</span> <span className="text-[var(--ct-mute)]">— {r.what}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 4: Swap the toggle in the five forms**

ทุกฟอร์มทำสามอย่างเหมือนกัน:
1. ใน import จาก `./ui/form-parts` (หรือ `../ui/form-parts`) แทน `ProToggle` ด้วย `FormulaPicker` และ `usePro` ด้วย `useFormula`
2. แทน `const [pro, setPro] = usePro();` ด้วย `const [formula, setFormula] = useFormula();`
3. แทน JSX `<ProToggle value={pro} onChange={setPro} />` ด้วย `<FormulaPicker value={formula} onChange={setFormula} />` (เงื่อนไข `format !== "ad" &&` ข้างหน้าคงไว้ตามเดิม)

และแก้ค่าที่ส่งไปกับรอบ:
- `ContentStudio.tsx` บรรทัด 582: `pro: format !== "ad" && pro,` → `formula: format === "ad" ? null : formula,`
- `ClaimTools.tsx` บรรทัด 115: `pro: format !== "ad" && pro,` → `formula: format === "ad" ? null : formula,` · บรรทัด 166: `if (round.pro) form.set("pro", "on");` → `if (round.formula) form.set("formula", round.formula);`
- `RecruitTools.tsx` บรรทัด 85 และ `DraftTools.tsx` บรรทัด 77: `pro: format !== "ad" && pro,` → `formula: format === "ad" ? null : formula,`
- `KnowledgeTools.tsx` บรรทัด 82: `pro,` → `formula,`

ตรวจ: `grep -rn "usePro\|ProToggle" src/app/studio` ต้องไม่เจอ และ `grep -rnw "pro" src/app/studio` ต้องเหลือแค่ `item.output.pro` ใน PieceCard/ScriptCard (Task 7 จะแก้) กับ `pro?: boolean;` แบบเก่าใน `GenerateInput`

- [ ] **Step 5: Run tests, types and lint**

Run: `npx vitest run tests/content/form-parts.test.ts && npx tsc --noEmit && npx next lint --dir src/app/studio`
Expected: PASS ไม่มี error และไม่มี warning ใหม่

- [ ] **Step 6: Commit**

```bash
git status -sb
git add src/app/studio tests/content/form-parts.test.ts
git commit -m "feat(studio): pick one writing formula in every form — none, สูตรคอนเทนต์โปร or สูตรอ่าน-ดูจนจบ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ป้ายบนการ์ด การ์ดเช็กลิสต์ในหน้าแก้ และการบันทึกข้อที่ติ๊ก

**Files:**
- Create: `src/app/studio/FinishCard.tsx`
- Modify: `src/app/studio/actions.ts` (เพิ่ม `saveFinishTicks` ต่อจาก `saveContentEdits`)
- Modify: `src/app/studio/PieceEditor.tsx` (import และแทรกการ์ดก่อนบล็อก `{anything && (`)
- Modify: `src/app/studio/PieceCard.tsx` (บรรทัด ~94)
- Modify: `src/app/studio/ScriptCard.tsx` (บรรทัด 39)

**Interfaces:**
- Consumes: Task 3 `finishChecks`, `ticksFor`, `cleanTicks`, `formulaBadge`, `type FinishFormat` · Task 1 `SHARE_WHY` · Task 2 `outputFormula` · `getContent`, `saveOutputIf`, `EditResult`
- Produces: `saveFinishTicks(id: string, ticks: string[]): Promise<EditResult>` · `FinishCard({ item, output, format, onSaved })`

- [ ] **Step 1: Add the server action**

ใน `src/app/studio/actions.ts` เพิ่ม import `import { cleanTicks } from "@/lib/content/finish-check";` แล้วเพิ่มต่อจากฟังก์ชัน `saveContentEdits`:

```ts
/**
 * สูตรอ่าน-ดูจนจบ: the checklist items the agent ticked (finish-check.ts). A tick changes no
 * words, so the checks are not run again and a piece on the Page may still be ticked. Written
 * only over the piece as it was read, as an edit is (saveOutputIf); read again if it moved.
 */
export async function saveFinishTicks(id: string, ticks: string[]): Promise<EditResult> {
  await requireMember();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
      const output: ContentOutput = { ...item.output, finishTicks: cleanTicks(ticks, item.format) };
      const saved = await saveOutputIf(id, output, undefined, item.output.rev ?? null);
      if (saved) return { ok: true, item: saved };
    }
    return { ok: false, error: "ชิ้นนี้เพิ่งถูกแก้ระหว่างบันทึก ลองติ๊กอีกครั้งนะครับ" };
  } catch (e) {
    console.error("finish ticks save failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
```

- [ ] **Step 2: Write `FinishCard.tsx`**

`src/app/studio/FinishCard.tsx`:

```tsx
"use client";
import { useState } from "react";
import { SHARE_WHY } from "@/lib/content/finish";
import { finishChecks, ticksFor, type FinishFormat } from "@/lib/content/finish-check";
import type { ContentOutput } from "@/lib/content/output";
import type { ContentItem } from "@/lib/content/store";
import { saveFinishTicks } from "./actions";
import { AlertIcon, CheckIcon } from "./ui/editor-icons";

/**
 * สูตรอ่าน-ดูจนจบ's checklist, beside the other checks (finish-check.ts). The code's half is
 * read from `output` — the words on screen as they are typed, not the last save. The agent's
 * half is ticked here and kept with the piece. It warns and never blocks: the owner decides.
 */
export function FinishCard({ item, output, format, onSaved }: {
  item: ContentItem;
  output: ContentOutput;
  format: FinishFormat;
  onSaved: (item: ContentItem) => void;
}) {
  const results = finishChecks(output, format);
  const ticks = ticksFor(format);
  const [done, setDone] = useState<string[]>(item.output.finishTicks ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passed = results.filter((r) => r.ok).length;
  const ticked = ticks.filter((t) => done.includes(t.id)).length;
  const share = item.output.shareWhy ? SHARE_WHY[item.output.shareWhy].label : "ไม่ระบุ";

  async function toggle(id: string) {
    const before = done;
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    setSaving(true);
    setError(null);
    const res = await saveFinishTicks(item.id, next).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setDone(before);
      setError(res && !res.ok ? res.error : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
      return;
    }
    onSaved(res.item);
  }

  return (
    <section aria-label="เช็กลิสต์สูตรอ่าน-ดูจนจบ" className="mt-4 rounded-lg border border-[var(--ct-line)] p-3 text-sm">
      <p className="font-medium">เช็กลิสต์สูตรอ่าน-ดูจนจบ</p>
      <p className="mt-0.5 text-xs text-[var(--ct-mute)]">ตรวจอัตโนมัติผ่าน {passed}/{results.length} · ติ๊กแล้ว {ticked}/{ticks.length}</p>
      <ul className="mt-2 space-y-1.5">
        {results.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            {r.ok
              ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-[var(--ct-accent)]" />
              : <AlertIcon className="mt-0.5 size-4 shrink-0 text-[var(--ct-warn-ink)]" />}
            <span>
              <span className="sr-only">{r.ok ? "ผ่าน: " : "ยังไม่ผ่าน: "}</span>
              {r.label}
              {!r.ok && r.where.length > 0 && (
                <span className="mt-0.5 block text-xs text-[var(--ct-warn-ink)]">{r.where.join(" · ")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium text-[var(--ct-mute)]">ติ๊กเอง (ระบบตรวจแทนไม่ได้)</p>
      <ul className="mt-1">
        {ticks.map((t) => (
          <li key={t.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={done.includes(t.id)} disabled={saving} onChange={() => void toggle(t.id)} className="size-5 shrink-0" />
              <span>
                {t.label}
                {t.id === "share-reason" && <span className="text-[var(--ct-mute)]"> (ชิ้นนี้: {share})</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-[var(--ct-alert)]">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Put the card in the editor**

ใน `src/app/studio/PieceEditor.tsx` เพิ่ม import:

```ts
import { outputFormula } from "@/lib/content/formula";
import { FinishCard } from "./FinishCard";
```

แทรกก่อนบรรทัด `{anything && (` (ต่อจากบล็อก "คนเห็นก่อนกด “ดูเพิ่มเติม”"):

```tsx
      {outputFormula(item.output) === "finish" && (item.format === "post" || item.format === "script") && (
        <FinishCard key={item.id} item={item} output={output} format={item.format} onSaved={onSaved} />
      )}
```

(`output` คือ `outputOf(draft)` ที่ประกาศไว้แล้วในไฟล์ จึงเป็นข้อความที่กำลังแก้)

- [ ] **Step 4: Label the cards**

`src/app/studio/PieceCard.tsx` — เพิ่ม `import { formulaBadge } from "@/lib/content/finish-check";` แล้วแทน `{item.output.pro ? " · สูตรโปร" : ""}` ด้วย:

```tsx
{formulaBadge(item.output, item.format) ? ` · ${formulaBadge(item.output, item.format)}` : ""}
```

`src/app/studio/ScriptCard.tsx` — เพิ่ม import เดียวกัน แล้วแทน `item.output.pro && "สูตรโปร"` ในอาร์เรย์ ด้วย `formulaBadge(item.output, "script")`

- [ ] **Step 5: Run the whole check**

Run: `npx vitest run && npx tsc --noEmit && npx next lint`
Expected: PASS ทั้งหมด

- [ ] **Step 6: Commit**

```bash
git status -sb
git add src/app/studio/FinishCard.tsx src/app/studio/actions.ts src/app/studio/PieceEditor.tsx src/app/studio/PieceCard.tsx src/app/studio/ScriptCard.tsx
git commit -m "feat(studio): สูตรอ่าน-ดูจนจบ's checklist card in the editor, its ticks kept, and the formula on every card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ตรวจทั้งระบบ และทดลองจริงบนเบราว์เซอร์

**Files:** ไม่มีไฟล์ใหม่ อาจแก้ไฟล์จาก Task 1–7 ถ้าเจอปัญหา

- [ ] **Step 1: Full verify**

Run: `npm run verify`
Expected: tsc, lint, vitest และ `next build` ผ่านทั้งหมด

- [ ] **Step 2: Start the dev server and open Studio**

ใช้ `preview_start` กับ `{ name: "dev" }` แล้วไปที่ `/studio/write`
ถ้าต้องล็อกอิน ให้บอกผู้ใช้ให้ล็อกอินเองใน browser pane **ห้ามกรอกรหัสผ่านเอง**

- [ ] **Step 3: Try the three pieces from the spec**

รอบเหล่านี้เรียก AI จริงและเสียเงินจริงประมาณ ฿1–2 ต่อรอบ ตามที่ spec ระบุไว้ว่าต้องทดลอง
1. โหมดแบบประกัน · Life Protect · โพสต์ · เลือก "สูตรอ่าน-ดูจนจบ" · 1 ชิ้น
2. โหมดแบบประกัน · iHealthy Ultra · สคริปต์ 60 วิ · สูตรอ่าน-ดูจนจบ · 1 ชิ้น
3. โหมดเขียนเอง · โพสต์ · ร่างสั้นๆ 3–4 บรรทัด · สูตรอ่าน-ดูจนจบ · 1 ชิ้น

แต่ละชิ้นตรวจว่า:
- การ์ดในรายการขึ้น "สูตรอ่าน-ดูจนจบ · ตรวจ x/y"
- เปิดหน้าแก้แล้วเห็นการ์ดเช็กลิสต์ (`read_page` หา "เช็กลิสต์สูตรอ่าน-ดูจนจบ")
- ติ๊ก 1 ข้อแล้ว reload หน้า ข้อที่ติ๊กยังอยู่
- ลบประโยคเฉลยของลูปในช่องเนื้อหา (ยังไม่ต้องบันทึก) แล้วข้อ "ลูปปิดครบ" เปลี่ยนเป็นไม่ผ่าน จากนั้นกดยกเลิกหรือพิมพ์คืน
- `read_console_messages` ไม่มี error ใหม่

และตรวจเพิ่ม:
- เลือกสูตรโปร สร้าง 1 ชิ้น การ์ดขึ้น "สูตรโปร" และไม่มีการ์ดเช็กลิสต์
- เปิดชิ้นเก่าที่สร้างด้วยสูตรโปรก่อนหน้านี้ ป้ายยังเป็น "สูตรโปร"
- สลับตัวเลือกในฟอร์มแล้ว reload ตัวเลือกยังอยู่
- `resize_window` แบบ mobile แล้วดูว่าปุ่มเลือกสูตรและการ์ดเช็กลิสต์ไม่ล้นจอ จากนั้น `resize_window` กลับเป็น desktop

- [ ] **Step 4: Record the cost**

ดู `costThb` ของชิ้นที่สร้าง (ใน `/admin/ai` หรือจาก network response) เทียบกับชิ้นสูตรโปรในรอบเดียวกัน
ถ้าชิ้นสูตรใหม่แพงกว่าสูตรโปรเกิน 30% ให้แจ้งผู้ใช้ก่อนไปต่อ

- [ ] **Step 5: Screenshot as proof**

`computer { action: "screenshot" }` ของหน้าแก้ชิ้นงานที่เห็นการ์ดเช็กลิสต์ และส่งให้ผู้ใช้

- [ ] **Step 6: Commit any fixes**

ถ้าแก้อะไรใน Step 3–4 ให้ commit แยก แล้ววัดค่าใช้จ่ายใส่ใน commit message ของ commit สุดท้าย เช่น

```bash
git status -sb
git add -A src tests
git commit -m "fix(studio): <what the trial found>

Trial 2026-10-01: สูตรอ่าน-ดูจนจบ post ฿x.xx, script 60s ฿x.xx vs สูตรโปร post ฿x.xx.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

ถ้าไม่มีอะไรต้องแก้ ให้บอกผู้ใช้เรื่องค่าใช้จ่ายในข้อความแทน ไม่ต้องทำ commit ว่าง

- [ ] **Step 7: Hand off**

ใช้ skill `superpowers:finishing-a-development-branch` เพื่อตัดสินใจว่าจะ merge / เปิด PR ยังไง **ห้าม push ขึ้น main เอง** เพราะ main คือ production (Vercel)
