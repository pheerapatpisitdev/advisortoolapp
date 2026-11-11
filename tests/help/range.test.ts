import { describe, expect, it } from "vitest";
import { byteRange } from "@/lib/help/range";

describe("byteRange", () => {
  it("cuts what an iPhone asks for", () => {
    expect(byteRange("bytes=0-1", 1000)).toEqual({ start: 0, end: 1 });
    expect(byteRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(byteRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });
  it("sends the whole file when there is no usable range", () => {
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange("bytes=0-1,5-9", 1000)).toBeNull();
    expect(byteRange("bytes=-", 1000)).toBeNull();
  });
  it("refuses a range past the end", () => {
    expect(byteRange("bytes=1000-", 1000)).toBe("bad");
    expect(byteRange("bytes=9-3", 1000)).toBe("bad");
    expect(byteRange("bytes=-0", 1000)).toBe("bad");
  });
});
