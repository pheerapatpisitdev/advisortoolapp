import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/scene-library/catalog";
import { filterLibrary, type LibraryFilter } from "@/lib/scene-library/filter";

const ALL: LibraryFilter = { q: "", type: "any", product: "any", state: "all" };
const ids = (f: Partial<LibraryFilter>) => filterLibrary(LIBRARY, { ...ALL, ...f }).map((i) => i.id);

describe("filterLibrary", () => {
  it("keeps everything with no filter, in the catalogue's order", () => {
    expect(ids({})).toEqual(LIBRARY.map((i) => i.id));
  });

  it("filters by type, product and state, together", () => {
    const devices = filterLibrary(LIBRARY, { ...ALL, type: "device" });
    expect(devices.length).toBeGreaterThan(0);
    expect(devices.every((i) => i.type === "device")).toBe(true);

    const healthReady = filterLibrary(LIBRARY, { ...ALL, type: "device", product: "health", state: "ready" });
    expect(healthReady.map((i) => i.id)).toEqual(LIBRARY.filter((i) => i.type === "device" && i.product === "health" && i.ready).map((i) => i.id));
    // round 1's eight and round 2's two โรคร้าย devices (cilump, incomestop)
    expect(healthReady).toHaveLength(10);

    const soonSaving = filterLibrary(LIBRARY, { ...ALL, product: "saving", state: "soon" });
    expect(soonSaving.length).toBeGreaterThan(0);
    expect(soonSaving.every((i) => i.product === "saving" && !i.ready)).toBe(true);

    expect(filterLibrary(LIBRARY, { ...ALL, state: "ready" }).every((i) => i.ready)).toBe(true);
    expect(filterLibrary(LIBRARY, { ...ALL, state: "soon" }).every((i) => !i.ready)).toBe(true);
  });

  it("finds a word in the name or in what it tells, case-insensitive", () => {
    expect(ids({ q: "ค่าห้อง" })).toContain("room");
    expect(ids({ q: "ICU" })).toContain("device-place-or-icu");
    expect(ids({ q: "icu" })).toContain("device-place-or-icu");
    // in the tells only: "ตัดแปะ" is in สต็อปโมชันกระดาษ's line, not its name
    expect(ids({ q: "ตัดแปะ" })).toContain("look-paper");
    // every word must be there
    expect(ids({ q: "ค่าห้อง ต่อคืน" })).toContain("room");
    expect(ids({ q: "ค่าห้อง นีออน" })).toEqual([]);
  });

  it("does not drop Thai tone marks: คาหอง is a different word", () => {
    expect(ids({ q: "คาหอง" })).toEqual([]);
  });

  it("matches what was typed with its marks in another order, split, or with a hidden space", () => {
    expect(ids({ q: "ค่าห้อง".normalize("NFD") })).toContain("room");
    // a tone mark typed before the vowel under it: แสงอุ่น as อ + ่ + ุ
    expect(ids({ q: "แสงอุ่น" })).toContain("look-minimal");
    // สระอำ typed as นิคหิต + สระอา
    expect(ids({ q: "คําถาม" })).toContain("format-quiz");
    // a zero-width space a Thai keyboard leaves between words
    expect(ids({ q: "ค่า​ห้อง" })).toContain("room");
  });

  it("is empty when nothing matches", () => {
    expect(filterLibrary(LIBRARY, { ...ALL, q: "ไม่มีคำนี้แน่นอน" })).toEqual([]);
    expect(filterLibrary(LIBRARY, { ...ALL, type: "format", product: "health" })).toEqual([]);
  });
});
