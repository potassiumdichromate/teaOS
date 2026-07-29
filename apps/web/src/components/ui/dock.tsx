import { useState, type ComponentType, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils.js";

export interface DockItemData {
  key: string;
  icon: ComponentType<{ className?: string }>;
  label: ReactNode;
  onClick: () => void;
  active?: boolean;
}

/**
 * macOS-style magnifying dock, adapted from React Bits' `Dock` (which ships
 * as `motion/react` + a standalone stylesheet) into this app's real stack:
 * `framer-motion` (already a dependency — no `motion/react` added) and
 * Tailwind tokens instead of the demo's hardcoded `#120F17`/`#222`. The
 * source's height-growing outer container (so the panel has room to reveal
 * labels above it on hover) is dropped — labels render as their own
 * absolutely-positioned tooltip per item instead, which needs no reserved
 * space and works inside a normal card rather than a page-height wrapper.
 */
export function Dock({
  items,
  distance = 140,
  panelHeight = 60,
  baseItemSize = 46,
  magnification = 64,
  className,
}: {
  items: DockItemData[];
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
  magnification?: number;
  className?: string;
}) {
  const mouseX = useMotionValue(Infinity);

  return (
    // No fixed height here — it sizes to its content (the `pt-8` tooltip
    // clearance plus the panel's own height). Forcing this wrapper to
    // exactly `panelHeight` while also giving it `pt-8` on top left the
    // panel rendering taller than the box the layout actually reserved,
    // so the next sibling in normal flow started underneath it and the
    // two visually overlapped — caught by screenshotting the real render,
    // not by reading the JSX.
    <div className={cn("flex justify-center overflow-visible pt-8 pb-1", className)}>
      <div
        role="toolbar"
        aria-label="Demo account picker"
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex items-end gap-3 rounded-xl border border-border bg-card px-3 pb-2 pt-2 shadow-raised"
        style={{ height: panelHeight }}
      >
        {items.map((item) => (
          <DockItem
            key={item.key}
            item={item}
            mouseX={mouseX}
            distance={distance}
            baseItemSize={baseItemSize}
            magnification={magnification}
          />
        ))}
      </div>
    </div>
  );
}

function DockItem({
  item,
  mouseX,
  distance,
  baseItemSize,
  magnification,
}: {
  item: DockItemData;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  distance: number;
  baseItemSize: number;
  magnification: number;
}) {
  const [ref, setRef] = useState<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  const dist = useTransform(mouseX, (val) => {
    const rect = ref?.getBoundingClientRect();
    if (!rect) return Infinity;
    return val - rect.x - rect.width / 2;
  });
  const targetSize = useTransform(dist, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, { mass: 0.1, stiffness: 160, damping: 14 });

  return (
    <div className="relative flex flex-col items-center">
      {hovered ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-elevated px-2 py-1 text-2xs text-foreground shadow-panel"
        >
          {item.label}
        </motion.div>
      ) : null}
      <motion.button
        ref={setRef}
        type="button"
        aria-label={typeof item.label === "string" ? item.label : undefined}
        onClick={item.onClick}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          item.active
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-1/2 w-1/2" />
      </motion.button>
    </div>
  );
}
