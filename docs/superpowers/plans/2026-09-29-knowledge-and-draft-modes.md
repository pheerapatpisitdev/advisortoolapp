# แท็บ "ความรู้" และ "เขียนเอง" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแท็บ "ความรู้" (ความเข้าใจผิด · บทความความรู้ · คำคม — ไม่ขาย) และ "เขียนเอง" (AI เกลาร่างของ agent 1–3 เวอร์ชัน) ใน Organic Studio

**Architecture:** ตามแบบแท็บหาทีม: โมดูลฝั่งเบราว์เซอร์ถือคลังหัวข้อ + prompt + parser (`knowledge.ts`, `draft.ts`), ตัววิ่งฝั่งเซิร์ฟเวอร์เรียก AI ชิ้นละครั้ง ผ่าน helper กลางตัวใหม่ `one-call-run.ts` (งบ/คำต้องห้าม/กฎ Facebook/โลโก้/บันทึก), action + route ต่อโหมด, ฟอร์มต่อโหมด. ชื่อโหมดจาก planHref รวมไว้ที่ `modes.ts`

**Tech Stack:** Next.js 15 (App Router, server actions + route handlers), TypeScript, Supabase (service role), vitest

**Spec:** `docs/superpowers/specs/2026-09-29-knowledge-and-draft-modes-design.md`

## Global Constraints

- แท็บความรู้ **ไม่ขาย**: ไม่เอ่ยชื่อแบบประกัน ชื่อบริษัท ราคา/เบี้ย ไม่ชวนซื้อ ปิดด้วยชวนเซฟ/ส่งต่อ; รูปแบบได้แค่ โพสต์ / สคริปต์
- ห้ามชวน "คอมเมนต์ว่า…" หรือแท็กเพื่อน (กฎ Facebook ลดการมองเห็น)
- คำคม: แต่งเองเท่านั้น ห้ามอ้างว่าเป็นคำพูดของคนดัง/บุคคลจริง
- แท็บความรู้: ไม้บรรทัดตัวเลข = `""` → ตัวเลขทุกตัวติดธง "ต้องตรวจ"
- เขียนเอง: ร่างไม่เกิน 2,000 ตัวอักษร เก็บใน `output.fact`; ห้าม AI เพิ่มข้อเท็จจริง/ตัวเลข/คำสัญญาที่ร่างไม่มี
- ข้อความท้ายโพสต์ความรู้ (ความเข้าใจผิด/บทความ): `"ข้อมูลนี้เพื่อความรู้ทั่วไป เงื่อนไขจริงขึ้นอยู่กับแต่ละกรมธรรม์"`; คำคม: `""` (บรรทัดผู้รับประกันยังต่อท้ายโดย `footer()` เหมือนทุกชิ้น — เจ้าของไม่ได้สั่งเปลี่ยน)
- เขียนเอง: ข้อความท้าย = `DISCLAIMER` เดิม
- planHref ใหม่: `"knowledge"` (ชื่อ "ความรู้"), `"draft"` (ชื่อ "เขียนเอง"); round โควตาใหม่ `"ai-knowledge"`, `"ai-draft"`
- ชิ้นต่อรอบ: 1–3 ทั้งสองแท็บ
- ป้ายแท็บ: "แบบประกัน · รีวิวเคลม · หาทีม · ความรู้ · เขียนเอง" เลื่อนแนวนอนได้เมื่อจอแคบ
- น้ำเสียงเป็นกลาง ห้าม "ครับ/ค่ะ/คะ" และ "ผม/ดิฉัน/ฉัน" (เหมือนทุกโหมด)

## Review Focus

1. **ร่างว่างหรือยาวเกิน** — ร่างที่มีแต่ช่องว่างต้องถูกปฏิเสธก่อนเรียก AI (ไม่เสียโควตา/งบ); ร่างยาวเกิน 2,000 ถูกตัด ไม่ใช่ error — ทดสอบใน Task 4
2. **หัวข้อ "พิมพ์เอง" ว่าง** — ความรู้ที่เลือก "พิมพ์เอง" แต่ไม่พิมพ์ ต้องได้ข้อความชัดเจน ไม่ใช่ 500 — ทดสอบใน Task 2
3. **ส่ง format "ad" มาที่แท็บความรู้** (เช่น จาก request ที่แต่งเอง) — ต้องถูกบังคับเป็นโพสต์ ไม่ใช่เขียนโฆษณาขายของ — ทดสอบใน Task 2
4. **AI ตอบไม่มี hook/body** — ชิ้นนั้นหายไป ชิ้นอื่นในรอบยังบันทึก; ทุกชิ้นพังได้ข้อความ "AI ตอบกลับมาไม่ครบ…" — ทดสอบใน Task 3
5. **ตัวเลขที่ AI เพิ่มในเขียนเอง** — ตัวเลขในร่างไม่ติดธง ตัวเลขใหม่ติดธง — ทดสอบใน Task 3 (helper) และ Task 4

---

### Task 1: ชื่อโหมดจาก planHref (`modes.ts`)

**Files:**
- Create: `src/lib/content/modes.ts`
- Modify: `src/app/studio/ContentStudio.tsx` (import + `nameOf` ~บรรทัด 535 + ตัวกรองรายการ ~บรรทัด 1256–1259)
- Modify: `src/app/studio/calendar/page.tsx:37`
- Test: `tests/content/modes.test.ts`

ทำเป็นงานแรกเพราะ Task 2 และ 4 จะเพิ่ม planHref ใหม่เข้าที่นี่ที่เดียว

**Interfaces:**
- Produces: `MODE_PLANS: { href: string; name: string }[]`, `modeName(href: string): string | null`, `registerMode` — ไม่มี; โหมดใหม่เพิ่มโดยแก้ array ใน Task 2/4

- [ ] **Step 1: เขียนเทสต์ที่ fail**

```ts
// tests/content/modes.test.ts
import { describe, expect, it } from "vitest";
import { MODE_PLANS, modeName } from "@/lib/content/modes";

describe("a piece's mode, from its plan_href", () => {
  it("names the modes that belong to no plan", () => {
    expect(modeName("claim-review")).toBe("รีวิวเคลม");
    expect(modeName("recruit")).toBe("หาทีม");
  });

  it("says nothing of a plan's own href", () => {
    expect(modeName("/lifeprotect")).toBeNull();
  });

  it("lists each mode once, for the list's filter", () => {
    const hrefs = MODE_PLANS.map((m) => m.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run tests/content/modes.test.ts`
Expected: FAIL — `Cannot find module '@/lib/content/modes'`

- [ ] **Step 3: เขียนโมดูล**

```ts
// src/lib/content/modes.ts
import { CLAIM_HREF, CLAIM_NAME } from "./claim";
import { RECRUIT_HREF, RECRUIT_NAME } from "./recruit";

/**
 * The rounds that belong to no plan, by the plan_href their pieces carry and the name the
 * workbench and the calendar show for them. One list, so a new mode is named everywhere at once.
 */
export const MODE_PLANS: { href: string; name: string }[] = [
  { href: CLAIM_HREF, name: CLAIM_NAME },
  { href: RECRUIT_HREF, name: RECRUIT_NAME },
];

export function modeName(href: string): string | null {
  return MODE_PLANS.find((m) => m.href === href)?.name ?? null;
}
```

- [ ] **Step 4: ใช้ใน ContentStudio และปฏิทิน**

ใน `ContentStudio.tsx` แทน:
```ts
  const nameOf = (h: string) => (h === CLAIM_HREF ? CLAIM_NAME : h === RECRUIT_HREF ? RECRUIT_NAME : products.find((p) => p.href === h)?.name ?? h);
```
ด้วย (อ่านบรรทัดจริงก่อน — ส่วนท้ายของ fallback ให้คงเดิม):
```ts
  const nameOf = (h: string) => modeName(h) ?? products.find((p) => p.href === h)?.name ?? h;
```
และตัวกรอง แทน 2 บรรทัด `<option value={CLAIM_HREF}>…</option>` / `<option value={RECRUIT_HREF}>…</option>` ด้วย:
```tsx
                {MODE_PLANS.map((m) => <option key={m.href} value={m.href}>{m.name}</option>)}
```
เพิ่ม `import { MODE_PLANS, modeName } from "@/lib/content/modes";` แล้วลบ import `CLAIM_HREF`/`RECRUIT_HREF` ถ้าไม่เหลือที่ใช้ (`CLAIM_NAME`/`RECRUIT_NAME` ยังใช้ที่แท็บ)

ใน `calendar/page.tsx:37` แทน
```ts
  const planName = item.planHref === CLAIM_HREF ? CLAIM_NAME : item.planHref === RECRUIT_HREF ? RECRUIT_NAME : contentProduct(item.planHref)?.name ?? item.planHref;
```
ด้วย
```ts
  const planName = modeName(item.planHref) ?? contentProduct(item.planHref)?.name ?? item.planHref;
```
และแก้ import ให้ตรง

- [ ] **Step 5: รันเทสต์ + typecheck**

