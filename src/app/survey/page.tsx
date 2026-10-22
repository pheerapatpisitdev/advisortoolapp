import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { gatePage } from "@/lib/auth/viewer";
import { bangkokToday } from "@/lib/survey/answers";
import { allLines, firstName } from "@/lib/survey/script";
import { keptVoiceUrls, prepareVoices, voiceKey } from "@/lib/survey/voice";
import { Survey } from "./Survey";

export const metadata = {
  title: "สำรวจความคุ้มครอง | AdvisorTool",
  description: "แบบสอบถามห้าช่วงสำหรับคุยกับลูกค้าที่มีประกันอยู่แล้ว จบด้วยวันนัดและสรุปก่อนนัด",
};

export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  // the customer is kept in the agent's own list: signed in first, as /fhc
  const viewer = await gatePage("/survey");
  const name = firstName(viewer.name);
  // every line this agent can hear, ready to play: the shared ones are made ahead; their own
  // opening is made after this page is sent, the first time they come, while they read it
  const lines = allLines(name);
  const voiceUrls = await keptVoiceUrls(lines).catch(() => ({} as Record<string, string>));
  const own = lines.filter((l) => !voiceUrls[voiceKey(l.text, l.female)] && l.text.includes(name));
  if (name && own.length) after(() => asWho(viewer.agentId, () => prepareVoices(own)).then(() => undefined));
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
      <Survey agentName={name} today={bangkokToday()} voiceUrls={voiceUrls} />
    </main>
  );
}
