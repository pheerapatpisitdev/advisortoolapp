/**
 * A job our Cloud Run engine runs (owner, 2026-10-02): inputs and outputs by alias, {{in_1}} /
 * {{out_1}} in the command. วิดีโอนำเสนอ sends one with no command at all (its job renders the
 * props); the clip editor's prepare and render commands went with ตัดต่อคลิป (owner, 2026-11-15).
 */
export interface FfmpegJob {
  inputs: { name: string; url: string }[];
  command: string;
  outputs: { name: string; file: string; contentType: string }[];
}
