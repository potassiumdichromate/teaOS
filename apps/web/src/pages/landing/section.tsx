import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils.js";

/**
 * Shared scroll-reveal + section-heading rhythm for the public site. One place
 * to change the timing so every section enters the same way instead of each
 * file inventing its own easing and delay.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Numbered monospace eyebrow + title + optional standfirst. The bracketed
 * index echoes the `[ built ]` stage tags and the hash/mono treatment the
 * authenticated app uses for technical values.
 */
export function SectionHeading({
  index,
  eyebrow,
  title,
  children,
  className,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("max-w-2xl", className)}>
      <p className="flex items-center gap-2.5 font-mono text-2xs uppercase tracking-label text-muted-foreground">
        <span className="text-primary/70">[ {index} ]</span>
        <span>{eyebrow}</span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-foreground sm:text-[1.75rem]">
        {title}
      </h2>
      {children ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p> : null}
    </Reveal>
  );
}
