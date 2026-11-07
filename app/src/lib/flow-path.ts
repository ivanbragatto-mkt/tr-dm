import { buildGraph, hasButton, triggerOf, type Graph } from "./flow";
import type { Key } from "./i18n";
import type { Automation } from "./store";

/** The steps of an automation in the order a person meets them, as translation keys. Follows the main line: next, then tap, yes. */
export function flowPath(a: Automation): Key[] {
  const g: Graph = a.draftGraph ?? a.graph ?? buildGraph(a);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  let cur = g.nodes.find((n) => n.data.kind === "trigger");
  const out: Key[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id) && out.length < 7) {
    seen.add(cur.id);
    const d = cur.data;
    switch (d.kind) {
      case "trigger": {
        const s = triggerOf(d).source;
        out.push(s === "ig_comment" || s === "fb_comment" ? "path.comment" : s === "ad" ? "path.ad" : s.startsWith("story") ? "path.story" : "path.dm");
        break;
      }
      case "public":
        out.push("path.public");
        break;
      case "message":
        out.push(d.pdf && !Object.values(d.text).some(Boolean) ? "path.pdf" : hasButton(d) ? "path.msgbtn" : "path.msg");
        break;
      case "condition":
        out.push(d.rows.some((r) => r.field === "follows") ? "path.follow" : "path.cond");
        break;
      case "actions":
        out.push("path.act");
        break;
      case "delay":
        out.push("path.delay");
        break;
      case "randomizer":
        out.push("path.rand");
        break;
    }
    const outs = g.edges.filter((e) => e.source === cur!.id);
    const pick = outs.find((e) => e.sourceHandle === "next") ?? outs.find((e) => e.sourceHandle === "yes") ?? outs.find((e) => e.sourceHandle === "tap") ?? outs[0];
    cur = pick ? byId.get(pick.target) : undefined;
  }
  return out;
}
