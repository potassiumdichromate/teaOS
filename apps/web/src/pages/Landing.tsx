import { Link } from "react-router-dom";
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
      <main>
        <Hero />
        <Problem />
        <Solution />
        <TechStack />
        <ArchitectureDiagram />
        <Flows />
        <Benefits />
        <FAQ />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs leading-relaxed text-muted-foreground">
            teaOS — a working prototype, not a production deployment. Every claim on this page is
            independently checkable on 0G Chain and 0G Storage.
          </p>
          <div className="flex shrink-0 gap-4 font-mono text-2xs uppercase tracking-label text-muted-foreground">
            <Link to="/verify" className="transition-colors hover:text-foreground">
              Verify a result
            </Link>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <a
              href="https://chainscan.0g.ai"
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-foreground"
            >
              0G explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