Run: `npx vitest run tests/content/modes.test.ts && npx tsc --noEmit`
Expected: PASS, ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/modes.ts tests/content/modes.test.ts src/app/studio/ContentStudio.tsx src/app/studio/calendar/page.tsx
git commit -m "refactor(studio): one list of the modes that belong to no plan"
```

---

### Task 2: โมดูลแท็บความรู้ (`knowledge.ts`)

**Files:**
- Create: `src/lib/content/knowledge.ts`
- Modify: `src/lib/content/modes.ts` (เพิ่ม knowledge)
- Test: `tests/content/knowledge.test.ts`

**Interfaces:**
- Consumes: `LOOP_RULES`, `steerLines`, `Format`, `Length` จาก `./prompt`; `PRO_HOOK_RULES`, `proRules` จาก `./pro`; `POLICY_RULES_TH` จาก `./policy`; `clip`, `MAX_CHARS`, `parsePoster`, `THEME_MOOD`, `THEMES`, `PosterBlock`, `PosterSpec` จาก `./poster`; `parseJsonReply` จาก `@/lib/ai/client`
- Produces:
  - `KNOWLEDGE_HREF = "knowledge"`, `KNOWLEDGE_NAME = "ความรู้"`
  - `type KnowledgeKind = "myth" | "article" | "quote"`, `KNOWLEDGE_KINDS: { id: KnowledgeKind; label: string }[]`
  - `KNOWLEDGE_SUBJECTS: Record<KnowledgeKind, { id: string; label: string }[]>`
  - `interface KnowledgeSubject { kind: KnowledgeKind; id: string; label: string }`
  - `subjectOf(kind: string, id: string, custom: string): KnowledgeSubject | null`
  - `knowledgeFormat(format: unknown): "post" | "script"`
  - `MAX_KNOWLEDGE_CUSTOM = 120`, `MAX_KNOWLEDGE_PIECES = 3`
  - `knowledgeMessages(subject: KnowledgeSubject, piece: number, reader: string, format: "post" | "script", length: Length | null, loop: boolean, pro: boolean): ChatMessage[]`
  - `parseKnowledgePiece(reply: string, subject: KnowledgeSubject, format: "post" | "script"): ContentOutput | null`
  - `KNOWLEDGE_DISCLAIMER`

- [ ] **Step 1: เขียนเทสต์ที่ fail**

```ts
// tests/content/knowledge.test.ts
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_DISCLAIMER, KNOWLEDGE_SUBJECTS, knowledgeFormat, knowledgeMessages, parseKnowledgePiece, subjectOf,
} from "@/lib/content/knowledge";
import { modeName } from "@/lib/content/modes";
import { PRO_HOOK_RULES } from "@/lib/content/pro";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const myth = subjectOf("myth", KNOWLEDGE_SUBJECTS.myth[0].id, "")!;
const quote = subjectOf("quote", KNOWLEDGE_SUBJECTS.quote[0].id, "")!;

describe("what a knowledge piece is about", () => {
  it("has a bank for each kind, quotes in the owner's four themes", () => {
    expect(KNOWLEDGE_SUBJECTS.myth.length).toBeGreaterThanOrEqual(8);
    expect(KNOWLEDGE_SUBJECTS.article.length).toBeGreaterThanOrEqual(8);
    expect(KNOWLEDGE_SUBJECTS.quote.map((q) => q.label)).toEqual(["วางแผนการเงิน/เก็บเงิน", "ครอบครัว/คนที่รัก", "สุขภาพ/ใช้ชีวิต", "กำลังใจทั่วไป"]);
  });

  it("takes the owner's own words, and refuses nothing typed", () => {
    expect(subjectOf("article", "custom", "  ประกันกับการผ่อนบ้าน  ")).toEqual({ kind: "article", id: "custom", label: "ประกันกับการผ่อนบ้าน" });
    expect(subjectOf("article", "custom", "   ")).toBeNull();
    expect(subjectOf("myth", "nope", "")).toBeNull();
    expect(subjectOf("ad", KNOWLEDGE_SUBJECTS.myth[0].id, "")).toBeNull();
  });

  it("is written as a post or a script, never an ad", () => {
    expect(knowledgeFormat("ad")).toBe("post");
    expect(knowledgeFormat("script")).toBe("script");
  });

  it("is named ความรู้ wherever pieces are listed", () => {
    expect(modeName("knowledge")).toBe("ความรู้");
  });
});

describe("the knowledge writer's brief", () => {
  it("sells nothing, and asks only for a save or a share", () => {
    const brief = text(knowledgeMessages(myth, 0, "", "post", null, false, false));
    expect(brief).toContain("ห้ามเอ่ยชื่อแบบประกัน");
    expect(brief).toContain("เซฟ");
    expect(brief).toContain("ห้ามชวนคอมเมนต์คำเฉพาะ");
    expect(brief).toContain(myth.label);
  });

  it("never puts a quote in a real person's mouth", () => {
    expect(text(knowledgeMessages(quote, 0, "", "post", null, false, false))).toContain("ห้ามอ้างว่าเป็นคำพูดของคนดัง");
  });

  it("takes สูตรคอนเทนต์โปร and คลิปวนลูป as the other writers do", () => {
    expect(text(knowledgeMessages(myth, 0, "", "post", null, false, true))).toContain(PRO_HOOK_RULES);
    expect(text(knowledgeMessages(myth, 0, "", "script", "60", true, false))).toContain("คลิปวนลูป");
  });

  it("opens each piece of a round differently", () => {
    expect(text(knowledgeMessages(myth, 0, "", "post", null, false, false))).not.toEqual(text(knowledgeMessages(myth, 1, "", "post", null, false, false)));
  });
});

