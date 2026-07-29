import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Cpu, Database, ShieldCheck } from "lucide-react";
import { Role } from "@nvei/shared";
import type { Role as RoleType } from "@nvei/shared";
import { api, ApiError } from "@/lib/api.js";
import { useAuth } from "@/lib/auth-context.js";
import { Button } from "@/components/ui/button.js";
import { Field, Input } from "@/components/ui/input.js";
import { ErrorState } from "@/components/ui/empty-state.js";
import { Brand, PORTAL_BLURB, PORTAL_LABEL, ROLE_ICON } from "@/components/ui/brand.js";
import { Spinner } from "@/components/ui/loading.js";
import ShapeGrid from "@/components/ui/shape-grid.js";

const ROLE_HOME: Record<RoleType, string> = {
  TEACHER: "/teacher",
  ADMIN: "/admin",
  CENTER: "/center",
  STUDENT: "/student",
  OBSERVER: "/observer",
};

// Seeded by prisma/seed.ts for this demo/pitch environment — the same five
// accounts already documented in README.md and knowledge_base.md. Surfaced
// here as a deliberate convenience for anyone evaluating the product; this is
// not, and is not presented as, a production authentication surface.
const DEMO_PASSWORD = "dev-password-only";
const DEMO_ACCOUNTS: { role: RoleType; email: string }[] = Role.map((r) => ({
  role: r,
  email: `${r.toLowerCase()}@example.dev`,
}));

const PILLARS = [
  {
    icon: Cpu,
    title: "Hardware-attested AI validation",
    body: "Every authored item is screened inside 0G Compute's private trust mode before it can enter a paper.",
  },
  {
    icon: Database,
    title: "Decentralized encrypted storage",
    body: "Papers and answer sets live in 0G Storage as encrypted objects addressed by their Merkle root.",
  },
  {
    icon: Clock,
    title: "Time-locked key release",
    body: "The paper's content key is sealed with drand/tlock — no operator can open it ahead of the exam window.",
  },
  {
    icon: ShieldCheck,
    title: "Independent public verification",
    body: "Hashes, storage roots, and anchors are re-checkable on 0G Chain by anyone, without trusting us.",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filled, setFilled] = useState<RoleType | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, role } = await api<{ token: string; role: RoleType }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(token, role);
      navigate(ROLE_HOME[role]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function useDemoAccount(account: { role: RoleType; email: string }) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setFilled(account.role);
    setError(null);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand / positioning column */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card/60 px-12 py-10 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_30%_30%,black,transparent_82%)]">
            <ShapeGrid direction="diagonal" speed={0.22} squareSize={44} hoverTrailAmount={5} />
          </div>
        </div>

        <Brand to="/" className="relative" />
        <div className="relative max-w-lg">
          <p className="ui-label mb-3">Trusted Evaluation Architecture</p>
          <h1 className="text-3xl font-medium leading-tight tracking-tight text-foreground">
            The infrastructure layer for trusted digital assessments.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            An operating system for high-stakes assessment — confidential AI validation,
            decentralized encrypted storage, cryptographic time-locked release, autonomous
            monitoring, and verification anyone can repeat for themselves.
          </p>
          <ul className="mt-8 space-y-5">
            {PILLARS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
                  <p.icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{p.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {p.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          teaOS by HorizonX Labs · Built on 0G Chain, 0G Storage, 0G Compute and drand
        </p>
      </section>

      {/* Sign-in column */}
      <section className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand to="/" />
          </div>

          <h2 className="text-xl font-medium tracking-tight text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ll be taken to the portal for your role.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="username"
                placeholder="you@organisation.gov"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFilled(null);
                }}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFilled(null);
                }}
              />
            </Field>
            {error ? <ErrorState title="Couldn't sign you in" description={error} /> : null}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="text-primary-foreground" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8 rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">Demo accounts</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Evaluation environment — pick a role to fill the form.
              </p>
            </div>
            <ul className="divide-y divide-border/70">
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = ROLE_ICON[account.role];
                const isFilled = filled === account.role;
                return (
                  <li key={account.role}>
                    <button
                      type="button"
                      onClick={() => useDemoAccount(account)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                    >
                      <span
                        className={
                          isFilled
                            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary"
                            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
                        }
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground">
                          {PORTAL_LABEL[account.role]}
                        </span>
                        <span className="block truncate font-mono text-2xs text-muted-foreground">
                          {account.email}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-2xs text-muted-foreground sm:block">
                        {isFilled ? "Filled" : "Use"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-border px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground">
              All five use the password{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                {DEMO_PASSWORD}
              </code>
              , seeded locally by <code className="font-mono">prisma/seed.ts</code>.
            </p>
          </div>

          {filled ? (
            <p className="mt-3 text-xs text-muted-foreground">{PORTAL_BLURB[filled]}.</p>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-4 text-xs">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to site
            </Link>
            <Link to="/verify" className="text-primary transition-colors hover:underline">
              Verify a result without an account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
