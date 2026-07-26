import { useMemo } from "react";
import ReactFlow, { Background, Controls, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card.js";

const COLORS = {
  app: "#888780",
  compute: "#7F77DD",
  storageChain: "#1D9E75",
  miden: "#D85A30",
};

function node(id: string, label: string, sublabel: string, x: number, y: number, color: string): Node {
  return {
    id,
    position: { x, y },
    data: { label: (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.85 }}>{sublabel}</div>
      </div>
    ) },
    style: {
      background: `${color}22`,
      border: `1px solid ${color}`,
      borderRadius: 8,
      color: "var(--text-primary, #eee)",
      width: 190,
      padding: 8,
    },
  };
}

export default function ArchitectureDiagram() {
  const nodes = useMemo<Node[]>(
    () => [
      node("teacher", "Teacher submits", "Question draft", 0, 0, COLORS.app),
      node("compute", "0G Compute", "AI validation, private TEE", 260, 0, COLORS.compute),
      node("storage", "0G Storage", "Encrypted question blob", 520, 0, COLORS.storageChain),
      node("chain1", "0G Chain", "QuestionRegistry anchor", 780, 0, COLORS.storageChain),
      node("admin", "Admin assembly", "Blueprint → master paper", 780, 140, COLORS.app),
      node("miden", "Miden testnet", "P2IDE key timelock", 520, 140, COLORS.miden),
      node("center", "Exam center", "Authorization gate", 260, 140, COLORS.app),
      node("student", "Student client", "Randomized delivery + submit", 0, 140, COLORS.app),
      node("eval", "Evaluation + AIR", "Score, rank, anchor result", 0, 280, COLORS.storageChain),
      node("verify", "Public verification", "Independent re-derivation", 260, 280, COLORS.app),
    ],
    [],
  );

  const edges = useMemo<Edge[]>(
    () => [
      { id: "e1", source: "teacher", target: "compute", animated: true },
      { id: "e2", source: "compute", target: "storage", animated: true },
      { id: "e3", source: "storage", target: "chain1", animated: true },
      { id: "e4", source: "chain1", target: "admin" },
      { id: "e5", source: "admin", target: "miden" },
      { id: "e6", source: "miden", target: "center" },
      { id: "e7", source: "center", target: "student" },
      { id: "e8", source: "student", target: "eval" },
      { id: "e9", source: "eval", target: "verify" },
    ],
    [],
  );

  return (
    <section id="architecture" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
      <h2 className="text-2xl font-medium text-foreground">Architecture</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Pan and zoom the diagram below. Color shows which real system executes each stage — gray is our
        application logic, purple is 0G Compute, green is 0G Storage/Chain, orange is Miden testnet.
      </p>
      <Card className="mt-8 p-0">
        <div style={{ height: 460 }}>
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background color="var(--border)" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </Card>
      <LegendRow />
    </section>
  );
}

function LegendRow() {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <Legend color={COLORS.app} label="Application layer" />
      <Legend color={COLORS.compute} label="0G Compute (TEE)" />
      <Legend color={COLORS.storageChain} label="0G Storage / Chain" />
      <Legend color={COLORS.miden} label="Miden testnet" />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
