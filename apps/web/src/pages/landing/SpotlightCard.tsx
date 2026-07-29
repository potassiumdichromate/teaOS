import { useCallback, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils.js";

/**
 * Landing-page surface primitive: the same flat panel shape as
 * `components/ui/card.tsx` (rounded-lg, `border-border`, `bg-card`,
 * `shadow-panel`, p-5 by default) with a mouse-tracked spotlight glow layered
 * on top.
 *
 * Adapted from React Bits' `SpotlightCard`, not pasted: the demo's `1.5rem`
 * radius / `#111` background / `#222` border / cyan glow are all replaced with
 * this product's real tokens, the pseudo-element + separate stylesheet are
 * folded into Tailwind so the landing page keeps zero extra CSS files, and a
 * hairline top highlight was added so the hover state reads on cards the
 * cursor enters from above.
 *
 * Deliberately local to `pages/landing/*` — `components/ui/card.tsx` is shared
 * with the authenticated portals and is not in scope for this treatment.
 */
export default function SpotlightCard({
  children,
  className,
  flush = false,
  spotlightColor = "hsl(212 92% 60% / 0.13)",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  /** Drop the default padding — for full-bleed content such as the diagram. */
  flush?: boolean;
  spotlightColor?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        "group/spot relative overflow-hidden rounded-lg border border-border bg-card shadow-panel",
        "transition-colors duration-300 hover:border-border-strong",
        flush ? "" : "p-5",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500",
          "group-hover/spot:opacity-100 group-focus-within/spot:opacity-100",
        )}
        style={{
          background: `radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500",
          "group-hover/spot:opacity-100 group-focus-within/spot:opacity-100",
        )}
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(212 92% 60% / 0.45) 50%, transparent)",
        }}
      />
      {children}
    </div>
  );
}
