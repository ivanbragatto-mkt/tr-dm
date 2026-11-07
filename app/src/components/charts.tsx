"use client";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./ui";

export type Line = { label: string; color: string; values: (number | null)[]; dash?: boolean };

const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 26 };
const nf = (n: number, lang = "en") => new Intl.NumberFormat(lang, { notation: Math.abs(n) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** A small dependency-free line chart. Hover or focus a point to read the values of that day. */
export function LineChart({ days, lines, lang = "en", empty, ariaLabel }: { days: string[]; lines: Line[]; lang?: string; empty: string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(640);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const hasData = lines.some((l) => l.values.some((v) => v != null));
  // draw at the real width so text keeps its size and the height stays fixed
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);
  const all = lines.flatMap((l) => l.values).filter((v): v is number => v != null);
  if (all.length === 0) return <p className="grid h-40 place-items-center rounded-lg bg-surface px-4 text-center text-sm text-text-muted">{empty}</p>;
  const hi = Math.max(...all);
  // a series that never moves (e.g. followers) reads better with a window around it than from zero
  const lo = Math.min(...all);
  const flatBase = lines.length === 1 && lo > 0 && hi - lo < hi * 0.5;
  const min = flatBase ? Math.max(0, Math.floor(lo - Math.max(1, (hi - lo) * 0.3))) : 0;
  const max = flatBase ? Math.ceil(hi + Math.max(1, (hi - lo) * 0.3)) : niceMax(hi);
  const x = (i: number) => PAD.l + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / Math.max(1, max - min)) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((f) => Math.round(min + f * (max - min)));
  const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(lang, { day: "numeric", month: "short", timeZone: "UTC" });
  const path = (vals: (number | null)[]) => {
    let s = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) return void (pen = false);
      s += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return s;
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (days.length - 1));
    setHover(Math.min(days.length - 1, Math.max(0, i)));
  };
  const cur = hover ?? days.length - 1;
  return (
    <div ref={box}>
      <div className="mb-2 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium text-accent">{fmtDay(days[cur])}</span>
        {lines.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-pill" style={{ background: l.dash ? `repeating-linear-gradient(90deg, ${l.color} 0 2px, transparent 2px 5px)` : l.color, height: 3 }} aria-hidden />
            {l.label}: <strong>{l.values[cur] == null ? "–" : nf(l.values[cur]!, lang)}</strong>
          </span>
        ))}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block touch-none" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <title id={id}>{ariaLabel}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">
              {nf(t, lang)}
            </text>
          </g>
        ))}
        {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i, k) => (
          <text key={k} x={x(i)} y={H - 6} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fontSize="11" fill="var(--color-text-muted)">
            {fmtDay(days[i])}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-border-input)" strokeDasharray="3 3" />}
        {lines.map((l) => (
          <g key={l.label}>
            <path d={path(l.values)} fill="none" stroke={l.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={l.dash ? "2 7" : undefined} />
            {l.values[cur] != null && <circle cx={x(cur)} cy={y(l.values[cur]!)} r="4" fill={l.color} stroke="var(--color-bg)" strokeWidth="2" />}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** A number with how much it moved over the period. */
export function Stat({ label, value, delta, hint, className }: { label: string; value: string; delta?: number | null; hint?: string; className?: string }) {
  return (
    <div className={cx("rounded-lg bg-surface-raised px-6 py-5", className)}>
      <div className="text-sm">{label}</div>
      <div className="mt-1.5 text-[40px] font-light leading-none text-accent">{value}</div>
      <div className="mt-2 min-h-4 text-[13px]">
        {delta != null && delta !== 0 && <span className={cx("font-medium", delta > 0 ? "text-success" : "text-danger")}>{delta > 0 ? "+" : ""}{nf(delta)} </span>}
        {hint}
      </div>
    </div>
  );
}

export const CHART_COLORS = { orange: "var(--color-signature)", navy: "var(--color-accent)", navyDash: "var(--color-accent)" };
export const lastNum = (v: (number | null)[]) => [...v].reverse().find((x) => x != null) ?? null;
export const firstNum = (v: (number | null)[]) => v.find((x) => x != null) ?? null;
export const sumNum = (v: (number | null)[]) => v.reduce<number>((s, x) => s + (x ?? 0), 0);

/** A quiet area line with a dot on the last value, for the big number card. No axes. */
export function Spark({ values, stroke = "var(--color-signature)", fill = "#ffffff", className }: { values: (number | null)[]; stroke?: string; fill?: string; className?: string }) {
  const v = values.map((x) => x ?? 0);
  const max = Math.max(1, ...v);
  const n = Math.max(2, v.length);
  const pts = v.map((x, i) => [(i / (n - 1)) * 400, 82 - (x / max) * 70] as const);
  if (pts.length < 2) pts.push([400, 82]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg aria-hidden viewBox="0 0 400 90" preserveAspectRatio="none" className={className}>
      <path d={`${d} L400,90 L0,90 Z`} fill={fill} fillOpacity=".08" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="5" fill={stroke} />
    </svg>
  );
}
