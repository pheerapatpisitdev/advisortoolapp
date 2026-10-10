import { gatePage } from "@/lib/auth/viewer";
import { Fhc } from "./Fhc";

export const metadata = {
  title: "Financial Health Check — ตรวจสุขภาพการเงิน",
  description:
    "กรอกอายุ รายได้ เงินเก็บ หนี้ และคนที่คุณดูแล ดูคะแนนสุขภาพการเงินหกด้าน ห้าเหตุการณ์ที่ควบคุมไม่ได้ และแผนประกันพร้อมเบี้ยจริงที่พอดีกับงบ",
};

export const dynamic = "force-dynamic";

export default async function FhcPage() {
  // every check is the agent's, kept in their own list: signed in first (owner, 2026-10-10)
  await gatePage("/fhc");
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-3xl sm:pb-10">
      <header className="pb-6 pt-8 print:hidden">
        <p className="text-sm text-[var(--lg-mute)]">Financial Health Check</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">ตรวจสุขภาพการเงิน</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          ทำแบบสอบถามนี้ด้วยกันกับลูกค้า กรอกตัวเลขคร่าวๆ ก็พอ ระบบให้คะแนนสุขภาพการเงินหกด้าน บอกว่าห้าเหตุการณ์ที่ควบคุมไม่ได้
          กระทบลูกค้าแค่ไหน และแบบประกันไหนพอดีกับงบ เก็บลูกค้าไว้ในรายชื่อของคุณได้
        </p>
      </header>
      <Fhc />
    </main>
  );
}
