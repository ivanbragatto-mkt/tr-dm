"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { copyAutomationTo, deleteAutomation, useStore } from "@/lib/store";
import { remoteEnabled } from "@/lib/supabase/client";
import { Badge, Button, Card, EmptyState, Modal, cx, timeAgo } from "@/components/ui";
import { PageHeader } from "@/components/shell";

export default function AutomationsPage() {
  const { t, lang } = useI18n();
  const { automations, accounts, activeAccount } = useStore();
  const [q, setQ] = useState("");
  const [copying, setCopying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function confirmDelete() {
    if (!del) return;
    setBusy(true);
    const ok = await deleteAutomation(del.id);
    setBusy(false);
    setDel(null);
    setNote(ok ? t("auto.delete.done") : t("auto.delete.err"));
  }
  const others = accounts.filter((a) => a.id !== activeAccount && a.status === "connected");
  async function copy(id: string, to: string) {
    const nid = to ? await copyAutomationTo(id, to) : null;
    setCopying(null);
    setNote(nid ? t("auto.copy.done") : t("auto.copy.err"));
  }
  const [tab, setTab] = useState<"all" | "live" | "draft" | "paused">("all");
  const mine = automations;
  const count = (k: typeof tab) => (k === "all" ? mine.length : mine.filter((x) => x.status === k).length);
  const list = mine.filter((a) => (tab === "all" || a.status === tab) && a.name.toLowerCase().includes(q.toLowerCase()));
  const tone = { live: "success", paused: "danger", draft: "muted" } as const;
  const newBtn = (
    <Link href="/automations/new">
      <Button>
        <Plus className="h-5 w-5" aria-hidden />
        {t("auto.new")}
      </Button>
    </Link>
  );
  const tabs = [
    ["all", t("auto.tab.all")],
    ["live", t("auto.status.live")],
    ["draft", t("auto.status.draft")],
    ["paused", t("auto.status.paused")],
  ] as const;
  return (
    <div className="mx-auto max-w-content pb-12">
      <PageHeader title={t("auto.title")} actions={newBtn} />
      <div className="space-y-5 px-4 sm:px-8">
        {note && (
          <p role="status" className="rounded-pill bg-mint px-5 py-3 text-sm font-medium text-accent">
            {note}
          </p>
        )}
        {automations.length === 0 ? (
          <Card>
            <EmptyState title={t("auto.empty.t")} text={t("auto.empty.d")} action={newBtn} />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div role="tablist" aria-label={t("auto.title")} className="inline-flex flex-wrap gap-1 rounded-pill bg-surface-raised p-1.5">
                {tabs.map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("inline-flex h-10 items-center gap-2 rounded-pill px-5 text-[15px] transition-colors duration-fast", tab === k ? "bg-accent font-medium text-on-accent" : "text-accent hover:bg-accent-soft")}>
                    {label}
                    <span className="text-[13px]">{count(k)}</span>
                  </button>
                ))}
              </div>
              <label className="flex h-[52px] min-w-0 flex-[0_1_340px] items-center gap-2.5 rounded-pill bg-surface-raised px-5">
                <Search className="h-5 w-5 shrink-0" aria-hidden />
                <span className="sr-only">{t("auto.search")}</span>
                <input type="text" placeholder={t("auto.search")} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-muted" />
              </label>
            </div>
            <div role="presentation" className="hidden items-end gap-x-5 px-6 text-[13px] lg:grid lg:grid-cols-[minmax(220px,1fr)_80px_150px_100px_170px]">
              <span>{t("auto.col.name")}</span>
              <span>{t("auto.col.replies")}</span>
              <span>{t("auto.col.clicks")}</span>
              <span>{t("auto.col.modified")}</span>
              <span />
            </div>
            <ul className="space-y-2">
              {list.map((a) => {
                const ctr = a.stats.sent ? Math.round((a.stats.clicked / a.stats.sent) * 100) : 0;
                return (
                  <li key={a.id}>
                    <article className="grid items-center gap-x-5 gap-y-2 rounded-lg bg-surface-raised px-6 py-3 lg:grid-cols-[minmax(220px,1fr)_80px_150px_100px_170px]">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <Link href={`/automations/${a.id}`} className="truncate text-base font-medium text-accent hover:text-signature" title={a.name}>
                          {a.name}
                        </Link>
                        <Badge tone={tone[a.status]}>{t(`auto.status.${a.status}` as "auto.status.live")}</Badge>
                      </div>
                      <div className="text-xl font-light text-accent" title={t("auto.col.replies")}>
                        <span className="text-[13px] font-normal text-text lg:hidden">{t("auto.col.replies")} </span>
                        {a.stats.runs}
                      </div>
                      <div className="flex items-center gap-2" title={t("auto.col.clicks")}>
                        <span className="w-12 text-xl font-light text-accent">{a.stats.sent ? `${ctr}%` : "–"}</span>
                        <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-pill bg-mint">
                          <span className="block h-1.5 rounded-pill bg-accent" style={{ width: `${ctr}%` }} />
                        </span>
                      </div>
                      <div className="text-[13px] leading-tight">{timeAgo(a.modified, t, lang)}</div>
                      <div className="flex items-center justify-end gap-2">
                        {remoteEnabled &&
                          (copying === a.id ? (
                            <select aria-label={t("auto.copy.to")} autoFocus defaultValue="" onChange={(e) => void copy(a.id, e.target.value)} onBlur={() => setCopying(null)} className="h-9 rounded-pill border-[1.5px] border-accent bg-bg px-3 text-sm">
                              <option value="" disabled>
                                {t("auto.copy.to")}…
                              </option>
                              {others.map((o) => (
                                <option key={o.id} value={o.id}>
                                  @{o.username}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Button variant="secondary" size="sm" className="h-9 whitespace-nowrap px-4" disabled={others.length === 0} title={others.length === 0 ? t("auto.copy.none") : t("auto.copy")} onClick={() => setCopying(a.id)}>
                              {t("auto.copy.short")}
                            </Button>
                          ))}
                        <Button variant="secondary" size="sm" className="h-9 px-4" disabled={a.status !== "paused"} title={a.status !== "paused" ? t("auto.delete.only") : undefined} onClick={() => setDel({ id: a.id, name: a.name })}>
                          {t("auto.delete")}
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
              {list.length === 0 && <li className="rounded-lg bg-surface-raised px-7 py-10 text-center">{t("auto.noresults")}</li>}
            </ul>
          </>
        )}
      </div>
      <Modal open={!!del} onClose={() => setDel(null)} title={t("auto.delete.title")} closeLabel={t("auto.delete.cancel")}>
        <p className="text-sm">{t("auto.delete.body", { name: del?.name ?? "" })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDel(null)}>
            {t("auto.delete.cancel")}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
            {t("auto.delete.confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
