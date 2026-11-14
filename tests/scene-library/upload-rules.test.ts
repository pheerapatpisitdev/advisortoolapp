import { describe, expect, it } from "vitest";
import {
  FILE_MAX, isUploadId, isUploadKind, KIND_HINT, KIND_NAME, KIND_TELLS, NAME_MAX, NOTE_MAX, PER_PERSON,
  REASONS, SHOTS_MAX, sniff, stateWord} from "@/lib/scene-library/upload-rules";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const enc = (s: string) => new TextEncoder().encode(s);

describe("sniff", () => {
  it("reads PNG and JPEG from the first bytes", () => {
    expect(sniff(PNG)).toBe("png");
    expect(sniff(JPG)).toBe("jpeg");
  });
  it("refuses SVG, HTML, a short PNG head and nothing", () => {
    expect(sniff(enc("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniff(enc("<html><body></body></html>"))).toBeNull();
    expect(sniff(PNG.slice(0, 7))).toBeNull();
    expect(sniff(JPG.slice(0, 2))).toBeNull();
    expect(sniff(new Uint8Array())).toBeNull();
  });
});

describe("stateWord", () => {
  it("says the six phrases", () => {
    expect(stateWord("part", "wait")).toBe("รออนุมัติ");
    expect(stateWord("style", "wait")).toBe("รออนุมัติ");
    expect(stateWord("ask", "wait")).toBe("รอเจ้าของดู");
    expect(stateWord("part", "ok")).toBe("ใช้ร่วมแล้ว");
    expect(stateWord("part", "no")).toBe("ไม่ผ่าน");
    expect(stateWord("ask", "queue")).toBe("อยู่ในคิวทำ");
    expect(stateWord("ask", "closed")).toBe("ปิดคำขอ");
  });
  it("a withdrawn file is ถอนออกแล้ว", () => {
    expect(stateWord("part", "gone")).toBe("ถอนออกแล้ว");
    expect(stateWord("style", "gone")).toBe("ถอนออกแล้ว");
  });
});

describe("constants", () => {
  it("holds the limits", () => {
    expect([NAME_MAX, NOTE_MAX, FILE_MAX, PER_PERSON, SHOTS_MAX]).toEqual([60, 300, 5 * 1024 * 1024, 20, 3]);
  });
  it("names the kinds and hints their files", () => {
    expect(KIND_NAME).toEqual({ part: "ชิ้นส่วนภาพ", style: "ภาพสไตล์", ask: "คำขอชิ้นใหม่" });
    expect(KIND_HINT).toEqual({ part: "PNG ไม่เกิน 5 MB", style: "JPG หรือ PNG ไม่เกิน 5 MB", ask: "ภาพหน้าจอไม่เกิน 3 ภาพ (ไม่บังคับ)" });
    for (const k of ["part", "style", "ask"] as const) expect(KIND_TELLS[k].length).toBeGreaterThan(0);
  });
  it("gives the four reasons in the spec's order", () => {
    expect(REASONS).toEqual(["อาจติดลิขสิทธิ์", "มีข้อมูลหรือหน้าลูกค้า", "ภาพไม่ชัดหรือเล็กเกินไป", "ไม่เกี่ยวกับงานประกัน"]);
  });
});

describe("guards", () => {
  it("knows an upload kind", () => {
    expect(isUploadKind("part")).toBe(true);
    expect(isUploadKind("ask")).toBe(true);
    expect(isUploadKind("video")).toBe(false);
    expect(isUploadKind(1)).toBe(false);
  });
  it("knows a uuid", () => {
    expect(isUploadId("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f")).toBe(true);
    expect(isUploadId("library/../x")).toBe(false);
    expect(isUploadId(undefined)).toBe(false);
  });
});
