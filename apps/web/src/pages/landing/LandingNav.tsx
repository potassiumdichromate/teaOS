import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button.js";
import { Brand } from "@/components/ui/brand.js";

const SECTIONS = [
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Solution" },
  { id: "stack", label: "Stack" },
  { id: "architecture", label: "Architecture" },
  { id: "flows", label: "Flows" },
  { id: "benefits", label: "Benefits" },
  { id: "faq", label: "FAQ" },
];

export default function LandingNav() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  const active = useActiveSection();

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Brand compact to="/" />
        <nav className="hidden gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors duration-200 ${
                active === s.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 gap-2">
          <Link to="/verify">
            <Button size="sm" variant="outline">
              Verify a result
            </Button>
          </Link>
          <Link to="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </div>
      {/* Reading progress — one hairline of the single accent colour. */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-primary/70"
      />
    </div>
  );
}

/** Highlights the nav link for whichever section currently owns the viewport. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (nodes.length === 0) return;
    // Track every section's state, not just the entries that changed — so
    // scrolling back into the hero (which owns no section id) clears the
    // highlight instead of leaving the last section stuck on.
    const intersecting = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) intersecting.set(entry.target.id, entry.isIntersecting);
        const current = SECTIONS.find((s) => intersecting.get(s.id));
        setActive(current?.id ?? null);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return active;
}
