import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/card/gsaving-table/route";
import { gsavingTablePath } from "@/lib/global-saving-table-card";
import { gsQuoteText } from "@/lib/global-saving-text";
import { quoteGlobalSaving } from "@/calc/global-saving/engine";

const at = (path: string) => new NextRequest(new URL(path, "https://advisortool.test"));

describe("Global Savings' table card (owner chose ค, 2026-10-20)", () => {
  it("is asked for by the figure the page was typed in", () => {
    expect(gsavingTablePath({ age: 35, basis: "premium", amount: 50_000 })).toMatch(/^\/api\/card\/gsaving-table\?age=35&prem=50000&v=/);
    expect(gsavingTablePath({ age: 35, basis: "sumAssured", amount: 50_051 })).toMatch(/^\/api\/card\/gsaving-table\?age=35&sum=50051&v=/);
  });

  it("draws the page's quote as a picture", async () => {
    const res = await GET(at(gsavingTablePath({ age: 35, basis: "premium", amount: 50_000 })));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    if (process.env.GS_CARD_OUT) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(process.env.GS_CARD_OUT, Buffer.from(await res.arrayBuffer()));
    }
  }, 30_000);

  it("refuses an address that names no quote the page would give", async () => {
    for (const q of ["age=35", "age=35&prem=50000&sum=50051", "age=80&prem=50000", "age=35&prem=100"]) {
      expect((await GET(at(`/api/card/gsaving-table?${q}`))).status).toBe(400);
    }
  });

  it("says the guarantee as certain and the bonus as an example", () => {
    const text = gsQuoteText(35, quoteGlobalSaving({ basis: "premium", amount: 50_000, age: 35 }));
    expect(text).toContain("เบี้ยปีละ 50,000 บาท (รวม 400,000 บาท)");
    expect(text).toContain("ทุนประกัน 50,051 บาท");
    expect(text).toContain("เงินการันตีรวม 407,916 บาท");
    expect(text).toContain("รับรวมประมาณ 585,666 บาท (โบนัสไม่การันตี)");
  });
});
