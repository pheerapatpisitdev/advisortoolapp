import type { Metadata } from "next";
import { STUDIO_FIELDS } from "@/components/auth/styles";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { myVoices, voiceFileUrl, yearlyRedosLeft } from "@/lib/voice/mine";
import { takeTexts } from "@/lib/voice/mine-words";
import { priceBaht } from "@/lib/wallet/prices";
import { walletPrices, walletSettings } from "@/lib/wallet/store";
import { VoiceBoard } from "./VoiceBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เสียงของฉัน | AdvisorTool" };

/**
 * เสียงของฉัน (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m): the
 * agent records their own voice, hears the clone, and keeps it. Open to everyone in Studio
 * (owner, 2026-10-15, mockup https://claude.ai/artifact/ByQCQqEsEvLxuaBy2KgQJ2).
 */
export default async function VoicePage() {
  const viewer = await gatePage("/studio/voice");
  const mine = await myVoices(viewer.agentId);
  const [prices, wallet, redos] = await Promise.all([walletPrices(), walletSettings(), mine.active ? yearlyRedosLeft(viewer.agentId) : Promise.resolve(0)]);
  const pending = mine.pending;
  const free = can(viewer, "owner") || !wallet.enabled;
  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      <div>
        <h1 className="text-xl font-semibold">เสียงของฉัน</h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">อัดเสียงตัวเอง 1–2 นาที แล้วทุกคลิปพากย์ด้วยเสียงของคุณ ทั้งวิดีโอนำเสนอ คลิปเล่าเรื่อง และสรุป FHC</p>
      </div>
      <VoiceBoard
        name={viewer.name.trim()}
        price={free ? null : priceBaht(prices.voiceClone)}
        extra={priceBaht(prices.elevenExtra)}
        pending={pending}
        texts={pending ? takeTexts(pending.sex, viewer.name.trim(), pending.code) : null}
        previewUrl={await voiceFileUrl(pending?.previewPath ?? null)}
        active={mine.active ? { id: mine.active.id, sample: await voiceFileUrl(mine.active.previewPath) } : null}
        redosLeft={redos}
        rejected={!pending && mine.last?.status === "rejected" ? mine.last.reason ?? "" : null}
      />
    </div>
  );
}
