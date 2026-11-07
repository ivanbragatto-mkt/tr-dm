"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { remoteEnabled } from "@/lib/supabase/client";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { AccountPicker } from "@/components/account-picker";
import { Charts, useInsights, type InsightsData } from "@/components/insights";

const RANGES = [7, 30, 90];

export default function InsightsPage() {
  const { t, lang } = useI18n();
  const { activeAccount, activeOrg, accounts, portfolios } = useStore();
  const [days, setDays] = useState(30);
  const mine = accounts.filter((a) => a.orgId === activeOrg && a.status === "connected");
  // the account picked on this page; starts as the one selected in the side menu
  const [sel, setSel] = useState<string | null>(activeAccount);
  useEffect(() => setSel(activeAccount), [activeAccount]);
  const acc = mine.find((a) => a.id === sel) ?? mine[0];
  const { data, err, loading } = useInsights({ account: remoteEnabled ? (acc?.id ?? null) : null }, days);
  const one: InsightsData | null = data && data.accounts[0] ? { ...data, total: data.accounts[0].series, insightsKnown: data.accounts[0].insightsKnown } : null;
  const tone = { live: "success", paused: "warning", draft: "muted" } as const;
  const range = (
    <div role="group" aria-label={t("ins.range")} className="inline-flex rounded-pill bg-surface-raised p-1">
      {RANGES.map((n) => (
        <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={`h-9 rounded-pill px-4 text-sm font-medium ${days === n ? "bg-accent text-on-accent" : "text-accent hover:bg-accent-soft"}`}>
          {t("ins.days", { n })}
        </button>
      ))}
    </div>
  );
  return (
    <div className="mx-auto max-w-content pb-12">
      <PageHeader title={acc ? `${t("ins.title")} · @${acc.username.replace(/^@/, "")}` : t("ins.title")} actions={range} />
      <div className="space-y-6 px-4 sm:px-8">
        {mine.length > 0 && (
          <div className="max-w-xs">
            <div className="mb-1 text-xs font-medium text-text-muted">{t("ins.account")}</div>
            <AccountPicker accounts={mine} portfolios={portfolios} value={acc?.id ?? null} onChange={setSel} label={t("ins.account")} />
          </div>
        )}
        {!acc && <Card className="p-4 text-sm text-text-muted">{t("ins.noacct")}</Card>}
        {loading && <p className="text-sm text-text-muted">{t("ins.loading")}</p>}
        {err && <p role="alert" className="text-sm text-danger">{t("ins.err")}</p>}
        {one && <Charts data={one} days={days} />}

        {data?.automations && (
          <section aria-labelledby="au">
            <h2 id="au" className="mb-3 text-lg font-semibold">{t("ins.autos")}</h2>
            <Card className="overflow-x-auto">
              {data.automations.length === 0 ? (
                <p className="p-4 text-sm text-text-muted">{t("ins.autos.none")}</p>
              ) : (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-border text-xs text-text-muted">
                    <tr>
                      {(["auto.col.name", "ins.autos.col.runs", "ins.autos.col.people", "ins.autos.col.sent", "ins.autos.col.taps", "ins.autos.col.docs"] as const).map((k) => (
                        <th key={k} scope="col" className="px-4 py-3 font-medium">{t(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.automations.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3 font-semibold">
                            <Badge tone={tone[a.status as keyof typeof tone] ?? "muted"}>{t(`auto.status.${a.status}` as "auto.status.live")}</Badge>
                            <span className="break-words">{a.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">{a.runs}</td>
                        <td className="px-4 py-3">{a.contacts}</td>
                        <td className="px-4 py-3">{a.sent}</td>
                        <td className="px-4 py-3">{a.taps}</td>
                        <td className="px-4 py-3">{a.docs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </section>
        )}

        {data?.topPosts && data.topPosts.length > 0 && (
          <section aria-labelledby="tp">
            <h2 id="tp" className="text-lg font-semibold">{t("ins.posts")}</h2>
            <p className="mb-3 text-sm text-text-muted">{t("ins.posts.sub")}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {data.topPosts.map((p) => (
                <li key={p.id}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                    <Card className="h-full overflow-hidden transition-shadow duration-base hover:shadow-pop">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image && <img src={p.image} alt="" className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />}
                      <div className="p-3">
                        <div className="text-xs text-text-muted">{new Date(p.date + "T12:00:00Z").toLocaleDateString(lang, { day: "numeric", month: "short", timeZone: "UTC" })}</div>
                        <p className="mt-1 line-clamp-2 text-sm">{p.caption || "–"}</p>
                        <p className="mt-2 text-xs font-medium">{p.likes} {t("ins.likes")} · {p.comments} {t("ins.commentsn")}</p>
                      </div>
                    </Card>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
