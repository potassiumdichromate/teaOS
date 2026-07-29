import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils.js";

export type ToastTone = "success" | "warning" | "danger" | "info";

export interface ToastData {
  tone: ToastTone;
  title: string;
  description?: string;
}

const ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: TriangleAlert,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  danger: "border-danger/30 text-danger",
  info: "border-primary/30 text-primary",
};

/**
 * A single auto-dismissing notification, fixed to the bottom-right. Not a
 * queue — one caller, one `ToastData | null` piece of state, one at a time.
 * That's the only shape this app needs it for today (post-submission
 * confirmation); a real stacked queue can be built when a second caller
 * actually needs one.
 */
export function Toast({
  toast,
  onDismiss,
  durationMs = 6000,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [toast, onDismiss, durationMs]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-elevated px-4 py-3 shadow-raised"
          >
            <span className={cn("mt-0.5 shrink-0", TONE_CLASS[toast.tone])}>
              {(() => {
                const Icon = ICON[toast.tone];
                return <Icon className="h-4 w-4" />;
              })()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{toast.title}</span>
              {toast.description ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {toast.description}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
