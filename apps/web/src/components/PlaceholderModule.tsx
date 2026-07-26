import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

// Used for every screen whose backing API is still a documented-but-stubbed
// 501 (see apps/api/src/routes/stub.helper.ts) — honest about what's built
// vs. planned, per the project's no-mocks rule. Never render fabricated data
// for these instead of this notice.
export function PlaceholderModule({ title, module }: { title: string; module: string }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Not built yet</CardDescription>
      </CardHeader>
      <p className="text-sm text-muted-foreground">
        This screen is specified in <code className="text-accent">docs/API_REFERENCE.md</code> and{" "}
        <code className="text-accent">knowledge_base.md</code>, planned for the{" "}
        <span className="text-foreground">{module}</span> Phase 4 module. Its backend route currently
        returns <code className="text-accent">501 Not Implemented</code> rather than mocked data.
      </p>
    </Card>
  );
}
