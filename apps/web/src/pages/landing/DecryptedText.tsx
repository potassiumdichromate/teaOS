import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils.js";

/**
 * Scramble-then-decrypt text reveal. Adapted from React Bits' `DecryptedText`
 * for this codebase:
 *
 * - imports `framer-motion` (the installed package) rather than `motion/react`;
 * - typed, and trimmed to the two triggers this page actually uses
 *   (`view` / `hover`) instead of carrying the unused click/toggle-reverse
 *   state machine;
 * - the default scramble alphabet is hex, not `A-Za-z!@#$` — the scrambled
 *   state should read as a digest, which is what this product is actually
 *   about;
 * - accessibility fix over the original: the visually-hidden copy holds the
 *   *real* text, not the scrambled frame, so screen readers and the
 *   `document.body.innerText` a crawler sees are never garbage;
 * - honours `prefers-reduced-motion` by rendering the final text immediately.
 */

type RevealDirection = "start" | "end" | "center";
type AnimateOn = "view" | "hover";

export default function DecryptedText({
  text,
  speed = 45,
  maxIterations = 12,
  sequential = true,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "0123456789abcdef",
  className,
  parentClassName,
  encryptedClassName,
  animateOn = "view",
  startDelay = 0,
}: {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: RevealDirection;
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: AnimateOn;
  /** ms to wait after the trigger before the first scramble frame. */
  startDelay?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const [displayText, setDisplayText] = useState(text);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDone, setIsDone] = useState(true);
  const hasAnimated = useRef(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alphabet = useMemo(
    () =>
      useOriginalCharsOnly
        ? Array.from(new Set(text.split(""))).filter((c) => c.trim() !== "")
        : characters.split(""),
    [useOriginalCharsOnly, text, characters],
  );

  const shuffle = useCallback(
    (source: string, keep: Set<number>) =>
      source
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (keep.has(i)) return source[i];
          return alphabet[Math.floor(Math.random() * alphabet.length)] ?? char;
        })
        .join(""),
    [alphabet],
  );

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
    intervalRef.current = null;
    delayRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (reducedMotion) return;
    stop();
    setRevealed(new Set());
    setIsDone(false);
    delayRef.current = setTimeout(() => setIsAnimating(true), startDelay);
  }, [reducedMotion, startDelay, stop]);

  const settle = useCallback(() => {
    stop();
    setIsAnimating(false);
    setRevealed(new Set());
    setDisplayText(text);
    setIsDone(true);
  }, [stop, text]);

  // Reset whenever the source string changes.
  useEffect(() => {
    setDisplayText(text);
    setRevealed(new Set());
    setIsDone(true);
  }, [text]);

  useEffect(() => {
    if (!isAnimating) return;
    let iteration = 0;

    const nextIndex = (current: Set<number>) => {
      const len = text.length;
      if (revealDirection === "end") return len - 1 - current.size;
      if (revealDirection === "center") {
        const middle = Math.floor(len / 2);
        const offset = Math.floor(current.size / 2);
        const candidate = current.size % 2 === 0 ? middle + offset : middle - offset - 1;
        if (candidate >= 0 && candidate < len && !current.has(candidate)) return candidate;
        for (let i = 0; i < len; i++) if (!current.has(i)) return i;
        return 0;
      }
      return current.size;
    };

    intervalRef.current = setInterval(() => {
      setRevealed((prev) => {
        if (sequential) {
          if (prev.size >= text.length) {
            settle();
            return prev;
          }
          const next = new Set(prev);
          next.add(nextIndex(prev));
          setDisplayText(shuffle(text, next));
          return next;
        }
        setDisplayText(shuffle(text, prev));
        iteration += 1;
        if (iteration >= maxIterations) settle();
        return prev;
      });
    }, speed);

    return stop;
  }, [isAnimating, maxIterations, revealDirection, sequential, settle, shuffle, speed, stop, text]);

  // `view` trigger — fire once, the first time the span scrolls into view.
  useEffect(() => {
    if (animateOn !== "view" || reducedMotion) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            start();
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [animateOn, reducedMotion, start]);

  useEffect(() => stop, [stop]);

  const hoverProps =
    animateOn === "hover"
      ? { onMouseEnter: () => !isAnimating && start(), onMouseLeave: settle }
      : {};

  return (
    <motion.span
      ref={containerRef}
      className={cn("inline-block whitespace-pre-wrap", parentClassName)}
      {...hoverProps}
    >
      {isDone ? (
        // Settled state — one plain run of text. No duplicated sr-only copy,
        // so selecting/copying the headline yields it exactly once.
        <span className={className}>{text}</span>
      ) : (
        <>
          {/* Real text for assistive tech and anything reading the DOM. */}
          <span className="sr-only">{text}</span>
          <span aria-hidden="true">
            {displayText.split("").map((char, i) => (
              <span key={`${i}-${char}`} className={revealed.has(i) ? className : encryptedClassName}>
                {char}
              </span>
            ))}
          </span>
        </>
      )}
    </motion.span>
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
