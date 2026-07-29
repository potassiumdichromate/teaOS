import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { FAQ as FAQ_ITEMS } from "./data.js";
import SpotlightCard from "./SpotlightCard.js";
import { Reveal, SectionHeading } from "./section.js";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-20">
      <SectionHeading index="07" eyebrow="Objections" title="Frequently asked questions">
        The questions a technical reviewer asks first — answered without hedging.
      </SectionHeading>

      <div className="mt-10 space-y-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={item.q} delay={(i % 3) * 0.05} y={10}>
              <SpotlightCard flush>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                >
                  <h3 className="text-sm font-medium text-foreground">{item.q}</h3>
                  <motion.span
                    aria-hidden
                    animate={{ rotate: isOpen ? 45 : 0, color: isOpen ? "hsl(212 92% 60%)" : undefined }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="shrink-0 text-muted-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
