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
