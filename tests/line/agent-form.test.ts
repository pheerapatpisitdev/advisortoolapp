import { beforeEach, describe, expect, it, vi } from "vitest";

/* The tables the form link reads, in memory: enough of supabase-js for select/eq/limit/maybeSingle/upsert. */
const db: Record<string, Record<string, unknown>[]> = {};
function from(name: string) {
  const rows = (db[name] ??= []);
  const filters: [string, unknown][] = [];
  const hit = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    limit: () => Promise.resolve({ data: hit().map((r) => ({ ...r })), error: null }),
    maybeSingle: () => Promise.resolve({ data: hit()[0] ? { ...hit()[0] } : null, error: null }),
    upsert: (row: Record<string, unknown>) => {
      const at = rows.find((r) => r.agent_id === row.agent_id);
      if (at) Object.assign(at, row); else rows.push({ ...row });
      return Promise.resolve({ error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from }) }));

const {
  agentFormReply, agentOfLine, asksForForm, cleanFormLink, formLinkFor, saveOwnFormLink, teamOrigin, teamTakesForms, unitclubFormLink,
} = await import("@/lib/line/agent-form");

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tenants = [
    { id: "t83g", slug: "83g", status: "active", custom_domain: "ktaxa83g.com", config: {} },
    { id: "takira", slug: "akira", status: "active", custom_domain: null, config: { features: { insurance: true } } },
    { id: "toff", slug: "off", status: "active", custom_domain: null, config: { features: { insurance: false } } },
    { id: "tgone", slug: "gone", status: "canceled", custom_domain: null, config: {} },
  ];
  db.agent_cards = [
    { agent_id: "a83g", tenant_id: "t83g", handle: "somchai", blocked: false },
    { agent_id: "aakira", tenant_id: "takira", handle: "nok", blocked: false },
    { agent_id: "ablocked", tenant_id: "t83g", handle: "bad", blocked: true },
    { agent_id: "aoff", tenant_id: "toff", handle: "x", blocked: false },
    { agent_id: "agone", tenant_id: "tgone", handle: "y", blocked: false },
  ];
  db.ins_agent_line = [{ agent_id: "a83g", line_user_id: "U83g" }];
});

describe("an agent's UnitClub form", () => {
  it("is on the team's own domain, else <slug>.unitclub.app", async () => {
    expect(await unitclubFormLink("a83g")).toBe("https://ktaxa83g.com/apply/somchai");
    expect(await unitclubFormLink("aakira")).toBe("https://akira.unitclub.app/apply/nok");
    expect(teamOrigin({ slug: "x", custom_domain: "  " })).toBe("https://x.unitclub.app");
  });

  it("is none for an agent with no handle, a blocked link, forms switched off, or a closed team", async () => {
    for (const id of ["member-google", "ablocked", "aoff", "agone"]) expect(await unitclubFormLink(id)).toBeNull();
    expect(teamTakesForms({ status: "past_due", config: null })).toBe(true);
    expect(teamTakesForms({ status: "active", config: { features: { insurance: "false" } } })).toBe(false);
  });
});

describe("the link the bot sends (ค)", () => {
  it("is the one the agent typed first, else their UnitClub form, else none", async () => {
    expect(await formLinkFor("a83g")).toEqual({ url: "https://ktaxa83g.com/apply/somchai", source: "unitclub" });
    await saveOwnFormLink("a83g", "https://forms.example.com/me");
    expect(await formLinkFor("a83g")).toEqual({ url: "https://forms.example.com/me", source: "own" });
    await saveOwnFormLink("a83g", null);
    expect((await formLinkFor("a83g"))?.source).toBe("unitclub");
    expect(await formLinkFor("member-google")).toBeNull();
  });

  it("goes to the agent whose LINE it is, and to nobody for a customer's", async () => {
    expect(await agentOfLine("U83g")).toBe("a83g");
    expect(await agentOfLine("Ucustomer")).toBeNull();
  });
});

describe("a link typed in ตั้งค่าส่วนตัว", () => {
  it("is kept as https, with https added when left off", () => {
    expect(cleanFormLink(" ktaxa83g.com/apply/somchai ")).toEqual({ ok: true, url: "https://ktaxa83g.com/apply/somchai" });
    expect(cleanFormLink("")).toEqual({ ok: true, url: null });
  });

  it("is refused when it is not a web address over https, or too long", () => {
    expect(cleanFormLink("http://example.com/form").ok).toBe(false);
    expect(cleanFormLink("javascript:alert(1)").ok).toBe(false);
    expect(cleanFormLink("ไม่ใช่ลิงก์").ok).toBe(false);
    expect(cleanFormLink(`https://example.com/${"a".repeat(500)}`).ok).toBe(false);
  });
});

describe("asking for a form", () => {
  it("is the customer menu's สนใจสมัคร, or a short message naming the form", () => {
    for (const t of ["สนใจสมัคร", "ขอฟอร์ม", "ขอฟอร์มสมัครให้ลูกค้าหน่อยครับ", "ขอลิงก์ฟอร์มหน่อย", "ใบคำขอ", "ขอลิงก์สมัคร", "form"]) {
      expect(asksForForm(t), t).toBe(true);
    }
  });

  it("is not saying a form is done, a quotation, or a long message that mentions one", () => {
    for (const t of ["ส่งฟอร์มแล้ว", "ลูกค้ากรอกฟอร์มเสร็จแล้ว", "ขอใบเสนอราคา ชาย 35", "ชาย 35 ล้านนึง", `ลูกค้าถามว่าฟอร์ม${"ก".repeat(80)}`]) {
      expect(asksForForm(t), t).toBe(false);
    }
  });
});

describe("the words the agent gets (ก ก)", () => {
  it("with a link: the link, then a message ready to pass on with the same link", () => {
    const [link, forward] = agentFormReply({ url: "https://ktaxa83g.com/apply/somchai", source: "unitclub" });
    expect(link).toContain("ลิงก์ฟอร์มใบคำขอของคุณ");
    expect(link).toContain("UnitClub");
    expect(forward).toContain("https://ktaxa83g.com/apply/somchai");
    expect(forward).not.toMatch(/ครับ|ค่ะ|ผม/);
  });

  it("without one: where to set it, and nothing else", () => {
    const words = agentFormReply(null);
    expect(words).toHaveLength(1);
    expect(words[0]).toContain("ตั้งค่าส่วนตัว › ลิงก์ฟอร์มใบคำขอของฉัน");
    expect(words[0]).not.toContain("sa-9f3a");
  });
});
