import { describe, expect, it } from "vitest";
import { checkPolicy } from "@/lib/content/policy";

const codes = (text: string) => checkPolicy(text).map((f) => f.code);

describe("checkPolicy", () => {
  it("stops copy that tells the reader what they are", () => {
    expect(codes("คุณป่วยเป็นโรคเรื้อรังอยู่ใช่ไหม")).toEqual(["health_you"]);
    expect(codes("คุณกำลังมีหนี้บ้านอยู่ใช่ไหม")).toEqual(["debt_you"]);
    expect(codes("คุณอายุ 40 แล้ว ต้องมีประกัน")).toEqual(["age_you"]);
    expect(codes("อายุ 50 ปีขึ้นไปสมัครได้ทันที")).toEqual(["age_you"]);
  });

  it("lets a supposition through — insurance is sold on 'if'", () => {
    expect(codes("ถ้าวันหนึ่งคุณป่วยหนัก ใครจะดูแลครอบครัว")).toEqual([]);
    expect(codes("สมมติว่าคุณป่วยกะทันหัน")).toEqual([]);
    // the supposition covers its own sentence and not the next one
    expect(codes("ถ้าคุณป่วย… แล้วคุณป่วยอยู่ตอนนี้ใช่ไหม")).toEqual(["health_you"]);
  });

  it("leaves a third-person example alone", () => {
    // the briefs price "ผู้หญิงอายุ 35"; that is an example, not the reader
    expect(codes("ตัวอย่าง ผู้หญิงอายุ 35 ทุน 500,000 บาท เบี้ยวันละ 20 บาท")).toEqual([]);
  });

  it("stops guarantees and requests for personal data", () => {
    expect(codes("สมัครวันนี้ อนุมัติ 100%")).toEqual(["guarantee"]);
    expect(codes("การันตีอนุมัติทุกเคส")).toEqual(["guarantee"]);
    expect(codes("ส่งเลขบัตรประชาชนมาในคอมเมนต์")).toEqual(["pii_request"]);
  });

  it("warns, without stopping, on an unprovable superlative", () => {
    const [f] = checkPolicy("เบี้ยถูกที่สุดในประเทศ");
    expect(f.code).toBe("superlative");
    expect(f.severity).toBe("warn");
  });

  it("says nothing about clean copy", () => {
    expect(codes("ทุน 1,000,000 บาท ถ้าเสียชีวิตก่อนอายุ 60 ครอบครัวได้ 2 เท่า")).toEqual([]);
  });

  it("reads the polite ท่าน as the reader too", () => {
    expect(codes("ท่านป่วยเป็นเบาหวานอยู่ใช่ไหม")).toEqual(["health_you"]);
    expect(codes("ท่านมีหนี้บ้านอยู่ใช่ไหม")).toEqual(["debt_you"]);
    expect(codes("ท่านตกงานอยู่หรือเปล่า")).toEqual(["job_you"]);
    expect(codes("ถ้าวันหนึ่งท่านป่วยหนัก ใครดูแล")).toEqual([]);
  });

  it("reads Thai digits as digits", () => {
    expect(codes("คุณอายุ ๔๐ แล้ว ต้องมีประกัน")).toEqual(["age_you"]);
    expect(codes("อายุ ๕๐ ปีขึ้นไปสมัครได้ทันที")).toEqual(["age_you"]);
    expect(codes("สมัครวันนี้ อนุมัติ ๑๐๐%")).toEqual(["guarantee"]);
    expect(codes("อันดับ ๑ ของประเทศ")).toEqual(["superlative"]);
  });
});

describe("checkPolicy — หาทีม's own rules", () => {
  const recruit = (text: string) => checkPolicy(text, { recruit: true }).map((f) => f.code);

  it("stops an income figure or a promise of one", () => {
    expect(recruit("รายได้เดือนละ 50,000 บาท")).toEqual(["income_promise"]);
    expect(recruit("สร้างรายได้หลักแสนต่อเดือน")).toEqual(["income_promise"]);
    expect(recruit("การันตีรายได้ทุกเดือน")).toEqual(["income_guarantee"]);
    expect(recruit("มีรายได้แน่นอน")).toEqual(["income_guarantee"]);
  });

  it("stops picking applicants by sex, age or status", () => {
    expect(recruit("รับสมัครเฉพาะผู้หญิง")).toEqual(["hire_filter"]);
    expect(recruit("อายุ 25-35 ปี สมัครได้เลย")).toContain("hire_filter");
    expect(recruit("รับคนโสดเท่านั้น")).toEqual(["hire_filter"]);
  });

  it("stops network-marketing words and warns on easy money", () => {
    expect(recruit("สร้างดาวน์ไลน์ของคุณเอง")).toEqual(["mlm"]);
    const [f] = checkPolicy("งานสบาย รวยเร็ว", { recruit: true });
    expect(f.code).toBe("easy_money");
    expect(f.severity).toBe("warn");
  });

  it("warns on a promise to pass the licence exam", () => {
    const [f] = checkPolicy("ทีมเราช่วยเตรียมสอบให้ตั้งแต่ต้นจนผ่าน", { recruit: true });
    expect(f.code).toBe("exam_promise");
    expect(f.severity).toBe("warn");
    expect(recruit("การันตีสอบผ่าน")).toContain("exam_promise");
  });

  it("lets the honest line through", () => {
    expect(recruit("รายได้ขึ้นกับผลงาน ทีมสอนตั้งแต่ศูนย์ ต้องสอบใบอนุญาต คปภ.")).toEqual([]);
    expect(recruit("ทุกเพศทุกวัยสมัครได้")).toEqual([]);
  });

  it("is off for the plan posts, which quote premiums in baht", () => {
    expect(codes("รายได้เดือนละ 50,000 บาท")).toEqual([]);
  });
});

