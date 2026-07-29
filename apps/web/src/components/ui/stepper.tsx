import type { ReactNode } from "react";
import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils.js";

export type StepState = "pending" | "active" | "done" | "failed";

export interface Step {
  key: string;
  label: ReactNode;
  detail?: ReactNode;
  state: StepState;
}

const ICON: Record<StepState, ReactNode> = {
  pending: <Circle className="h-3 w-3" />,
  active: <Loader2 className="h-3 w-3 animate-spin" />,
  done: <Check className="h-3 w-3" />,
  failed: <X className="h-3 w-3" />,
};

const RING: Record<StepState, string> = {
  pending: "border-border bg-card text-muted-foreground",
  active: "border-primary/60 bg-primary/10 text-primary",
  done: "border-success/50 bg-success/10 text-success",
  failed: "border-danger/50 bg-danger/10 text-danger",
};

const TEXT: Record<StepState, string> = {
  pending: "text-muted-foreground",
  active: "text-foreground",
  done: "text-foreground",
  failed: "text-danger",
};

/** Vertical progress stepper for the pipelines this product runs. */
export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                "absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px",
                step.state === "done" ? "bg-success/40" : "bg-border",
              )}
            />
          ) : null}
          <span
            className={cn(
              "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              RING[step.state],
            )}
          >
            {ICON[step.state]}
          </span>
          <span className="min-w-0 pt-0.5">
            <span className={cn("block text-sm", TEXT[step.state])}>{step.label}</span>
            {step.detail ? (
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {step.detail}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
