/**
 * Money in chart (Working Copy `AN.chart`): line or bars per day with a dollar axis, the
 * first, middle and last dates under it, and a guide line plus tooltip on hover or tap.
 */
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { money } from "@/utils/payments";

const W = 620;
const H = 180;
const PL = 48;
const PB = 22;
const PT = 8;

const label = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", opts);

export const MoneyChart = ({ days, type }: { days: { day: string; amount: number }[]; type: "line" | "bar" }) => {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const max = Math.max(...days.map((d) => d.amount), 1);
  const step = max > 1200 ? 600 : max > 600 ? 300 : max > 300 ? 150 : 100;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / top);
  const bw = (W - PL) / days.length;
  const gap = Math.min(6, bw * 0.3);
  const cx = (i: number) => PL + i * bw + bw / 2;
  const base = H - PB;
  const n = days.length - 1;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  const labelled = days.length <= 7 ? days.map((_, i) => i) : [0, Math.floor(days.length / 2), n];
  const pts = days.map((d, i) => `${cx(i).toFixed(1)},${y(d.amount).toFixed(1)}`).join(" ");
  const tip = hover !== null ? days[hover] : null;
  const width = wrap.current?.getBoundingClientRect().width ?? W;
  const scale = width / W;

  return (
    <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full [&_text]:fill-dark-300 [&_text]:text-caption"
        role="img"
        aria-label="Money in by day. Hover or tap a day to see the amount."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W} y1={y(t)} y2={y(t)} className="stroke-light-525" />
            <text x={PL - 8} y={y(t) + 4} textAnchor="end">
              ${t.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {hover !== null ? <line x1={cx(hover)} x2={cx(hover)} y1={PT} y2={base} className="stroke-light-600" strokeDasharray="3 3" /> : null}
        {type === "bar"
          ? days.map((d, i) => (
              <rect
                key={d.day}
                x={PL + i * bw + gap / 2}
                y={y(d.amount)}
                width={Math.max(bw - gap, 1.5)}
                height={Math.max(base - y(d.amount), 0)}
                rx={Math.min(3, bw / 4)}
                className={i === n || i === hover ? "fill-primary" : "fill-primary-200"}
              />
            ))
          : (
            <>
              <polygon points={`${cx(0).toFixed(1)},${base} ${pts} ${cx(n).toFixed(1)},${base}`} className="fill-primary-50" />
              <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={cx(n)} cy={y(days[n].amount)} r="4" className="fill-primary" />
              {hover !== null ? <circle cx={cx(hover)} cy={y(days[hover].amount)} r="5" className="fill-primary stroke-light-300" strokeWidth="2" /> : null}
            </>
          )}
        {labelled.map((i) => (
          <text key={i} x={cx(i)} y={H - 5} textAnchor={days.length > 7 && i === n ? "end" : days.length > 7 && i === 0 ? "start" : "middle"}>
            {days.length === 1 ? label(days[i].day, { weekday: "short", month: "short", day: "numeric" }) : label(days[i].day, { month: "short", day: "numeric" })}
          </text>
        ))}
        {days.map((d, i) => (
          <rect
            key={`hit-${d.day}`}
            x={PL + i * bw}
            y={PT}
            width={bw}
            height={base - PT}
            fill="transparent"
            className="cursor-crosshair"
            aria-label={`${label(d.day, { month: "short", day: "numeric" })}: ${money(d.amount)}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          />
        ))}
      </svg>
      {tip && hover !== null ? (
        <div
          className={cn(
            "pointer-events-none absolute z-[3] flex flex-col gap-0.5 whitespace-nowrap rounded-control border border-light-525 bg-light-300 px-2.5 py-1.5 shadow-overlay",
            "-translate-x-1/2 -translate-y-full"
          )}
          style={{ left: Math.min(Math.max(cx(hover) * scale, 60), width - 60), top: Math.max(y(tip.amount) * scale - 10, 40) }}
        >
          <b className="text-label-sm">{money(tip.amount)}</b>
          <span className="text-caption text-dark-300">{label(tip.day, { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
      ) : null}
    </div>
  );
};
