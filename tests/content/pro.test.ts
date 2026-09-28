import { describe, expect, it } from "vitest";
import { PRO_HOOK_RULES, PRO_NAME, PRO_PRINCIPLES, proRules } from "@/lib/content/pro";
import { buildMessages, type Ask } from "@/lib/content/prompt";
import { planMessages } from "@/lib/content/plan";
import { claimSystem } from "@/lib/content/claim";
import { recruitSystem } from "@/lib/content/recruit";
import { scenes } from "@/lib/content/script";

/** สูตรคอนเทนต์โปร: its rules reach every writer when ticked, and none when not. */

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const ask = (over: Partial<Ask> = {}): Ask => ({
  brief: "ข้อมูล", format: "post", angle: "", custom: "", length: null, plans: [{ angle: "มุม", hook: "หัว" }], ...over,
});
const planOpts = { brief: "ข้อมูล", count: 1, angle: "", avoid: [], template: null };

describe("the thirteen", () => {
  it("lists thirteen, and says which one the writer cannot do", () => {
    expect(PRO_PRINCIPLES).toHaveLength(13);
    expect(PRO_PRINCIPLES.filter((p) => !p.ai).map((p) => p.name)).toEqual(["Graph Retention"]);
  });
});

describe("the planner's hook", () => {
  it("is stacked only when the box is ticked", () => {
    expect(text(planMessages({ ...planOpts, pro: true }))).toContain(PRO_HOOK_RULES);
    expect(text(planMessages(planOpts))).not.toContain(PRO_NAME);
  });

  it("names a group in the third person, never the reader as one of them", () => {
    expect(PRO_HOOK_RULES).toContain("บุคคลที่สาม");
    expect(PRO_HOOK_RULES).toContain("ห้ามทักคนอ่าน");
  });
});

describe("the round's writer", () => {
  it("gets the post rules for a post, and nothing when not ticked", () => {
    expect(text(buildMessages(ask({ pro: true })))).toContain(proRules("post"));
    expect(text(buildMessages(ask()))).not.toContain(PRO_NAME);
  });

  it("gets the script rules, with the first three seconds, B-roll and a save mid-clip", () => {
    const rules = proRules("script", "60");
    expect(text(buildMessages(ask({ format: "script", length: "60", pro: true })))).toContain(rules);
    expect(rules).toContain("[0–3 วิ]");
    expect(rules).toContain("B-roll:");
    expect(rules).toContain("- Mid-CTA:");
  });

  it("leaves the mid-clip ask to คลิปวนลูป, which has its own, and to clips long enough for one", () => {
    expect(proRules("script", "60", true)).not.toContain("- Mid-CTA:");
    expect(proRules("script", "30")).not.toContain("- Mid-CTA:");
  });

  it("asks only for a save mid-post, never a comment or a tag", () => {
    expect(proRules("post")).toContain("ชวนได้แค่เซฟ");
  });

  it("writes an ad as before", () => {
    expect(proRules("ad")).toBe("");
  });
});

describe("รีวิวเคลม and หาทีม", () => {
  it("take the hook and the body rules together, since one call writes both", () => {
    for (const system of [claimSystem("post", null, false, true), recruitSystem("post", null, false, true)]) {
      expect(system).toContain(PRO_HOOK_RULES);
      expect(system).toContain(proRules("post"));
    }
    expect(claimSystem("post")).not.toContain(PRO_NAME);
    expect(recruitSystem("post")).not.toContain(PRO_NAME);
  });
});

describe("a script's first three seconds", () => {
  it("show once: the spoken hook with its screen text and opening shot", () => {
    const list = scenes("หัว", "[0–3 วิ] {จอ: ประกันกลุ่มไม่พอ?} (ชูใบเสร็จเข้ากล้อง)\n[3–15 วิ] เนื้อหา (B-roll: หน้าโรงพยาบาล)", "[15–20 วิ] ปิด");
    expect(list[0]).toEqual({ time: "0–3 วิ", say: "หัว", acts: ["ชูใบเสร็จเข้ากล้อง"], screen: ["ประกันกลุ่มไม่พอ?"] });
    expect(list.map((s) => s.time)).toEqual(["0–3 วิ", "3–15 วิ", "15–20 วิ"]);
    expect(list[1].acts).toEqual(["B-roll: หน้าโรงพยาบาล"]);
  });
});
