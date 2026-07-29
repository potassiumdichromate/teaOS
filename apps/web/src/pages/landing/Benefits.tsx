import { CITIZEN_BENEFITS, COURT_BENEFITS, GOVERNMENT_BENEFITS } from "./data.js";
import SpotlightCard from "./SpotlightCard.js";
import { Reveal, SectionHeading } from "./section.js";

const GROUPS = [
  { title: "For assessment owners", items: GOVERNMENT_BENEFITS },
  { title: "For courts, auditors & regulators", items: COURT_BENEFITS },
  { title: "For candidates & the public", items: CITIZEN_BENEFITS },
];

const ROADMAP = [
  <>
    Move password hashing to the native <code className="font-mono text-xs text-accent">bcrypt</code>{" "}
    binding — load testing measured a real ~19x login-latency regression under concurrent traffic
    with the current pure-JS implementation.
  </>,
  <>Rate limiting on login and the public verification endpoint.</>,
  <>A sixth on-chain registry for anchoring the aggregate AIR list hash, not just per-student results.</>,
  <>
    India Stack (Aadhaar/DigiLocker) identity-proofing for Student Verification, beyond Application
    ID + DOB.
  </>,
];

export default function Benefits() {
  return (
    <section id="benefits" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-20">
      <SectionHeading index="06" eyebrow="Outcomes" title="Who this actually helps, and how" />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {GROUPS.map((g, i) => (
          <Reveal key={g.title} delay={i * 0.06} className="h-full">
            <SpotlightCard className="flex h-full flex-col">
              <h3 className="text-base font-medium tracking-tight text-foreground">{g.title}</h3>
              <ul className="mt-4 space-y-3">
                {g.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.05}>
        <SpotlightCard className="mt-10">
          <h3 className="text-base font-medium tracking-tight text-foreground">Roadmap</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Honest about what&apos;s next, not just what&apos;s shipped
          </p>
          <ol className="mt-5 space-y-3">
            {ROADMAP.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-px shrink-0 font-mono text-2xs text-muted-foreground/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </SpotlightCard>
      </Reveal>
    </section>
  );
}
