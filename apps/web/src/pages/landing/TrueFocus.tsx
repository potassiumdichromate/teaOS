import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils.js";
import { usePrefersReducedMotion } from "./DecryptedText.js";

/**
 * Cycles a focus reticle across the words of one short phrase, blurring the
 * rest. Adapted from React Bits' `TrueFocus`:
 *
 * - `framer-motion` import, typed props, and the separate stylesheet folded
 *   into Tailwind;
 * - the demo's red/green 3px corner brackets become a 1px `primary` reticle —
 *   it should read as a measurement crosshair over a technical claim, which is
 *   the job it is doing here, not as a game HUD;
 * - `blurAmount` defaults down from 5px to 3.5px and the type size is set by
 *   the caller rather than hardcoded to `3rem/900`, so the unfocused words stay
 *   readable instead of turning to mush;
 * - two real bugs in the original are fixed: the focus rect is never
 *   recomputed on resize (it desyncs the moment the phrase rewraps), and the
 *   `wordRefs` array is never trimmed when the sentence changes;
 * - under `prefers-reduced-motion` the phrase renders sharp and static.
 */
export default function TrueFocus({
  sentence,
  blurAmount = 3.5,
  borderColor = "hsl(212 92% 60%)",
  glowColor = "hsl(212 92% 60% / 0.5)",
  animationDuration = 0.6,
  pauseBetweenAnimations = 1.1,
  className,
  wordClassName,
}: {
  sentence: string;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
  className?: string;
  wordClassName?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const words = sentence.split(" ");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  wordRefs.current.length = words.length;

  useEffect(() => {
    if (reducedMotion || words.length < 2) return;
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % words.length),
      (animationDuration + pauseBetweenAnimations) * 1000,
    );
    return () => clearInterval(id);
  }, [animationDuration, pauseBetweenAnimations, reducedMotion, words.length]);

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const measure = () => {
      const container = containerRef.current;
      const active = wordRefs.current[index];
      if (!container || !active) return;
      const parent = container.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setRect({
        x: box.left - parent.left,
        y: box.top - parent.top,
        width: box.width,
        height: box.height,
      });
    };
    measure();
    // The original never re-measures — the reticle desyncs as soon as the
    // phrase rewraps at a smaller viewport.
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [index, reducedMotion, sentence]);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex flex-wrap items-center justify-center gap-x-5 gap-y-3", className)}
    >
      {words.map((word, i) => {
        const active = reducedMotion || i === index;
        return (
          <span
            key={`${word}-${i}`}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            className={cn(
              "select-none transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
              wordClassName,
            )}
            style={{
              filter: active ? "blur(0px)" : `blur(${blurAmount}px)`,
              transition: `filter ${animationDuration}s ease, color ${animationDuration}s ease`,
            }}
          >
            {word}
          </span>
        );
      })}

      {reducedMotion ? null : (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 box-content"
          animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height, opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: animationDuration, ease: [0.22, 1, 0.36, 1] }}
        >
          {CORNERS.map((corner) => (
            <span
              key={corner.key}
              className={cn("absolute h-2 w-2 rounded-[1px]", corner.className)}
              style={{
                borderColor,
                filter: `drop-shadow(0 0 4px ${glowColor})`,
              }}
            />
          ))}
        </motion.span>
      )}
    </div>
  );
}

const CORNERS = [
  { key: "tl", className: "-left-2 -top-2 border-l border-t" },
  { key: "tr", className: "-right-2 -top-2 border-r border-t" },
  { key: "bl", className: "-bottom-2 -left-2 border-b border-l" },
  { key: "br", className: "-bottom-2 -right-2 border-b border-r" },
];
