"use client";
import { AD_PAINTERS } from "@/lib/ads/picture-picks";
import { AUTO, AUTO_FLOOR_THB, painterFor, WRITERS, writerOf } from "@/lib/content/models";
import type { PiecePerson } from "@/lib/content/people";
import { THEME_LABEL, type Theme } from "@/lib/content/poster";
import { PersonPicker, type PersonOption } from "../PersonPicker";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "../ThemeSwatches";
import { PictureBrief } from "../ui/PictureBrief";
import { PictureFold, pictureSummary } from "../ui/form-parts";
import { field } from "./styles";

/**
 * ภาพและโมเดล for an Ads Studio campaign (owner, 2026-10-05): Organic Studio's fold — the writer,
 * the painter, the posters' tone, who is in the pictures and the picture brief — kept on the
 * campaign rather than this browser, so every ad in it is made alike. ไม่วาดภาพ is not offered:
 * an ad is not sent without its picture. Used by ตั้งค่าแคมเปญ and the new-campaign form.
 */

export interface PicturePicks {
  /** null for อัตโนมัติ */
  writer: string | null;
  /** null for อัตโนมัติ */
  painter: string | null;
  theme: ThemeChoice;
  person: PiecePerson | null;
  brief: string;
}

export function PictureFields({ value, onChange, people, back }: {
  value: PicturePicks;
  onChange: (next: Partial<PicturePicks>) => void;
  people: PersonOption[];
  /** where the people library's "← กลับ" returns to */
  back: string;
}) {
  const { writer, painter, theme, person, brief } = value;
  // อัตโนมัติ as the month having room; the server settles it on what is left at the press
  const writes = writerOf(writer ?? AUTO);
  const paints = painterFor(painter ?? AUTO, Infinity, Boolean(person));
  const summary = pictureSummary({
    format: "ad", writer: writes.short, painter: paints.short,
    theme: theme === AUTO_THEME ? "โทนสี AI เลือก" : `โทน${THEME_LABEL[theme as Theme]}`,
    person: person ? people.find((p) => p.id === person.id)?.name : undefined,
    brief: brief.trim() || undefined,
  });

  return (
    <PictureFold summary={summary}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">โมเดลเขียน</span>
        <select value={writer ?? AUTO} onChange={(e) => onChange({ writer: e.target.value === AUTO ? null : e.target.value })} className={field}>
          <option value={AUTO}>อัตโนมัติ</option>
          {WRITERS.map((w) => <option key={w.id} value={w.id}>{w.label} · ฿{w.thb.toFixed(2)} ต่อชิ้น</option>)}
        </select>
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">
          {writer === null
            ? `ปกติใช้ ${writes.short} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะสลับเป็นแบบประหยัดเอง`
            : `${writes.short} · ราคาต่อชิ้น`}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">ภาพประกอบ</span>
        <select value={painter ?? AUTO} onChange={(e) => onChange({ painter: e.target.value === AUTO ? null : e.target.value })} className={field}>
          <option value={AUTO}>อัตโนมัติ</option>
          {AD_PAINTERS.map((p) => <option key={p.id} value={p.id}>{p.label} · ฿{p.thb.toFixed(2)} ต่อภาพ</option>)}
        </select>
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">
          {painter === null
            ? `ปกติวาดด้วย ${painterFor(AUTO).short} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะหยุดวาด แล้วกด “วาดรูป” บนการ์ดเองได้`
            : `${painterFor(painter).short} · ราคาต่อภาพ วาดให้ทุกแอดหลังเขียนเสร็จ`}
        </span>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
        <ThemeSwatches<ThemeChoice> value={theme} onChange={(t) => onChange({ theme: t })} allowAuto />
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">
          {theme === AUTO_THEME ? "แต่ละแอดอาจได้คนละโทน ภาพ AI วาดตามโทนของแอดนั้น" : "ใช้กับทุกแอดในแคมเปญนี้ และภาพ AI จะวาดในโทนเดียวกัน"}
        </span>
      </div>

      <div>
        <PersonPicker people={people} value={person} onChange={(p) => onChange({ person: p })} back={back} />
        {person && <span className="mt-1 block text-xs text-[var(--ct-mute)]">วาดด้วย Gemini Image ซึ่งรักษาหน้าคนได้ดีที่สุด ราวภาพละ ฿2.4 · ชุดและสถานที่พิมพ์ในบรีฟภาพด้านล่าง</span>}
      </div>

      <PictureBrief
        value={brief} onChange={(b) => onChange({ brief: b })}
        asPerson={Boolean(person)}
        note="ใช้กับภาพทุกแอดในแคมเปญนี้ · AI วาดทั้งโปสเตอร์รวมตัวหนังสือ ต้องตรวจตัวสะกดและตัวเลขก่อนส่ง"
      />
    </PictureFold>
  );
}
