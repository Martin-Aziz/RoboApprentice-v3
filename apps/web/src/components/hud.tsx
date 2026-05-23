"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * HUD frame — a panel with all four corner brackets and an optional
 * "label" tab in the upper-left. The `tone` prop swaps the bracket color
 * to amber for accent or alert states.
 */
export function HudFrame({
  className,
  tone = "cyan",
  label,
  rightLabel,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "cyan" | "amber";
  label?: React.ReactNode;
  rightLabel?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "hud rounded-[3px]",
        tone === "amber" && "hud-amber",
        className,
      )}
      {...rest}
    >
      <span className="hud-corner-tr" />
      <span className="hud-corner-bl" />
      {(label || rightLabel) && (
        <div className="flex items-center justify-between border-b border-[rgb(var(--steel)/0.5)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--bone-2))]">
          <span className="flex items-center gap-2">
            {label && (
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1 w-3",
                    tone === "amber"
                      ? "bg-[rgb(var(--signal-amber))]"
                      : "bg-[rgb(var(--signal-cyan))]",
                  )}
                />
                {label}
              </span>
            )}
          </span>
          {rightLabel && <span>{rightLabel}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Pulse — animated dot used for "live" or "online" indicators.
 */
export function Pulse({
  tone = "cyan",
  className,
}: {
  tone?: "cyan" | "amber" | "green" | "red";
  className?: string;
}) {
  const color =
    tone === "amber"
      ? "rgb(var(--signal-amber))"
      : tone === "green"
        ? "rgb(var(--signal-green))"
        : tone === "red"
          ? "rgb(var(--signal-red))"
          : "rgb(var(--signal-cyan))";
  return (
    <span
      className={cn("relative inline-flex h-2 w-2", className)}
      style={{ color }}
    >
      <span
        className="absolute inset-0 rounded-full pulse-ring"
        style={{ backgroundColor: color, opacity: 0.4 }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/**
 * Section label — uppercase mono, tick row, slash prefix.
 * Used like a section divider.
 */
export function SectionLabel({
  children,
  className,
  num,
}: {
  children: React.ReactNode;
  className?: string;
  num?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--bone-2))]",
        className,
      )}
    >
      {num && (
        <span className="text-[rgb(var(--signal-cyan))]">{num}</span>
      )}
      <span className="text-[rgb(var(--bone))]">{children}</span>
      <span className="tick-row flex-1" />
    </div>
  );
}

/**
 * Stat — a big tabular numeral with a small caption above and an
 * optional unit suffix and trend indicator.
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--bone-2))]">
        <span className="h-px w-3 bg-[rgb(var(--signal-cyan))]" />
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[44px] leading-none tabular text-[rgb(var(--bone))]">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs uppercase tracking-widest text-[rgb(var(--bone-2))]">
            {unit}
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "ml-1 font-mono text-[10px]",
              trend === "up" && "text-[rgb(var(--signal-green))]",
              trend === "down" && "text-[rgb(var(--signal-red))]",
              trend === "flat" && "text-[rgb(var(--bone-3))]",
            )}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
          </span>
        )}
      </div>
      {hint && (
        <div className="font-mono text-[10px] text-[rgb(var(--bone-3))]">
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * Sparkline — minimal SVG sparkline. Pure presentation.
 */
export function Sparkline({
  values,
  width = 120,
  height = 28,
  stroke = "rgb(var(--signal-cyan))",
  fill = "rgb(var(--signal-cyan) / 0.18)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.4" />
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={fill}
        stroke="none"
      />
    </svg>
  );
}

/**
 * Diagonal slash decoration — used as a section accent.
 */
export function Slash({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "select-none font-mono text-[rgb(var(--signal-cyan))]",
        className,
      )}
    >
      //
    </span>
  );
}
