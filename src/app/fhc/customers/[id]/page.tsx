import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBaht } from "@/calc/money";
import { PlanView } from "@/components/plan/PlanView";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { getCustomer } from "@/lib/fhc/customers";
import { AREA_LABEL, GAP_WORD } from "@/lib/fhc/gaps";
import { lineText } from "@/lib/fhc/share";
import { PILL } from "../pill";
import { CustomerActions } from "./CustomerActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ลูกค้า FHC | AdvisorTool" };

const BOX = "rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4";
const UNIT = { sum: "บาท", room: "บาท/วัน", pension: "บาท/เดือน" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");

export default async function FhcCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await gatePage(`/fhc/customers/${id}`);
  const owner = can(viewer, "owner");
  const c = await getCustomer(viewer, id, owner).catch((e) => {
    console.error("fhc customer not read:", e);
    return null;
  });
  if (!c) notFound();
  const { snapshot } = c;
  const date = new Date(c.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const first = c.gaps.find((g) => g.key === c.firstArea);
  const message = `คุณ${c.name}\n\n${lineText(snapshot)}`;

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 sm:max-w-3xl sm:pb-10">
      <header className="pb-1 pt-8">
        <Link href="/fhc/customers" className="text-sm text-[var(--lg-mute)]">‹ ลูกค้า FHC ของฉัน</Link>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">{c.name}</h1>
        <p className="mt-2 text-sm tabular-nums text-[var(--lg-mute)]">
          {c.sex === "F" ? "หญิง" : "ชาย"} อายุ {c.age} · ตรวจเมื่อ {date}
        </p>
        {c.contact && <p className="mt-1 text-sm text-[var(--lg-white)]">{c.contact}</p>}
        {c.note && <p className="mt-1 text-sm text-[var(--lg-mute)]">โน้ต: {c.note}</p>}
      </header>

      <section className={BOX}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ขาดหรือไม่พอตรงไหน</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="bg-[var(--bot-navy)] text-white">
                <th className="px-3 py-2 font-medium">ด้าน</th>
                <th className="px-3 py-2 text-right font-medium">มีอยู่</th>
                <th className="px-3 py-2 text-right font-medium">ควรมี</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium">แบบที่เสนอ</th>
              </tr>
            </thead>
            <tbody>
              {c.gaps.map((g) => (
                <tr key={g.key} className="border-b border-[var(--lg-hair)] align-top">
                  <td className="px-3 py-2.5 text-[var(--lg-white)]">{AREA_LABEL[g.key]}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.have ? `${n(g.have)} ${UNIT[g.unit]}` : "ไม่มี"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(g.should)} {UNIT[g.unit]}</td>
                  <td className="px-3 py-2.5"><span className={`${PILL.base} ${PILL[g.state]}`}>{GAP_WORD[g.state]}</span></td>
                  <td className="px-3 py-2.5 text-[var(--lg-mute)]">
                    {g.product ? `${g.product} ${g.annual ? `${formatBaht(g.annual)} บาท` : ""}` : g.state === "ok" ? "ไม่ต้องเพิ่ม" : "ยังไม่มีแบบที่พอดีกับงบ"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          {first ? (
            <>
              <span className="text-[var(--lg-gold)]">เริ่มที่:</span> {AREA_LABEL[first.key]} ตามลำดับที่แผนเลือกไว้ตอนตรวจ
            </>
          ) : (
            "ครบทุกด้าน ไม่ต้องตามเรื่องประกัน"
          )}
        </p>
        <p className="mt-1 text-xs text-[var(--lg-mute)]">ตัวเลขเป็นของวันที่ตรวจ เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท</p>
      </section>

      <PlanView result={snapshot.plan} prose={null} />

      <CustomerActions id={c.id} name={c.name} message={message} owner={owner} />
    </main>
  );
}
