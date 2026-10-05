import Link from "next/link";
import { unsyncedText, type UnsyncedAccount } from "@/lib/ads/results";

/**
 * Under the results (campaign table, ads list): each ad account the sends used whose results the
 * nightly read does not fetch, so a "—" is read as "not fetched", not as nothing spent.
 */
export function UnsyncedNote({ accounts }: { accounts: UnsyncedAccount[] }) {
  if (accounts.length === 0) return null;
  return (
    <ul className="space-y-1">
      {accounts.map((a) => (
        <li key={a.actId} className="text-xs font-medium text-[var(--ct-alert)]">
          {unsyncedText(a)}{" "}
          <Link href="/admin/ads" className="underline underline-offset-2">/admin/ads</Link>
        </li>
      ))}
    </ul>
  );
}
