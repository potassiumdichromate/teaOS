import { useState } from "react";
import { Card } from "@/components/ui/card.js";
import { FAQ as FAQ_ITEMS } from "./data.js";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
      <h2 className="text-2xl font-medium text-foreground">Frequently asked questions</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The questions a technical reviewer asks first — answered without hedging.
      </p>
      <div className="mt-8 space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <Card key={item.q} className="cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{item.q}</h3>
              <span className="text-muted-foreground">{open === i ? "−" : "+"}</span>
            </div>
            {open === i && <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>}
          </Card>
        ))}
      </div>
    </section>
  );
}
