import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface VerifyResponse {
  identityMatch: boolean;
  answerHashMatch: boolean;
  submissionHashMatch: boolean;
  resultHashMatch: boolean;
  midenNoteValid: boolean;
  storageProofValid: boolean;
  chainTxValid: boolean;
  overallVerified: boolean;
  details: {
    submissionChainTx?: string;
    resultChainTx?: string;
    storageRoot?: string;
    midenNoteId?: string;
  };
}

const CHECKS: { key: keyof VerifyResponse; label: string; hint: string }[] = [
  { key: "identityMatch", label: "Identity", hint: "Application ID + DOB matches a known student" },
  { key: "submissionHashMatch", label: "Submission hash", hint: "Recomputed from your stored answers, matches what was recorded at submit time" },
  { key: "answerHashMatch", label: "Answer hash (on-chain)", hint: "Recomputed hash matches the one anchored on 0G Chain's SubmissionRegistry" },
  { key: "resultHashMatch", label: "Result hash", hint: "Recomputed from your score components, matches DB and 0G Chain's ResultRegistry" },
  { key: "storageProofValid", label: "0G Storage proof", hint: "Merkle inclusion proof for your encrypted answers blob verifies" },
  { key: "chainTxValid", label: "0G Chain transactions", hint: "Anchor transactions independently re-fetched from the chain, not our own mirror" },
  { key: "midenNoteValid", label: "Miden submission note", hint: "Not available yet — Miden bridge isn't wired (see docs/MIDEN_INTEGRATION.md)" },
];

export default function Verify() {
  const [applicationId, setApplicationId] = useState("");
  const [dob, setDob] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setResult(await api<VerifyResponse>("/verify", { method: "POST", body: JSON.stringify({ applicationId, dob }) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <Card>
        <CardHeader>
          <CardTitle>Verify a result</CardTitle>
          <CardDescription>Independently re-derives and checks every hash — no login required</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            placeholder="Application ID"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Checking…" : "Verify"}</Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>

        {result && (
          <div className="mt-6 space-y-3 border-t border-border pt-6">
            <div className={`rounded-md p-3 text-center text-sm font-medium ${result.overallVerified ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
              {result.overallVerified ? "VERIFIED" : result.identityMatch ? "PARTIALLY VERIFIED" : "NOT FOUND"}
            </div>
            {result.identityMatch && (
              <div className="space-y-2">
                {CHECKS.filter((c) => c.key !== "identityMatch").map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <p className="text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.hint}</p>
                    </div>
                    <span className={result[c.key] ? "text-success" : "text-muted-foreground"}>
                      {result[c.key] ? "✓" : "—"}
                    </span>
                  </div>
                ))}
                {result.details.submissionChainTx && (
                  <p className="pt-2 text-xs text-muted-foreground break-all">tx: {result.details.submissionChainTx}</p>
                )}
              </div>
            )}
            {!result.identityMatch && (
              <p className="text-sm text-muted-foreground">
                No matching record for that Application ID and date of birth.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
