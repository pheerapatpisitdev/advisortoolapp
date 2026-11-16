import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/card/gsaving-card/route";
import { GET as GET255 } from "@/app/api/card/gsaving255-card/route";
import { gsaving255CardPath, gsavingCardPath } from "@/lib/global-saving-card";
import { gs255QuoteText, gsQuoteText } from "@/lib/global-saving-text";
import { quoteGlobalSaving } from "@/calc/global-saving/engine";
import { quoteGlobalSaving255 } from "@/calc/global-saving/engine-25-5";

const at = (path: string) => new NextRequest(new URL(path, "https://advisortool.test"));

describe("Global Savings' whole-page card (owner chose ข, 2026-10-20)", () => {
  it("is asked for by the figure the page was typed in", () => {
    expect(gsavingCardPath({ age: 35, basis: "premium", amount: 50_000 })).toMatch(/^\/api\/card\/gsaving-card\?age=35&prem=50000&v=/);
    expect(gsavingCardPath({ age: 35, basis: "sumAssured", amount: 50_051 })).toMatch(/^\/api\/card\/gsaving-card\?age=35&sum=50051&v=/);
  });

  it("draws the page's quote as a picture", async () => {
    const res = await GET(at(gsavingCardPath({ age: 35, basis: "premium", amount: 50_000 })));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    if (process.env.GS_CARD_OUT) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(process.env.GS_CARD_OUT, Buffer.from(await res.arrayBuffer()));
    }
  }, 30_000);

  it("refuses an address that names no quote the page would give", async () => {
    for (const q of ["age=35", "age=35&prem=50000&sum=50051", "age=80&prem=50000", "age=35&prem=100"]) {
      expect((await GET(at(`/api/card/gsaving-card?${q}`))).status).toBe(400);
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

/** 25/5 sends as 15/8 does (owner, 2026-11-16): the same drawing, told its own plan. */
describe("Global Savings 25/5's whole-page card", () => {
  it("is asked for by the figure the page was typed in, at its own address", () => {
    expect(gsaving255CardPath({ age: 40, basis: "sumAssured", amount: 100_000 })).toMatch(/^\/api\/card\/gsaving255-card\?age=40&sum=100000&v=/);
    expect(gsaving255CardPath({ age: 40, basis: "premium", amount: 99_500 })).toMatch(/^\/api\/card\/gsaving255-card\?age=40&prem=99500&v=/);
  });

  it("draws the page's quote as a picture", async () => {
    const res = await GET255(at(gsaving255CardPath({ age: 40, basis: "sumAssured", amount: 100_000 })));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    if (process.env.GS255_CARD_OUT) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(process.env.GS255_CARD_OUT, Buffer.from(await res.arrayBuffer()));
    }
  }, 30_000);

  it("refuses an address that names no quote the page would give", async () => {
    for (const q of ["age=40", "age=40&prem=99500&sum=100000", "age=80&sum=100000", "age=40&sum=10000", "age=40&sum=20000001"]) {
      expect((await GET255(at(`/api/card/gsaving255-card?${q}`))).status).toBe(400);
    }
  });

  it("says the guarantee as certain, the bonus as an example, and when it is paid", () => {
    const text = gs255QuoteText(40, quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 40 }));
    expect(text).toContain("Global Savings Plus 25/5");
    expect(text).toContain("เบี้ยปีละ 99,500 บาท (รวม 497,500 บาท)");
    expect(text).toContain("ทุนประกัน 100,000 บาท");
    expect(text).toContain("เงินการันตีรวม 525,000 บาท");
    expect(text).toContain("ปีละ 1,000 บาท · ครบสัญญา 501,000 บาท");
    expect(text).toContain("รับรวมประมาณ 954,640 บาท (โบนัสไม่การันตี)");
    expect(text).toContain("สิ้นปีที่ 10, 15, 20 และตอนครบสัญญา");
  });
});
