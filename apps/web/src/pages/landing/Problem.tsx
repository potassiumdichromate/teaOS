import { motion } from "framer-motion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { CURRENT_PROBLEMS } from "./data.js";

export default function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
      <h2 className="text-2xl font-medium text-foreground">The current process, and where it breaks</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        A national exam's question paper is authored, compiled, printed or exported, and distributed to
        thousands of centers — a long chain, and every link is a place trust can fail silently.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CURRENT_PROBLEMS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>{p.detail}</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
