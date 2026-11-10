/**
 * The rules of การเชื่อมต่อระบบเข้าใช้ (owner chose ก ก ก, 2026-11-03; mockup
 * https://claude.ai/artifact/CM989D3EiZgrFKWHEwAksq), kept apart from the database, the network
 * and LINE so they can be tested on their own.
 *
 * Each way in is asked every 30 minutes (four, then KingClub's from 2026-11-11). A way in is called down after two checks in a row
 * fail, as the AI check does (src/lib/ai/health-rules.ts, whose standing and step are reused),
 * and the owner hears twice per outage: when it goes down and when it comes back. Written after
 * Bluewealth's agents were locked out for 19 hours unseen, 2026-11-02/03.
 */
import { FAILS_TO_ALERT, lasted, type Event } from "@/lib/ai/health-rules";

export const ROUTES = ["unitos-code", "unitos-sso", "bluewealth", "kingclub", "google"] as const;
export type Route = (typeof ROUTES)[number];

export const isRoute = (s: string): s is Route => (ROUTES as readonly string[]).includes(s);

/** What the owner sees each way in called, on the page and in LINE. */
export const ROUTE_LABEL: Record<Route, string> = {
  "unitos-code": "ตัวแทน UnitOS · รหัส 6 หลัก",
  "unitos-sso": "ตัวแทน UnitOS · เมนูใน UnitOS",
  bluewealth: "ตัวแทน Bluewealth · รหัส 6 หลัก",
  kingclub: "ตัวแทน KingClub · เมนูในแอปและรหัส 6 หลัก",
  google: "สมาชิกทั่วไป · Google",
};

/** The line under each card's name: where the check asks. */
export const ROUTE_NOTE: Record<Route, string> = {
  "unitos-code": "อ่านรายชื่อตัวแทนจาก UnitOS (UnitClub)",
  "unitos-sso": "กดการ์ด advisortool Studio ในแอป UnitOS แล้วเข้าเลย",
  bluewealth: "ถามรายชื่อจากฐานข้อมูลของ Bluewealth",
  kingclub: "ถามตั๋วและรายชื่อจากฐานข้อมูลของ KingClub",
  google: "ปุ่ม \"ดำเนินการต่อด้วย Google\" หน้าแรก",
};

/** What a broken way in looks like to the people who use it. */
export const ROUTE_SEEN: Record<Route, string> = {
  "unitos-code": "ตัวแทน UnitOS ที่กรอกรหัสเห็น \"ระบบขัดข้อง ลองใหม่อีกครั้ง\"",
  "unitos-sso": "ตัวแทนที่กดเข้าจากเมนูใน UnitOS เข้าไม่ได้",
  bluewealth: "ตัวแทน Bluewealth ทุกคนเห็น \"ระบบขัดข้อง ลองใหม่อีกครั้ง\"",
  kingclub: "ตัวแทน KingClub กดเมนูแล้วเด้งไปหน้าแรก และกรอกรหัสก็เข้าไม่ได้",
  google: "สมาชิกทั่วไปกดปุ่ม Google แล้วเข้าไม่ได้",
};

/** A failed check in the owner's words, with what to do about it. */
export interface Diagnosis {
  /** one line: what is wrong */
  why: string;
  /** steps to put it right, in order; empty when there is nothing to do but wait */
  fix: string[];
}

const PUT = (name: string) => `npx wrangler secret put ${name}`;

/**
 * The raw error of a check read for the owner. The words matched are the services' own:
 * Supabase answers a wrong publishable key with "Invalid API key", Bluewealth's
 * advisortool_agents a wrong lookup key with "not allowed", Google's token endpoint a wrong
 * client with "invalid_client".
 */
