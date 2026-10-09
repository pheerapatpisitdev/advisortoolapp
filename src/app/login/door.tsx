import { redirect } from "next/navigation";
import { googleError } from "@/lib/auth/google";
import { memberSettings } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { LoginForm } from "./LoginForm";

export type DoorParams = Promise<{ next?: string; error?: string }>;

/**
 * The door for UnitOS agents (their code) and for members outside UnitOS, who come in with
 * Google since 2026-10-02 (/auth/google). It stands on the front page (owner, 2026-10-10); /login
 * only passes people on to it. Somebody already signed in goes straight on to where they were
 * headed; when nothing says, the main system at /home (owner, 2026-10-10), whose menu reaches
 * the sales pages, Studio and — for staff — the back office. `error` is why Google's round trip
 * ended here; an unknown one says nothing.
 */
export async function LoginDoor({ searchParams }: { searchParams: DoorParams }) {
  const params = await searchParams;
  // "/" is this door now, so being sent back to it would go round forever: older links say
  // next=/ for the chat, which lives at /home
  const asked = safeNext(params.next, "/home");
  const next = asked === "/" || asked.startsWith("/?") || asked.startsWith("/#") ? "/home" : asked;
  if (await getViewer()) redirect(next);
  // settings that cannot be read hide the sign-up link rather than the door
  const settings = await memberSettings().catch(() => ({ signupOpen: false }));
  return <LoginForm next={next} signupOpen={settings.signupOpen} error={googleError(params.error)} />;
}
