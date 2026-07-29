import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils.js";

const CONTROL =
  "w-full rounded-md border border-border bg-background/60 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 hover:border-border-strong focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(CONTROL, "h-9", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(CONTROL, "py-2 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

// Chevron drawn inline so the native select arrow doesn't fight the dark
// theme. Kept in `style` rather than a `bg-[url(...)]` class on purpose:
// tailwind-merge treats an arbitrary `bg-[…]` as conflicting with the
// `bg-background/60` in CONTROL and silently drops the background colour,
// which is what made selects render in Chrome's default grey.
const CHEVRON =
  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23808a99' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, style, ...props }, ref) => (
    <select
      ref={ref}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.6rem center",
        backgroundSize: "14px",
        ...style,
      }}
      className={cn(
        CONTROL,
        "h-9 cursor-pointer appearance-none pr-9",
        "[&>option]:bg-card [&>option]:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("ui-label block", className)} {...props} />;
}

/**
 * Label + control + optional hint/error. Rendered as a `<label>` element so
 * the control inside is implicitly associated without any id plumbing.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label ? <span className="ui-label block">{label}</span> : null}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </label>
  );
}
