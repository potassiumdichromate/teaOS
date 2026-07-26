import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card.js";
import { FLOWS } from "./data.js";

const TABS = Object.keys(FLOWS);

export default function Flows() {
  const [active, setActive] = useState(TABS[0]);
  const flow = FLOWS[active];

  return (
    <section id="flows" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
      <h2 className="text-2xl font-medium text-foreground">How each role experiences it</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Six perspectives on the same pipeline — pick one.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`rounded-md px-3 py-1.5 text-sm ${active === tab ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="mt-6">
          <h3 className="mb-4 text-base font-medium text-foreground">{flow.title}</h3>
          <ol className="space-y-3">
            {flow.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary">{i + 1}</span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </motion.div>
    </section>
  );
}
