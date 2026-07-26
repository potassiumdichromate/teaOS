// HTTP client for the Rust `miden-bridge` sidecar (contracts/miden/bridge) —
// Node has no first-party Miden client, so the real miden-client Rust SDK
// runs in that sidecar and this module just calls it. See
// docs/MIDEN_INTEGRATION.md for why this indirection is necessary rather than
// reimplementing Miden's protocol logic in TypeScript.
import { z } from "zod";
import { env } from "../config/env.js";

const timelockNoteResultSchema = z.object({
  noteId: z.string().min(1),
  timelockHeight: z.union([z.string(), z.number()]),
  reclaimHeight: z.union([z.string(), z.number()]),
});
export type TimelockNoteResult = z.infer<typeof timelockNoteResultSchema>;

const submissionNoteResultSchema = z.object({ noteId: z.string().min(1) });
export type SubmissionNoteResult = z.infer<typeof submissionNoteResultSchema>;

export type MidenNoteStatus = "PENDING" | "COMMITTED" | "CONSUMED" | "RECLAIMED";

// Real bug found by actually running Paper Generation (not a hypothetical):
// an early version of the Rust bridge's 501 stubs returned status 200 with
// an {error, path} body, which this function's old bare `!res.ok` check
// didn't catch — it happily parsed the error body as if it were a
// TimelockNoteResult, and the caller marked a Paper READY with
// `midenNoteId: null`. The status-code bug is fixed on the Rust side, but
// this schema validation stays as defense-in-depth: a 200 response whose
// body doesn't actually match the expected shape is now a hard error here,
// not a silently-accepted fake success, regardless of what caused it.
async function bridgeFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.MIDEN_BRIDGE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`miden-bridge ${path} failed: ${res.status} ${bodyText}`);
  }
  const parsed = schema.safeParse(JSON.parse(bodyText));
  if (!parsed.success) {
    throw new Error(
      `miden-bridge ${path} returned 200 but the body didn't match the expected shape: ${bodyText}`,
    );
  }
  return parsed.data;
}

const noteStatusSchema = z.object({
  noteId: z.string(),
  status: z.enum(["PENDING", "COMMITTED", "CONSUMED", "RECLAIMED"]),
  consumable: z.boolean(),
});
const consumeResultSchema = z.object({ wrappedKeyHex: z.string() });

export const midenBridge = {
  /** Seals a wrapped content key into a P2IDE note — see MIDEN_INTEGRATION.md "Use 1". */
  createPaperKeyTimelock: (args: {
    wrappedKeyHex: string;
    targetAccountId: string;
    timelockAt: string; // ISO timestamp, converted to a block height by the bridge
    reclaimAt: string;
  }) => bridgeFetch("/notes/paper-key-timelock", timelockNoteResultSchema, {
    method: "POST",
    body: JSON.stringify(args),
  }),

  /** Private submission commitment — see MIDEN_INTEGRATION.md "Use 2". */
  createSubmissionNote: (args: { sessionId: string; submissionContentHash: string; intakeAccountId: string }) =>
    bridgeFetch("/notes/submission-commitment", submissionNoteResultSchema, {
      method: "POST",
      body: JSON.stringify(args),
    }),

  getNoteStatus: (noteId: string) =>
    bridgeFetch(`/notes/${encodeURIComponent(noteId)}/status`, noteStatusSchema),

  /** Consumes the timelock note once its timelock_height has passed, releasing the wrapped key. */
  consumePaperKeyTimelock: (noteId: string) =>
    bridgeFetch(`/notes/${encodeURIComponent(noteId)}/consume`, consumeResultSchema, { method: "POST" }),
};