describe("a knowledge piece from the writer's reply", () => {
  const reply = JSON.stringify({ hook: "หัว", body: "เนื้อ", closing: "เซฟไว้", hashtags: ["ประกัน"], imagePrompt: "x", poster: { theme: "navy", headline: "หัวบนภาพ" } });

  it("carries the general disclaimer, no story to check numbers against, and a poster", () => {
    const o = parseKnowledgePiece(reply, myth, "post")!;
    expect(o.disclaimer).toBe(KNOWLEDGE_DISCLAIMER);
    expect(o.fact).toBeUndefined();
    expect(o.hashtags).toEqual(["#ประกัน"]);
    expect(o.poster?.blocks.find((b) => b.kind === "headline")?.text).toBe("หัวบนภาพ");
  });

  it("puts a quote big in the middle, with no disclaimer of its own", () => {
    const o = parseKnowledgePiece(reply, quote, "post")!;
    expect(o.disclaimer).toBe("");
    expect(o.poster?.layout).toBe("center");
  });

  it("has no poster for a script, and nothing without a hook or a body", () => {
    expect(parseKnowledgePiece(reply, myth, "script")?.poster).toBeUndefined();
    expect(parseKnowledgePiece(JSON.stringify({ body: "เนื้อ" }), myth, "post")).toBeNull();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run tests/content/knowledge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: เขียนโมดูล**

```ts
// src/lib/content/knowledge.ts
import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/client";
import type { ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Length } from "./prompt";
import { PRO_HOOK_RULES, proRules } from "./pro";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * ความรู้ (owner, 2026-09-29): pieces that make a Page known and trusted and sell nothing —
 * a myth put right, a plain article, a quote. See
 * docs/superpowers/specs/2026-09-29-knowledge-and-draft-modes-design.md.
 *
 * One call per piece, no planner, as หาทีม. The writer may use general knowledge (the owner's
 * choice), so there is no brief to check figures against: every number in a knowledge piece is
 * flagged for the owner to confirm (knowledge-run.ts checks against ""). Browser-safe.
 */

export const KNOWLEDGE_HREF = "knowledge";
export const KNOWLEDGE_NAME = "ความรู้";

export type KnowledgeKind = "myth" | "article" | "quote";
export const KNOWLEDGE_KINDS: { id: KnowledgeKind; label: string }[] = [
  { id: "myth", label: "ความเข้าใจผิด" },
  { id: "article", label: "บทความความรู้" },
  { id: "quote", label: "คำคม/บทความดีๆ" },
];

export const KNOWLEDGE_SUBJECTS: Record<KnowledgeKind, { id: string; label: string }[]> = {
  myth: [
    { id: "group", label: "มีประกันกลุ่มของบริษัทแล้ว ไม่ต้องทำเพิ่ม" },
    { id: "young", label: "ยังหนุ่มสาว สุขภาพดี ยังไม่ต้องรีบทำ" },
    { id: "later", label: "รอแก่ก่อนค่อยทำ ก็ทันเหมือนกัน" },
    { id: "noclaim", label: "เคลมยาก บริษัทไม่ยอมจ่ายจริง" },
    { id: "savings", label: "มีเงินเก็บพอแล้ว ไม่ต้องมีประกัน" },
    { id: "death", label: "ประกันชีวิตมีไว้สำหรับตอนเสียชีวิตเท่านั้น" },
    { id: "lump", label: "ประกันสุขภาพแบบเหมาจ่ายคุ้มครองทุกอย่าง" },
    { id: "preexist", label: "โรคที่เป็นอยู่แล้ว ทำประกันแล้วก็เคลมได้" },
    { id: "fixed", label: "ทำประกันแล้ว เบี้ยจะไม่ขึ้นอีกเลย" },
    { id: "tax", label: "ซื้อประกันลดหย่อนภาษีได้ไม่จำกัด" },
  ],
  article: [
    { id: "lumpvsitem", label: "ประกันสุขภาพแบบเหมาจ่าย กับแบบแยกค่าใช้จ่าย ต่างกันอย่างไร" },
    { id: "waiting", label: "ระยะรอคอยคืออะไร ทำไมต้องรู้ก่อนเคลม" },
    { id: "opdipd", label: "OPD กับ IPD คืออะไร เลือกแบบไหนดี" },
    { id: "daily", label: "ค่าชดเชยรายวันคืออะไร ช่วยอะไรได้บ้าง" },
    { id: "copay", label: "Co-payment และ Deductible คืออะไร" },
    { id: "taxdeduct", label: "ลดหย่อนภาษีจากประกัน ทำได้อย่างไร" },
    { id: "ci", label: "ประกันโรคร้ายแรง จ่ายเงินตอนไหน" },
    { id: "surrender", label: "มูลค่าเวนคืนกรมธรรม์คืออะไร" },
    { id: "sumassured", label: "ทุนประกันชีวิตควรมีเท่าไหร่ คิดอย่างไร" },
    { id: "claimdocs", label: "เตรียมเอกสารเคลมอย่างไร ให้ได้เงินเร็ว" },
  ],
  quote: [
    { id: "money", label: "วางแผนการเงิน/เก็บเงิน" },
    { id: "family", label: "ครอบครัว/คนที่รัก" },
    { id: "health", label: "สุขภาพ/ใช้ชีวิต" },
    { id: "cheer", label: "กำลังใจทั่วไป" },
  ],
};

export const MAX_KNOWLEDGE_CUSTOM = 120;
export const MAX_KNOWLEDGE_PIECES = 3;

export interface KnowledgeSubject {
  kind: KnowledgeKind;
  id: string;
  label: string;
}

const isKind = (v: string): v is KnowledgeKind => v === "myth" || v === "article" || v === "quote";

/** The picked subject, or the owner's own words as one; null when there is nothing to write about. */
export function subjectOf(kind: string, id: string, custom: string): KnowledgeSubject | null {
  if (!isKind(kind)) return null;
  if (id === "custom") {
    const own = custom.trim().slice(0, MAX_KNOWLEDGE_CUSTOM);
    return own ? { kind, id: "custom", label: own } : null;
  }
  const s = KNOWLEDGE_SUBJECTS[kind].find((x) => x.id === id);
  return s ? { kind, ...s } : null;
}

/** A knowledge piece sells nothing, so it is never an ad. */
export const knowledgeFormat = (format: unknown): "post" | "script" => (format === "script" ? "script" : "post");

const WRITE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. คอนเทนต์นี้ไม่ขาย: ห้ามเอ่ยชื่อแบบประกัน ชื่อบริษัทประกัน ราคาหรือเบี้ย และห้ามชวนซื้อหรือชวนทักแชทเพื่อซื้อ",
  "2. ใช้ความรู้ทั่วไปได้ แต่ห้ามอ้างว่าบริษัทหรือกรมธรรม์ไหนให้หรือไม่ให้อะไร เรื่องที่ต่างกันในแต่ละกรมธรรม์ให้บอกว่า “ขึ้นกับเงื่อนไขของกรมธรรม์” ใส่ตัวเลขเฉพาะที่เป็นความรู้สาธารณะและจำเป็น (เช่น เพดานลดหย่อนภาษี) และบอกว่าเป็นของปีไหน ห้ามแต่งตัวเลข",
  "3. ห้ามคำเกินจริง เช่น การันตี ดีที่สุด ไม่มีความเสี่ยง ได้เงินคืนแน่นอน และห้ามขายด้วยความกลัว",
  "4. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "5. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
  "6. ปิดท้ายด้วยการชวนเซฟเก็บไว้ หรือส่งต่อให้คนที่ควรรู้ ห้ามชวนคอมเมนต์คำเฉพาะ และห้ามชวนแท็กเพื่อน (Facebook ลดการมองเห็น)",
  "",
  POLICY_RULES_TH,
].join("\n");

const KIND_TASK: Record<KnowledgeKind, string> = {
  myth: "แบบ: แก้ความเข้าใจผิด — บอกความเชื่อ → ทำไมคนถึงเชื่อ → ความจริงคืออะไร → ควรทำอย่างไร เล่าเป็นมิตร ไม่ตำหนิคนอ่าน",
  article: "แบบ: บทความความรู้ — อธิบายให้คนทั่วไปเข้าใจในครั้งเดียว ใช้ตัวอย่างในชีวิตประจำวัน แบ่งเป็นข้อสั้นๆ ได้ จบด้วยสิ่งที่คนอ่านเอาไปใช้ได้",
  quote: "แบบ: คำคม/บทความดีๆ — แต่งคำคมใหม่ 1 ประโยคที่คนอยากเซฟเก็บไว้ แล้วเล่าต่อสั้นๆ ว่าทำไมถึงจริง แต่งเองเท่านั้น ห้ามอ้างว่าเป็นคำพูดของคนดังหรือบุคคลจริง ห้ามใส่ชื่อคนหลังคำคม",
};

const OPENERS = [
  "เปิดด้วยคำถามที่คนอ่านต้องหยุดคิด",
  "เปิดด้วยภาพหรือสถานการณ์ในชีวิตประจำวัน",
  "เปิดด้วยประโยคที่สวนความเชื่อหรือทำให้แปลกใจ",
];

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ อบอุ่น ห้ามมีตัวหนังสือ ห้ามภาพเงินสด",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว (คำคม: ใส่ตัวคำคมเลย ไม่เกิน 80 ตัวอักษร)",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร ชวนเซฟ (คำคม: เว้นว่างได้)",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

function knowledgeSystem(kind: KnowledgeKind, format: "post" | "script", length: Length | null, loop: boolean, pro: boolean): string {
  const task = format === "post"
    ? [
        "งาน: โพสต์เฟซบุ๊ก",
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
        "- hook: ประโยคเปิด 1 บรรทัด หยุดนิ้วคนเลื่อนฟีด",
        kind === "quote" ? "- body: 2–5 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่" : "- body: 6–14 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
        "- closing: 1 บรรทัด ชวนเซฟหรือส่งต่อ",
        "- hashtags: 3–6 แท็ก",
        ...POSTER_LINES,
      ]
    : [
        `งาน: สคริปต์พูดหน้ากล้อง ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
        "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] ต้องหยุดคนดูให้ได้",
        "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ท่าทางในวงเล็บ และข้อความขึ้นจอเป็น {จอ: …} เฉพาะจุดสำคัญ ใช้ \\n ขึ้นบรรทัดใหม่",
        "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม ชวนเซฟหรือส่งต่อ",
        "- hashtags: 3–6 แท็ก สำหรับแคปชันใต้คลิป",
      ];
  return [
    "คุณคือนักเขียนคอนเทนต์ความรู้เรื่องประกันและการใช้ชีวิต ให้เพจของตัวแทนประกันชีวิตในประเทศไทย ภาษาไทยแบบที่คนทั่วไปพูดกัน อ่านง่ายบนมือถือ อบอุ่น จริงใจ",
    "",
    WRITE_RULES,
    "",
    KIND_TASK[kind],
    ...task,
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...(pro ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
  ].join("\n");
}

export function knowledgeMessages(
  subject: KnowledgeSubject, piece: number, reader: string, format: "post" | "script", length: Length | null, loop: boolean, pro: boolean,
): ChatMessage[] {
  const about = subject.kind === "quote" ? `แนวคำคม: ${subject.label}` : `หัวข้อ: ${subject.label}`;
  return [
    { role: "system", content: knowledgeSystem(subject.kind, format, length, loop, pro) },
    { role: "user", content: [about, OPENERS[piece % OPENERS.length], steerLines({ reader: reader.trim() })].filter(Boolean).join("\n\n") },
  ];
}

export const KNOWLEDGE_DISCLAIMER = "ข้อมูลนี้เพื่อความรู้ทั่วไป เงื่อนไขจริงขึ้นอยู่กับแต่ละกรมธรรม์";
const BADGE: Record<KnowledgeKind, string> = { myth: "ความเข้าใจผิด", article: "รู้ไว้ใช่ว่า", quote: "" };
const FOOTER = "เซฟเก็บไว้ได้เลย";

function knowledgePoster(raw: unknown, hook: string, kind: KnowledgeKind): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    ...(BADGE[kind] ? [{ kind: "badge" as const, text: BADGE[kind] }] : []),
    { kind: "headline", text: headline },
    ...(kind === "quote" ? (footer ? [{ kind: "footer" as const, text: footer }] : []) : [{ kind: "footer" as const, text: footer || FOOTER }]),
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: kind === "quote" ? "center" : "bottom", theme, blocks })!;
}

