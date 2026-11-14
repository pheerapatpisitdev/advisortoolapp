import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { clipCover, clipFile, clipLength, HELP_CLIPS, helpClip } from "@/lib/help/clips";

const PUBLIC = path.join(process.cwd(), "public");
const APP = path.join(process.cwd(), "src/app");

describe("วิธีใช้งาน's clips", () => {
  it("each has its film and its cover on disk, small enough for a phone", () => {
    for (const c of HELP_CLIPS) {
      const film = path.join(PUBLIC, clipFile(c.id));
      expect(existsSync(film), c.id).toBe(true);
      expect(existsSync(path.join(PUBLIC, clipCover(c.id))), c.id).toBe(true);
      // Cloudflare serves no file over 25 MB; these are meant to be a tenth of that
      expect(statSync(film).size, c.id).toBeLessThan(5 * 1024 * 1024);
    }
  });

  it("has one address per clip, and a button only to a page that exists", () => {
    expect(new Set(HELP_CLIPS.map((c) => c.id)).size).toBe(HELP_CLIPS.length);
    for (const c of HELP_CLIPS) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/);
      if (c.go) expect(existsSync(path.join(APP, c.go.href, "page.tsx")), c.go.href).toBe(true);
    }
    // the two pages that link straight to their clip
    expect(helpClip("topup")).toBeDefined();
    expect(helpClip("quote-video")).toBeDefined();
    // ตั้งค่าส่วนตัว links to its clip from ข้อความส่งให้ลูกค้า
    expect(helpClip("share-text")).toBeDefined();
  });

  it("writes a length the way a player does", () => {
    expect(clipLength(73)).toBe("1:13");
    expect(clipLength(104)).toBe("1:44");
  });
});
