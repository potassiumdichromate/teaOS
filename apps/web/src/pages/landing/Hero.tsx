import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.js";

export default function Hero() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-sm font-medium text-accent">
        Prototype — not a production deployment
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mx-auto mt-3 max-w-3xl text-4xl font-medium text-foreground sm:text-5xl"
      >
        National Verifiable Examination Infrastructure
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground"
      >
        Every stage of a national exam — authoring, paper assembly, delivery, evaluation, ranking,
        result publication — made cryptographically verifiable and tamper-evident, while question
        content stays confidential until exam time. Built on real infrastructure, not a slide deck.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-8 flex flex-wrap justify-center gap-3"
      >
        <Link to="/login"><Button size="lg">Sign in</Button></Link>
        <Link to="/verify"><Button size="lg" variant="outline">Verify a result</Button></Link>
        <a href="#solution"><Button size="lg" variant="ghost">See how it works</Button></a>
      </motion.div>
    </div>
  );
}
