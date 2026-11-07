// Numbers for the charts. Server only.
// Meta side: follower count, reach, interactions per day, copied into account_stats_daily by snapshotAccount().
// Own side: comments caught, messages sent... come from account_activity() (migration 0011).
import type { SupabaseClient } from "@supabase/supabase-js";
import { graphBase } from "./channels";
import { decryptToken } from "./crypto";

type Row = { day: string; followers: number | null; reach: number | null; interactions: number | null; likes: number | null; comments: number | null; profile_views: number | null; media_count?: number | null };
export type Activity = { day: string; triggers: number; messages_out: number; messages_in: number; new_contacts: number };

export const SERIES = ["followers", "reach", "interactions", "triggers", "messages_out", "new_contacts"] as const;
export type SeriesKey = (typeof SERIES)[number];
export type AccountSeries = Record<SeriesKey, (number | null)[]>;

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function dayRange(days: number, today = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))));
  return out;
}

/** One account's series over `days`. Followers carry forward (and back-fill before the first known day, so no fake jump); other Meta numbers stay null when unknown. */
export function buildSeries(days: string[], rows: Row[], act: Activity[]): AccountSeries {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const aDay = new Map(act.map((a) => [a.day, a]));
  const known = rows.filter((r) => r.followers != null).sort((a, b) => a.day.localeCompare(b.day));
  let last: number | null = null;
  const followers = days.map((d) => {
    const v = byDay.get(d)?.followers;
    if (v != null) last = v;
    else if (last == null) {
      // before the first value: use the earliest value we have after this day, if any
      const next = known.find((r) => r.day > d);
      return next?.followers ?? null;
    }
    return last;
  });
  const pick = (k: "reach" | "interactions") => days.map((d) => byDay.get(d)?.[k] ?? null);
  const own = (k: keyof Omit<Activity, "day">) => days.map((d) => aDay.get(d)?.[k] ?? 0);
  return {
    followers,
    reach: pick("reach"),
    interactions: pick("interactions"),
    triggers: own("triggers"),
    messages_out: own("messages_out"),
    new_contacts: own("new_contacts"),
  };
}

/** Sum series of several accounts. A day is null only when every account is null that day. */
export function sumSeries(list: AccountSeries[], len: number): AccountSeries {
  const out = {} as AccountSeries;
  for (const k of SERIES) {
    out[k] = Array.from({ length: len }, (_, i) => {
      let any = false;
      let s = 0;
      for (const a of list) {
        const v = a[k][i];
        if (v != null) {
          any = true;
          s += v;
        }
      }
      return any ? s : null;
    });
  }
  return out;
}

async function graph(path: string, params: Record<string, string>, token: string) {
  const u = new URL(`${graphBase()}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j, msg: String(j?.error?.message ?? "").slice(0, 120) };
}

/** Copy today's numbers (and what Meta lets us read back in time) into account_stats_daily. Never throws; returns notes. */
export async function snapshotAccount(db: SupabaseClient, acc: { id: string; org_id: string; external_ig_id: string | null; access_token_enc: string | null }): Promise<string[]> {
  const notes: string[] = [];
  if (!acc.external_ig_id || !acc.access_token_enc) return ["no token"];
  let token: string;
  try {
    token = decryptToken(acc.access_token_enc);
  } catch {
    return ["token"];
  }
  const ig = acc.external_ig_id;
  const base = { channel_account_id: acc.id, org_id: acc.org_id };
  const now = new Date();
  const today = iso(now);

  const prof = await graph(ig, { fields: "followers_count,media_count" }, token);
  if (!prof.ok) return [`profile: ${prof.msg}`];
  const followersNow = Number(prof.j.followers_count ?? 0);
  await db.from("account_stats_daily").upsert({ ...base, day: today, followers: followersNow, media_count: Number(prof.j.media_count ?? 0) });

  // Daily series Meta can give for the last 30 days: reach and net follower change. Follower change lets us rebuild the past count.
  const since = Math.floor(now.getTime() / 1000) - 29 * 86400;
  const ser = await graph(`${ig}/insights`, { metric: "reach,follower_count", period: "day", since: String(since), until: String(Math.floor(now.getTime() / 1000)) }, token);
  if (ser.ok) {
    const dayOf = (end: string) => iso(new Date(new Date(end).getTime() - 3600_000)); // end_time marks the end of the day
    const reach = new Map<string, number>();
    const delta = new Map<string, number>();
    for (const m of (ser.j.data ?? []) as { name: string; values: { value: number; end_time: string }[] }[]) {
      for (const v of m.values ?? []) (m.name === "reach" ? reach : delta).set(dayOf(v.end_time), Number(v.value ?? 0));
    }
    const { data: have } = await db.from("account_stats_daily").select("day,followers").eq("channel_account_id", acc.id);
    const haveF = new Set((have ?? []).filter((r) => r.followers != null).map((r) => r.day as string));
    const rows: Record<string, unknown>[] = [];
    let f = followersNow;
    // walk back from today: the count at the end of day D = today's count minus all changes after D
    const ds = [...new Set([...reach.keys(), ...delta.keys()])].sort().reverse();
    for (const d of ds) {
      if (d > today) continue;
      const row: Record<string, unknown> = { ...base, day: d };
      if (reach.has(d)) row.reach = reach.get(d);
      if (d < today && delta.size && !haveF.has(d)) row.followers = f;
      if (d < today) f -= delta.get(d) ?? 0;
      if (Object.keys(row).length > 3) rows.push(row);
    }
    if (rows.length) await db.from("account_stats_daily").upsert(rows);
  } else notes.push(`series: ${ser.msg}`);

  // Yesterday's totals (these metrics only come as a total over a range, so we take them one day at a time, going forward).
  const y0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const tot = await graph(`${ig}/insights`, { metric: "total_interactions,likes,comments,profile_views", metric_type: "total_value", period: "day", since: String(Math.floor(y0.getTime() / 1000)), until: String(Math.floor(y0.getTime() / 1000) + 86400) }, token);
  if (tot.ok) {
    const v: Record<string, number> = {};
    for (const m of (tot.j.data ?? []) as { name: string; total_value?: { value: number } }[]) v[m.name] = Number(m.total_value?.value ?? 0);
    await db.from("account_stats_daily").upsert({ ...base, day: iso(y0), interactions: v.total_interactions ?? null, likes: v.likes ?? null, comments: v.comments ?? null, profile_views: v.profile_views ?? null });
  } else notes.push(`totals: ${tot.msg}`);
  return notes;
}

export async function snapshotAll(db: SupabaseClient): Promise<{ done: number; notes: Record<string, string[]> }> {
  const { data } = await db.from("channel_accounts").select("id,org_id,external_ig_id,access_token_enc").eq("channel", "instagram").eq("status", "connected");
  const notes: Record<string, string[]> = {};
  let done = 0;
  for (const a of data ?? []) {
    const n = await snapshotAccount(db, { ...a, access_token_enc: a.access_token_enc as unknown as string | null });
    if (n.length) notes[a.id] = n;
    done++;
  }
  return { done, notes };
}