describe("English rules", () => {
  const codes = (t: string) => checkPolicy(t).map((f) => f.code);
  it.each([
    ["Are you sick of waiting rooms? Are you sick?", "health_you_en"],
    ["You have diabetes, so…", "health_you_en"],
    ["Are you in debt from hospital bills?", "debt_you_en"],
    ["Now that you're over 50, cover gets harder.", "age_you_en"],
    ["Lost your job last month?", "job_you_en"],
    ["100% approved, guaranteed acceptance.", "guarantee_en"],
    ["Send us your passport number to start.", "pii_request_en"],
    ["The best in Thailand.", "superlative_en"],
    ["Perfect for your O-A visa.", "visa_type_en"],
    ["Use it for a retirement visa.", "visa_type_en"],
    ["Your visa approved, guaranteed.", "visa_promise_en"],
    ["Our plan works for every visa.", "visa_promise_en"],
    ["It works for any visa.", "visa_promise_en"],
    ["Valid for all visas.", "visa_promise_en"],
    ["We're number one.", "superlative_en"],
    ["The #1 health plan.", "superlative_en"],
    ["The best plan in Thailand.", "superlative_en"],
    ["The cheapest insurance in Thailand.", "superlative_en"],
    // a visa named on its own, without the word "visa" after it (final review, 2026-10-02)
    ["Great for O-A holders", "visa_type_en"],
    ["Need insurance for your DTV?", "visa_type_en"],
    ["On a Non-O? Message us", "visa_type_en"],
    ["Applying for an LTR?", "visa_type_en"],
    ["Retiring here on an O-X?", "visa_type_en"],
    ["Covers the insurance requirement for Thai Elite", "visa_type_en"],
    ["Send us your PIN code", "pii_request_en"],
    // emergency treatment within 90 days of travel is all the cover abroad there is
    ["You're covered anywhere in the world.", "worldwide_en"],
    ["Enjoy global coverage.", "worldwide_en"],
    ["Worldwide cover for expats", "worldwide_en"],
  ])("catches %s", (text, code) => expect(codes(text)).toContain(code));
  it.each([
    "If you get sick, the bill is covered up to the plan's limit.",
    "When you change jobs, your company plan ends.",
    "Message us to check your visa.",
    "Renewable up to age 98.",
    "Bring your passport when you visit us.",
    "You're covered for cancer treatment.",
    "Are you covered for cancer?",
    "You have cancer cover from day one.",
    "You are protected against chronic illness.",
    "Premiums depend on your age and plan.",
    "If you're under 65, you can apply.",
    "If you are aged 60, you can apply.",
    "Cover is separate from visa approval.",
    "Get help for your visa questions.",
    "Guaranteed coverage up to age 98.",
    "Ask us about your visa.",
    "Plan for a long-term stay.",
    "Share this post and pin it for later.",
    "It is not worldwide cover.",
    "It isn't worldwide, and it's not global cover.",
    "Emergency treatment abroad within 90 days of travel.",
  ])("lets %s through", (text) => expect(checkPolicy(text).filter((f) => f.code.endsWith("_en"))).toEqual([]));
});

describe("Thai in an English piece", () => {
  it("stops an English piece that carries Thai, and names the first Thai run", () => {
    const [f] = checkPolicy("Cover that stays with you\n#ประกันสุขภาพ #expat", { lang: "en" }).filter((x) => x.code === "thai_in_english");
    expect(f).toMatchObject({ severity: "block", match: "ประกันสุขภาพ" });
    expect(f.message).toBe("ชิ้นภาษาอังกฤษมีตัวอักษรไทย — โพสต์อังกฤษต้องไม่มีภาษาไทย");
    expect(f.fix).toBe("แก้ส่วนที่เป็นภาษาไทยให้เป็นภาษาอังกฤษ");
  });
  it("says nothing of Thai on a Thai piece, nor on an English piece without any", () => {
    expect(checkPolicy("Cover that stays with you\n#ประกันสุขภาพ").map((f) => f.code)).not.toContain("thai_in_english");
    expect(checkPolicy("Cover that stays with you\n#ประกันสุขภาพ", { lang: "th" }).map((f) => f.code)).not.toContain("thai_in_english");
    expect(checkPolicy("Cover that stays with you\n#expat", { lang: "en" })).toEqual([]);
  });
});
