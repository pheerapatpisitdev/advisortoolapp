// C1369.MP4 (35.52 s): silencedetect -24 dB 0.25 s, and the words Gemini heard per speech span
export const DURATION = 35.52;
export const SILENCE_LOG = [
  "frame:0 pts:0 pts_time:0", "lavfi.silence_start=0",
  "frame:73 pts:73472 pts_time:1.53", "lavfi.silence_end=1.53", "lavfi.silence_duration=1.53",
  "lavfi.silence_start=4.62", "lavfi.silence_end=5.07", "lavfi.silence_duration=0.45",
  "lavfi.silence_start=9.06", "lavfi.silence_end=9.46",
  "lavfi.silence_start=11.51", "lavfi.silence_end=11.82",
  "lavfi.silence_start=16.54", "lavfi.silence_end=16.92",
  "lavfi.silence_start=22.92", "lavfi.silence_end=23.24",
  "lavfi.silence_start=24.74", "lavfi.silence_end=25.12",
  "lavfi.silence_start=30.04", "lavfi.silence_end=30.41",
  "lavfi.silence_start=34.21",
].join("\n");
// Gemini's segments (its times drift ~1 s; snapping and span assignment correct them)
export const SEGMENTS = [
  { start: 0, end: 2.9, text: "ขอบคุณลูกเพจมากมายนะคะ" },
  { start: 2.9, end: 5.9, text: "แล้วก็ขอบคุณน้องๆ พี่ๆ น้องๆ ท่านใหม่" },
  { start: 5.9, end: 9.2, text: "ที่คอยกดติดตามเพจด้วยนะคะ" },
  { start: 9.2, end: 13.0, text: "ล่าสุดเนี่ย ทางเพจของเราก็ได้ปิดยอดไปแล้วนะคะ" },
  { start: 13.0, end: 16.5, text: "881,533 บาท" },
  { start: 16.5, end: 20.3, text: "อนุมัติมาที่ 53,333 บาท" },
  { start: 20.3, end: 24.8, text: "ส่วนที่เหลือก็คือติดเกี่ยวกับการขอประวัติ สำหรับลูกค้าที่มีประวัตินะคะ" },
  { start: 24.8, end: 27.5, text: "ขอบคุณจริงๆ ขอบคุณทุกท่าน" },
  { start: 27.5, end: 30.1, text: "ที่สนับสนุนมา ณ โอกาสนี้ด้วยค่ะ" },
  { start: 30.1, end: 33.1, text: "ทั้งทีมเลย ขอบคุณมากๆ เลยค่ะ" },
  { start: 33.1, end: 35.0, text: "สวัสดีค่ะ" },
];
