import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils.js";

/**
 * Flat, opaque panel — the single surface primitive across the app and the
 * public site. Padding is on by default (the landing page relies on it);
 * pass `flush` for full-bleed content such as tables or charts.
 */
export function Card({
  className,
  flush,
  ...props
}: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-panel",
        flush ? "" : "p-5",
        className,
      )}
      {...props}
    />
  );
}

/** Header block. Pass `action` to right-align controls against the title. */
export function CardHeader({
  className,
  action,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { action?: ReactNode }) {
  if (action) {
    return (
      <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...props}>
        <div className="min-w-0 space-y-1">{children}</div>
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      </div>
    );
  }
  return (
    <div className={cn("mb-4 space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-medium tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

/** Padded body for use inside a `flush` card. */
export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-border px-5 py-3", className)}
      {...props}
    />
  );
}

/** Hairline divider between stacked regions inside a card. */
export function CardSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-5 border-t border-border", className)} {...props} />;
}
