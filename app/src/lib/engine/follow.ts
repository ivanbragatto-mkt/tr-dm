// "Ask them to follow us first": finds out whether a person follows the account, using Meta's user profile lookup.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Graph } from "../flow";
import { graphBase } from "../channels";
import { decryptToken } from "../crypto";

type F = typeof fetch;
export type FollowInfo = { follows: boolean | null; followers: number | null; note?: string };

/** Only look it up when the flow actually asks (a "follows the account" condition). Saves a Meta call on every other flow. */
export function usesFollowCheck(g: Graph): boolean {
  return g.nodes.some((n) => n.data.kind === "condition" && n.data.rows.some((r) => r.field === "follows"));
}

/** GET /{IGSID}?fields=is_user_follow_business,follower_count. `follows` is null when Meta would not say (permission, id not eligible, error). */
export async function fetchFollow(token: string, igsid: string, f: F = fetch): Promise<FollowInfo> {
  const u = new URL(`${graphBase()}/${encodeURIComponent(igsid)}`);
  u.searchParams.set("fields", "is_user_follow_business,follower_count");
  try {
    const r = await f(u, { headers: { authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { follows: null, followers: null, note: `Meta ${j?.error?.code ?? r.status}: ${String(j?.error?.message ?? "").slice(0, 100)}` };
    return {
      follows: typeof j.is_user_follow_business === "boolean" ? j.is_user_follow_business : null,
      followers: typeof j.follower_count === "number" ? j.follower_count : null,
      note: typeof j.is_user_follow_business === "boolean" ? undefined : "field missing in the answer",
    };
  } catch (e) {
    return { follows: null, followers: null, note: e instanceof Error ? e.message : String(e) };
  }
}

/** Looks the person up with the account's token and remembers the answer on the contact. Never throws. */
export async function refreshFollow(db: SupabaseClient, accountId: string, contact: { id?: string; external_id?: string; [k: string]: unknown }, f: F = fetch): Promise<FollowInfo> {
  try {
    const { data } = await db.from("channel_accounts").select("access_token_enc").eq("id", accountId).single();
    if (!data?.access_token_enc) return { follows: null, followers: null, note: "no token" };
    const info = await fetchFollow(decryptToken(data.access_token_enc as unknown as string), String(contact.external_id), f);
    const patch: Record<string, unknown> = {};
    if (info.follows != null) patch.follows_account = info.follows;
    if (info.followers != null) patch.follower_count = info.followers;
    if (Object.keys(patch).length) await db.from("contacts").update(patch).eq("id", String(contact.id));
    if (info.follows == null) console.warn("[follow]", info.note);
    return info;
  } catch (e) {
    return { follows: null, followers: null, note: e instanceof Error ? e.message : String(e) };
  }
}
