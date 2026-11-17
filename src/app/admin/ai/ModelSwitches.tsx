"use client";
import { useState, useTransition } from "react";
import { Empty } from "../ui";
import { Group, GroupLabel, Item, ProviderMark, Said, Switch } from "./kit/parts";
import { setModelEnabled, type ModelRow } from "./actions";
import { PROVIDER_LABEL } from "./labels";

/**
 * The switch that takes a model out of every lane at once, the "โมเดล" card of /admin/ai until
 * 2026-10-23 (owner chose ก, mockup https://claude.ai/artifact/1MZqF78ZXVU64Pv5wPzh2u): it now sits
 * at the foot of ลำดับหลักและสำรอง, where a lane row that says "ข้าม · ปิดโมเดลอยู่" sends the reader.
 * Its own section of the page since 2026-11-18 (settings-kit look, owner chose ข), a switch per model.
 * It is not the lane's own ใช้ box: that one skips a model in one lane, this one in all of them.
 */

/** How a model's kind reads on the page. A judge answers in probabilities, never in words. */
const KIND_LABEL: Record<string, string> = { text: "ข้อความ", image: "รูปภาพ", judge: "ตัดสิน (ไม่สร้างข้อความ)" };

/** The quality an image row is asked for, so one model at two prices reads as two choices. */
const QUALITY_LABEL: Record<string, string> = { low: "คุณภาพต่ำ", medium: "คุณภาพมาตรฐาน", high: "คุณภาพสูง (คมชัด)" };

export function ModelSwitches({ models }: { models: ModelRow[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string>();
  const [note, setNote] = useState<{ id: string; ok: boolean; text: string }>();

  const flip = (id: string, on: boolean) => {
    setNote(undefined);
    setBusy(id);
    start(async () => {
      try {
        const res = await setModelEnabled(id, on);
        setNote(res.ok ? { id, ok: true, text: `${on ? "เปิด" : "ปิด"}แล้ว` } : { id, ok: false, text: res.error });
      } catch {
        setNote({ id, ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" });
      } finally {
        setBusy(undefined);
      }
    });
  };

  if (models.length === 0) return <Empty>ยังไม่มีโมเดลในระบบ</Empty>;
  const companies = [...new Set(models.map((m) => m.provider))];
  return (
    <>
      {companies.map((p) => (
        <div key={p}>
          <GroupLabel>{PROVIDER_LABEL[p] ?? p}</GroupLabel>
          <Group>
            {models.filter((m) => m.provider === p).map((m) => (
              <Item
                key={m.id} muted={!m.enabled}
                mark={<ProviderMark id={m.provider} size={18} />}
                title={<span className="font-mono text-sm">{m.model_name}</span>}
                description={<>{KIND_LABEL[m.kind] ?? m.kind}{m.quality && <> · {QUALITY_LABEL[m.quality] ?? m.quality}</>}
                  {m.kind === "judge" && " · ยังไม่มีงานไหนเรียกใช้ เปิดปิดด้วยการใส่หรือลบกุญแจ"}</>}
                control={<>
                  {busy === m.id && <span className="text-xs text-[var(--bot-ink-mute)]">กำลังบันทึก…</span>}
                  {note?.id === m.id && <Said ok={note.ok} text={note.text} />}
                  <Switch id={`model-${m.id}`} checked={m.enabled} disabled={pending || m.kind === "judge"}
                          label={`ใช้งาน ${m.model_name}`} onChange={(on) => flip(m.id, on)} />
                </>}
              />
            ))}
          </Group>
        </div>
      ))}
    </>
  );
}
