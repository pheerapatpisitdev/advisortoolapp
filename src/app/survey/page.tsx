import { gatePage } from "@/lib/auth/viewer";
import { bangkokToday } from "@/lib/survey/answers";
import { Survey } from "./Survey";

export const metadata = {
  title: "สำรวจความคุ้มครอง | AdvisorTool",
  description: "แบบสอบถามห้าช่วงสำหรับคุยกับลูกค้าที่มีประกันอยู่แล้ว จบด้วยวันนัดและสรุปก่อนนัด",
};

export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  // the customer is kept in the agent's own list: signed in first, as /fhc
  const viewer = await gatePage("/survey");
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:pb-10">
      <header className="pb-6 pt-8">
        <p className="text-sm text-[var(--lg-mute)]">แบบสอบถามนัดพบ</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">สำรวจความคุ้มครอง</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          คุยกับลูกค้าที่มีประกันอยู่แล้ว ทางโทรศัพท์หรือต่อหน้า ห้าช่วง ราวสามนาที ทุกข้อแตะเลือกได้ มีบทพูดกำกับ
          จบแล้วได้วันนัดกับสรุปก่อนนัด และลูกค้าเข้ารายชื่อเดียวกับ FHC
        </p>
      </header>
      <Survey agentName={viewer.name.trim().split(/\s+/)[0] ?? ""} today={bangkokToday()} />
    </main>
  );
}
