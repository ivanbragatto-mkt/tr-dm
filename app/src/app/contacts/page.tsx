"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addTag, removeTag, setAutomationsPaused, setSubscribed, useStore, windowOpen, type Contact } from "@/lib/store";
import { Badge, Button, Card, EmptyState, Input, Modal, timeAgo } from "@/components/ui";
import { PageHeader } from "@/components/shell";

export default function ContactsPage() {
  const { t, lang } = useI18n();
  const { contacts } = useStore();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = contacts.filter((c) => (c.name + c.handle + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase()));
  const current = contacts.find((c) => c.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-content pb-12">
      <PageHeader title={t("contacts.title")} />
      <div className="px-4 sm:px-8">
        {contacts.length === 0 ? (
          <Card>
            <EmptyState title={t("contacts.empty.t")} text={t("contacts.empty.d")} />
          </Card>
        ) : (
          <>
            <div className="mb-5 max-w-sm">
              <label className="flex h-[52px] items-center gap-2.5 rounded-pill bg-surface-raised px-5">
                <Search className="h-5 w-5 shrink-0" aria-hidden />
                <span className="sr-only">{t("contacts.search")}</span>
                <input placeholder={t("contacts.search")} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-muted" />
              </label>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="border-b border-border text-sm">
                  <tr>
                    {(["name", "handle", "tags", "lang", "last"] as const).map((k) => (
                      <th key={k} scope="col" className="px-6 py-4 font-medium text-accent">
                        {t(`contacts.col.${k}` as "contacts.col.name")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-6 py-4">
                        <button onClick={() => setOpenId(c.id)} className="font-medium text-accent underline-offset-2 hover:underline">
                          {c.name}
                        </button>
                      </td>
                      <td className="px-6 py-4">@{c.handle}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((tg) => (
                            <span key={tg} className="inline-flex items-center rounded-pill bg-mint px-3 py-1 text-sm font-medium text-accent">{tg}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">{c.language}</td>
                      <td className="px-6 py-4">{timeAgo(c.lastActivity, t, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
      <Modal open={!!current} onClose={() => setOpenId(null)} title={t("contacts.profile")} closeLabel={t("contacts.close")}>
        {current && <Profile c={current} />}
      </Modal>
    </div>
  );
}

function Profile({ c }: { c: Contact }) {
  const { t } = useI18n();
  const [tag, setTag] = useState("");
  const src = { comment: t("contacts.src.comment"), ad: t("contacts.src.ad"), dm: t("contacts.src.dm") }[c.optedInVia];
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xl font-medium text-accent">{c.name}</div>
        <div className="text-sm">@{c.handle}</div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-text-muted">{t("contacts.status")}</dt>
          <dd>{c.subscribed ? t("contacts.subscribed") : t("contacts.unsubscribed")}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{t("contacts.optin")}</dt>
          <dd>{src}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{t("contacts.col.lang")}</dt>
          <dd>{c.language}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{t("contacts.window")}</dt>
          <dd>{windowOpen(c) ? "✓ 24h" : t("contacts.window.closed")}</dd>
        </div>
      </dl>
      <div>
        <div className="mb-2 text-sm font-semibold">{t("contacts.tags")}</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {c.tags.map((tg) => (
            <span key={tg} className="inline-flex items-center gap-1 rounded-pill bg-mint px-3 py-1 text-sm font-medium text-accent">
              {tg}
              <button onClick={() => removeTag(c.id, tg)} aria-label={`${tg} ×`} className="grid h-4 w-4 place-items-center rounded-pill hover:bg-surface">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTag(c.id, tag);
            setTag("");
          }}
        >
          <Input aria-label={t("contacts.addtag")} placeholder={t("contacts.addtag.ph")} value={tag} onChange={(e) => setTag(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!tag.trim()}>
            {t("contacts.addtag")}
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setAutomationsPaused(c.id, !c.automationsPaused)}>
          {c.automationsPaused ? t("contacts.unpause") : t("contacts.pause")}
        </Button>
        <Button variant="secondary" onClick={() => setSubscribed(c.id, !c.subscribed)}>
          {c.subscribed ? t("contacts.unsub") : t("contacts.sub")}
        </Button>
        <Link href="/inbox">
          <Button>{t("contacts.chat")}</Button>
        </Link>
      </div>
    </div>
  );
}
