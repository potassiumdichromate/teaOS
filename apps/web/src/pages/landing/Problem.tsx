import { CURRENT_PROBLEMS } from "./data.js";
import SpotlightCard from "./SpotlightCard.js";
import { Reveal, SectionHeading } from "./section.js";

export default function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-20">
      <SectionHeading index="01" eyebrow="The problem" title="The current process, and where it breaks">
        An assessment&apos;s question paper is authored, compiled, exported or printed, and
        distributed to hundreds of delivery sites — a long chain, and every link is a place trust can
        fail silently.
      </SectionHeading>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CURRENT_PROBLEMS.map((p, i) => (
          <Reveal key={p.title} delay={(i % 3) * 0.06} className="h-full">
            <SpotlightCard
              className="h-full"
              spotlightColor="hsl(358 68% 58% / 0.10)"
            >
              <h3 className="flex items-baseline gap-2 text-base font-medium tracking-tight text-foreground">
                <span className="font-mono text-2xs text-danger/60">{String(i + 1).padStart(2, "0")}</span>
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.detail}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
