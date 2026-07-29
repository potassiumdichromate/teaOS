import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils.js";

/**
 * Shared "there is genuinely nothing here" state. Used instead of fabricating
 * placeholder rows — consistent with the project's no-mock-data rule.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
        {icon ?? <Inbox className="h-4 w-4" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Error counterpart to EmptyState — same shape, danger tone. */
export function ErrorState({
  title = "Couldn't load this",
  description,
  action,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border border-danger/30 bg-danger/[0.07] px-4 py-3",
        className,
      )}
    >
      <p className="text-sm font-medium text-danger">{title}</p>
      {description ? (
        <p className="text-xs leading-relaxed text-danger/80">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
