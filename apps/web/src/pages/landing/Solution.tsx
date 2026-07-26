import { motion } from "framer-motion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { PIPELINE } from "./data.js";

export default function Solution() {
  return (
    <section id="solution" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
      <h2 className="text-2xl font-medium text-foreground">Every stage, made verifiable</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Not a new CBT system — a redesign of the whole lifecycle so each step produces something a
        third party can independently re-check, without needing to trust the examination body's word.
      </p>

      <div className="mt-8 grid gap-3">
        {PIPELINE.map((stage, i) => (
          <motion.div
            key={stage.title}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <Card className="flex items-center justify-between">
              <div>
                <CardTitle>{stage.title}</CardTitle>
                <CardDescription>{stage.detail}</CardDescription>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${stage.real ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                {stage.real ? "built" : "gated on Miden"}
              </span>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="mt-8 border-warning/40">
        <CardHeader>
          <CardTitle>What&apos;s real vs. engineered — read this before trusting any badge in this app</CardTitle>
        </CardHeader>
        <p className="text-sm text-muted-foreground">
          AI validation genuinely runs inside a hardware TEE (0G Compute, private trust mode — verified
          live against pc.0g.ai). Encrypted storage and on-chain anchoring are real, on 0G Storage and
          0G Chain mainnet. The paper-key timelock and submission commitments use real Miden — testnet
          only, since no Miden mainnet exists yet. Master-paper assembly runs as access-controlled,
          fully audit-logged application logic, not inside a literal hardware enclave — no such product
          is documented by either ecosystem today, and we&apos;d rather say so than imply one exists.
          Full detail in <code className="text-accent">knowledge_base.md</code>.
        </p>
      </Card>
    </section>
  );
}
