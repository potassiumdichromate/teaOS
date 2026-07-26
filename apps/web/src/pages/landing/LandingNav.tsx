import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.js";

const SECTIONS = [
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Solution" },
  { id: "architecture", label: "Architecture" },
  { id: "flows", label: "Flows" },
  { id: "benefits", label: "Benefits" },
  { id: "faq", label: "FAQ" },
];

export default function LandingNav() {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <span className="text-sm font-medium text-foreground">NVEI</span>
        <nav className="hidden gap-1 sm:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="flex gap-2">
          <Link to="/verify"><Button size="sm" variant="outline">Verify a result</Button></Link>
          <Link to="/login"><Button size="sm">Sign in</Button></Link>
        </div>
      </div>
    </div>
  );
}
