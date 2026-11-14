# คลังแอนิเมชัน — phase 4ข: สไตล์ภาพ AI 7 แบบ (คลิปตามโจทย์)

Owner, 2026-11-14: mockup https://claude.ai/artifact/4wNeMcrM1Yat1q7oXYMQSS ("ก ทุกข้อ": AI styles in a second round,
samples first). Samples drawn the same day with the app's own Gemini painter (tests/scratch/ai-style-samples/, script
tests/scratch/ai-style-samples.mts). Owner: "ตัดอันนี้ออกไป" on the ลายไทยร่วมสมัย sample → **seven styles**, the
Thai-pattern one is dropped from the library entirely.

## The seven styles

`PictureStyle` gains, in this order after ไวต์บอร์ด นีออน บลูพริ้นท์ on the form:

| id | Thai name | painter prefix (`STYLE_PREFIX`) |
|---|---|---|
| `cartoon3d` | การ์ตูน 3D | Cute 3D cartoon render of Thai people: rounded friendly characters with big eyes, soft studio lighting, smooth plastic-like materials, bright cheerful colours, simple clean background. |
| `clay` | ดินเคลย์ | Claymation still of Thai people: characters and objects sculpted from matte modelling clay with visible fingerprints and soft edges, warm studio light, a miniature set. |
| `anime` | อนิเมะ | Japanese anime illustration of Thai people: clean cel-shaded characters, soft pastel sky colours, gentle light, simple background details. |
| `watercolor` | สีน้ำ | Soft watercolour painting of Thai people on textured paper: loose washes, gentle bleeding edges, pale pastel palette, light pencil underdrawing, lots of white paper. |
| `isometric` | ไอโซเมตริก | Isometric 3D illustration with Thai people: a small diorama seen from a 30-degree isometric angle, clean geometric shapes, soft shadows, calm blue and teal palette. |
| `collage` | ตัดแปะนิตยสาร | Magazine paper collage of Thai people: cut-out shapes and halftone photo pieces layered with torn paper edges, bold contrasting colours, visible paper texture. |
| `pixel` | พิกเซล | 16-bit pixel art of Thai people: chunky visible pixels, limited bright palette, simple sprites and tiles like a retro video game scene. |

These are the sample prompts with "Thai people" added (the samples drew Western-looking people). The shared suffix
(no text, no numbers, no logos, no real person's likeness) stays. Existing styles' prefixes do not change.
(`cartoon` is taken by a retired style, hence `cartoon3d`.)

## Around the pictures

As the mockup said: the screen words, subtitles, figure card and contact card of an AI-style clip use the plain paper
band (`freeLook` returns `{}` for them, as for the retired styles). A device scene in an AI-style clip is drawn as it is
drawn for those retired styles today (no change in the drawing code; if the drawing code must change, the
REMOTION_DRAWING fingerprint changes and that must be said). Price is unchanged (pictures are charged per picture as
today). A style reference from the library still overrides the prefix as today.

## The form

The คลิปตามโจทย์ picture-style chips are shown in two labelled groups: **หน้าตาที่ระบบวาด** (paper, warm, plot, line,
board, neon, blueprint) and **สไตล์ภาพ AI** (the seven). Under the AI group: "คำบนจอใช้แถบกระดาษเรียบ ภาพวาดโดย AI".
`?style=<id>` links accept the seven.

## The library

`ai-style-cartoon3d`… the seven catalogue items become ready (ids may be renamed to match the style ids; the
`ai-style-thai-pattern` entry is deleted), each with `uses` into คลิปตามโจทย์ (`style=<id>`) and a preview still made
from the owner-seen sample: `public/library/ai-<id>.jpg`, 216×384 JPEG (center-cropped from the 9:16 sample).

## Tests

Allowlists (`PICTURE_STYLES`, `checked.ts` STYLES, links), `STYLE_PREFIX` text exact and containing "Thai people",
`freeLook` → `{}` for the seven, form groups and chips, catalogue ready + previews on disk, thai-pattern gone.
