import Link from "next/link";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { agentNames, listCustomers } from "@/lib/fhc/customers";
import { CustomerList } from "./CustomerList";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ลูกค้า FHC ของฉัน | AdvisorTool",
  description: "รายชื่อลูกค้าที่ทำ Financial Health Check กับคุณ พร้อมสรุปว่าแต่ละคนขาดประกันอะไร",
};

export default async function FhcCustomersPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const viewer = await gatePage("/fhc/customers");
  const owner = can(viewer, "owner");
  const all = owner && (await searchParams).all === "1";
  // a list that cannot be read says so; it does not pass for an empty one
  const rows = await listCustomers(viewer, all).catch((e) => {
    console.error("fhc customers not read:", e);
    return null;
  });
  const names = all && rows ? await agentNames(rows.map((r) => r.agentId)).catch(() => new Map<string, string>()) : null;

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-3xl sm:pb-10">
      <header className="pb-5 pt-8">
        <p className="text-sm text-[var(--lg-mute)]">Financial Health Check</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">{all ? "ลูกค้า FHC ของทุกคน" : "ลูกค้า FHC ของฉัน"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          ลูกค้าที่คุณเก็บชื่อไว้ตอนทำแบบสอบถามด้วยกัน เห็นเฉพาะคุณ ป้ายแต่ละใบบอกว่าลูกค้ายังขาด หรือมีแต่ไม่พอในด้านไหน
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/fhc" className="lg-metal-face rounded-sm border border-[var(--lg-gold)] px-4 py-2 font-medium">ทำแบบสอบถามใหม่</Link>
          {owner && (
            <Link
              href={all ? "/fhc/customers" : "/fhc/customers?all=1"}
              className="rounded-sm border border-[var(--lg-panel-line)] px-4 py-2 text-[var(--lg-mute)]"
            >
              {all ? "ดูเฉพาะของฉัน" : "ดูของทุกคน"}
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
