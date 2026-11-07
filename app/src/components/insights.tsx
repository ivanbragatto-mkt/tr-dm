"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "./ui";
import { CHART_COLORS, LineChart, Stat, firstNum, lastNum, sumNum } from "./charts";

type Series = Record<"followers" | "reach" | "interactions" | "triggers" | "messages_out" | "new_contacts", (number | null)[]>;
export type InsightsData = {
  days: string[];
  total: Series | null;
  accounts: { id: string; username: string; series: Series; insightsKnown: boolean }[];
  insightsKnown?: boolean;
  automations?: { id: string; name: string; status: string; runs: number; contacts: number; sent: number; taps: number; docs: number }[];
  topPosts?: { id: string; caption: string; kind: string; date: string; url: string; image: string; likes: number; comments: number }[];
};

/** Loads /api/insights for a workspace or an account. */
export function useInsights(scope: { org?: string | null; account?: string | null }, days: number) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [err, setErr] = useState(false);
  const key = scope.account ? `account=${scope.account}` : scope.org ? `org=${scope.org}` : "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    setData(null);
    setErr(false);
    fetch(`/api/insights?${key}&days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => live && setData(j))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [key, days]);
  return { data, err, loading: !!key && !data && !err };
}

const nf = (n: number | null, lang: string) => (n == null ? "–" : new Intl.NumberFormat(lang, { notation: n >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n));

/** Stat cards and the three charts for one set of series (a whole workspace or one account). */
export function Charts({ data, days }: { data: InsightsData; days: number }) {
  const { t, lang } = useI18n();
  const s = data.total;
  if (!s) return null;
  const fNow = lastNum(s.followers);
  const fStart = firstNum(s.followers);
  const grew = fNow != null && fStart != null ? fNow - fStart : null;
  const period = t("ins.period.growth", { n: days });
  const showReach = data.insightsKnown;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("ins.followers")} value={nf(fNow, lang)} delta={grew} hint={period} />
        <Stat label={t("ins.triggers")} value={nf(sumNum(s.triggers), lang)} hint={period} />
        <Stat label={t("ins.out")} value={nf(sumNum(s.messages_out), lang)} hint={period} />
        {showReach ? <Stat label={t("ins.interactions")} value={nf(sumNum(s.interactions), lang)} hint={period} /> : <Stat label={t("ins.contacts")} value={nf(sumNum(s.new_contacts), lang)} hint={period} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">{t("ins.growth")}</h3>
          <LineChart days={data.days} lang={lang} empty={t("ins.empty")} ariaLabel={t("ins.growth")} lines={[{ label: t("ins.followers"), color: CHART_COLORS.orange, values: s.followers }]} />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">{t("ins.activity")}</h3>
          <LineChart
            days={data.days}
            lang={lang}
            empty={t("ins.empty")}
            ariaLabel={t("ins.activity")}
            lines={[
              { label: t("ins.triggers"), color: CHART_COLORS.orange, values: s.triggers },
              { label: t("ins.out"), color: CHART_COLORS.navy, values: s.messages_out },
              { label: t("ins.contacts"), color: CHART_COLORS.green, values: s.new_contacts },
            ]}
          />
        </Card>
        {showReach && (
          <Card className="p-4 lg:col-span-2">
            <h3 className="mb-3 text-sm font-medium">{t("ins.reachint")}</h3>
            <LineChart
              days={data.days}
              lang={lang}
              empty={t("ins.empty")}
              ariaLabel={t("ins.reachint")}
              lines={[
                { label: t("ins.reach"), color: CHART_COLORS.navy, values: s.reach },
                { label: t("ins.interactions"), color: CHART_COLORS.orange, values: s.interactions },
              ]}
            />
          </Card>
        )}
      </div>
      <p className="text-xs text-text-muted">{showReach ? t("ins.since") : `${t("ins.noperm")} ${t("ins.since")}`}</p>
    </div>
  );
}
