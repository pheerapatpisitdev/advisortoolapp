import Link from "next/link";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { agentNames, agentRooms, isRoomLead, listCustomers, type Scope } from "@/lib/fhc/customers";
import { CustomerList } from "./CustomerList";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ลูกค้า FHC ของฉัน | AdvisorTool",
  description: "รายชื่อลูกค้าที่ทำ Financial Health Check กับคุณ พร้อมสรุปว่าแต่ละคนขาดประกันอะไร",
};

/** "Krungthai-AXA Life 83G" reads as 83G on a phone: every office here is Krungthai-AXA Life */
const shortOffice = (name: string) => name.replace(/^Krungthai-AXA Life\s+/i, "").trim() || name;

export default async function FhcCustomersPage({ searchParams }: { searchParams: Promise<{ all?: string; office?: string }> }) {
  const viewer = await gatePage("/fhc/customers");
  const owner = can(viewer, "owner");
  // the owner sees every office; an office's admins and managers see their own office (owner, 2026-11-09)
  const lead = !owner && isRoomLead(viewer);
  const q = await searchParams;
  const scope: Scope = owner && q.all === "1" ? "all" : lead && q.office === "1" ? "office" : "mine";
  // a list that cannot be read says so; it does not pass for an empty one
  const rows = await listCustomers(viewer, scope).catch((e) => {
    console.error("fhc customers not read:", e);
    return null;
  });
  let names: Map<string, string> | null = null;
  if (scope !== "mine" && rows) {
    const ids = rows.map((r) => r.agentId);
    names = await agentNames(ids).catch(() => new Map<string, string>());
    if (scope === "all") {
      // the owner sees which office each agent is from
      const rooms = await agentRooms(ids).catch(() => new Map<string, { id: string; name: string }>());
      for (const id of new Set(ids)) {
        const room = rooms.get(id);
        if (room?.name) names.set(id, `${names.get(id) ?? "ไม่ทราบชื่อ"} · ${shortOffice(room.name)}`);
      }
    }
  }
  const title = scope === "all" ? "ลูกค้า FHC ของทุกคน" : scope === "office" ? `ลูกค้า FHC ของสำนักงาน ${shortOffice(viewer.tenantName)}` : "ลูกค้า FHC ของฉัน";
  const toggle = owner
    ? { href: scope === "all" ? "/fhc/customers" : "/fhc/customers?all=1", label: scope === "all" ? "ดูเฉพาะของฉัน" : "ดูของทุกคน" }
    : lead
      ? { href: scope === "office" ? "/fhc/customers" : "/fhc/customers?office=1", label: scope === "office" ? "ดูเฉพาะของฉัน" : "ดูของทั้งสำนักงาน" }
      : null;

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-3xl sm:pb-10">
      <header className="pb-5 pt-8">
        <p className="text-sm text-[var(--lg-mute)]">Financial Health Check</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          ลูกค้าที่คุณเก็บชื่อไว้ตอนทำ FHC หรือสำรวจความคุ้มครองด้วยกัน เห็นได้เฉพาะคุณ ผู้จัดการสำนักงานของคุณ และผู้ดูแลระบบ ป้ายแต่ละใบบอกว่าลูกค้ายังขาด หรือมีแต่ไม่พอในด้านไหน ส่วนลูกค้าจากการสำรวจจะบอกวันนัด
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/fhc" className="lg-metal-face rounded-sm border border-[var(--lg-gold)] px-4 py-2 font-medium">ทำแบบสอบถามใหม่</Link>
          <Link href="/survey" className="rounded-sm border border-[var(--lg-gold)] px-4 py-2 text-[var(--lg-gold)]">สำรวจความคุ้มครอง</Link>
          {toggle && (
            <Link href={toggle.href} className="rounded-sm border border-[var(--lg-panel-line)] px-4 py-2 text-[var(--lg-mute)]">
              {toggle.label}
            </Link>
          )}
        </div>
      </header>
      {rows === null ? (
        <p className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5 text-sm text-[var(--lg-gold)]">
          อ่านรายชื่อไม่ได้ในตอนนี้ ลองรีเฟรชอีกครั้งนะครับ
        </p>
      ) : (
        <CustomerList rows={rows} names={names ? Object.fromEntries(names) : null} />
      )}
    </main>
  );
}
