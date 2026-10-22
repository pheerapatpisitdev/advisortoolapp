import { notFound } from "next/navigation";
import { PlanView } from "@/components/plan/PlanView";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { afterPlan } from "@/lib/fhc/after";
import { getCustomer } from "@/lib/fhc/customers";
import { AREA_LABEL, GAP_WORD, offerPrice } from "@/lib/fhc/gaps";
import { cleanFhc } from "@/lib/fhc/health";
import { lineText } from "@/lib/fhc/share";
import { bangkokToday, isSurvey } from "@/lib/survey/answers";
import { summarize, summaryText } from "@/lib/survey/summary";
import { SurveySummary } from "../../../survey/SurveySummary";
import { ScoreBoard } from "../../ScoreBoard";
import { PILL } from "../pill";
import { CustomerActions } from "./CustomerActions";
import { CustomerHeader } from "./CustomerHeader";

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
  const thaiDay = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  // a สำรวจความคุ้มครอง customer: the สรุปก่อนนัด in place of a check (owner, 2026-10-22)
  if (c.kind === "survey") {
    const a = isSurvey(c.input) ? c.input : null;
    // ages and links as of the day the survey was saved
    const day = new Date(c.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    const s = a ? summarize(a, day) : null;
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 sm:max-w-3xl sm:pb-10">
        <CustomerHeader
          id={c.id} name={c.name} contact={c.contact} note={c.note}
          meta={<>{c.sex === "F" ? "หญิง" : "ชาย"} อายุ {c.age} · สำรวจความคุ้มครองเมื่อ {thaiDay(c.createdAt)}</>}
        />
        {a && s ? (
          <>
            <h2 className="text-base font-medium text-[var(--lg-white)]">สรุปก่อนนัด{a.date < bangkokToday() ? " (เลยวันนัดแล้ว)" : ""}</h2>
            <SurveySummary a={a} s={s} />
          </>
        ) : (
          <p className={`${BOX} text-sm text-[var(--lg-mute)]`}>อ่านคำตอบของลูกค้าคนนี้ไม่ได้</p>
        )}
        <CustomerActions id={c.id} name={c.name} message={a && s ? summaryText(a, s) : c.name} owner={owner} video={false} />
      </main>
    );
  }
  const date = thaiDay(c.createdAt);
  const first = c.gaps.find((g) => g.key === c.firstArea);
  // worked from the saved form and plan each time, so customers saved before this was written show it too
  const form = cleanFhc(c.input);
  const after = typeof form === "string" ? null : afterPlan(form, snapshot.plan, snapshot.scores);
  const message = `คุณ${c.name}\n\n${lineText({ ...snapshot, after })}`;

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 sm:max-w-3xl sm:pb-10">
      <CustomerHeader
        id={c.id} name={c.name} contact={c.contact} note={c.note}
        meta={<>
          {c.sex === "F" ? "หญิง" : "ชาย"} อายุ {c.age} · ตรวจเมื่อ {date}
          {snapshot.updatedAt && <> · อัปเดตผลล่าสุด {thaiDay(snapshot.updatedAt)}</>}
        </>}
      />

      {snapshot.scores?.length > 0 && (
        <section className={BOX}>
          <h2 className="mb-3 text-base font-medium text-[var(--lg-white)]">สุขภาพการเงิน</h2>
          <ScoreBoard scores={snapshot.scores} after={after} />
        </section>
      )}

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
                    {g.product ? (
                      <>
                        {g.product}
                        {g.annual ? <><br />{offerPrice(g)}</> : null}
                      </>
                    ) : g.state === "ok" ? "ไม่ต้องเพิ่ม" : "ยังไม่มีแบบที่พอดีกับงบ"}
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
