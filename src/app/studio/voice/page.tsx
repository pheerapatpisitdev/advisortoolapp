import type { Metadata } from "next";
import Link from "next/link";
import { STUDIO_FIELDS } from "@/components/auth/styles";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { mayClone, myVoices, voiceFileUrl, yearlyRedosLeft } from "@/lib/voice/mine";
import { takeTexts } from "@/lib/voice/mine-words";
import { priceBaht } from "@/lib/wallet/prices";
import { walletPrices, walletSettings } from "@/lib/wallet/store";
import { VoiceBoard } from "./VoiceBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เสียงของฉัน | AdvisorTool" };

/**
 * เสียงของฉัน (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m): the
 * agent records their own voice, hears the clone, and sends it to the Super Admin. During the
 * pilot, for the agents the owner invited.
 */
export default async function VoicePage() {
  const viewer = await gatePage("/studio/voice");
  if (!(await mayClone(viewer).catch(() => false))) {
    return (
      <div className="mx-auto max-w-md space-y-4" style={STUDIO_FIELDS}>
        <h1 className="text-xl font-semibold">เสียงของฉัน</h1>
        <p className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 text-sm">ช่วงนำร่อง เปิดให้ตัวแทนที่ได้รับเชิญเท่านั้น อยากลองใช้ ติดต่อผู้ดูแลระบบได้เลย</p>
        <Link href="/studio/account" className="text-sm underline">กลับไปบัญชีของฉัน</Link>
      </div>
    );
  }
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
