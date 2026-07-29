import zgLogo from "@/assets/0g-logo.png";
import { TECH } from "./data.js";
import DecryptedText from "./DecryptedText.js";
import SpotlightCard from "./SpotlightCard.js";
import { Reveal } from "./section.js";

export default function TechStack() {
  return (
    <section id="stack" className="mx-auto max-w-5xl scroll-mt-16 px-6 pb-20">
      <Reveal className="max-w-2xl">
        <p className="flex items-center gap-2.5 font-mono text-2xs uppercase tracking-label text-muted-foreground">
          <span className="text-primary/70">[ 03 ]</span>
          <span>The substrate</span>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </p>
        <h2 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-medium tracking-tight text-foreground sm:text-[1.75rem]">
          <span>Built on</span>
          {/* The real 0G brand mark — this section is literally the 0G stack,
              so the wordmark does the work the heading would otherwise repeat. */}
          <img
            src={zgLogo}
            alt="0G"
            className="h-6 w-auto translate-y-[1px] sm:h-7"
            loading="lazy"
            decoding="async"
          />
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Four independent systems, each doing one job this product cannot do for itself — and each
          one publicly checkable, so none of them has to be taken on our word.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {TECH.map((t, i) => (
          <Reveal key={t.name} delay={(i % 2) * 0.06} className="h-full">
            <SpotlightCard className="flex h-full flex-col">
              <h3 className="text-base font-medium tracking-tight text-foreground">{t.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{t.role}</p>
              <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 font-mono text-2xs uppercase tracking-label text-accent">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                <DecryptedText
                  text={t.status}
                  animateOn="view"
                  sequential
                  speed={18}
                  startDelay={120 + i * 90}
                  characters="0123456789abcdef"
                  className="text-accent"
                  encryptedClassName="text-accent/35"
                />
              </p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