/** One knowledge piece from a reply, or null when the reply has no hook or body. */
export function parseKnowledgePiece(reply: string, subject: KnowledgeSubject, format: "post" | "script"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  const kindLabel = KNOWLEDGE_KINDS.find((k) => k.id === subject.kind)!.label;
  return {
    hooks: [hook],
    angle: `${KNOWLEDGE_NAME} · ${kindLabel} · ${subject.label}`,
    body,
    closing: text(raw.closing),
    hashtags: [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: subject.kind === "quote" ? "" : KNOWLEDGE_DISCLAIMER,
    ...(format === "script" ? {} : { poster: knowledgePoster(raw.poster, hook, subject.kind) }),
  };
}
```

ใน `modes.ts` เพิ่ม import และสมาชิก:
```ts
import { KNOWLEDGE_HREF, KNOWLEDGE_NAME } from "./knowledge";
// …
  { href: KNOWLEDGE_HREF, name: KNOWLEDGE_NAME },
```

- [ ] **Step 4: รันเทสต์**

Run: `npx vitest run tests/content/knowledge.test.ts tests/content/modes.test.ts`
Expected: PASS ทั้งหมด (ถ้า `parsePoster` ปฏิเสธเพราะ headline คำคมยาวเกิน `MAX_CHARS.headline` — `clip` ตัดให้แล้ว ไม่ควรเกิด)

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/knowledge.ts src/lib/content/modes.ts tests/content/knowledge.test.ts
git commit -m "feat(studio): the ความรู้ writer's subjects, brief and reply"
```

---

### Task 3: ตัววิ่งรอบแบบเรียก AI ชิ้นละครั้ง (`one-call-run.ts`) + รอบความรู้

**Files:**
- Create: `src/lib/content/one-call-run.ts`
- Create: `src/lib/content/knowledge-run.ts`
- Modify: `src/lib/auth/quota.ts:24` (เพิ่ม `"ai-knowledge"`, `"ai-draft"` ใน `AI_ROUNDS`)
- Modify: `src/app/studio/actions.ts` (เพิ่ม `generateKnowledge` ใต้ `generateRecruit`)
- Create: `src/app/api/content-knowledge/route.ts`
- Modify: `src/app/studio/draw.ts` (เพิ่ม `knowledgeRound`)
- Test: `tests/content/one-call-run.test.ts`, `tests/content/knowledge-route.test.ts`

**Interfaces:**
- Consumes: Task 2 ทั้งหมด; `chat`, `BudgetExceeded` (`@/lib/ai/client`); `findWords`, `strayNumbers` (`./check`); `checkPolicy` (`./policy`); `posterText` (`./poster`); `OVERHEAD_THB`, `writerOf` (`./models`); `contentCap`, `contentSpentThisMonth`, `holdContentBudget`, `listWords`, `releaseContentBudget`, `saveContent`, `ContentItem` (`./store`); `fallbackWriters`, `UnreadableReply` (`./write`); `ownerWording` (`./wording`); `roundLogo` (`./logo-store`); `isLogoSpot` (`./logo`); `takeRound` (`@/lib/auth/quota`)
- Produces:
  - `oneCallRound(opts: OneCallRound): Promise<GenerateResult>` โดย
    ```ts
    interface OneCallRound {
      href: string;               // plan_href of every piece
      format: Format;
      length: Length | null;
      count: number;
      writer?: string;            // WRITERS id or AUTO
      messages: (piece: number) => ChatMessage[];
      parse: (reply: string, piece: number) => ContentOutput | null;
      yardstick: string;          // where a figure may come from; "" flags every figure
      loop: boolean; pro: boolean;
      logoSpot?: string; page?: string;
      label: string;              // for the server log
    }
    ```
  - `KnowledgeWriteInput { kind: string; subject: string; custom?: string; reader?: string; format?: string; length?: string; loop?: boolean; pro?: boolean; logoSpot?: string; page?: string; count: number; writer?: string }`
  - `writeKnowledge(input: KnowledgeWriteInput): Promise<GenerateResult>`
  - `generateKnowledge(input: KnowledgeWriteInput): Promise<GenerateResult>` (action)
  - `knowledgeRound(input: KnowledgeWriteInput): Promise<GenerateResult>` (client)

- [ ] **Step 1: เขียนเทสต์ helper ที่ fail**

```ts
// tests/content/one-call-run.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentOutput } from "@/lib/content/output";

/** A round of one call per piece: numbers checked against its yardstick, broken replies dropped, the budget held and released. */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
const store = vi.hoisted(() => ({
  contentCap: vi.fn(async () => 30), contentSpentThisMonth: vi.fn(async () => 0),
  holdContentBudget: vi.fn(async () => ({ ok: true, id: "h1" })), releaseContentBudget: vi.fn(async () => undefined),
  listWords: vi.fn(async () => []), saveContent: vi.fn(async (row: { output: ContentOutput; flags: unknown }) => ({ id: "c", ...row })),
}));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/logo-store", () => ({ roundLogo: vi.fn(async () => null) }));

const { oneCallRound } = await import("@/lib/content/one-call-run");

const piece = (body: string): ContentOutput => ({ hooks: ["หัว"], body, closing: "", hashtags: [], imagePrompt: "", disclaimer: "" });
const base = {
  href: "draft", format: "post" as const, length: null, count: 2, messages: () => [{ role: "user" as const, content: "x" }],
  loop: false, pro: false, label: "test",
};

beforeEach(() => {
  vi.clearAllMocks();
  ai.chat.mockImplementation(async () => ({ text: "reply", model: "m", costThb: 0.5, outputTokens: 10 }));
});

describe("a one-call round", () => {
  it("flags a figure that is not in the yardstick, and not one that is", async () => {
    const r = await oneCallRound({ ...base, count: 1, yardstick: "ร่างมีเลข 500,000 บาท", parse: () => piece("ทุน 500,000 บาท เบี้ย 1,234 บาท") });
    expect(r.ok).toBe(true);
    const flags = store.saveContent.mock.calls[0][0].flags as { numbers: string[] };
    expect(flags.numbers.join(" ")).toContain("1,234");
    expect(flags.numbers.join(" ")).not.toContain("500,000");
  });

  it("flags every figure when the yardstick is empty", async () => {
    await oneCallRound({ ...base, count: 1, yardstick: "", parse: () => piece("ลดหย่อนได้ 100,000 บาท") });
    expect((store.saveContent.mock.calls[0][0].flags as { numbers: string[] }).numbers.length).toBeGreaterThan(0);
  });

  it("saves the pieces that came back and drops a broken one", async () => {
    const r = await oneCallRound({ ...base, yardstick: "", parse: (_reply, i) => (i === 0 ? piece("ดี") : null) });
    expect(r).toMatchObject({ ok: true, missing: 1 });
    expect(store.saveContent).toHaveBeenCalledTimes(1);
  });

  it("says the reply was incomplete when every piece broke, and gives the budget back", async () => {
    const r = await oneCallRound({ ...base, yardstick: "", parse: () => null });
    expect(r).toEqual({ ok: false, error: "AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่อีกครั้งนะครับ" });
    expect(store.releaseContentBudget).toHaveBeenCalledWith("h1");
  });

  it("marks คลิปวนลูป and สูตรโปร on the pieces", async () => {
    await oneCallRound({ ...base, format: "script", count: 1, loop: true, pro: true, yardstick: "", parse: () => piece("x") });
    expect(store.saveContent.mock.calls[0][0].output).toMatchObject({ loop: true, pro: true });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run tests/content/one-call-run.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: เขียน helper**

```ts
// src/lib/content/one-call-run.ts
import { BudgetExceeded, chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { GenerateResult } from "@/app/studio/actions";
import { findWords, strayNumbers } from "./check";
import { isLogoSpot } from "./logo";
import { roundLogo } from "./logo-store";
import { OVERHEAD_THB, writerOf } from "./models";
import type { ContentOutput } from "./output";
import { checkPolicy } from "./policy";
import { posterText } from "./poster";
import type { Format, Length } from "./prompt";
import {
  contentCap, contentSpentThisMonth, holdContentBudget, listWords, releaseContentBudget, saveContent, type ContentItem,
} from "./store";
import { fallbackWriters, UnreadableReply } from "./write";
import { ownerWording } from "./wording";

/**
 * A round written one call per piece with no planner — ความรู้ and เขียนเอง (2026-09-29), in
 * the shape หาทีม's writeRecruit has: the month's money checked and held, each piece written on
 * the picked writer with its fallbacks, the owner's wording applied, the Page's logo put on,
 * each saved with its checks. What differs per mode is passed in: the brief, the reply's
 * reading, and the yardstick a figure must be found in.
 */

const WRITE_TIMEOUT_MS = 60_000;
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";

export interface OneCallRound {
  href: string;
  format: Format;
  length: Length | null;
  count: number;
  writer?: string;
  messages: (piece: number) => ChatMessage[];
  parse: (reply: string, piece: number) => ContentOutput | null;
  /** where a figure may come from; "" flags every figure for the owner to confirm */
  yardstick: string;
  loop: boolean;
  pro: boolean;
  logoSpot?: string;
  page?: string;
  /** names the round in the server log */
  label: string;
}

function checkedText(o: ContentOutput): string {
  return [...o.hooks, o.body, o.closing, o.hashtags.join(" "), posterText(o.poster)].join("\n");
}

export async function oneCallRound(r: OneCallRound): Promise<GenerateResult> {
  const logo = r.format === "script" ? null
    : await roundLogo(typeof r.page === "string" ? r.page : null, isLogoSpot(r.logoSpot) ? r.logoSpot : null);
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const writer = writerOf(r.writer, cap - spent);
    const held = await holdContentBudget(r.count * (writer.thb + OVERHEAD_THB), cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอรอบนี้ — ลดจำนวนชิ้นหรือเลือกโมเดลประหยัด` };
    hold = held.id;
    const words = await listWords();

    const settled = await Promise.allSettled(Array.from({ length: r.count }, async (_, i) => {
      const reply = await chat({
        tier: "large", task: "content", messages: r.messages(i),
        maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
        prefer: writer.model, within: fallbackWriters(writer.model),
      });
      const parsed = r.parse(reply.text, i);
      const output = parsed && ownerWording(parsed);
      if (!output) {
        console.error(`${r.label} piece unreadable (${reply.model}, ${reply.outputTokens} tokens):`, reply.text.length);
        throw new UnreadableReply();
      }
      return {
        output: {
          ...output, ...(r.loop ? { loop: true } : {}), ...(r.pro ? { pro: true } : {}),
          ...(logo && output.poster ? { poster: { ...output.poster, logo } } : {}),
        },
        model: reply.model, costThb: reply.costThb,
      };
    }));
    const written = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
    if (written.length === 0) {
      const why = reasons.find((x) => x instanceof BudgetExceeded) ?? reasons[0];
      if (why instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (why instanceof UnreadableReply) return { ok: false, error: why.message };
      throw why;
    }

    const items: ContentItem[] = [];
    for (const w of written) {
      try {
        items.push(await saveContent({
          planHref: r.href, format: r.format, angle: "", length: r.length, output: w.output,
          flags: {
            numbers: strayNumbers(checkedText(w.output), r.yardstick),
            words: findWords(checkedText(w.output), words),
            policy: checkPolicy(checkedText(w.output)),
            fixes: null,
          },
          rateVersion: null, model: w.model, costThb: w.costThb, hookTemplateId: null,
        }));
      } catch (e) {
        console.error(`${r.label} save failed mid-round:`, e);
        return items.length
          ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${written.length} ชิ้น — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
          : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
      }
    }
    return { ok: true, items, costThb: items.reduce((s, i) => s + i.costThb, 0), missing: r.count - items.length };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error(`${r.label} write failed:`, e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}
```

ตรวจชื่อ field ของ `chat()` ผลลัพธ์ (`text`, `model`, `costThb`, `outputTokens`) กับ `src/lib/ai/client.ts` และ signature `saveContent` กับ `src/lib/content/store.ts:171` ก่อน — ต้องตรงกับที่ `recruit-run.ts` ใช้

- [ ] **Step 4: รันเทสต์ helper**

Run: `npx vitest run tests/content/one-call-run.test.ts`
Expected: PASS 5/5

- [ ] **Step 5: เขียนรอบความรู้ + action + route + client + เทสต์ route**

```ts
// src/lib/content/knowledge-run.ts
import type { GenerateResult } from "@/app/studio/actions";
import { knowledgeFormat, knowledgeMessages, KNOWLEDGE_HREF, MAX_KNOWLEDGE_PIECES, parseKnowledgePiece, subjectOf } from "./knowledge";
import { oneCallRound } from "./one-call-run";
import { LENGTHS, MAX_READER, type Length } from "./prompt";

export interface KnowledgeWriteInput {
  /** myth, article or quote */
  kind: string;
  /** a subject id from KNOWLEDGE_SUBJECTS[kind], or "custom" with the owner's words */
  subject: string;
  custom?: string;
  reader?: string;
  format?: string;
  length?: string;
  loop?: boolean;
  pro?: boolean;
  logoSpot?: string;
  page?: string;
  count: number;
  writer?: string;
}

/** ความรู้ on the server. Called by the generateKnowledge action only, which holds the limits. */
export async function writeKnowledge(input: KnowledgeWriteInput): Promise<GenerateResult> {
  const subject = subjectOf(String(input.kind ?? ""), String(input.subject ?? ""), typeof input.custom === "string" ? input.custom : "");
  if (!subject) return { ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" };
  const format = knowledgeFormat(input.format);
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const pro = input.pro === true;
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  return oneCallRound({
    href: KNOWLEDGE_HREF, format, length, loop, pro,
    count: Math.min(MAX_KNOWLEDGE_PIECES, Math.max(1, Math.round(Number(input.count) || 1))),
    writer: input.writer,
    messages: (i) => knowledgeMessages(subject, i, reader, format, length, loop, pro),
    parse: (reply) => parseKnowledgePiece(reply, subject, format),
    // general knowledge is allowed, so there is nothing to find a figure in: every one is flagged
    yardstick: "",
    logoSpot: input.logoSpot, page: input.page, label: "knowledge",
  });
}
```

ใน `src/lib/auth/quota.ts:24`:
```ts
export const AI_ROUNDS = ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft"] as const;
```

ใน `src/app/studio/actions.ts` ใต้ `generateRecruit` (เพิ่ม import `writeKnowledge, type KnowledgeWriteInput` จาก `@/lib/content/knowledge-run`):
```ts
/** ความรู้: a round from a picked subject (src/lib/content/knowledge.ts), under the plan form's hourly limit. */
export async function generateKnowledge(input: KnowledgeWriteInput): Promise<GenerateResult> {
  const viewer = await requireMember();
  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  // a subject not given is said before a round is counted
  if (!subjectOf(String(input.kind ?? ""), String(input.subject ?? ""), typeof input.custom === "string" ? input.custom : "")) {
    return { ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" };
  }
  const over = await takeRound(viewer, "ai-knowledge");
  if (over) return { ok: false, error: over };
  return writeKnowledge(input);
}
```
(import `subjectOf` จาก `@/lib/content/knowledge`)

```ts
// src/app/api/content-knowledge/route.ts
import type { NextRequest } from "next/server";
import { generateKnowledge } from "@/app/studio/actions";
import type { KnowledgeWriteInput } from "@/lib/content/knowledge-run";
import { refuseUnless } from "@/lib/auth/viewer";

/** A ความรู้ round as a plain request, for the reason /api/content-recruit gives. */

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const input = await req.json().catch(() => null) as KnowledgeWriteInput | null;
  if (!input || typeof input !== "object") return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  return Response.json(await generateKnowledge(input));
}
```

ใน `src/app/studio/draw.ts` ต่อท้าย (import type `KnowledgeWriteInput`):
```ts
/** A ความรู้ round through /api/content-knowledge, as recruitRound. */
export async function knowledgeRound(input: KnowledgeWriteInput): Promise<GenerateResult> {
  const res = await fetch("/api/content-knowledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return await res.json() as GenerateResult;
}
```

```ts
// tests/content/knowledge-route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => null) }));
const run = vi.hoisted(() => ({ writeKnowledge: vi.fn(async () => ({ ok: true, items: [], costThb: 0, missing: 0 })) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/content/knowledge-run", () => run);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })), getViewer: vi.fn(async () => ({ agentId: "a1" })) }));

const { POST } = await import("@/app/api/content-knowledge/route");
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/content-knowledge", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.2.0.${Math.random()}` },
}));

