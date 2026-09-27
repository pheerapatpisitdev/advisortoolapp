import type { Metadata } from "next";
import { listContentWords, listLessons, listNotes } from "./actions";
import { Lessons } from "./Lessons";
import { Notes } from "./Notes";
import { Words } from "./Words";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
/** สรุปแชทตอนนี้ runs the review as this page's action: a model reading a day of chats */
export const maxDuration = 300;

/** Named for the tab in the owner's words; the root layout's title is the calculator's. */
export const metadata: Metadata = {
  title: "สอน AI | advisortool",
};

/**
 * What the agent has taught the assistant, on top of the plan rules.
 *
 * It lived on the home page, open to anybody, which was right while that page was the agent's
 * own tool. The page answers customers now — and the notes reach the Messenger bot as well —
 * so a stranger typing here would be typing into what the business says to people who arrived
 * through a paid advertisement.
 */
export default async function KnowledgePage() {
  await gatePage("/admin/knowledge", "admin");
  const [notes, words, { review, lessons }] = await Promise.all([listNotes(), listContentWords(), listLessons()]);
  return (
    <>
      <Lessons review={review} initial={lessons} />
      {/* keyed on the list, so a lesson taken with ใช้ shows up here without a reload */}
      <Notes key={notes.map((n) => n.id).join(",")} initial={notes} />
      <Words initial={words} />
    </>
  );
}