export function diagnose(route: Route, error: string): Diagnosis {
  if (/ไม่ได้ตั้งค่า|not configured/i.test(error)) {
    const names = route === "bluewealth"
      ? ["BLUEWEALTH_SUPABASE_URL", "BLUEWEALTH_ANON_KEY", "BLUEWEALTH_LOOKUP_KEY"]
      : route === "kingclub" ? ["KINGCLUB_SUPABASE_URL", "KINGCLUB_ANON_KEY", "KINGCLUB_LOOKUP_KEY"]
      : route === "google" ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] : [];
    return {
      why: "ยังไม่ได้ใส่ค่าการเชื่อมต่อบนเซิร์ฟเวอร์",
      fix: names.length ? [`ใส่ค่าบน Cloudflare: ${names.map(PUT).join(" · ")}`, "กด \"ตรวจตอนนี้\""] : [],
    };
  }
  if (/ไม่ตอบภายใน|timeout|abort/i.test(error)) return { why: "ไม่ตอบภายใน 10 วินาที", fix: [] };
  if (route === "bluewealth") {
    if (/invalid api key/i.test(error)) {
      return {
        why: "ฐานข้อมูล Bluewealth ไม่รับกุญแจเชื่อมต่อของเรา",
        fix: [
          "เปิดโปรเจกต์ Bluewealth ใน Supabase → Project Settings → API Keys คัดลอก Publishable key",
          `ใส่ใหม่บน Cloudflare: ${PUT("BLUEWEALTH_ANON_KEY")}`,
          "ถ้ายังไม่หาย ใส่ที่อยู่ใหม่ด้วย: " + PUT("BLUEWEALTH_SUPABASE_URL"),
          "กด \"ตรวจตอนนี้\"",
        ],
      };
    }
    if (/not allowed|42501/i.test(error)) {
      return {
        why: "กุญแจตรวจรายชื่อของเราไม่ตรงกับที่ Bluewealth เก็บไว้",
        fix: [
          "ใส่กุญแจที่ตรงกับแถวใน advisortool_private.lookup_keys ของ Bluewealth",
          `บน Cloudflare: ${PUT("BLUEWEALTH_LOOKUP_KEY")}`,
          "กด \"ตรวจตอนนี้\"",
        ],
      };
    }
    if (/could not find the function|PGRST202|does not exist/i.test(error)) {
      return { why: "ฐานข้อมูล Bluewealth ไม่มีฟังก์ชันตรวจรายชื่อ advisortool_agents", fix: ["ลง supabase/bluewealth/20261024_advisortool_lookup.sql ใหม่ที่ Bluewealth"] };
    }
  }
  if (route === "kingclub") {
    if (/invalid api key/i.test(error)) {
      return {
        why: "ฐานข้อมูล KingClub ไม่รับกุญแจเชื่อมต่อของเรา",
        fix: [
          "เปิดโปรเจกต์ KingClub ใน Supabase → Project Settings → API Keys คัดลอก Publishable key",
          `ใส่ใหม่บน Cloudflare: ${PUT("KINGCLUB_ANON_KEY")}`,
          "ถ้ายังไม่หาย ใส่ที่อยู่ใหม่ด้วย: " + PUT("KINGCLUB_SUPABASE_URL"),
          "กด \"ตรวจตอนนี้\"",
        ],
      };
    }
    if (/not allowed|42501/i.test(error)) {
      return {
        why: "กุญแจตรวจรายชื่อของเราไม่ตรงกับที่ KingClub เก็บไว้",
        fix: [
          "ใส่กุญแจที่ตรงกับแถวใน advisortool_private.lookup_keys ของ KingClub",
          `บน Cloudflare: ${PUT("KINGCLUB_LOOKUP_KEY")}`,
          "กด \"ตรวจตอนนี้\"",
        ],
      };
    }
    if (/could not find the function|PGRST202|does not exist/i.test(error)) {
      return { why: "ฐานข้อมูล KingClub ไม่มีฟังก์ชันของ advisortool", fix: ["ลง supabase/kingclub/20261111_advisortool_sso.sql ที่ KingClub"] };
    }
  }
  if (route === "google" && /invalid_client|unauthorized_client/i.test(error)) {
    return {
      why: "Google ไม่รู้จักรหัสแอปหรือรหัสลับของเรา",
      fix: [
        "เปิด Google Cloud → APIs & Services → Credentials ไคลเอนต์ \"advisortool web\"",
        `ใส่ใหม่บน Cloudflare: ${PUT("GOOGLE_CLIENT_ID")} · ${PUT("GOOGLE_CLIENT_SECRET")}`,
        "กด \"ตรวจตอนนี้\"",
      ],
    };
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error)) return { why: "ติดต่อปลายทางไม่ได้", fix: [] };
  const code = error.match(/\b([1-5]\d\d)\b/)?.[1];
  if (code?.startsWith("5")) return { why: `ปลายทางล่ม รอเขาแก้ (${code})`, fix: [] };
  return { why: "ตอบผิดปกติ", fix: [] };
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

/** The one LINE message a run sends, or null when nothing changed: one push however many changed. */
export function signinAlertText(events: Event[], link: string): string | null {
  const ours = events.filter((e) => isRoute(e.provider));
  if (ours.length === 0) return null;
  const blocks = ours.map((e) => {
    const route = e.provider as Route;
    if (e.kind === "down") {
      const d = diagnose(route, e.error);
      return [
        "🚪 ทางเข้าใช้ไม่ได้",
        ROUTE_LABEL[route],
        `สาเหตุ: ${d.why}`,
        ROUTE_SEEN[route],
        `ตั้งแต่ ${day(e.since)} ${clock(e.since)} น. · ตรวจไม่ผ่าน ${FAILS_TO_ALERT} รอบติด`,
      ].join("\n");
    }
    return ["✅ ทางเข้ากลับมาใช้ได้แล้ว", ROUTE_LABEL[route], `ใช้ไม่ได้ ${lasted(e.since, e.at)} (${clock(e.since)}–${clock(e.at)} น.)`].join("\n");
  });
  return [...blocks, ours.some((e) => e.kind === "down") ? link : null].filter(Boolean).join("\n\n");
}
