import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { TECH } from "./data.js";

export default function TechStack() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <div className="grid gap-4 sm:grid-cols-2">
        {TECH.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>{t.role}</CardDescription>
            </CardHeader>
            <p className="text-xs text-accent">{t.status}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
