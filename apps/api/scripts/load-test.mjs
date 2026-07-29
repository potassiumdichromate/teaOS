// Real concurrency test against a locally running apps/api (no framework
// dependency added just for this — plain fetch + Promise.allSettled).
// Deliberately scoped to endpoints that don't spend real money or real gas
// under concurrency: auth, DB-backed reads (observer/admin dashboards), and
// student enrollment (a real Postgres write under real concurrent load,
// exercising the same @@unique([studentId, paperId]) constraint that backs
// double-submission prevention). It intentionally does NOT fire concurrent
// question submissions, because every one of those triggers a real, paid 0G
// Compute validation call and a real 0G Chain anchor tx — burning the user's
// real credits/gas on every run of a load test would be irresponsible, not
// "more real." This is a disclosed scope limit, not an oversight — see the
// summary this script prints.
//
// Usage: node scripts/load-test.mjs [baseUrl] [concurrency]
const baseUrl = process.argv[2] ?? "http://localhost:4000/api";
const concurrency = Number(process.argv[3] ?? 25);

async function timed(fn) {
  const start = performance.now();
  try {
    const res = await fn();
    return { ok: res.ok, status: res.status, ms: performance.now() - start };
  } catch (err) {
    return { ok: false, status: 0, ms: performance.now() - start, error: String(err) };
  }
}

function summarize(name, results) {
  const ok = results.filter((r) => r.ok).length;
  const durations = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const errorRate = ((results.length - ok) / results.length) * 100;
  console.log(
    `${name}: ${results.length} requests, concurrency ${concurrency} — ` +
      `${ok}/${results.length} succeeded (${errorRate.toFixed(1)}% error rate), ` +
      `p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`,
  );
  return { name, total: results.length, ok, errorRate, p50, p95 };
}

async function login(email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.json();
}

async function main() {
  const report = [];

  // ── Phase 1: concurrent logins ──────────────────────────────────────────
  const loginResults = await Promise.all(
    Array.from({ length: concurrency }, () =>
      timed(() =>
        fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "teacher@example.dev", password: "dev-password-only" }),
        }),
      ),
    ),
  );
  report.push(summarize("POST /auth/login (concurrent)", loginResults));

  const { token: adminToken } = await login("admin@example.dev", "dev-password-only");
  const { token: observerToken } = await login("observer@example.dev", "dev-password-only");
  const { token: centerToken } = await login("center@example.dev", "dev-password-only");

  // ── Phase 2: concurrent authenticated dashboard reads ──────────────────
  const overviewResults = await Promise.all(
    Array.from({ length: concurrency }, () =>
      timed(() => fetch(`${baseUrl}/admin/overview`, { headers: { Authorization: `Bearer ${adminToken}` } })),
    ),
  );
  report.push(summarize("GET /admin/overview (concurrent)", overviewResults));

  const integrityResults = await Promise.all(
    Array.from({ length: concurrency }, () =>
      timed(() => fetch(`${baseUrl}/observer/integrity-summary`, { headers: { Authorization: `Bearer ${observerToken}` } })),
    ),
  );
  report.push(summarize("GET /observer/integrity-summary (concurrent)", integrityResults));

  const healthResults = await Promise.all(
    Array.from({ length: concurrency }, () =>
      timed(() => fetch(`${baseUrl}/observer/system-health`, { headers: { Authorization: `Bearer ${observerToken}` } })),
    ),
  );
  report.push(summarize("GET /observer/system-health (concurrent, includes a real 0G Chain RPC call each)", healthResults));

  // ── Phase 3: concurrent student enrollment against the SAME (student,
  // paper) pair — a real test of the @@unique([studentId, paperId])
  // constraint under actual concurrent writes. Whether this student is
  // already enrolled in the paper or not, at most one of these N concurrent
  // requests should ever succeed — that's the double-enrollment guarantee
  // working under real concurrency, not just in a single-threaded test.
  const papers = await fetch(`${baseUrl}/admin/schedule`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
  let enrollSummary = "skipped — no papers exist yet to race against";
  if (Array.isArray(papers) && papers.length > 0) {
    const paperId = papers[0].id;
    const enrollResults = await Promise.all(
      Array.from({ length: concurrency }, () =>
        timed(() =>
          fetch(`${baseUrl}/center/sessions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${centerToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId: "APP-000001", paperId }),
          }),
        ),
      ),
    );
    const enrollOk = enrollResults.filter((r) => r.ok).length;
    enrollSummary = `${enrollOk}/${concurrency} succeeded (expected <= 1 — the unique constraint should reject every duplicate, even under real concurrency)`;
  }
  console.log(`POST /center/sessions racing the same (student, paper) pair: ${enrollSummary}`);

  console.log("\n--- Summary ---");
  for (const r of report) {
    console.log(`${r.name}: ${r.ok}/${r.total} ok, ${r.errorRate.toFixed(1)}% errors, p50=${r.p50.toFixed(1)}ms, p95=${r.p95.toFixed(1)}ms`);
  }
  console.log(
    "\nScope note: question submission / paper generation / evaluation were deliberately excluded from " +
      "concurrent load — each real submission triggers a paid 0G Compute call and/or a real 0G Chain gas " +
      "transaction, and spending real money/gas on every load-test run would be irresponsible. This run " +
      "validates the HTTP/DB layer's concurrency behavior, not the external-network-bound pipelines.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
