import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Card = ({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-[28px] border border-border bg-surface/95 shadow-card backdrop-blur-sm",
      className
    )}
  >
    {children}
  </div>
);

export const SectionTitle = ({
  eyebrow,
  title,
  action
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">{eyebrow}</p> : null}
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
    </div>
    {action}
  </div>
);

export const TrendBadge = ({
  label,
  positive = true
}: {
  label: string;
  positive?: boolean;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
      positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
    )}
  >
    {label}
  </span>
);

export const SegmentedControl = <T extends string | number>({
  options,
  value,
  onChange
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="inline-flex rounded-full border border-blue-100 bg-blue-50/80 p-1">
    {options.map((option) => (
      <button
        key={option.value}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
          option.value === value ? "bg-white text-ink shadow-sm" : "text-muted"
        )}
        onClick={() => onChange(option.value)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);
