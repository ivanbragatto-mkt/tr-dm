"use client";
import { useState } from "react";
import { FileText, RotateCcw, Send } from "lucide-react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { matchTrigger, type Graph } from "@/lib/flow";
import { runGraph, triggerNode, type Effect } from "@/lib/engine/run";
import { fillVars } from "@/lib/vars";
import { Button, Card, Field, Input, cx } from "./ui";

type Item =
  | { kind: "comment"; text: string }
  | { kind: "public"; text: string }
  | { kind: "dm"; text: string; button?: string; nodeId: string; used?: boolean }
  | { kind: "doc"; name: string }
  | { kind: "note"; text: string };

/** Runs the automation as it is on screen (nothing to save first) with the same engine the server uses, and shows what the person would get. */
export function WizardTest({ graph, defaultLang }: { graph: Graph; defaultLang: Lang }) {
  const { t } = useI18n();
  const [handle, setHandle] = useState("visitor_" + Math.floor(Math.random() * 900 + 100));
  const [comment, setComment] = useState("");
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [follows, setFollows] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [runs, setRuns] = useState(0);

  const snapshot = (windowOpen: boolean) => ({ language: lang, tags: [] as string[], followsAccount: follows, followers: 120, optedInVia: "comment" as const, windowOpen, hour: new Date().getHours() });
  const toItems = (effects: Effect[]): Item[] =>
    effects.flatMap((e): Item[] => {
      const person = { username: handle, first_name: null };
      if (e.type === "public_reply") return [{ kind: "public", text: fillVars(e.text, person) }];
      if (e.type === "message") {
        const out: Item[] = [];
        if (e.text) out.push({ kind: "dm", text: fillVars(e.text, person), button: e.button, nodeId: e.nodeId });
        if (e.pdf) out.push({ kind: "doc", name: e.pdf.name });
        return out;
      }
      if (e.type === "tag_add") return [{ kind: "note", text: t("wiz.try.tag", { tag: e.value }) }];
      if (e.type === "blocked") return [{ kind: "note", text: t("wiz.try.blocked") }];
      return [];
    });

  function send() {
    const trig = triggerNode(graph);
    const text = comment.trim() || (trig?.data.anyWord ? "👋" : trig?.data.keywords[0] ?? "");
    const start: Item[] = [{ kind: "comment", text }];
    if (!trig || !matchTrigger(trig.data, text)) {
      setItems([...start, { kind: "note", text: t("wiz.try.nomatch") }]);
      return;
    }
    const out = runGraph({ graph, start: "trigger", snapshot: snapshot(false), source: "ig_comment", defaultLang, privateReplyAvailable: true, publicRotation: runs });
    setRuns(runs + 1);
    setItems([...start, ...toItems(out.effects)]);
  }
  function tap(idx: number) {
    const it = items[idx];
    if (it.kind !== "dm" || it.used) return;
    const out = runGraph({ graph, start: { nodeId: it.nodeId, handle: "tap" }, snapshot: snapshot(true), source: "ig_comment", defaultLang, privateReplyAvailable: false, publicRotation: runs });
    setItems([...items.map((x, i) => (i === idx && x.kind === "dm" ? { ...x, used: true } : x)), { kind: "note", text: t("wiz.try.tapped") }, ...toItems(out.effects)]);
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">{t("wiz.try.title")}</h2>
      <p className="text-xs text-text-muted">{t("wiz.try.d")}</p>
      <Field label={t("wiz.test.handle")} htmlFor="wt-handle">
        <Input id="wt-handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
      </Field>
      <Field label={t("wiz.test.comment")} htmlFor="wt-comment">
        <Input id="wt-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("wiz.try.comment.ph")} />
      </Field>
      <Field label={t("wiz.lang")} htmlFor="wt-lang">
        <select id="wt-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="h-10 w-full rounded-md border border-border-input bg-bg px-2 text-sm">
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={follows} onChange={(e) => setFollows(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        {t("wiz.try.follows")}
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={send}>
          <Send className="h-4 w-4" aria-hidden />
          {t("wiz.test.send")}
        </Button>
        {items.length > 0 && (
          <Button variant="secondary" aria-label={t("wiz.try.reset")} title={t("wiz.try.reset")} onClick={() => setItems([])}>
            <RotateCcw className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>

      <div className="min-h-40 space-y-2 rounded-xl bg-accent p-3 text-xs text-on-accent" aria-live="polite">
        {items.length === 0 && <p className="py-8 text-center opacity-80">{t("wiz.try.empty")}</p>}
        {items.map((it, i) => {
          switch (it.kind) {
            case "comment":
              return (
                <p key={i} className="ml-auto max-w-[85%] rounded-lg bg-white/15 p-2.5">
                  <span className="font-semibold">@{handle} </span>
                  {it.text}
                </p>
              );
            case "public":
              return (
                <p key={i} className="ml-6 max-w-[85%] rounded-lg bg-white/10 p-2.5">
                  <span className="block text-[10px] opacity-70">{t("wiz.try.public")}</span>
                  {it.text}
                </p>
              );
            case "dm":
              return (
                <div key={i} className="max-w-[88%] space-y-1.5">
                  <div className="rounded-lg bg-white p-2.5 text-text">{it.text}</div>
                  {it.button && (
                    <button type="button" disabled={it.used} onClick={() => tap(i)} className={cx("w-full rounded-pill px-3 py-1.5 text-center font-semibold", it.used ? "bg-white/20 opacity-60" : "bg-signature text-on-signature hover:ring-2 hover:ring-white")}>
                      {it.button}
                    </button>
                  )}
                </div>
              );
            case "doc":
              return (
                <div key={i} className="flex max-w-[88%] items-center gap-2 rounded-lg bg-white p-2.5 text-text">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{it.name}</span>
                </div>
              );
            default:
              return (
                <p key={i} className="text-center text-[11px] italic opacity-80">
                  {it.text}
                </p>
              );
          }
        })}
      </div>
    </Card>
  );
}
