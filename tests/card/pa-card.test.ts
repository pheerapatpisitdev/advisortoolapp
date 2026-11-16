import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as CARD } from "@/app/api/card/pa-card/route";
import { GET as TABLE } from "@/app/api/card/pa-table/route";
import { paCard, paCardFrom, paCardPath, paTable, paTablePath } from "@/lib/pa-card";
import { paFamily } from "@/lib/pa-plans";

const at = (path: string) => new NextRequest(new URL(path, "https://advisortool.test"));
const read = (path: string) => paCardFrom(new URL(path, "https://advisortool.test").searchParams);

/** The PA page had only its text to send (owner, 2026-11-16: ก ก on mockup https://claude.ai/artifact/JS18RH7pQi6hbtp4tcWPq2). */
describe("PA's card and all-plans table, for ส่งให้ลูกค้า", () => {
  it("are asked for by the plan's code, the occupation class and the age", () => {
    expect(paCardPath({ code: "PAP02", cls: 1, age: 35 })).toMatch(/^\/api\/card\/pa-card\?plan=PAP02&cls=1&age=35&v=/);
    expect(paTablePath({ code: "PAP02", cls: 1, age: 35 })).toMatch(/^\/api\/card\/pa-table\?plan=PAP02&cls=1&age=35&v=/);
  });

  it("the card states the page's own figures", () => {
    const card = paCard(read(paCardPath({ code: "PAP02", cls: 1, age: 35 }))!);
    expect(card.planLine).toBe("ประกันอุบัติเหตุ PA Platinum · แผน Platinum 02");
    expect(card.insuredLine).toBe("อายุ 35 ปี · ขั้นอาชีพ 1");
    expect(card.premium).toBe("8,000");
    expect(card.perDay).toBe("ตกวันละ 22 บาท");
    expect(card.main.amount).toBe("2,000,000");
    expect(card.rows.map((r) => r.amount)).toEqual(["1,000,000", "1,000,000", "120,000", "2,000", "2,500,000"]);
  });

  it("PA Max has no medical or weekly row", () => {
    const card = paCard(read(paCardPath({ code: "PAM03", cls: 2, age: 40 }))!);
    expect(card.premium).toBe("6,750");
    expect(card.rows.map((r) => r.amount)).toEqual(["1,000,000", "1,000,000", "3,750,000"]);
  });

  it("the table carries every plan of the family, the chosen one marked, a premium row per class taken", () => {
    const t = paTable(read(paTablePath({ code: "PAP02", cls: 1, age: 35 }))!);
    expect(t.title).toBe("PA Platinum · ตารางทุกแผน");
    expect(t.columns).toEqual(["Platinum 01", "Platinum 02", "Platinum 03", "Platinum 04", "Platinum 05"]);
    expect(t.picked).toBe(1);
    expect(t.rows[0].cells).toEqual(["1,000,000", "2,000,000", "3,000,000", "5,000,000", "10,000,000"]);
    expect(t.premiums.map((r) => r.label)).toEqual(["เบี้ย/ปี ขั้นอาชีพ 1", "เบี้ย/ปี ขั้นอาชีพ 2"]);
    expect(t.premiums[1].cells).toEqual(["6,000", "9,600", "13,500", "20,000", "38,500"]);
    // Classic A alone takes class 3: the other plan's cell is a dash
    const classic = paTable(read(paTablePath({ code: "PAC04", cls: 3, age: 10 }))!);
    expect(classic.premiums.map((r) => r.cells)).toEqual([["3,500", "4,500"], ["4,300", "5,500"], ["5,150", "–"]]);
    expect(paTable(read(paTablePath({ code: "PAM01", cls: 1, age: 30 }))!).columns).toHaveLength(paFamily("max").plans.length);
  });

  it("no quote the page would not give", () => {
    for (const q of ["plan=PAP02&cls=1", "plan=NOPE&cls=1&age=35", "plan=PAP02&cls=3&age=35", "plan=PAP02&cls=1&age=10", "plan=PAC04&cls=4&age=30", "plan=PAP02&cls=1&age=3x"]) {
      expect(read(`/api/card/pa-card?${q}`)).toBeUndefined();
    }
  });

  it("both draw as pictures, and refuse what is no quote", async () => {
    for (const [GET, path, out] of [
      [CARD, paCardPath({ code: "PAP02", cls: 1, age: 35 }), process.env.PA_CARD_OUT],
      [TABLE, paTablePath({ code: "PAP02", cls: 1, age: 35 }), process.env.PA_TABLE_OUT],
      [TABLE, paTablePath({ code: "PAM04", cls: 2, age: 35 }), process.env.PA_MAX_TABLE_OUT],
      [CARD, `${paCardPath({ code: "PAC04", cls: 3, age: 8 })}&name=${encodeURIComponent("สมชาย ใจดี")}`, process.env.PA_NAMED_OUT],
    ] as const) {
      const res = await GET(at(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      if (out) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(out, Buffer.from(await res.arrayBuffer()));
      }
    }
    expect((await CARD(at("/api/card/pa-card?plan=PAP02&cls=3&age=35"))).status).toBe(400);
    expect((await TABLE(at("/api/card/pa-table?plan=PAP02&cls=1&age=99"))).status).toBe(400);
  }, 60_000);
});
