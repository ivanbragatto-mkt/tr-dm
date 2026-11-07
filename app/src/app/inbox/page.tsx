"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellPlus, Check, FileText, Lock, RotateCcw, Search } from "lucide-react";
import { remoteEnabled } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  addNote,
  assignConversation,
  markRead,
  sendAgentMessage,
  setAutomationsPaused,
  setConversationState,
  setReminder,
  useStore,
  windowOpen,
  HOUR,
  type Message,
} from "@/lib/store";
import { Button, EmptyState, Tabs, Textarea, cx, timeAgo } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Filter = "open" | "closed" | "unread";

export default function InboxPage() {
  const { t, lang } = useI18n();
  const { conversations, contacts, team } = useStore();
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      conversations
        .map((c) => ({ c, contact: contacts.find((x) => x.id === c.contactId)! }))
        .filter((r) => r.contact)
        .filter((r) => (filter === "open" ? r.c.state === "open" : filter === "closed" ? r.c.state === "closed" : r.c.unread > 0))
        .filter((r) => (r.contact.name + r.contact.handle).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.c.lastAt - a.c.lastAt),
    [conversations, contacts, filter, q],
  );
  const active = rows.find((r) => r.c.id === sel) ?? null;

  useEffect(() => {
    if (sel) markRead(sel);
  }, [sel, conversations.length]);

  return (
    <div className="mx-auto max-w-[1400px] pb-8">
      <PageHeader title={t("inbox.title")} />
      <div className="flex flex-wrap items-stretch gap-4 px-4 sm:px-8 lg:flex-nowrap">
        <section aria-label={t("inbox.title")} className={cx("flex h-[calc(100vh-180px)] min-h-[560px] w-full flex-col gap-1.5 overflow-hidden rounded-xl bg-surface-raised px-4 py-5 lg:w-[330px] lg:shrink-0", active && "hidden lg:flex")}>
          <div role="tablist" aria-label={t("inbox.all")} className="mb-2 flex gap-1 self-start rounded-pill bg-canvas p-[5px]">
            {(["open", "unread", "closed"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cx("h-9 whitespace-nowrap rounded-pill px-3.5 text-sm transition-colors duration-fast", filter === k ? "bg-accent font-medium text-on-accent" : "text-accent hover:bg-accent-soft")}>
                {t(`inbox.filter.${k}` as "inbox.filter.open")}
              </button>
            ))}
          </div>
          <label className="mb-2 flex h-11 items-center gap-2 rounded-pill bg-canvas px-4">
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="sr-only">{t("inbox.search")}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("inbox.search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted" />
          </label>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <EmptyState title={t("inbox.empty")} text={t("inbox.empty.d")} />
            ) : (
              <ul className="space-y-1">
                {rows.map(({ c, contact }) => {
                  const last = [...c.messages].reverse().find((m) => m.kind !== "event" && m.kind !== "note");
                  return (
                    <li key={c.id}>
                      <button onClick={() => setSel(c.id)} aria-current={sel === c.id} className={cx("flex w-full items-center gap-3 rounded-[20px] p-3 text-left hover:bg-canvas", sel === c.id && "bg-canvas")}>
                        <Avatar name={contact.name} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={cx("truncate text-[15px] text-accent", c.unread ? "font-bold" : "font-medium")}>{contact.name}</span>
                            <span className="shrink-0 text-[13px]">{timeAgo(c.lastAt, t, lang)}</span>
                          </span>
                          <span className="block truncate text-sm">{last?.kind === "doc" ? `📎 ${last.text}` : last?.text}</span>
                        </span>
                        {c.unread > 0 && <span aria-label="unread" className="h-2.5 w-2.5 shrink-0 rounded-pill bg-signature" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {active ? (
          <Thread key={active.c.id} convId={active.c.id} onBack={() => setSel(null)} team={team} />
        ) : (
          <section className="hidden h-[calc(100vh-180px)] min-h-[560px] min-w-0 flex-1 place-items-center rounded-xl bg-surface-raised lg:grid">
            <p className="text-base">{t("inbox.select")}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const p = name.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-pill bg-accent text-sm font-bold text-on-accent" style={{ width: size, height: size, fontSize: size > 60 ? 22 : 14 }}>
      {((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? p[0]?.[1] ?? "")).toUpperCase()}
    </span>
  );
}

function Thread({ convId, onBack, team }: { convId: string; onBack: () => void; team: { id: string; name: string }[] }) {
  const { t, lang } = useI18n();
  const { conversations, contacts, automations } = useStore();
  const conv = conversations.find((c) => c.id === convId)!;
  const contact = contacts.find((c) => c.id === conv.contactId)!;
  const [tab, setTab] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const open = windowOpen(contact);
  const fmt = (n: number) => new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(n);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conv.messages.length]);

  function submit() {
    const v = text.trim();
    if (!v) return;
    if (tab === "note") addNote(conv.id, v);
    else {
      const r = sendAgentMessage(conv.id, v);
      if (!r.ok) return setErr(t("inbox.window.closed"));
    }
    setErr(null);
    setText("");
  }

  const auto = automations.find((x) => x.id === conv.automationId);
  return (
    <>
      <section aria-label={contact.name} className="flex h-[calc(100vh-180px)] min-h-[560px] min-w-0 flex-1 flex-col gap-4 rounded-xl bg-surface-raised px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onBack} aria-label={t("inbox.title")} className="grid h-10 w-10 place-items-center rounded-pill hover:bg-canvas lg:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <Avatar name={contact.name} />
            <div className="min-w-0">
              <div className="truncate text-lg font-medium text-accent">{contact.name}</div>
              <label className="sr-only" htmlFor="assignee">
                {t("inbox.assignee")}
              </label>
              <select id="assignee" value={conv.assignee ?? ""} onChange={(e) => assignConversation(conv.id, e.target.value || null)} className="h-7 rounded-pill border-0 bg-transparent p-0 text-sm">
                <option value="">{t("inbox.unassigned")}</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("inline-flex items-start gap-2 rounded-[20px] px-3.5 py-1.5 text-sm font-medium", open ? "bg-mint text-accent" : "border-[1.5px] border-accent text-accent")} role="status">
              <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-pill", open ? "bg-accent" : "border-[1.5px] border-accent")} />
              {open ? t("inbox.window.open", { t: fmt(contact.windowExpiresAt!) }) : t("inbox.window.closed")}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setReminder(conv.id, Date.now() + 24 * HOUR)}>
              <BellPlus className="h-4 w-4" aria-hidden />
              {conv.reminderAt ? t("inbox.reminder.set") : t("inbox.remind")}
            </Button>
            {conv.state === "open" ? (
              <Button variant="secondary" size="sm" onClick={() => setConversationState(conv.id, "closed")}>
                <Check className="h-4 w-4" aria-hidden />
                {t("inbox.close")}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConversationState(conv.id, "open")}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t("inbox.reopen")}
              </Button>
            )}
          </div>
        </div>

        <div role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3.5 overflow-y-auto py-1.5">
          {conv.messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          <div ref={endRef} />
        </div>

        <div>
          <div className="mb-2">
            <Tabs label={t("inbox.reply")} value={tab} onChange={setTab} items={[{ value: "reply", label: t("inbox.reply") }, { value: "note", label: t("inbox.note") }]} />
          </div>
          {err && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {err}
            </p>
          )}
          <div className="flex items-end gap-3 rounded-[28px] border-[1.5px] border-accent py-2 pl-5 pr-2">
            <textarea
              aria-label={tab === "note" ? t("inbox.note") : t("inbox.reply")}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tab === "note" ? t("inbox.note.ph") : t("inbox.reply.ph")}
              disabled={tab === "reply" && !open}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              className="max-h-32 min-h-[28px] flex-1 resize-none self-center bg-transparent py-1 text-base outline-none placeholder:text-text-muted disabled:opacity-60"
            />
            <Button onClick={submit} disabled={!text.trim() || (tab === "reply" && !open)}>
              {tab === "note" ? t("inbox.save.note") : t("inbox.send")}
            </Button>
          </div>
        </div>
      </section>

      <aside aria-label={contact.name} className="hidden h-[calc(100vh-180px)] min-h-[560px] w-[290px] shrink-0 flex-col gap-5 overflow-y-auto rounded-xl bg-surface-raised px-6 py-6 xl:flex">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={contact.name} size={72} />
          <span className="break-all text-xl font-medium text-accent">{contact.name}</span>
          <span className="text-sm">{fmt(contact.lastActivity)}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-accent">{t("inbox.tags")}</span>
          <div className="flex flex-wrap gap-2">
            {contact.tags.length === 0 && <span className="text-sm">–</span>}
            {contact.tags.map((g) => (
              <span key={g} className="rounded-pill bg-mint px-3.5 py-1.5 text-sm font-medium text-accent">
                {g}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <span className="text-sm font-medium text-accent">{t("inbox.auto.current")}</span>
          <span className="text-[15px]">{auto?.name ?? "–"}</span>
          {contact.automationsPaused && (
            <span className="text-sm">
              {t("inbox.paused", { t: remoteEnabled ? "7 d" : "30 min" })}
            </span>
          )}
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setAutomationsPaused(contact.id, !contact.automationsPaused)}>
            {contact.automationsPaused ? t("inbox.resume") : t("inbox.pause.person")}
          </Button>
        </div>
        <Link href="/contacts" className="mt-auto text-[15px] font-medium text-accent underline underline-offset-4 hover:text-signature">
          {t("inbox.contact.open")}
        </Link>
      </aside>
    </>
  );
}

function Bubble({ m }: { m: Message }) {
  const { t } = useI18n();
  if (m.kind === "event")
    return (
      <p className="mx-auto rounded-pill border-[1.5px] border-accent px-3.5 py-1 text-[13px] text-accent">
        {m.text.startsWith("inbox.") ? t(m.text as "inbox.system.opened") : m.text}
      </p>
    );
  if (m.kind === "note")
    return (
      <div className="mx-auto flex max-w-[85%] items-start gap-2 rounded-[20px] bg-mint px-4 py-3 text-sm">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        <span className="break-words">{m.text}</span>
      </div>
    );
  const mine = m.sender !== "contact";
  return (
    <div className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
      <span className="mb-1 text-[13px]">
        {m.fromComment ? "💬 " + t("inbox.msg.comment") : m.sender === "bot" ? t("inbox.sender.bot") : m.sender === "agent" ? t("inbox.sender.you") : ""}
        {m.kind === "public" && " · public"}
      </span>
      <div className={cx("max-w-[75%] break-words px-4 py-3 text-[15px] leading-[1.5]", m.kind === "doc" ? "rounded-[22px] border-[1.5px] border-accent bg-bg font-medium text-accent" : mine ? "rounded-[22px_22px_6px_22px] bg-bubble-out text-on-bubble-out" : "rounded-[22px_22px_22px_6px] bg-bubble-in text-text")}>
        {m.kind === "doc" ? (
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden />
            <span>{m.text}</span>
          </span>
        ) : (
          m.text
        )}
        {m.button && <div className="mt-2 rounded-pill border border-white/50 px-3 py-1.5 text-center font-medium">{m.button}</div>}
      </div>
      {mine && m.status === "queued" && <span className="mt-1 text-[13px]">{t("inbox.msg.queued")}</span>}
      {mine && m.status === "failed" && <span className="mt-1 max-w-[85%] text-[13px] text-danger">{t("inbox.msg.failed", { why: m.failure ?? "?" })}</span>}
    </div>
  );
}

