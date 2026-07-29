import { useEffect, useState } from "react";
import { Database, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { EmptyState, ErrorState } from "@/components/ui/empty-state.js";
import { Field, Input } from "@/components/ui/input.js";
import { LoadingLine, Spinner } from "@/components/ui/loading.js";
import { HashValue } from "@/components/ui/mono.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { DataTable, KeyValueList, type Column } from "@/components/ui/table.js";

interface StorageObjectRow {
  storageRoot: string;
  entityType: "Question" | "Paper" | "StudentExamSession";
  entityId: string;
  createdAt: string;
}
interface ProofResult {
  entityType: string;
  entityId: string;
  storageRoot: string;
  proofValid: boolean;
  sizeBytes?: number;
  error?: string;
}

const ENTITY_TONE: Record<string, "primary" | "info" | "neutral"> = {
  Question: "primary",
  Paper: "info",
  StudentExamSession: "neutral",
};

export default function StorageExplorer() {
  const [objects, setObjects] = useState<StorageObjectRow[] | null>(null);
  const [checked, setChecked] = useState<Record<string, ProofResult | "pending" | "error">>({});

  const [manualRoot, setManualRoot] = useState("");
  const [manualResult, setManualResult] = useState<ProofResult | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    api<StorageObjectRow[]>("/storage/objects?take=50").then(setObjects);
  }, []);

  async function verifyRoot(root: string) {
    setChecked((prev) => ({ ...prev, [root]: "pending" }));
    try {
      // Real Merkle-proof-verified download against the live 0G Storage
      // indexer — not a DB flag. Can take a few seconds.
      const result = await api<ProofResult>(`/storage/objects/${encodeURIComponent(root)}/proof`);
      setChecked((prev) => ({ ...prev, [root]: result }));
    } catch {
      setChecked((prev) => ({ ...prev, [root]: "error" }));
    }
  }

  async function verifyManual() {
    if (!manualRoot) return;
    setManualBusy(true);
    setManualError(null);
    setManualResult(null);
    try {
      setManualResult(await api<ProofResult>(`/storage/objects/${encodeURIComponent(manualRoot)}/proof`));
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setManualBusy(false);
    }
  }

  const columns: Column<StorageObjectRow>[] = [
    {
      key: "type",
      header: "Type",
      cell: (o) => <Badge tone={ENTITY_TONE[o.entityType] ?? "neutral"}>{o.entityType}</Badge>,
      width: "w-40",
    },
    {
      key: "entity",
      header: "Entity",
      cell: (o) => <HashValue value={o.entityId} head={10} tail={4} copyable />,
    },
    {
      key: "root",
      header: "Storage root",
      cell: (o) => <HashValue value={o.storageRoot} head={10} tail={6} />,
      hideOnMobile: true,
    },
    {
      key: "at",
      header: "Recorded",
      align: "right",
      cell: (o) => (
        <span className="whitespace-nowrap text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "proof",
      header: "Proof",
      align: "right",
      width: "w-40",
      cell: (o) => {
        const state = checked[o.storageRoot];
        if (state === "pending") {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Spinner className="h-3 w-3" /> Verifying
            </span>
          );
        }
        if (state === "error") {
          return <Badge tone="danger">Request failed</Badge>;
        }
        if (state && typeof state === "object") {
          return (
            <Badge tone={state.proofValid ? "success" : "danger"}>
              {state.proofValid ? `Verified · ${state.sizeBytes ?? "?"} B` : "Proof failed"}
            </Badge>
          );
        }
        return (
          <Button size="xs" variant="outline" onClick={() => verifyRoot(o.storageRoot)}>
            Verify
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="0G Storage Explorer"
        description="Every encrypted question, master paper, and answer blob this platform has ever written to 0G Storage, addressed by its Merkle root. Verifying a proof performs a real, independent download from the live indexer — never a database flag."
      />

      <Card>
        <CardHeader>
          <CardTitle>Verify a storage root</CardTitle>
          <CardDescription>Paste any root hash — from the table below, or from anywhere else in the app that shows one.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <Field label="Storage root">
            <Input
              placeholder="0x…"
              value={manualRoot}
              onChange={(e) => setManualRoot(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
          <Button className="self-end" disabled={!manualRoot || manualBusy} onClick={verifyManual}>
            {manualBusy ? <Spinner className="text-primary-foreground" /> : null}
            Verify proof
          </Button>
        </div>
        <div className="mt-4">
          {manualBusy ? (
            <LoadingLine label="Downloading and verifying the Merkle proof" />
          ) : manualError ? (
            <ErrorState description={manualError} />
          ) : manualResult ? (
            <KeyValueList
              items={[
                { label: "Owner", value: `${manualResult.entityType} · ${manualResult.entityId}` },
                { label: "Storage root", value: <HashValue value={manualResult.storageRoot} /> },
                {
                  label: "Proof",
                  value: (
                    <Badge tone={manualResult.proofValid ? "success" : "danger"}>
                      {manualResult.proofValid ? "Verified" : "Failed"}
                    </Badge>
                  ),
                },
                manualResult.proofValid
                  ? { label: "Size", value: `${manualResult.sizeBytes ?? "—"} bytes` }
                  : { label: "Error", value: manualResult.error ?? "—" },
              ]}
            />
          ) : (
            <EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Nothing checked yet" compact />
          )}
        </div>
      </Card>

      <Card flush className="mt-5">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Storage objects</CardTitle>
          <CardDescription>Newest first, across questions, master papers, and submitted answer sets.</CardDescription>
        </CardHeader>
        <DataTable
          columns={columns}
          rows={objects}
          rowKey={(o) => o.storageRoot}
          emptyIcon={<Database className="h-4 w-4" />}
          emptyTitle="No storage objects yet"
        />
      </Card>
    </>
  );
}
