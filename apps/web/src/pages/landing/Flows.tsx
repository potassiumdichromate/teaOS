import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FLOWS } from "./data.js";
import SpotlightCard from "./SpotlightCard.js";
import { Reveal, SectionHeading } from "./section.js";

const TABS = Object.keys(FLOWS);

export default function Flows() {
  const [active, setActive] = useState(TABS[0]!);
  const flow = FLOWS[active]!;

  return (
    <section id="flows" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-20">
      <SectionHeading index="05" eyebrow="Roles" title="How each role experiences it">
        Six perspectives on the same pipeline — pick one.
      </SectionHeading>

      <Reveal className="mt-8">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const selected = active === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                aria-pressed={selected}
                className={`relative rounded-md border px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  selected
                    ? "border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {selected ? (
                  <motion.span
                    layoutId="flow-tab"
                    className="absolute inset-0 -z-10 rounded-md bg-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                {tab}
              </button>
            );
          })}
        </div>
      </Reveal>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard>
              <h3 className="text-base font-medium tracking-tight text-foreground">{flow.title}</h3>
              <ol className="mt-4 space-y-3">
                {flow.steps.map((step, i) => (
                  <motion.li
                    key={step}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.05 }}
                    className="flex gap-3 text-sm"
                  >
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 font-mono text-2xs text-primary">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed text-muted-foreground">{step}</span>
                  </motion.li>
                ))}
              </ol>
            </SpotlightCard>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
