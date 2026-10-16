"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Piece, PieceGroup } from "@/lib/collage/library";
import { Card, Empty } from "../ui";
import { drawCollagePiece } from "./actions";

const BTN = "rounded-md bg-[var(--bot-navy)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const GHOST = "rounded-md border border-[var(--bot-line)] px-2.5 py-1 text-xs disabled:opacity-50";
const GROUPS: { group: PieceGroup; title: string }[] = [{ group: "hand", title: "มือ" }, { group: "person", title: "คน" }, { group: "thing", title: "ของ" }];
/** three pieces at a time: each is one call of its own, ~20–40 s */
const AT_ONCE = 3;

type Row = Piece & { url?: string; drawnAt?: string };

export function CollageLibrary({ pieces, trial }: { pieces: Row[] | null; trial: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [spent, setSpent] = useState(0);
  if (!pieces) return <Empty>อ่านคลังภาพไม่ได้ ตรวจว่าสร้างที่เก็บ collage-library แล้ว</Empty>;

  const drawn = pieces.filter((p) => p.url).length;
  const trialLeft = trial.filter((k) => !pieces.find((p) => p.key === k)?.url);
  const restLeft = pieces.filter((p) => !p.url && !trial.includes(p.key)).map((p) => p.key);

  async function draw(keys: string[]) {
    setMsg(null);
    setBusy((b) => new Set([...b, ...keys]));
    const queue = [...keys];
    const errors: string[] = [];
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => {
      for (let k = queue.shift(); k; k = queue.shift()) {
        const r = await drawCollagePiece(k).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
        if (r.ok) setSpent((s) => s + r.costThb); else errors.push(r.error);
        setBusy((b) => { const n = new Set(b); n.delete(k!); return n; });
        router.refresh();
      }
    }));
    if (errors.length) setMsg(errors.join(" · "));
  }

  return (
    <>
      {msg && <p role="alert" className="mb-4 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">{msg}</p>}
      <Card title={`วาดแล้ว ${drawn} จาก ${pieces.length} ภาพ`} hint={spent ? `รอบนี้ใช้ไปประมาณ ฿${spent.toFixed(2)}` : "ลอง 6 ภาพก่อน ดูหน้าตาแล้วค่อยวาดที่เหลือ"}>
        <div className="flex flex-wrap gap-2">
          {trialLeft.length > 0 && <button type="button" className={BTN} disabled={busy.size > 0} onClick={() => draw(trialLeft)}>วาด {trialLeft.length} ภาพลอง</button>}
          {trialLeft.length === 0 && restLeft.length > 0 && <button type="button" className={BTN} disabled={busy.size > 0} onClick={() => draw(restLeft)}>วาดที่เหลือ {restLeft.length} ภาพ (ประมาณ ฿{(restLeft.length * 0.43).toFixed(0)})</button>}
          {busy.size > 0 && <span className="self-center text-sm text-[var(--bot-ink-mute)]">กำลังวาด {busy.size} ภาพ…</span>}
        </div>
      </Card>
      {GROUPS.map(({ group, title }) => (
        <Card key={group} title={title} hint={`${pieces.filter((p) => p.group === group && p.url).length} จาก ${pieces.filter((p) => p.group === group).length}`}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {pieces.filter((p) => p.group === group).map((p) => (
              <li key={p.key} className="flex flex-col gap-1.5 rounded-lg border border-[var(--bot-line)] p-2">
                <div className="flex aspect-square items-center justify-center rounded-md bg-[var(--bot-line)]">
                  {p.url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.url} alt={p.name} className="max-h-full max-w-full object-contain" />
                    : <span className="px-2 text-center text-xs text-[var(--bot-ink-mute)]">{busy.has(p.key) ? "กำลังวาด…" : trial.includes(p.key) ? "ภาพลอง ยังไม่ได้วาด" : "ยังไม่ได้วาด"}</span>}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="min-w-0 truncate text-sm">{p.name}</span>
                  {p.url && <button type="button" className={GHOST} disabled={busy.has(p.key)} onClick={() => draw([p.key])}>วาดใหม่</button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
