import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.js";
import DecryptedText from "./DecryptedText.js";
import ShapeGrid from "@/components/ui/shape-grid.js";
import TrueFocus from "./TrueFocus.js";

const EASE = [0.22, 1, 0.36, 1] as const;

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: EASE },
  };
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Decorative only: the canvas never receives pointer events, so every
          button and link below stays clickable straight through it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_15%,black,transparent_78%)]">
          <ShapeGrid
            direction="diagonal"
            speed={0.28}
            squareSize={46}
            hoverTrailAmount={6}
            borderColor="hsl(222 14% 20%)"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-20 text-center sm:pt-24">
        <motion.p {...rise(0)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 font-mono text-2xs uppercase tracking-label text-muted-foreground backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Prototype — not a production deployment
          </span>
        </motion.p>

        <motion.h1
          {...rise(0.06)}
          className="mx-auto mt-6 max-w-3xl text-4xl font-medium tracking-tight text-foreground sm:text-5xl"
        >
          <DecryptedText
            text="Trusted Verifiable Assessment Layer"
            animateOn="view"
            sequential
            revealDirection="center"
            speed={26}
            startDelay={340}
            className="text-foreground"
            encryptedClassName="text-primary/45"
          />
        </motion.h1>

        <motion.p
          {...rise(0.12)}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground"
        >
          The infrastructure layer for trusted digital assessments. Every stage — authoring,
          assembly, delivery, evaluation, result publication — is made cryptographically verifiable
          and tamper-evident, while question content stays confidential until release.
        </motion.p>

        <motion.p
          {...rise(0.15)}
          className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground/85"
        >
          Confidential AI validation inside a hardware-attested enclave, decentralized encrypted
          storage, a real drand/tlock time-locked key release, and verification any outside party can
          repeat for themselves. Built on real infrastructure, not a slide deck.
        </motion.p>

        <motion.div {...rise(0.2)} className="mt-9">
          <TrueFocus
            sentence="Verifiable. Tamper-evident. Independently-checkable."
            blurAmount={2.5}
            className="gap-x-7"
            wordClassName="font-mono text-sm uppercase tracking-label sm:text-base"
          />
        </motion.div>

        <motion.div {...rise(0.24)} className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/login">
            <Button size="lg">Sign in</Button>
          </Link>
          <Link to="/verify">
            <Button size="lg" variant="outline">
              Verify a result
            </Button>
          </Link>
          <a href="#solution">
            <Button size="lg" variant="ghost">
              See how it works
            </Button>
          </a>
        </motion.div>

        <motion.p
          {...rise(0.3)}
          className="mt-10 font-mono text-2xs uppercase tracking-label text-muted-foreground/80"
        >
          Governments · Universities · Enterprises · Certification bodies · Hiring platforms
        </motion.p>
      </div>
    </section>
  );
}