beforeEach(() => vi.clearAllMocks());

describe("a ความรู้ round", () => {
  it("takes one of the agent's rounds and writes", async () => {
    const res = await post({ kind: "myth", subject: "group", count: 1 });
    expect((await res.json()).ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-knowledge");
  });

  it("refuses a custom subject left empty before counting a round", async () => {
    const res = await post({ kind: "article", subject: "custom", custom: "   ", count: 1 });
    expect(await res.json()).toEqual({ ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.writeKnowledge).not.toHaveBeenCalled();
  });

  it("refuses a body that is not an object", async () => {
    const res = await POST(new NextRequest("http://localhost/api/content-knowledge", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });
});
```

ถ้า import `actions.ts` ในเทสต์ดึงโมดูลหนัก (Supabase ตอน import) จน fail ให้ mock เพิ่ม `vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }))` — เทสต์ `claim-route.test.ts` ที่มีอยู่ทำงานแบบเดียวกันได้ ให้ดูเป็นแบบ

- [ ] **Step 6: รันเทสต์ + typecheck**

Run: `npx vitest run tests/content/one-call-run.test.ts tests/content/knowledge-route.test.ts tests/content/knowledge.test.ts && npx tsc --noEmit`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/lib/content/one-call-run.ts src/lib/content/knowledge-run.ts src/lib/auth/quota.ts src/app/studio/actions.ts src/app/api/content-knowledge/route.ts src/app/studio/draw.ts tests/content/one-call-run.test.ts tests/content/knowledge-route.test.ts
git commit -m "feat(studio): write ความรู้ rounds, one call a piece, every figure flagged"
```

---

### Task 4: แท็บเขียนเอง — โมดูล รอบ action route

**Files:**
- Create: `src/lib/content/draft.ts`, `src/lib/content/draft-run.ts`, `src/app/api/content-draft/route.ts`
- Modify: `src/lib/content/modes.ts`, `src/app/studio/actions.ts`, `src/app/studio/draw.ts`
- Test: `tests/content/draft.test.ts`, `tests/content/draft-route.test.ts`

**Interfaces:**
- Consumes: `oneCallRound` (Task 3); `CORE_RULES` ไม่ใช้ (ข้อ 1 ของมันผูกกับข้อมูลแบบประกัน); `LOOP_RULES`, `steerLines`, `Format`, `Length`, `LENGTHS`, `MAX_READER` (`./prompt`); `PRO_HOOK_RULES`, `proRules`; `POLICY_RULES_TH`; `AD_LIMITS` (`./ads`); `DISCLAIMER` (`./output`); poster helpers
- Produces:
  - `DRAFT_HREF = "draft"`, `DRAFT_NAME = "เขียนเอง"`, `MAX_DRAFT = 2000`, `MAX_DRAFT_PIECES = 3`
  - `DRAFT_STYLES: { id: string; label: string; say: string }[]` (3 ตัว: close, punchy, story)
  - `cleanDraft(raw: unknown): string` — trim + ตัดที่ 2,000 ตัวอักษร (code points)
  - `draftMessages(draft: string, piece: number, reader: string, format: Format, length: Length | null, loop: boolean, pro: boolean): ChatMessage[]`
  - `parseDraftPiece(reply: string, draft: string, piece: number, format: Format): ContentOutput | null`
  - `DraftWriteInput { draft: string; reader?: string; format?: string; length?: string; loop?: boolean; pro?: boolean; logoSpot?: string; page?: string; count: number; writer?: string }`
  - `writeDraft(input)`, `generateDraft(input)` (action), `draftRound(input)` (client)

- [ ] **Step 1: เขียนเทสต์ที่ fail**

```ts
// tests/content/draft.test.ts
import { describe, expect, it } from "vitest";
import { cleanDraft, DRAFT_STYLES, draftMessages, MAX_DRAFT, parseDraftPiece } from "@/lib/content/draft";
import { DISCLAIMER } from "@/lib/content/output";
import { modeName } from "@/lib/content/modes";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const DRAFT = "ลูกค้าอายุ 35 ถามว่าทุน 500,000 พอไหม ผมแนะนำให้ดูรายจ่ายต่อปีก่อน";

describe("the owner's draft", () => {
  it("is trimmed and kept to 2,000 characters, not refused", () => {
    expect(cleanDraft("  ร่าง  ")).toBe("ร่าง");
    expect([...cleanDraft("ก".repeat(MAX_DRAFT + 50))].length).toBe(MAX_DRAFT);
    expect(cleanDraft("   ")).toBe("");
    expect(cleanDraft(42)).toBe("");
  });

  it("is named เขียนเอง wherever pieces are listed", () => {
    expect(modeName("draft")).toBe("เขียนเอง");
  });
});

describe("the polisher's brief", () => {
  it("keeps the draft's meaning and adds no fact, number or promise", () => {
    const brief = text(draftMessages(DRAFT, 0, "", "post", null, false, false));
    expect(brief).toContain(DRAFT);
    expect(brief).toContain("ห้ามเพิ่มข้อเท็จจริง ตัวเลข หรือคำสัญญา");
  });

  it("polishes each version its own way: closest, punchier, a story", () => {
    expect(DRAFT_STYLES.map((s) => s.id)).toEqual(["close", "punchy", "story"]);
    expect(text(draftMessages(DRAFT, 0, "", "post", null, false, false))).toContain(DRAFT_STYLES[0].say);
    expect(text(draftMessages(DRAFT, 2, "", "post", null, false, false))).toContain(DRAFT_STYLES[2].say);
  });

  it("writes an ad to Ads Manager's lengths", () => {
    expect(text(draftMessages(DRAFT, 0, "", "ad", null, false, false))).toContain("headline");
  });
});

describe("a polished version", () => {
  const reply = JSON.stringify({ hook: "หัว", body: "เนื้อ", closing: "ทักมา", hashtags: ["x"], imagePrompt: "p", poster: { theme: "navy", headline: "บนภาพ" } });

  it("keeps the draft as its story, so the draft's own figures stay allowed after an edit", () => {
    const o = parseDraftPiece(reply, DRAFT, 1, "post")!;
    expect(o.fact).toBe(DRAFT);
    expect(o.disclaimer).toBe(DISCLAIMER);
    expect(o.angle).toContain(DRAFT_STYLES[1].label);
    expect(o.poster).toBeDefined();
  });

  it("is nothing without a hook or a body", () => {
    expect(parseDraftPiece(JSON.stringify({ hook: "หัว" }), DRAFT, 0, "post")).toBeNull();
  });
});
```

```ts
// tests/content/draft-route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => null) }));
const run = vi.hoisted(() => ({ writeDraft: vi.fn(async () => ({ ok: true, items: [], costThb: 0, missing: 0 })) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/content/draft-run", () => run);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), requireMember: vi.fn(async () => ({ agentId: "a1" })), getViewer: vi.fn(async () => ({ agentId: "a1" })) }));

const { POST } = await import("@/app/api/content-draft/route");
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/content-draft", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.3.0.${Math.random()}` },
}));

