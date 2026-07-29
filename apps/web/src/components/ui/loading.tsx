import type { HTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils.js";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-muted/70", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.05] to-transparent" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-muted-foreground", className)} />;
}

/** Inline "…doing a thing" line used inside panels while a fetch is in flight. */
export function LoadingLine({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 py-6 text-sm text-muted-foreground", className)}>
      <Spinner />
      {label}…
    </div>
  );
}

/** Placeholder block matching the rhythm of a KeyValueList / stat panel. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  columns = 3,
  rows = 4,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 px-4 py-4", className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3 flex-1", c === 0 && "flex-[2]")} />
          ))}
        </div>
      ))}
    </div>
  );
}
