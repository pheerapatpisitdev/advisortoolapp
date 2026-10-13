import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Viewer } from "@/lib/auth/access";
import type { MemberAccess } from "@/lib/members/access";
import { DEFAULT_PASS_SETTINGS, type PassState } from "@/lib/members/pass";
import { PassReminder, priceLabel, reminderOf } from "@/components/shell/PassReminder";

/** The bar over /home and Studio in a member's last three days (owner, 2026-10-13). */

const NOW = "2026-11-13T03:00:00Z";
const draw = (end: string, priceSatang = 9900) => renderToStaticMarkup(createElement(PassReminder, { end, now: NOW, priceSatang }));

describe("PassReminder", () => {
  it("says how many days are left, until when, and links to renew at the price", () => {
    // 15 พ.ย. 00:30 in Bangkok, a little under two days away
    const html = draw("2026-11-14T17:30:00Z");
    expect(html).toContain("สมาชิกเหลืออีก 2 วัน (ถึง 15 พ.ย.)");
    expect(html).toContain('href="/membership"');
    expect(html).toContain("ต่ออายุ ฿99");
  });

  it("is drawn on the last day and the third, not before and not after the end", () => {
    expect(draw("2026-11-13T05:00:00Z")).toContain("สมาชิกเหลืออีก 1 วัน");
    expect(draw("2026-11-16T03:00:00Z")).toContain("สมาชิกเหลืออีก 3 วัน");
    expect(draw("2026-11-16T03:00:01Z")).toBe("");
    expect(draw(NOW)).toBe("");
    expect(draw("2026-11-01T00:00:00Z")).toBe("");
  });

  it("names the price in whole baht, and satang only when there are some", () => {
    expect(priceLabel(9900)).toBe("฿99");
    expect(priceLabel(14950)).toBe("฿149.50");
    expect(priceLabel(150000)).toBe("฿1,500");
  });
});

describe("reminderOf", () => {
  const member = { kind: "member", agentId: "m1" } as unknown as Viewer;
  const unitos = { kind: "unitos", agentId: "a1" } as unknown as Viewer;
  const on = { ...DEFAULT_PASS_SETTINGS, enabled: true, satang: 12900 };
  const end = new Date("2026-11-14T17:30:00Z");
  const live: PassState = { status: "live", period: { rowId: 1, kind: "paid", start: new Date("2026-10-15T17:30:00Z"), end }, end };
  const now = new Date(NOW);

  it("hands the bar the live pass's end and the owner's price", async () => {
    const read = vi.fn(async (): Promise<MemberAccess> => ({ gated: true, state: live, settings: on }));
    expect(await reminderOf(member, read, now)).toEqual({ end: end.toISOString(), now: NOW.replace("Z", ".000Z"), priceSatang: 12900 });
  });

  it("gives no bar while the switch is off, for an expired pass, or to anyone not a member", async () => {
    const off = vi.fn(async (): Promise<MemberAccess> => ({ gated: false }));
    expect(await reminderOf(member, off, now)).toBeNull();
    const gone = vi.fn(async (): Promise<MemberAccess> => ({ gated: true, state: { status: "expired", end }, settings: on }));
    expect(await reminderOf(member, gone, now)).toBeNull();
    const read = vi.fn(async (): Promise<MemberAccess> => ({ gated: true, state: live, settings: on }));
    expect(await reminderOf(unitos, read, now)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it("gives no bar, and logs, when the pass cannot be read: the bar must not break the page", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = vi.fn(async (): Promise<MemberAccess> => { throw new Error("down"); });
    expect(await reminderOf(member, broken, now)).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
