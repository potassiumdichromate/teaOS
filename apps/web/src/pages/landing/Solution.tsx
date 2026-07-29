import { PIPELINE } from "./data.js";
import SpotlightCard from "./SpotlightCard.js";
import { Reveal, SectionHeading } from "./section.js";

/**
 * Stage status tag. Deliberately not a solid green pill — this product's
 * visual language is monospace technical values and bracketed labels, so the
 * built/in-progress state reads as a machine tag (`[ built ]`) in a hairline
 * box rather than a generic status blob.
 */
function StageTag({ real }: { real: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-1 font-mono text-2xs uppercase tracking-label ${
        real
          ? "border-success/30 bg-success/[0.07] text-success"
          : "border-warning/30 bg-warning/[0.07] text-warning"
      }`}
    >
      <span aria-hidden className="opacity-40">
        [
      </span>
      {real ? "built" : "in progress"}
      <span aria-hidden className="opacity-40">
        ]
      </span>
    </span>
  );
}

export default function Solution() {
  return (
    <section id="solution" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-20">
      <SectionHeading index="02" eyebrow="The pipeline" title="Every stage, made verifiable">
        Not a new test-delivery system — a redesign of the whole lifecycle so each step produces
        something a third party can independently re-check, without needing to trust the assessment
        body&apos;s word.
      </SectionHeading>

      <div className="mt-10 grid gap-3">
        {PIPELINE.map((stage, i) => (
          <Reveal key={stage.title} delay={i * 0.05} y={10}>
            <SpotlightCard className="flex items-center gap-4">
              <span className="hidden w-8 shrink-0 font-mono text-xs text-primary/60 sm:block">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-medium tracking-tight text-foreground">
                  {stage.title}
                </h3>
                <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">
                  {stage.detail}
                </p>
              </div>
              <StageTag real={stage.real} />
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.05}>
        <SpotlightCard
          className="mt-10 border-warning/30"
          spotlightColor="hsl(38 88% 56% / 0.09)"
        >
          <h3 className="flex flex-wrap items-center gap-2 text-base font-medium tracking-tight text-foreground">
            <span className="font-mono text-2xs uppercase tracking-label text-warning">
              [ disclosure ]
            </span>
            What&apos;s real vs. engineered — read this before trusting any badge in this app
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            AI validation genuinely runs inside a hardware TEE (0G Compute, private trust mode —
            verified live against pc.0g.ai). Encrypted storage and on-chain anchoring are real, on 0G
            Storage and 0G Chain mainnet. The paper-key timelock is real drand/tlock — the content
            key is sealed to a future round of drand mainnet&apos;s public randomness beacon, released
            only when that round&apos;s real threshold signature is published, proven end to end
            against real 0G and drand mainnet. Submission commitments use the deployed{" "}
            <code className="font-mono text-xs text-accent">SubmissionRegistry</code> contract&apos;s
            own write-once guard, which already made a second submission structurally impossible
            without any separate primitive. Master-paper assembly runs as access-controlled, fully
            audit-logged application logic, not inside a literal hardware enclave — no such product
            is documented by 0G today, and we&apos;d rather say so than imply one exists.
          </p>
        </SpotlightCard>
      </Reveal>
    </section>
  );
}
