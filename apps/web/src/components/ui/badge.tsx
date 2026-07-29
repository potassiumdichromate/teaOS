import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export type Tone = "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "pending";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border-strong/70 bg-muted/60 text-muted-foreground",
  info: "border-info/25 bg-info/10 text-info",
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  pending: "border-accent/25 bg-accent/10 text-accent",
};

const DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  pending: "bg-accent",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-label",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5">
          {pulse ? (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                DOT_CLASS[tone],
              )}
            />
          ) : null}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
        </span>
      ) : null}
      {children}
    </span>
  );
}

/**
 * Single source of truth for every status enum this product surfaces —
 * QuestionStatus, PaperStatus, SessionStatus, SecurityEventSeverity, PC
 * health, and the assorted boolean-ish states (published, authorized,
 * reachable). Unknown values fall back to `neutral` rather than throwing, so a
 * new backend enum value degrades to a readable grey pill instead of a crash.
 */
const STATUS_TONE: Record<string, Tone> = {
  // QuestionStatus
  DRAFT: "neutral",
  SUBMITTED: "info",
  VALIDATING: "pending",
  ACCEPTED: "success",
  REJECTED: "danger",
  // PaperStatus
  PENDING: "neutral",
  ASSEMBLING: "pending",
  READY: "success",
  LOCKED: "info",
  // SessionStatus
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  EVALUATED: "success",
  // SecurityEventSeverity
  INFO: "info",
  LOW: "neutral",
  MEDIUM: "warning",
  WARNING: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
  // Health / connectivity
  ONLINE: "success",
  OFFLINE: "neutral",
  DEGRADED: "warning",
  UNKNOWN: "neutral",
  REACHABLE: "success",
  UNREACHABLE: "danger",
  // Lifecycle
  PUBLISHED: "success",
  UNPUBLISHED: "neutral",
  AUTHORIZED: "success",
  "NOT AUTHORIZED": "warning",
};

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return STATUS_TONE[status.toUpperCase()] ?? "neutral";
}

export function StatusBadge({
  status,
  label,
  dot = true,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  dot?: boolean;
  className?: string;
}) {
  const tone = statusTone(status);
  const text = label ?? (status ?? "—").replace(/_/g, " ");
  return (
    <Badge tone={tone} dot={dot} className={className}>
      {text}
    </Badge>
  );
}

/** Compact up/down indicator for health rows — dot plus optional label. */
export function HealthDot({ ok, className }: { ok: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        ok ? "bg-success shadow-[0_0_0_3px_hsl(152_52%_46%/0.15)]" : "bg-danger shadow-[0_0_0_3px_hsl(358_68%_58%/0.15)]",
        className,
      )}
    />
  );
}
