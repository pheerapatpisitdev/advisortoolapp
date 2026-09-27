import { NextResponse } from "next/server";
import {
  grantedScopes, listAdAccounts, listPages, statePurpose, subscribePage, tokenFromCode,
} from "@/lib/facebook/oauth";
import { clearPending, savePending, saveConnection } from "@/lib/facebook/connection";
import { clearPendingAds, saveAdAccount, savePendingAds } from "@/lib/facebook/ads-connection";
import { requestOrigin } from "@/lib/facebook/origin";
import { can } from "@/lib/auth/access";
import { audit, getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/**
 * Where Facebook sends the admin back. One Page is connected outright; several means asking
 * which, so the user token waits in the database until they say. The ads login is the same
 * shape with an ad account in place of a Page — and it keeps the user token itself, because
 * an ad account has no token of its own to hand over.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const params = new URL(req.url).searchParams;
  const purpose = statePurpose(params.get("state"));
  const home = purpose === "ads" ? "/admin/ads" : "/admin/messenger";

  const back = (outcome: string, detail?: string) => {
    const q = new URLSearchParams({ fb: outcome });
    if (detail) q.set("detail", detail.slice(0, 200));
    return NextResponse.redirect(`${origin}${home}?${q}`);
  };

  // the state proves the login began here; the session proves who is finishing it
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(home)}`);
  if (!can(viewer, purpose === "ads" ? "admin" : "connect")) return NextResponse.redirect(`${origin}/studio`);

  if (params.get("error")) return back("cancelled");
  if (!purpose) return back("state");
  const code = params.get("code");
  if (!code) return back("state");

  try {
    const userToken = await tokenFromCode(code, origin);

    if (purpose === "ads") {
      const [scopes, accounts] = await Promise.all([grantedScopes(userToken), listAdAccounts(userToken)]);
      if (!scopes.includes("ads_read")) return back("noscope");
      if (accounts.length === 0) return back("noaccounts");
      if (accounts.length > 1) {
        await savePendingAds(userToken, scopes);
        return back("choose");
      }
      const a = accounts[0];
      await saveAdAccount({ id: a.id, name: a.name, currency: a.currency, token: userToken, scopes });
      await clearPendingAds();
      await audit("connect-ads", a.id, { name: a.name });
      return back("connected");
    }

    const [scopes, pages] = await Promise.all([grantedScopes(userToken), listPages(userToken)]);

    if (pages.length === 0) return back("nopages");
    if (pages.length > 1) {
      await savePending(userToken, scopes);
      return back("choose");
    }

    const page = pages[0];
    const fields = await subscribePage(page);
    await saveConnection({
      pageId: page.id, pageName: page.name, token: page.accessToken, scopes, fields,
    });
    await clearPending();
    await audit("connect-page", page.id, { name: page.name });
    return back("connected");
  } catch (e) {
    return back("failed", e instanceof Error ? e.message : String(e));
  }
}
