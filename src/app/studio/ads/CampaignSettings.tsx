"use client";
import { useEffect, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/content/poster";
import type { PersonOption } from "../PersonPicker";
import { AUTO_THEME } from "../ThemeSwatches";
import { errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { deleteQuestion } from "@/lib/ads/campaign-view";
import { ask } from "../ask";
import { deleteAdCampaign, updateAdCampaign } from "./actions";
import type { Room } from "./AdEditor";
import { Fold } from "./Fold";
import { PictureFields, type PicturePicks } from "./PictureFields";
import { field, plain, TONES } from "./styles";

/**
 * ตั้งค่าแคมเปญ, folded in Ads Studio's tools column under the writing form (and away on a phone
 * with the tools folded): the plan (set when it was made, shown only), its name, what to stress,
 * the brand's voice and ภาพและโมเดล (PictureFields), then ลบแคมเปญนี้, which asks first.
 * Settings changed and not saved are saved before a round is written (`saveFirst`), since the
 * writer reads the campaign, not this form.
 */

const NAME_MAX = 60;
const TEXT_MAX = 120;

/** ลบแคมเปญนี้: asks in the page, then deletes and opens the Page's next campaign. A refusal (an ad still switched on) shows under it. */
function DeleteCampaign({ campaign, sent, live }: { campaign: Room["campaign"]; sent: boolean; live: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    if (!(await ask(deleteQuestion({ title: campaign.title, live, sent }), "ลบแคมเปญ"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteAdCampaign(campaign.id);
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      // busy stays on until the page has moved: the campaign is gone
      router.replace(`/studio/ads?page=${encodeURIComponent(campaign.pageId)}`);
    } catch {
      setError("การเชื่อมต่อหลุด ยังไม่รู้ว่าลบแล้วหรือไม่ — เปิดหน้านี้ใหม่เพื่อดู");
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" onClick={run} disabled={busy} className="inline-flex min-h-11 items-center text-sm text-[var(--ct-alert)] underline underline-offset-2 disabled:opacity-50">
        {busy ? "กำลังลบ…" : "ลบแคมเปญนี้"}
      </button>
      {error && <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>{error}</p>}
    </div>
  );
}

export function CampaignSettings({ campaign, productName, people, sent, live, folded, writing, saveFirst, unsaved }: {
  campaign: Room["campaign"];
  /** the plan's name, shown and not editable */
  productName: string;
  /** the people library, for ใส่บุคคลในภาพ */
  people: PersonOption[];
  /** some of its ads went to Facebook: deleting says they stay there */
  sent: boolean;
  /** how many of its ads may be running now (liveCount): deleting leaves them running on Facebook */
  live: number;
  /** a phone with the tools folded */
  folded: boolean;
  /** a round is being written: nothing here changes until it is back */
  writing: boolean;
  /** set to what saves the unsaved settings, for the room to call before a round; false when they could not be */
  saveFirst: MutableRefObject<(() => Promise<boolean>) | null>;
  /** kept true while settings are typed and not saved, for the drawer to ask before it closes */
  unsaved?: MutableRefObject<boolean>;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name ?? "");
  const [hint, setHint] = useState(campaign.hint ?? "");
  const [voice, setVoice] = useState(campaign.brandVoice ?? "");
  const [picks, setPicks] = useState<PicturePicks>(() => ({
    writer: campaign.writer, painter: campaign.painter, theme: (campaign.theme as Theme | null) ?? AUTO_THEME,
    person: campaign.person, brief: campaign.pictureBrief ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<NoteState>(null);

  const themeValue = picks.theme === AUTO_THEME ? null : picks.theme;
  const picksDirty = picks.writer !== campaign.writer || picks.painter !== campaign.painter
    || (picks.person?.id ?? null) !== (campaign.person?.id ?? null) || (picks.person?.pose ?? null) !== (campaign.person?.pose ?? null)
    || (picks.brief.trim() || null) !== campaign.pictureBrief;
  const dirty = (name.trim() || null) !== campaign.name || (hint.trim() || null) !== campaign.hint
    || (voice.trim() || null) !== campaign.brandVoice || themeValue !== campaign.theme || picksDirty;

  async function persist(): Promise<boolean> {
    if (!dirty) return true;
    setSaving(true);
    setNote(null);
    try {
      const res = await updateAdCampaign(campaign.id, {
        name, hint, brandVoice: voice, theme: themeValue,
        writer: picks.writer, painter: picks.painter, person: picks.person, pictureBrief: picks.brief,
      });
      if (!res.ok) { setNote(errorNote(res.error)); return false; }
      router.refresh();
      return true;
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่ได้บันทึกการตั้งค่า ลองใหม่อีกครั้ง"));
      return false;
    } finally {
      setSaving(false);
    }
  }
  // the room's press saves what is typed here first; the newest persist, whatever changed since
  useEffect(() => { saveFirst.current = persist; });
  useEffect(() => {
    if (!unsaved) return;
    unsaved.current = dirty;
    return () => { unsaved.current = false; };
  }, [unsaved, dirty]);

  async function save() {
    if (await persist()) setNote(okNote("บันทึกการตั้งค่าแล้ว"));
  }

  const summary = [campaign.title, dirty ? "ยังไม่ได้บันทึก" : null].filter(Boolean).join(" · ");

  return (
    <div className={folded ? "hidden lg:block" : ""}>
      <Fold title="ตั้งค่าแคมเปญ" summary={summary} warn={dirty}>
        <fieldset disabled={saving || writing} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <legend className="sr-only">ตั้งค่าแคมเปญ</legend>
          <div className="text-sm">
            <span className="block text-xs text-[var(--ct-mute)]">แบบประกัน (ตั้งตอนสร้าง แก้ไม่ได้)</span>
            <span className="font-medium">{productName}</span>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">ชื่อแคมเปญ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={field} />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between text-sm font-medium">
              <span>สิ่งที่อยากเน้น</span>
              <span className="text-xs font-normal text-[var(--ct-mute)]">{[...hint].length}/{TEXT_MAX}</span>
            </span>
            <textarea value={hint} onChange={(e) => setHint(e.target.value)} maxLength={TEXT_MAX} rows={2} className={`${field} leading-relaxed`} />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between text-sm font-medium">
              <span>น้ำเสียงแบรนด์</span>
              <span className="text-xs font-normal text-[var(--ct-mute)]">{[...voice].length}/{TEXT_MAX}</span>
            </span>
            <textarea value={voice} onChange={(e) => setVoice(e.target.value)} maxLength={TEXT_MAX} rows={2} className={`${field} leading-relaxed`} />
          </label>
          <PictureFields
            value={picks} onChange={(next) => setPicks((p) => ({ ...p, ...next }))}
            people={people} back={`/studio/ads?campaign=${encodeURIComponent(campaign.id)}`}
          />
        </fieldset>
        {dirty && (
          <button type="button" onClick={save} disabled={saving || writing} className={`${plain} w-full`}>
            {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </button>
        )}
        <Note note={note} />
        <DeleteCampaign campaign={campaign} sent={sent} live={live} />
      </Fold>
    </div>
  );
}
