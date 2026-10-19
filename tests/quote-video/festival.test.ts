import { describe, expect, it } from "vitest";
import { FESTIVAL_KEYS, festivalGreeting, festivalOn, readFestival } from "@/lib/quote-video/festival";
import { VIDEO_FESTIVAL_COLORS } from "@/lib/card-theme";
import { readTheme } from "@/lib/quote-video/theme-keys";

/** noon in Bangkok on a day */
const bkk = (d: string) => new Date(`${d}T12:00:00+07:00`);

describe("ธีมเทศกาล's days (owner, 2026-10-20)", () => {
  it("comes on seven days before a festival and goes off after its last day", () => {
    expect(festivalOn(bkk("2026-11-16"))).toBeNull();
    expect(festivalOn(bkk("2026-11-17"))?.key).toBe("loykrathong");
    expect(festivalOn(bkk("2026-11-24"))?.key).toBe("loykrathong");
    expect(festivalOn(bkk("2026-11-25"))).toBeNull();
    expect(festivalOn(bkk("2026-10-20"))).toBeNull();
  });

  it("keeps สงกรานต์ on through its three days", () => {
    expect(festivalOn(bkk("2027-04-06"))?.key).toBe("songkran");
    expect(festivalOn(bkk("2027-04-15"))?.key).toBe("songkran");
    expect(festivalOn(bkk("2027-04-16"))).toBeNull();
  });

  it("sees ปีใหม่ from late December, with next year's พ.ศ.", () => {
    const on = festivalOn(bkk("2026-12-26"));
    expect(on?.key).toBe("newyear");
    expect(on?.greeting).toBe("สวัสดีปีใหม่ 2570");
    expect(festivalOn(bkk("2027-01-01"))?.greeting).toBe("สวัสดีปีใหม่ 2570");
    expect(festivalOn(bkk("2027-01-02"))).toBeNull();
  });

  it("goes by the day in Bangkok, not in UTC", () => {
    // 2026-11-16 at 18:00 UTC is already the 17th in Bangkok
    expect(festivalOn(new Date("2026-11-16T18:00:00Z"))?.key).toBe("loykrathong");
  });

  it("finds a lunar festival only in the years listed", () => {
    expect(festivalOn(bkk("2027-02-01"))?.key).toBe("cny");
    expect(festivalOn(bkk("2031-01-25"))).toBeNull();
  });

  it("covers วันพ่อ and วันแม่", () => {
    expect(festivalOn(bkk("2026-12-01"))?.greeting).toBe("สุขสันต์วันพ่อ");
    expect(festivalOn(bkk("2027-08-12"))?.greeting).toBe("สุขสันต์วันแม่");
  });

  it("keeps a clip's greeting when it is drawn after the days end", () => {
    expect(festivalGreeting("newyear", bkk("2027-01-03"))).toBe("สวัสดีปีใหม่ 2570");
    expect(festivalGreeting("loykrathong", bkk("2026-11-24"))).toBe("สุขสันต์วันลอยกระทง");
  });

  it("has colours for every festival, and reads only the festivals it knows", () => {
    for (const k of FESTIVAL_KEYS) expect(VIDEO_FESTIVAL_COLORS[k].ground).toMatch(/^#/);
    expect(readFestival("cny")).toBe("cny");
    expect(readFestival("halloween")).toBeUndefined();
    expect(readTheme("festival")).toBe("festival");
  });
});
