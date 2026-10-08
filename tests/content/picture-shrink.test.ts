import { describe, expect, it } from "vitest";
import { MAX_SIDE, MAX_UPLOAD_BYTES, THUMB_SIDE, fileProblem, shrunkSize } from "@/lib/content/picture-shrink";

/** What the browser does to a picture before it is sent to be read: nothing over 1,024 px, nothing enlarged. */

describe("shrunkSize", () => {
  it("brings the long side down to 1,024, keeping the shape", () => {
    expect(MAX_SIDE).toBe(1024);
    expect(shrunkSize(4000, 3000)).toEqual({ w: 1024, h: 768 });
  });

  it("never enlarges a picture that is small already", () => {
    expect(shrunkSize(600, 800)).toEqual({ w: 600, h: 800 });
  });

  it("rounds the short side, for a tall picture too", () => {
    expect(shrunkSize(800, 4000)).toEqual({ w: 205, h: 1024 });
  });
});

describe("shrunkSize for a thumbnail", () => {
  it("brings the long side down to 256 and never enlarges", () => {
    expect(THUMB_SIDE).toBe(256);
    expect(shrunkSize(4000, 3000, THUMB_SIDE)).toEqual({ w: 256, h: 192 });
    expect(shrunkSize(100, 80, THUMB_SIDE)).toEqual({ w: 100, h: 80 });
  });
});

describe("fileProblem", () => {
  it("turns away a kind that is not jpg, png or webp, HEIC included, with a Thai sentence", () => {
    const msg = fileProblem({ type: "image/heic", size: 1 });
    expect(msg).toEqual(expect.stringContaining("jpg"));
  });

  it("turns away a file over 8 MB, and takes exactly 8 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
    expect(fileProblem({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toEqual(expect.stringContaining("8 MB"));
    expect(fileProblem({ type: "image/png", size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("takes a normal webp", () => {
    expect(fileProblem({ type: "image/webp", size: 1000 })).toBeNull();
  });
});
