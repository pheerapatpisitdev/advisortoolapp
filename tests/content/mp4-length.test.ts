import { describe, expect, it } from "vitest";
import { mp4Seconds, mvhdSeconds } from "@/lib/content/mp4-length";

/** a clip's length read from its own file (owner chose 17ก, 2026-10-18) */

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type: string, body: number[]) => [...be32(8 + body.length), ...[...type].map((c) => c.charCodeAt(0)), ...body];
const mvhd0 = (scale: number, units: number) => box("mvhd", [0, 0, 0, 0, ...be32(0), ...be32(0), ...be32(scale), ...be32(units), ...new Array(80).fill(0)]);
const mvhd1 = (scale: number, units: number) => box("mvhd", [1, 0, 0, 0, ...be32(0), ...be32(0), ...be32(0), ...be32(0), ...be32(scale), ...be32(Math.floor(units / 2 ** 32)), ...be32(units >>> 0), ...new Array(80).fill(0)]);

/** a file as bytes, and a ReadRange over it that counts what it was asked */
function file(bytes: number[]) {
  const b = Uint8Array.from(bytes);
  const asked: [number, number][] = [];
  return { size: b.length, asked, read: async (s: number, e: number) => { asked.push([s, e]); return b.subarray(s, e + 1); } };
}

describe("mp4Seconds", () => {
  it("reads moov at the start (a phone's fast-start file)", async () => {
    const f = file([...box("ftyp", [0x69, 0x73, 0x6f, 0x6d]), ...box("moov", mvhd0(600, 600 * 42)), ...box("mdat", new Array(5000).fill(1))]);
    expect(await mp4Seconds(f.read, f.size)).toBe(42);
  });

  it("reads moov at the end, hopping over the picture data unread", async () => {
    const f = file([...box("ftyp", [1, 2, 3, 4]), ...box("mdat", new Array(100_000).fill(1)), ...box("moov", mvhd0(1000, 160_000))]);
    expect(await mp4Seconds(f.read, f.size)).toBe(160);
    expect(f.asked.every(([s, e]) => e - s < 70_000)).toBe(true);
  });

  it("reads a version-1 header", () => {
    expect(mvhdSeconds(Uint8Array.from(mvhd1(90_000, 90_000 * 75).slice(8)))).toBe(75);
  });

  it("says null for a file with no movie header", async () => {
    const f = file([...box("ftyp", [1, 2, 3, 4]), ...box("mdat", [1, 2, 3])]);
    expect(await mp4Seconds(f.read, f.size)).toBeNull();
    expect(await mp4Seconds(file([1, 2, 3]).read, 3)).toBeNull();
  });
});