beforeEach(() => vi.clearAllMocks());

describe("a เขียนเอง round", () => {
  it("takes one of the agent's rounds and polishes", async () => {
    expect((await (await post({ draft: "ร่าง", count: 2 })).json()).ok).toBe(true);
    expect(quota.takeRound).toHaveBeenCalledWith({ agentId: "a1" }, "ai-draft");
  });

  it("refuses an empty draft before counting a round", async () => {
    expect(await (await post({ draft: "   ", count: 1 })).json()).toEqual({ ok: false, error: "พิมพ์ร่างก่อนนะครับ" });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run tests/content/draft.test.ts tests/content/draft-route.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: เขียนโมดูล**

```ts
// src/lib/content/draft.ts
import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/client";
import { AD_LIMITS } from "./ads";
import { DISCLAIMER, type ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Format, type Length } from "./prompt";
import { PRO_HOOK_RULES, proRules } from "./pro";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * เขียนเอง (owner, 2026-09-29): the agent's own draft, polished by the AI into up to three
 * versions — closest to the draft, punchier, told as a story. The draft's meaning and facts
 * stay; nothing is added. The draft is kept as the piece's `fact`, the field whose figures are
 * allowed when a piece is checked and edited, so the agent's own numbers are never flagged and
 * a number the AI brought in is. Browser-safe.
 */

export const DRAFT_HREF = "draft";
export const DRAFT_NAME = "เขียนเอง";
export const MAX_DRAFT = 2000;
export const MAX_DRAFT_PIECES = 3;

export const DRAFT_STYLES = [
  { id: "close", label: "ใกล้ร่างที่สุด", say: "คงคำและลำดับของเจ้าของไว้มากที่สุด แก้คำผิด จัดย่อหน้าให้อ่านง่ายบนมือถือ เขียนประโยคเปิดใหม่ให้หยุดคนเลื่อน" },
  { id: "punchy", label: "กระชับ หยุดคนเลื่อน", say: "ย่อให้สั้นลงราวครึ่งหนึ่ง ตัดคำเกริ่นและคำซ้ำ ประโยคเปิดแรงขึ้น เหลือแต่ใจความ" },
  { id: "story", label: "เล่าเป็นเรื่อง", say: "เรียงเนื้อหาของร่างเป็นเรื่องเล่าที่อ่านลื่น มีต้น กลาง จบ โดยใช้เฉพาะเรื่องที่ร่างมี" },
] as const;

/** The draft as sent: trimmed, and cut at MAX_DRAFT characters rather than refused. */
export function cleanDraft(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return [...raw.trim()].slice(0, MAX_DRAFT).join("").trim();
}

const RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. คงใจความและข้อเท็จจริงของร่างไว้ครบ ห้ามเพิ่มข้อเท็จจริง ตัวเลข หรือคำสัญญาที่ร่างไม่มี ตัวเลขในร่างคัดลอกได้ตรงตัวเท่านั้น ห้ามคำนวณหรือปัดเศษ",
  "2. ถ้าร่างมีคำที่ผิดกฎโฆษณาของ Facebook หรือคำเกินจริง (การันตี ดีที่สุด ได้เงินคืนแน่นอน ฯลฯ) ให้เปลี่ยนเป็นคำที่ถูกต้อง",
  "3. ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันอื่น และห้ามใส่ชื่อจริงหรือข้อมูลที่ทำให้รู้ว่าเป็นลูกค้าคนไหน",
  "4. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "5. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
  "6. ร่างจะขายหรือไม่ขายก็ได้ ให้ปิดท้ายตามที่ร่างตั้งใจ ถ้าร่างไม่บอก ให้ชวนทักแชทหรือเซฟเก็บไว้ ห้ามชวนคอมเมนต์คำเฉพาะหรือแท็กเพื่อน",
  "",
  POLICY_RULES_TH,
].join("\n");

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ ตรงกับเรื่องในร่าง ห้ามมีตัวหนังสือ",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว ตัวเลขต้องมาจากร่างเท่านั้น",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

function draftSystem(format: Format, length: Length | null, loop: boolean, pro: boolean): string {
  const task: Record<Format, string[]> = {
    post: [
      "งาน: เกลาร่างของเจ้าของเพจเป็นโพสต์เฟซบุ๊ก",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
      "- hook: ประโยคเปิด 1 บรรทัด · body: ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ · closing: 1–2 บรรทัด · hashtags: 3–6 แท็ก",
      ...POSTER_LINES,
    ],
    script: [
      `งาน: เกลาร่างของเจ้าของเพจเป็นสคริปต์พูดหน้ากล้อง ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
      "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ]",
      "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] ใส่ท่าทางในวงเล็บ และข้อความขึ้นจอเป็น {จอ: …} ใช้ \\n ขึ้นบรรทัดใหม่",
      "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม · hashtags: 3–6 แท็ก",
    ],
    ad: [
      "งาน: เกลาร่างของเจ้าของเพจเป็นโฆษณา Facebook",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…",${POSTER_SHAPE}}`,
      `- hook คือ headline: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.headline} ตัวอักษร`,
      `- body คือ primary text: ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว ทั้งหมดไม่เกิน 400 ตัวอักษร`,
      `- closing คือ description: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.description} ตัวอักษร`,
      ...POSTER_LINES,
    ],
  };
  return [
    "คุณคือบรรณาธิการคอนเทนต์ให้ตัวแทนประกันชีวิตในประเทศไทย งานคือเกลาร่างของเจ้าของเพจให้ดีขึ้นโดยยังเป็นเรื่องของเขา",
    "",
    RULES,
    "",
    ...task[format],
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...(pro && format !== "ad" ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
  ].join("\n");
}

export function draftMessages(draft: string, piece: number, reader: string, format: Format, length: Length | null, loop: boolean, pro: boolean): ChatMessage[] {
  const style = DRAFT_STYLES[piece % DRAFT_STYLES.length];
  return [
    { role: "system", content: draftSystem(format, length, loop, pro) },
    {
      role: "user",
      content: [`ร่างของเจ้าของเพจ:\n"""${draft}"""`, `วิธีเกลาเวอร์ชันนี้: ${style.say}`, steerLines({ reader: reader.trim() })].filter(Boolean).join("\n\n"),
    },
  ];
}

function draftPoster(raw: unknown, hook: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [{ kind: "headline", text: headline }, ...(footer ? [{ kind: "footer" as const, text: footer }] : [])];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "bottom", theme, blocks })!;
}

/** One polished version from a reply, or null when the reply has no hook or body. */
export function parseDraftPiece(reply: string, draft: string, piece: number, format: Format): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  const style = DRAFT_STYLES[piece % DRAFT_STYLES.length];
  return {
    hooks: [format === "ad" ? hook.slice(0, 120) : hook],
    angle: `${DRAFT_NAME} · ${style.label}`,
    body: format === "ad" ? body.slice(0, 1200) : body,
    closing: format === "ad" ? text(raw.closing).slice(0, 120) : text(raw.closing),
    hashtags: format === "ad" ? [] : [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: DISCLAIMER,
    ...(format === "script" ? {} : { poster: draftPoster(raw.poster, hook) }),
    ...(format === "ad" ? { ad: { angle: style.label, tone: DRAFT_NAME } } : {}),
    // the draft is the piece's story: its figures are allowed now and after every edit
    fact: draft,
  };
}
```

```ts
// src/lib/content/draft-run.ts
import type { GenerateResult } from "@/app/studio/actions";
import { cleanDraft, draftMessages, DRAFT_HREF, MAX_DRAFT_PIECES, parseDraftPiece } from "./draft";
import { oneCallRound } from "./one-call-run";
import { LENGTHS, MAX_READER, type Format, type Length } from "./prompt";

export interface DraftWriteInput {
  draft: string;
  reader?: string;
  format?: string;
  length?: string;
  loop?: boolean;
  pro?: boolean;
  logoSpot?: string;
  page?: string;
  count: number;
  writer?: string;
}

