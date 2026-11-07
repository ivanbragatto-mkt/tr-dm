import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { graphBase } from "@/lib/channels";
import { decryptToken } from "@/lib/crypto";
import { serverClient } from "@/lib/supabase/server";
import { buildSeries, dayRange, snapshotAccount, sumSeries, type Activity } from "@/lib/stats";

export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Charts data. ?org=<id> = the whole workspace (accumulated and per account); ?account=<id> = one account in detail. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const org = p.get("org");
  const account = p.get("account");
  const days = Math.min(90, Math.max(7, Number(p.get("days") ?? 30) || 30));
  if ((org && !UUID.test(org)) || (account && !UUID.test(account)) || (!org && !account)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const sb = await serverClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // row level security limits this to the caller's workspaces
  let q = sb.from("channel_accounts").select("id,org_id,username:display_name,external_ig_id,status").eq("channel", "instagram").eq("status", "connected");
  q = account ? q.eq("id", account) : q.eq("org_id", org!);
  const { data: accs } = await q;
  if (!accs?.length) return NextResponse.json({ days: dayRange(days), total: null, accounts: [] });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const range = dayRange(days);
  const today = range[range.length - 1];
  // take a snapshot now for accounts that do not have today's yet (the daily job does this too)
  const { data: fresh } = await db.from("account_stats_daily").select("channel_account_id").in("channel_account_id", accs.map((a) => a.id)).eq("day", today);
  const haveToday = new Set((fresh ?? []).map((r) => r.channel_account_id as string));
  const stale = accs.filter((a) => !haveToday.has(a.id)).slice(0, 6);
  if (stale.length) {
    const { data: full } = await db.from("channel_accounts").select("id,org_id,external_ig_id,access_token_enc").in("id", stale.map((s) => s.id));
    await Promise.all((full ?? []).map((a) => snapshotAccount(db, { ...a, access_token_enc: a.access_token_enc as unknown as string | null }).catch(() => [])));
  }

  const { data: rows } = await sb.from("account_stats_daily").select("channel_account_id,day,followers,media_count,reach,interactions,likes,comments,profile_views").in("channel_account_id", accs.map((a) => a.id)).gte("day", range[0]);
  const perAccount = await Promise.all(
    accs.map(async (a) => {
      const { data: act } = await sb.rpc("account_activity", { p_account: a.id, p_since: range[0] });
      const mine = (rows ?? []).filter((r) => r.channel_account_id === a.id) as never[];
      const series = buildSeries(range, mine, ((act ?? []) as Activity[]).map((x) => ({ day: String(x.day), triggers: Number(x.triggers), messages_out: Number(x.messages_out), messages_in: Number(x.messages_in), new_contacts: Number(x.new_contacts) })));
      const insightsKnown = (rows ?? []).some((r) => r.channel_account_id === a.id && (r.reach != null || r.interactions != null));
      return { id: a.id, username: String(a.username).replace(/^@/, ""), series, insightsKnown };
    }),
  );
  const total = sumSeries(perAccount.map((x) => x.series), range.length);
  const out: Record<string, unknown> = { days: range, total, accounts: perAccount, insightsKnown: perAccount.some((x) => x.insightsKnown) };

  if (account) {
    // extras for one account: automations ranking and the best recent posts
    const { data: autos } = await sb.from("automations").select("id,name,status").eq("channel_account_id", account);
    const { data: st } = await sb.rpc("automation_stats");
    const stats = new Map(((st ?? []) as { automation_id: string; runs: number; contacts: number; sent: number; taps: number; docs: number }[]).map((s) => [s.automation_id, s]));
    out.automations = (autos ?? []).map((a) => {
      const s = stats.get(a.id);
      return { id: a.id, name: a.name, status: a.status, runs: Number(s?.runs ?? 0), contacts: Number(s?.contacts ?? 0), sent: Number(s?.sent ?? 0), taps: Number(s?.taps ?? 0), docs: Number(s?.docs ?? 0) };
    }).sort((a, b) => b.runs - a.runs);
    const { data: full } = await db.from("channel_accounts").select("access_token_enc,external_ig_id").eq("id", account).single();
    try {
      const token = decryptToken(full?.access_token_enc as unknown as string);
      const url = new URL(`${graphBase()}/${full?.external_ig_id}/media`);
      url.searchParams.set("fields", "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count");
      url.searchParams.set("limit", "30");
      const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const posts = ((j.data ?? []) as Record<string, string | number>[]).map((m) => ({
          id: String(m.id),
          caption: String(m.caption ?? "").replace(/\s+/g, " ").slice(0, 100),
          kind: m.media_product_type === "REELS" ? "reel" : "post",
          date: String(m.timestamp ?? "").slice(0, 10),
          url: String(m.permalink ?? ""),
          image: m.media_type === "VIDEO" ? String(m.thumbnail_url ?? "") : String(m.media_url ?? m.thumbnail_url ?? ""),
          likes: Number(m.like_count ?? 0),
          comments: Number(m.comments_count ?? 0),
        }));
        out.topPosts = posts.sort((a, b) => b.likes + b.comments - (a.likes + a.comments)).slice(0, 5);
      }
    } catch {
      /* the page works without the posts */
    }
  }
  return NextResponse.json(out);
}
