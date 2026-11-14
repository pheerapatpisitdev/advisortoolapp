# คลังแอนิเมชัน — device round 3: อุปมาเล่าเรื่อง

Owner, 2026-11-15, "ก ทุกข้อ" on mockup https://claude.ai/artifact/LGkGpFihPZGpG7HCmNgtAe: 1ก the eight metaphors
below; 2ก they also replace the opening scene of eight คลิปเล่าเรื่อง topics. The pairing list was shown in chat
and approved ("ตามนี้ สร้างเลย"). Built exactly as rounds 1 and 2 (specs 2026-11-13-health-devices-design.md,
2026-11-14-devices-life-tax-design.md): a device is a `KnowShow` layout drawn by `showBody` (paper, warm, line) and
the info route (plot, info, board, neon, blueprint) through the Kit, timed by `kspec`, words in
`knowText`/`showText`.

## The rule for this round

A metaphor carries **no figure at all**. Every field is words. Any Arabic or Thai digit in any metaphor word field
(title, note, labels, sides, arrows, spare) is refused: in คลิปตามโจทย์ the scene fails its check like a device
with a forged figure does (falls back to a picture scene); in code-written story scenes a test pins that no
metaphor word holds a digit. Words pass the same FORBIDDEN / FREE_FORBIDDEN checks as other script words.

## The eight devices

All have `title: [string, string]` (either line may be ""), `note?: string` (the line under the picture). Extra
word fields per device:

| layout | ชื่อ | extra fields | drawn (beats: set → trouble → protection → note) |
|---|---|---|---|
| `umbrella` | ร่มกันฝน | — | rain starts over a family of three; a red umbrella opens over them; the rain runs off its edge |
| `housepillar` | เสาหลักของบ้าน | `label?` (on the pillar, default "รายได้"), `spare?` | a house roof on one centre pillar with `label`, family inside; the pillar shakes; when `spare` is given a gold second pillar slides in under the roof with `spare` on it (no spare → the shake only) |
| `lifering` | ห่วงชูชีพ | — | a person in water, waves moving; a red-white ring arcs in on a dashed line and lands round them |
| `safetynet` | ตาข่ายนิรภัย | — | a person on a high line; they slip and fall; a green net below catches them with a bounce |
| `seedtree` | เมล็ดโตเป็นต้นไม้ | `from?`, `to?` (ground labels, default "วันนี้" / "วันข้างหน้า") | a seed in soil sprouts, grows to a small tree, then a big tree, left to right |
| `balance` | ตาชั่ง | `sides: [string, string]`, `tilt?: "left" \| "right" \| "even"` (default "even") | a scale with a word on each pan; the beam settles to `tilt` |
| `bridge` | สะพานข้ามช่วงยาก | — | two cliffs and water; a person on the left; a bridge draws across; the person walks over |
| `shield` | โล่กันลูกศร | `arrows: string[]` (1–5 words) | arrows labelled with the words fly in from the left one by one; a blue shield with a tick takes each; a family stands safe behind |

Length limits (checked like other word fields; longer is refused, not cut): title lines ≤ 20 characters, note ≤ 34,
label/spare/from/to/sides ≤ 12, each arrow ≤ 14. Every word fits at all three sizes and seven looks (stills
looked at). The family figures are the existing paper people/kin drawings where they exist, simple shapes
otherwise; no faces beyond the existing style.

Registry (`src/lib/scene-library/devices.ts`): family **"อุปมา"**, product **"all"** (widen the type), clips
story + prompt, `numberFields: []`, word fields as above; a `when` line each for the writer, e.g. umbrella:
"เปรียบประกันกับร่มที่กางไว้ก่อนฝนตก ใช้กับความเชื่อว่าซื้อประกันเหมือนแช่งตัวเอง หรือเตรียมไว้ก่อนเกิดเรื่อง".
No `when` line says a FORBIDDEN word.

## คลิปเล่าเรื่อง: eight opening scenes

The opening scene (the first scene, `knowAsk`) of each topic below becomes the metaphor. Its **voice is
unchanged** and its **title is the old opening's own two lines verbatim** (the myth quotes keep their “ ”). All
other scenes of the topic, its figures, captions, inputs and timing logic are unchanged. Every look the topic
offers today draws the new opener.

| topic | metaphor | title (= old opener) | note | extra |
|---|---|---|---|---|
| `pillar` เสาหลักหายไป | housepillar | บ้านนี้มีเสาหลัก / "" | รายได้หลักของบ้าน | label "รายได้", no spare |
| `mythjinx` | umbrella | “ซื้อประกัน / เหมือนแช่งตัวเอง” | พกร่ม ไม่ได้ทำให้ฝนตก | — |
| `selfemployed` | safetynet | ไม่มีเจ้านาย / สวัสดิการล่ะ? | ตาข่ายนี้ เราขึงเองได้ | — |
| `pricey` | seedtree | “เบี้ยแพง / ไม่มีงบ” | เริ่มเล็ก ดีกว่าไม่เริ่ม | defaults |
| `bank` | balance | “ฝากธนาคาร / ดีกว่า” | ออมไว้ใช้ ประกันกันเรื่องใหญ่ | sides เงินออม / ประกัน, tilt even |
| `welfare` | bridge | “มีบัตรทอง / ประกันสังคมแล้ว” | ช่วงป่วย รายได้หาย ต้องมีสะพาน | — |
| `ciincome` | lifering | ป่วยหนัก / รายได้หายไปไหน? | เงินก้อนมาตอนที่ต้องการที่สุด | — |
| `fiverisks` | shield | ประกันชีวิต / คืออะไรกันแน่? | ประกันรับแทนเรา | arrows จากไปเร็ว, อยู่นานเกิน, ป่วยหนัก, อุบัติเหตุ, ทุพพลภาพ |

(fiverisks: the pairing list in chat showed the title "5 เรื่องใหญ่ ที่ชีวิตต้องเตรียม", but the topic's actual
opener is "ประกันชีวิต คืออะไรกันแน่?"; the rule "title = old opener" wins and the owner is told.)

The opener's length follows its voice as today (kspec beats spread across the voice).

## คลิปตามโจทย์

The writer's device list gains the eight with their `when` lines and JSON word fields; the checks refuse digits
and over-long words as above; the script editor shows the new word fields in Thai (หัวข้อ, บรรทัดใต้ภาพ, คำบนเสา,
เสาสำรอง, คำใต้ภาพซ้าย / ขวา, สองข้างตาชั่ง, ตาชั่งเอียง, ลูกศร). Price unchanged (a device scene is
not a picture).

## The library

The eight catalogue entries (`device-` keys as they stand: balance-scale, umbrella, house-pillar, arrow-shield,
life-ring, safety-net, seed-to-tree, bridge) become ready, each with the seven-look switcher and stills
`/library/<layout>-<look>.jpg` (8 × 7 = 56 new JPEGs, existing 119 byte-identical), linking to their story topic
and คลิปตามโจทย์.

## Shipping

One REMOTION_DRAWING change; prepare samples (four of the eight topics in paper + one other look, one prompt clip
with metaphors); before the push the owner sees stills of the eight in all looks and sample clips. No database
change.

## Tests

Per device: kspec/knowText, every look × size draws without throwing, dark looks keep words readable (contrast
at word pixels), digits refused in every word field, length limits, `tilt`/`spare`/`arrows` shapes. Story: each of
the eight topics' first scene is its metaphor, voice and title equal the old opener's, no other scene changed.
Prompt: writer parsing (incl. a digit in a metaphor word refused), editor field names. Catalogue ready + previews
on disk; count 119 + 56 = 175.