/** เขียนเอง on the server. Called by the generateDraft action only, which holds the limits. */
export async function writeDraft(input: DraftWriteInput): Promise<GenerateResult> {
  const draft = cleanDraft(input.draft);
  if (!draft) return { ok: false, error: "พิมพ์ร่างก่อนนะครับ" };
  const format: Format = input.format === "script" || input.format === "ad" ? input.format : "post";
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && input.loop === true;
  const pro = format !== "ad" && input.pro === true;
  const reader = (typeof input.reader === "string" ? input.reader : "").trim().slice(0, MAX_READER);
  return oneCallRound({
    href: DRAFT_HREF, format, length, loop, pro,
    count: Math.min(MAX_DRAFT_PIECES, Math.max(1, Math.round(Number(input.count) || 1))),
    writer: input.writer,
    messages: (i) => draftMessages(draft, i, reader, format, length, loop, pro),
    parse: (reply, i) => parseDraftPiece(reply, draft, i, format),
    // the draft is where a figure may come from; one the AI brought in is flagged
    yardstick: draft,
    logoSpot: input.logoSpot, page: input.page, label: "draft",
  });
}
```

ใน `actions.ts` ใต้ `generateKnowledge` (import `writeDraft, type DraftWriteInput`, `cleanDraft`):
```ts
/** เขียนเอง: the agent's draft polished into versions (src/lib/content/draft.ts), under the hourly limit. */
export async function generateDraft(input: DraftWriteInput): Promise<GenerateResult> {
  const viewer = await requireMember();
  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  // an empty draft is said before a round is counted
  if (!cleanDraft(input.draft)) return { ok: false, error: "พิมพ์ร่างก่อนนะครับ" };
  const over = await takeRound(viewer, "ai-draft");
  if (over) return { ok: false, error: over };
  return writeDraft(input);
}
```

`src/app/api/content-draft/route.ts` — เหมือน route ความรู้ใน Task 3 ทุกบรรทัด แต่ใช้ `generateDraft` และ `DraftWriteInput` จาก `@/lib/content/draft-run`, คอมเมนต์ `/** A เขียนเอง round as a plain request, for the reason /api/content-recruit gives. */`

`draw.ts` เพิ่ม:
```ts
/** A เขียนเอง round through /api/content-draft, as recruitRound. */
export async function draftRound(input: DraftWriteInput): Promise<GenerateResult> {
  const res = await fetch("/api/content-draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return await res.json() as GenerateResult;
}
```

`modes.ts` เพิ่ม `{ href: DRAFT_HREF, name: DRAFT_NAME }` (import จาก `./draft`)

- [ ] **Step 4: รันเทสต์ + typecheck**

Run: `npx vitest run tests/content/draft.test.ts tests/content/draft-route.test.ts tests/content/modes.test.ts && npx tsc --noEmit`
Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/draft.ts src/lib/content/draft-run.ts src/app/api/content-draft/route.ts src/lib/content/modes.ts src/app/studio/actions.ts src/app/studio/draw.ts tests/content/draft.test.ts tests/content/draft-route.test.ts
git commit -m "feat(studio): เขียนเอง — the agent's draft polished into up to three versions"
```

---

### Task 5: ฟอร์มสองแท็บ และแท็บใน Organic Studio

**Files:**
- Modify: `src/app/studio/ui/form-parts.tsx` (`FormatPicker` รับ `formats?`)
- Create: `src/app/studio/knowledge/KnowledgeTools.tsx`, `src/app/studio/draft/DraftTools.tsx`
- Modify: `src/app/studio/ContentStudio.tsx` (ชนิด mode, ปุ่มแท็บ, localStorage, เรนเดอร์ฟอร์มใหม่)

**Interfaces:**
- Consumes: `knowledgeRound`, `draftRound` (Task 3–4); `KNOWLEDGE_KINDS`, `KNOWLEDGE_SUBJECTS`, `MAX_KNOWLEDGE_CUSTOM`, `MAX_KNOWLEDGE_PIECES`, `KNOWLEDGE_NAME`; `DRAFT_STYLES`, `MAX_DRAFT`, `MAX_DRAFT_PIECES`, `DRAFT_NAME`; ทุกชิ้นจาก `form-parts`, `LogoPicker`, `PersonPicker` ตามที่ `RecruitTools.tsx` ใช้
- Produces: `KnowledgeTools`, `DraftTools` — props เหมือน `RecruitTools` ทุกตัว (`writer, onWriter, painter, onPainter, people, person, onPerson, logo, rounds, left, pending, making, run, folded, formId`)

- [ ] **Step 1: `FormatPicker` รับรายการรูปแบบ**

```tsx
export function FormatPicker({ value, onChange, formats = FORMATS }: { value: Format; onChange: (f: Format) => void; formats?: Format[] }) {
```
และใน body เปลี่ยน `FORMATS.map` เป็น `formats.map`

- [ ] **Step 2: เขียน `KnowledgeTools.tsx`**

คัดลอก `src/app/studio/recruit/RecruitTools.tsx` ทั้งไฟล์เป็นจุดเริ่ม แล้วเปลี่ยนตามนี้ (ส่วนที่ไม่กล่าวถึงให้เหมือนเดิมทุกบรรทัด: ความยาวคลิป, `LoopToggle`, `ProToggle`, `LogoPicker`, `PictureFold` ทั้งก้อน, `PressBar`):

- import แทนของหาทีม:
  ```ts
  import { KNOWLEDGE_KINDS, KNOWLEDGE_NAME, KNOWLEDGE_SUBJECTS, MAX_KNOWLEDGE_CUSTOM, MAX_KNOWLEDGE_PIECES, type KnowledgeKind } from "@/lib/content/knowledge";
  import { knowledgeRound } from "../draw";
  ```
- คอมเมนต์หัวไฟล์: `/** ความรู้'s tools (owner, 2026-09-29): a kind, a subject from its bank or the owner's own, the round — sells nothing (knowledge.ts). */`
- `READER_KEY = "content-knowledge-reader"`
- state:
  ```ts
  const [kind, setKind] = useState<KnowledgeKind>("myth");
  const [subject, setSubject] = useState<string>(KNOWLEDGE_SUBJECTS.myth[0].id);
  const [custom, setCustom] = useState("");
  const pickKind = (k: KnowledgeKind) => { setKind(k); setSubject(KNOWLEDGE_SUBJECTS[k][0].id); };
  const [format, setFormat] = useState<Format>("post");
  ```
  ลบ `tone` และ `RECRUIT_*`
- `blocked = subject === "custom" && !custom.trim() ? "พิมพ์หัวข้อ หรือเลือกจากรายการ" : null`
- `unit = "ชิ้น"`
- `create()`:
  ```ts
  const round = { kind, subject, custom: custom.trim(), reader: reader.trim(), format, length, loop: format === "script" && loop, pro, count, writer,
    ...(format !== "script" && logo.spot ? { logoSpot: logo.spot, page: logo.page } : {}) };
  const paintWith = round.format === "script" ? "none" : painterFor(painter, left, Boolean(person)).id;
  await run(count, round.format, () => knowledgeRound(round), paintWith, person);
  ```
- แทนบล็อก "หัวข้อ" ของหาทีม ด้วย:
  ```tsx
  <div role="group" aria-labelledby={`${id}-kind`}>
    <span id={`${id}-kind`} className="mb-1.5 block text-sm font-medium">แบบ</span>
    <div className="flex flex-wrap gap-2">
      {KNOWLEDGE_KINDS.map((k) => (
        <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => pickKind(k.id)} className={chip(kind === k.id)}>{k.label}</button>
      ))}
    </div>
  </div>
  <div>
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{kind === "quote" ? "แนวคำคม" : kind === "myth" ? "ความเข้าใจผิด" : "หัวข้อ"}</span>
      <select value={subject} onChange={(e) => setSubject(e.target.value)} className={field}>
        {KNOWLEDGE_SUBJECTS[kind].map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        <option value="custom">พิมพ์เอง…</option>
      </select>
    </label>
    {subject === "custom" && (
      <label className="mt-2 block">
        <span className="sr-only">หัวข้อ (พิมพ์เอง)</span>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={MAX_KNOWLEDGE_CUSTOM} placeholder={kind === "quote" ? "เช่น คำคมเรื่องการออมเงินของคนเพิ่งเริ่มทำงาน" : "เช่น ประกันกับการผ่อนบ้าน"} className={field} />
      </label>
    )}
    <p className="mt-1.5 text-xs text-[var(--ct-mute)]">โพสต์ความรู้ไม่ขาย ไม่เอ่ยชื่อแบบประกัน — ตัวเลขทุกตัวจะติดธงให้ตรวจก่อนลงเพจ</p>
  </div>
  <FormatPicker value={format} onChange={setFormat} formats={["post", "script"]} />
  ```
- `ProToggle` แสดงเสมอ (ไม่มีโฆษณา): `<ProToggle value={pro} onChange={setPro} />`
- FormSection "เรื่องที่เล่า": เหลือแต่ช่องคนอ่าน — ไม่มีชิปผู้อ่านสำเร็จรูป (ลบ `RECRUIT_READERS` loop และปุ่ม "ทุกคน"); ป้ายเป็น `คนอ่าน <span …>(ไม่ใส่ก็ได้ · ระบบจำไว้ให้)</span>`, placeholder `"เช่น พ่อแม่ลูกเล็ก หรือคนเพิ่งเริ่มทำงาน"`; ลบก้อน "วิธีเล่า"
- `PressBar`: `max={MAX_KNOWLEDGE_PIECES}`, label: `pending ? \`กำลังเขียน ${making} ชิ้น… (ราว 20–40 วินาที)\` : \`สร้าง${format === "post" ? "โพสต์" : "สคริปต์"}${KNOWLEDGE_NAME} ${count} ชิ้น\``
- ภาพประกอบ hint (บรรทัด "AI วาดภาพบรรยากาศการทำงาน…"): เปลี่ยนเป็น `` `${paints.short} · AI วาดภาพประกอบให้ทุกชิ้นหลังเขียนเสร็จ` ``

- [ ] **Step 3: เขียน `DraftTools.tsx`**

เริ่มจาก `RecruitTools.tsx` เช่นกัน แล้วเปลี่ยน:

- import: `import { DRAFT_NAME, DRAFT_STYLES, MAX_DRAFT, MAX_DRAFT_PIECES } from "@/lib/content/draft";` และ `import { draftRound } from "../draw";`
- คอมเมนต์หัวไฟล์: `/** เขียนเอง's tools (owner, 2026-09-29): the agent's draft and how many versions to polish it into (draft.ts). */`
- `READER_KEY = "content-draft-reader"`; state `const [draft, setDraft] = useState("");` แทน topic/custom/tone
- `blocked = !draft.trim() ? "พิมพ์ร่างก่อน" : null`
- `unit = format === "ad" ? "แบบ" : "เวอร์ชัน"`
- `create()`:
  ```ts
  const round = { draft: draft.trim(), reader: reader.trim(), format, length, loop: format === "script" && loop, pro: format !== "ad" && pro, count, writer,
    ...(format !== "script" && logo.spot ? { logoSpot: logo.spot, page: logo.page } : {}) };
  const paintWith = round.format === "script" ? "none" : painterFor(painter, left, Boolean(person)).id;
  await run(count, round.format, () => draftRound(round), paintWith, person);
  ```
- แทนบล็อกหัวข้อด้วย:
  ```tsx
  <label className="block">
    <span className="mb-1 flex justify-between text-sm font-medium">
      <span>ร่างของคุณ</span>
      <span className="text-xs font-normal text-[var(--ct-mute)]">{[...draft].length}/{MAX_DRAFT}</span>
    </span>
    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_DRAFT} rows={7}
      placeholder="พิมพ์เรื่องที่อยากโพสต์ได้เลย ภาษาพูดก็ได้ AI จะเกลาให้ โดยไม่เพิ่มข้อมูลหรือตัวเลขที่คุณไม่ได้เขียน"
      className={`${field} min-h-40 leading-relaxed`} />
  </label>
  <FormatPicker value={format} onChange={setFormat} />
  ```
- คงความยาวคลิป / `LoopToggle` / `{format !== "ad" && <ProToggle …/>}`
- FormSection "เรื่องที่เล่า": ช่องคนอ่านแบบเดียวกับ KnowledgeTools และใต้ช่องแสดงวิธีเกลาของรอบ:
  ```tsx
  <p className="text-xs text-[var(--ct-mute)]">เวอร์ชันในรอบนี้: {DRAFT_STYLES.slice(0, count).map((s) => s.label).join(" · ")}</p>
  ```
- `PressBar`: `max={MAX_DRAFT_PIECES}`, label `pending ? \`กำลังเกลา ${making} ${unit}… (ราว 20–40 วินาที)\` : \`เกลา${format === "post" ? "โพสต์" : format === "ad" ? "โฆษณา" : "สคริปต์"} ${count} ${unit}\``
- ภาพประกอบ hint เหมือน KnowledgeTools

- [ ] **Step 4: แท็บใน ContentStudio**

ชนิด mode และ localStorage (บรรทัด ~222–236):
```ts
type Mode = "plan" | "claim" | "recruit" | "knowledge" | "draft";
const MODES: Mode[] = ["plan", "claim", "recruit", "knowledge", "draft"];
```
(ประกาศระดับไฟล์ใกล้ `TABS`) แล้ว
```ts
  const [mode, setModeState] = useState<Mode>("plan");
  …
      if (!initialHook && keptMode && keptMode !== "plan" && (MODES as string[]).includes(keptMode)) setModeState(keptMode as Mode);
  …
  const setMode = (next: Mode) => {
```
ปุ่มแท็บ (บรรทัด ~971) แทน array เดิมด้วย และให้แถวเลื่อนแนวนอนได้:
```tsx
{([["plan", "แบบประกัน"], ["claim", CLAIM_NAME], ["recruit", RECRUIT_NAME], ["knowledge", KNOWLEDGE_NAME], ["draft", DRAFT_NAME]] as const).map(([m, label]) => (
```
ที่ container ของแถวปุ่มนี้ (อ่านบรรทัดจริง) เพิ่ม `overflow-x-auto` และให้ปุ่ม `shrink-0` คง `flex-auto whitespace-nowrap`

เรนเดอร์ฟอร์มใหม่ต่อจาก `<div hidden={mode !== "recruit"}>…</div>` ด้วย props ชุดเดียวกับ `RecruitTools` ทุกตัว:
```tsx
          <div hidden={mode !== "knowledge"}>
            <KnowledgeTools
              folded={!formOpen} formId={mode === "knowledge" ? formId : undefined}
              writer={writer} onWriter={(w) => pick({ writer: w })} painter={painter} onPainter={(p) => pick({ painter: p })}
              people={people} person={person} onPerson={setPerson} logo={logo}
              left={left} rounds={spend.rounds} pending={pending} making={making}
              run={…เหมือนที่ส่งให้ RecruitTools…}
            />
          </div>
          <div hidden={mode !== "draft"}>
            <DraftTools …props เดียวกัน, formId={mode === "draft" ? formId : undefined} … />
          </div>
```
(อ่านบล็อก `<RecruitTools … />` จริงแล้วคัดลอก props ทุกตัวรวมถึง `run=` ให้ตรง) เพิ่ม import `KnowledgeTools`, `DraftTools`, `KNOWLEDGE_NAME`, `DRAFT_NAME`

- [ ] **Step 5: typecheck + lint + เทสต์ทั้งหมด**

Run: `npx tsc --noEmit && npx eslint src/app/studio && npx vitest run`
Expected: ไม่มี error; เทสต์ผ่านทั้งหมด

- [ ] **Step 6: ดูในเบราว์เซอร์**

เปิด dev server (`preview_start` ชื่อ `dev`) → ต้องล็อกอิน: ถ้าเจ้าของเปิดหน้าให้ได้ ให้ตรวจ — 5 แท็บเลื่อนได้บนจอ 375px, แท็บความรู้เปลี่ยนแบบแล้วรายการหัวข้อเปลี่ยน, ไม่มีปุ่มโฆษณาในแท็บความรู้, แท็บเขียนเองนับตัวอักษร และปุ่มสร้างถูกปิดเมื่อร่างว่าง. ถ้าล็อกอินไม่ได้ ให้บันทึกว่ายังไม่ได้ดูหน้าจริง

- [ ] **Step 7: Commit**

```bash
git add src/app/studio/ui/form-parts.tsx src/app/studio/knowledge/KnowledgeTools.tsx src/app/studio/draft/DraftTools.tsx src/app/studio/ContentStudio.tsx
git commit -m "feat(studio): the ความรู้ and เขียนเอง tabs on the workbench"
```

---

### Task 6: ลองเขียนจริง + ตรวจทั้งหมด

**Files:**
- ไม่มีไฟล์ในโปรเจกต์ (สคริปต์ชั่วคราวอยู่ใน scratchpad)

- [ ] **Step 1: สคริปต์ลอง (vite-node, env จาก `.env.local`)**

```ts
// <scratchpad>/modes-sample.ts
import { knowledgeMessages, parseKnowledgePiece, subjectOf } from "@/lib/content/knowledge";
import { draftMessages, parseDraftPiece } from "@/lib/content/draft";
import { chat } from "@/lib/ai/client";

const show = (label: string, o: ReturnType<typeof parseKnowledgePiece>) =>
  console.log(`\n===== ${label}\nHOOK: ${o?.hooks[0]}\n${o?.body}\nCLOSE: ${o?.closing}\nPOSTER: ${JSON.stringify(o?.poster?.blocks)}`);
for (const [kind, id] of [["myth", "group"], ["article", "waiting"], ["quote", "family"]] as const) {
  const s = subjectOf(kind, id, "")!;
  const r = await chat({ tier: "large", task: "content", messages: knowledgeMessages(s, 0, "", "post", null, false, true), maxTokens: 4000, json: true, timeoutMs: 60_000, effort: "low" });
  show(`${kind} (${r.model} ฿${r.costThb.toFixed(2)})`, parseKnowledgePiece(r.text, s, "post"));
}
const DRAFT = "วันนี้มีลูกค้าอายุ 35 ถามว่าทุนประกันชีวิต 1 ล้านพอไหม ผมบอกให้ลองคิดจากหนี้บ้านกับค่าเรียนลูกก่อน แล้วค่อยดูว่าขาดเท่าไหร่";
for (const i of [0, 1, 2]) {
  const r = await chat({ tier: "large", task: "content", messages: draftMessages(DRAFT, i, "", "post", null, false, false), maxTokens: 4000, json: true, timeoutMs: 60_000, effort: "low" });
  show(`draft ${i} (${r.model} ฿${r.costThb.toFixed(2)})`, parseDraftPiece(r.text, DRAFT, i, "post"));
}
```

Run: `set -a && source .env.local && set +a && npx vite-node --config vitest.config.ts <scratchpad>/modes-sample.ts`
Expected: 6 ชิ้นอ่านออกทั้งหมด ตรวจด้วยตาว่า: ความรู้ไม่มีชื่อแบบประกัน/บริษัท/เบี้ย และปิดด้วยชวนเซฟ; คำคมไม่มีชื่อคน; เขียนเองไม่มีตัวเลขที่ร่างไม่มี. ถ้ามีข้อผิด แก้กติกาในโมดูล + เพิ่มเทสต์ แล้วรันซ้ำ

- [ ] **Step 2: ตรวจทั้งหมด**

Run (ทีละคำสั่ง ไม่รันพร้อมกัน): `npx tsc --noEmit` → `npx eslint src/app/studio src/lib/content src/app/api tests/content` → `npx vitest run` → `NEXT_DIST_DIR=.next-build npx next build`
Expected: ผ่านทั้งหมด (คำเตือน lint เดิมใน `tests/content/claim-poster.test.ts` ไม่เกี่ยว)

- [ ] **Step 3: สรุปให้เจ้าของ** — ตัวอย่างผลจริงทั้ง 6 ชิ้นแบบย่อ ค่าใช้จ่าย และสิ่งที่ยังไม่ได้ดูในหน้าจริง; ยังไม่ merge/push จนกว่าเจ้าของสั่ง
