import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { CITIZEN_BENEFITS, COURT_BENEFITS, GOVERNMENT_BENEFITS } from "./data.js";

const GROUPS = [
  { title: "For government", items: GOVERNMENT_BENEFITS },
  { title: "For courts & auditors", items: COURT_BENEFITS },
  { title: "For citizens & students", items: CITIZEN_BENEFITS },
];

export default function Benefits() {
  return (
    <section id="benefits" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
      <h2 className="text-2xl font-medium text-foreground">Who this actually helps, and how</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.title}>
            <CardHeader>
              <CardTitle>{g.title}</CardTitle>
            </CardHeader>
            <ul className="space-y-2">
              {g.items.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">· {item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
          <CardDescription>Honest about what's next, not just what's shipped</CardDescription>
        </CardHeader>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. Resolve the Miden client's Windows build blocker (likely fix: build from WSL/Linux) — unblocks paper release, exam start, evaluation, and submission-note verification end to end.</li>
          <li>2. Real hardware-attested paper-key sealing, replacing the current placeholder key-wrapping.</li>
          <li>3. A sixth on-chain registry for anchoring the aggregate AIR list hash, not just per-student results.</li>
          <li>4. India Stack (Aadhaar/DigiLocker) identity-proofing for Student Verification, beyond Application ID + DOB.</li>
        </ol>
      </Card>
    </section>
  );
}
