"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { flowPath } from "@/lib/flow-path";
import { remoteEnabled, supabase } from "@/lib/supabase/client";
import { Badge, Button, Card, FlowPath, cx, timeAgo } from "@/components/ui";
import { Charts, useInsights } from "@/components/insights";
import { Spark } from "@/components/charts";
import { PageHeader } from "@/components/shell";

const nf = (n: number, lang: string) => new Intl.NumberFormat(lang).format(n);

function initials(handle: string) {
  const h = handle.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);
  return ((h[0]?.[0] ?? "?") + (h[1]?.[0] ?? h[0]?.[1] ?? "")).toUpperCase();
}

export default function HomePage() {
  const { t, lang } = useI18n();
  const { automations, conversations, contacts, activeOrg, activeAccount, accounts } = useStore();
  const { data: ins, err: insErr, loading: insLoading } = useInsights({ org: remoteEnabled ? activeOrg : null }, 30);
  const [name, setName] = useState("");
  useEffect(() => {
    if (!remoteEnabled) return;
    supabase().auth.getUser().then(({ data }) => {
      const first = (data.user?.email ?? "").split("@")[0].split(/[._-]/)[0];
      setName(first ? first[0].toUpperCase() + first.slice(1) : "");
    });
  }, []);

  const mine = automations.filter((a) => !remoteEnabled || !a.accountId || a.accountId === activeAccount);
  const live = mine.filter((a) => a.status === "live");
  const hour = new Date().getHours();
  const greet = t(hour < 12 ? "home.greet.m" : hour < 18 ? "home.greet.a" : "home.greet.n", { name: name || "👋" });

  // numbers: today from the daily series, the rest from the automations' own totals
  const sentSeries = ins?.total?.messages_out ?? [];
  const today = sentSeries.length ? (sentSeries[sentSeries.length - 1] ?? 0) : mine.reduce((n, a) => n + a.stats.sent, 0);
  const people = mine.reduce((n, a) => n + a.stats.contacts, 0);
  const sent = mine.reduce((n, a) => n + a.stats.sent, 0);
  const taps = mine.reduce((n, a) => n + a.stats.taps, 0);
  const docs = mine.reduce((n, a) => n + a.stats.docs, 0);
  const ctr = sent ? Math.round((taps / sent) * 100) : 0;

  // activity: the latest thing each conversation did
  const who = new Map(contacts.map((c) => [c.id, c]));
  const activity = conversations
    .map((c) => {
      const m = [...c.messages].reverse().find((x) => x.kind !== "event" && x.kind !== "note");
      const p = who.get(c.contactId);
      if (!m || !p) return null;
      const what = m.sender === "contact" ? (m.fromComment ? t("act.comment", { t: m.text.slice(0, 40) }) : t("act.reply")) : m.kind === "doc" ? t("act.doc") : t("act.got");
      return { id: c.id, handle: p.handle, what, at: m.at };
    })
    .filter((x): x is { id: string; handle: string; what: string; at: number } => !!x)
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);

  const hasLive = live.length > 0;
  const answered = conversations.some((c) => c.messages.some((m) => m.sender === "agent" && m.kind === "text"));
  const steps = [
    { done: accounts.some((a) => a.status === "connected") || !remoteEnabled, label: t("home.step1"), href: "/settings" },
    { done: hasLive, label: t("home.step2"), href: "/automations/new" },
    { done: answered, label: t("home.step3"), href: "/inbox" },
  ];
  const newBtn = (
    <Link href="/automations/new">
      <Button>
        <Plus className="h-5 w-5" aria-hidden />
        {t("auto.new")}
      </Button>
    </Link>
  );

  return (
    <div className="mx-auto max-w-content space-y-6 pb-12">
      <PageHeader eyebrow={t("home.eyebrow")} title={greet} actions={newBtn} />

      <section aria-label={t("home.hero.label")} className="mx-4 flex flex-wrap items-stretch gap-8 rounded-xl bg-accent p-6 text-on-accent sm:mx-8 sm:p-9">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <span className="text-base font-medium">{t("home.hero.label")}</span>
          <span className="text-[64px] font-light leading-none tracking-[-0.02em] sm:text-numeral">{nf(today, lang)}</span>
          <Spark values={sentSeries.slice(-14)} className="mt-3 h-[90px] w-full" />
        </div>
        <dl className="flex min-w-0 flex-[1_1_260px] flex-col justify-between gap-4">
          {[
            [t("home.m.people"), nf(people, lang)],
            [t("home.m.ctr"), `${ctr}%`],
            [t("home.m.docs"), nf(docs, lang)],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-t border-white pt-4">
              <dt className="text-base">{k}</dt>
              <dd className="text-metric font-light">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-4 flex flex-wrap items-start gap-6 sm:mx-8">
        <Card className="min-w-0 flex-[1_1_480px] p-6 sm:px-8 sm:py-7">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-medium text-accent">{t("home.live")}</h2>
            <Link href="/automations" className="text-[15px] font-medium text-accent underline-offset-4 hover:text-signature hover:underline">
              {t("home.seeall")}
            </Link>
          </div>
          {live.length === 0 && <p className="border-t border-border py-6 text-sm">{t("home.live.none")}</p>}
          {live.slice(0, 4).map((a) => (
            <Link key={a.id} href={`/automations/${a.id}`} className="flex flex-col gap-3.5 border-t border-border py-[18px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-medium text-accent">{a.name}</span>
                <Badge tone="success">{t("auto.status.live")}</Badge>
              </div>
              <FlowPath steps={flowPath(a).map((k) => t(k))} />
              <span className="text-sm">
                {a.stats.runs} {t("auto.col.runs").toLowerCase()} · {timeAgo(a.modified, t, lang)}
              </span>
            </Link>
          ))}
        </Card>

        <Card className="min-w-0 flex-[1_1_320px] p-6 sm:px-8 sm:py-7">
          <div className="mb-2.5 flex items-center gap-2.5">
            <h2 className="text-xl font-medium text-accent">{t("home.activity")}</h2>
            <span aria-hidden className="h-2.5 w-2.5 rounded-pill bg-signature" />
          </div>
          {activity.length === 0 && <p className="border-t border-border py-6 text-sm">{t("home.activity.none")}</p>}
          {activity.map((x) => (
            <Link key={x.id} href="/inbox" className="flex items-start gap-3.5 border-t border-border py-3.5">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-canvas text-sm font-bold text-accent">
                {initials(x.handle)}
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-[1.4]">
                <span className="font-medium">@{x.handle.replace(/^@/, "")}</span> {x.what}
                <br />
                <span className="text-sm">{timeAgo(x.at, t, lang)}</span>
              </span>
            </Link>
          ))}
        </Card>
      </div>

      {remoteEnabled && activeOrg && (
        <section aria-labelledby="ov" className="mx-4 sm:mx-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="ov" className="text-xl font-medium text-accent">
                {t("ins.ws")}
              </h2>
              <p className="text-sm">{t("ins.ws.sub")}</p>
            </div>
            <Link href="/insights" className="text-[15px] font-medium text-accent underline underline-offset-4 hover:text-signature">
              {t("ins.detail")}
            </Link>
          </div>
          {insLoading && <p className="text-sm">{t("ins.loading")}</p>}
          {insErr && (
            <p role="alert" className="text-sm text-danger">
              {t("ins.err")}
            </p>
          )}
          {ins && ins.total && <Charts data={ins} days={30} />}
          {ins && !ins.total && <Card className="p-6 text-sm">{t("ins.noacct")}</Card>}
          {ins && ins.accounts.length > 1 && (
            <Card className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-base">
                <thead className="border-b border-border text-sm">
                  <tr>
                    {(["ins.account", "ins.followers", "ins.triggers", "ins.out"] as const).map((k) => (
                      <th key={k} scope="col" className="px-6 py-4 font-medium text-accent">
                        {t(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ins.accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 font-medium text-accent">@{a.username}</td>
                      <td className="px-6 py-4">{[...a.series.followers].reverse().find((v) => v != null) ?? "–"}</td>
                      <td className="px-6 py-4">{a.series.triggers.reduce((x: number, v) => x + (v ?? 0), 0)}</td>
                      <td className="px-6 py-4">{a.series.messages_out.reduce((x: number, v) => x + (v ?? 0), 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}

      <section aria-labelledby="next" className="mx-4 flex flex-wrap items-center gap-x-10 gap-y-5 rounded-xl bg-mint px-6 py-6 sm:mx-8 sm:px-8">
        <h2 id="next" className="shrink-0 text-lg font-medium text-accent">
          {t("home.next")}
        </h2>
        {steps.map((s) => (
          <Link key={s.label} href={s.href} className="inline-flex items-center gap-3 text-base text-accent">
            <span aria-hidden className={cx("grid h-7 w-7 place-items-center rounded-pill border-2 border-accent", s.done ? "bg-accent text-on-accent" : "bg-white")}>
              {s.done && <Check className="h-4 w-4" strokeWidth={3} />}
            </span>
            <span className={s.done ? "" : "font-medium"}>{s.label}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
