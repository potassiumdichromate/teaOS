import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { Skeleton } from "@/components/ui/loading.js";

export type StatTone = "default" | "success" | "warning" | "danger" | "primary";

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * A single headline number. Deliberately not a chart — per the form heuristic,
 * one value with no comparison is a stat tile, not a one-bar bar chart.
 * The value wears a text token by default; a status tone is used only when the
 * number *is* a status (rejected counts, failed jobs).
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  loading = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-3.5 shadow-panel transition-colors hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="ui-label truncate">{label}</p>
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p
          className={cn(
            "mt-1.5 font-mono text-2xl font-medium leading-none tracking-tight tabular-nums",
            VALUE_TONE[tone],
          )}
        >
          {value}
        </p>
      )}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({
  columns = 4,
  className,
  children,
}: {
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  children: ReactNode;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  }[columns];
  return <div className={cn("grid gap-3", cols, className)}>{children}</div>;
}

/**
 * Proportion bar — "how much of X has Y". Single hue, value stated in text so
 * the bar is reinforcement rather than the only encoding.
 */
export function Meter({
  label,
  value,
  total,
  hint,
  className,
}: {
  label: ReactNode;
  value: number;
  total: number;
  hint?: ReactNode;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const complete = total > 0 && value >= total;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground">{label}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          <span className={complete ? "text-success" : "text-foreground"}>{value}</span>
          <span className="text-muted-foreground"> / {total}</span>
          <span className="ml-2 text-muted-foreground">{total > 0 ? `${pct}%` : "—"}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            complete ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
