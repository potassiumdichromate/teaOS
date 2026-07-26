import LandingNav from "./landing/LandingNav.js";
import Hero from "./landing/Hero.js";
import Problem from "./landing/Problem.js";
import Solution from "./landing/Solution.js";
import TechStack from "./landing/TechStack.js";
import ArchitectureDiagram from "./landing/ArchitectureDiagram.js";
import Flows from "./landing/Flows.js";
import Benefits from "./landing/Benefits.js";
import FAQ from "./landing/FAQ.js";

export default function Landing() {
  return (
    <div>
      <LandingNav />
      <Hero />
      <Problem />
      <Solution />
      <TechStack />
      <ArchitectureDiagram />
      <Flows />
      <Benefits />
      <FAQ />
      <footer className="border-t border-border px-6 py-10 text-center text-xs text-muted-foreground">
        National Verifiable Examination Infrastructure — a prototype. See{" "}
        <code className="text-accent">knowledge_base.md</code> for the full architecture and status.
      </footer>
    </div>
  );
}
