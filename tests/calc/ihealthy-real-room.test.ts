import { describe, expect, it } from "vitest";
import { iHealthyCompareCard } from "@/lib/ihealthy-compare-card";
import { iHealthyFullCard } from "@/lib/ihealthy-full-card";
import { FULL_ROW_LABEL } from "@/lib/ihealthy-full-rows";
import { LANGS } from "@/lib/ihealthy-lang";
import { REAL_ROOM_WORDS, realRoomText, roomShown } from "@/lib/ihealthy-real-room";

/** Pinned, as the card's own tests are: a lapsed rate table has no price at all. */
const WHILE_CURRENT = new Date("2026-09-12");
const OPENING = "age=35&sex=M&base=WLF99HX&sa=50000&plan=GOLD&area=&cover=&mode=annual";
const label = REAL_ROOM_WORDS.th.label;

describe("the real-room line (owner, 2026-11-18)", () => {
  it("has its words in every language of the page", () => {
    for (const lang of LANGS) {
      for (const text of Object.values(REAL_ROOM_WORDS[lang])) expect(text.trim()).toBeTruthy();
    }
  });

  it("says each plan's range, the owner's figures", () => {
    expect(realRoomText("SMART")).toBe("1,500 – 2,500");
    expect(realRoomText("PLATINUM")).toBe("21,000 – 30,000");
    expect(realRoomText("NOPE")).toBe("-");
  });

  it("is on unless the address says room=0", () => {
    expect(roomShown(undefined)).toBe(true);
    expect(roomShown(null)).toBe(true);
    expect(roomShown("1")).toBe(true);
    expect(roomShown("0")).toBe(false);
    expect(roomShown(["0"])).toBe(false);
  });

  it("sits under the room row of the whole-table picture, all six plans", () => {
    const rows = iHealthyFullCard(new URLSearchParams(OPENING), WHILE_CURRENT).rows;
    const at = rows.findIndex((r) => r.label === label);
    expect(rows[at - 1].label).toBe(FULL_ROW_LABEL.th["1"]);
    expect(rows[at].cells.map((c) => c.text)).toEqual([
      "1,500 – 2,500", "3,000 – 4,000", "5,500 – 7,000", "9,000 – 11,000", "15,000 – 18,000", "21,000 – 30,000",
    ]);
  });

  it("is left out of the whole-table picture with room=0", () => {
    const rows = iHealthyFullCard(new URLSearchParams(`${OPENING}&room=0`), WHILE_CURRENT).rows;
    expect(rows.some((r) => r.label === label)).toBe(false);
  });

  it("sits once under the room row of the 4-plan picture, and goes with room=0", () => {
    const on = iHealthyCompareCard(new URLSearchParams(OPENING), WHILE_CURRENT).rows;
    expect(on.filter((r) => r.label === label)).toHaveLength(1);
    expect(on.find((r) => r.label === label)!.cells.map((c) => c.text)).toEqual([
      "1,500 – 2,500", "3,000 – 4,000", "5,500 – 7,000", "9,000 – 11,000",
    ]);
    const off = iHealthyCompareCard(new URLSearchParams(`${OPENING}&room=0`), WHILE_CURRENT).rows;
    expect(off.some((r) => r.label === label)).toBe(false);
  });
});
