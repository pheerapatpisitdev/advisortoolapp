import { describe, expect, it } from "vitest";
import { pickHookMenu, HOOK_MENU_SIZE } from "@/lib/content/hooks";
import { parsePlans, planMessages } from "@/lib/content/plan";

const pool = Array.from({ length: 40 }, (_, i) => ({ id: `h${i}`, category: ["SWAP", "BUILD", "CLAIM", "LIST", "CONTRARIAN"][i % 5], template: `สูตร ${i}` }));

describe("pickHookMenu", () => {
  it("offers the size asked for, none twice, spread over the categories", () => {
    const menu = pickHookMenu(pool, {});
    expect(menu).toHaveLength(HOOK_MENU_SIZE);
    expect(new Set(menu.map((h) => h.id)).size).toBe(HOOK_MENU_SIZE);
    expect(new Set(menu.map((h) => h.category)).size).toBe(5);
  });

  it("puts the formulas that went up on a Page first, best first", () => {
    const menu = pickHookMenu(pool, { h7: 1, h3: 4, h9: 2, h11: 1 });
    expect(menu.slice(0, 3).map((h) => h.id)).toEqual(["h3", "h9", "h7"].slice(0, 3));
  });

  it("gives what there is when the library is small or empty", () => {
    expect(pickHookMenu(pool.slice(0, 3), {})).toHaveLength(3);
    expect(pickHookMenu([], {})).toEqual([]);
  });
});

describe("the planner's menu", () => {
  const menu = [{ template: "a [x]", category: "LIST" }, { template: "b [y]", category: "SWAP" }];
  const ask = { brief: "ข้อมูล", count: 2, angle: "", avoid: [], template: null, menu, reader: "", goal: "" as const, fact: "", lang: "th" as const };

  it("lists the formulas by number and asks for f on each piece", () => {
    const [, user] = planMessages(ask);
    expect(user.content).toContain('1. "a [x]"');
    expect(user.content).toContain('2. "b [y]"');
    expect(user.content).toContain('"f":1');
  });

  it("offers no menu when the owner chose a formula", () => {
    const [, user] = planMessages({ ...ask, template: { template: "c [z]", category: "LIST" } });
    expect(user.content).not.toContain('"f":1');
    expect(user.content).not.toContain("1. ");
  });

  it("reads the formula number only inside the menu, and once", () => {
    const reply = JSON.stringify({ plans: [{ hook: "h1", f: 2 }, { hook: "h2", f: 2 }, { hook: "h3", f: 9 }, { hook: "h4", f: 0 }] });
    expect(parsePlans(reply, 4, 2)).toEqual([
      { angle: "h1", hook: "h1", formulaNo: 2 },
      { angle: "h2", hook: "h2" },
      { angle: "h3", hook: "h3" },
      { angle: "h4", hook: "h4" },
    ]);
  });

  it("ignores f when there is no menu", () => {
    expect(parsePlans(JSON.stringify({ plans: [{ hook: "h", f: 1 }] }), 1)).toEqual([{ angle: "h", hook: "h" }]);
  });
});
