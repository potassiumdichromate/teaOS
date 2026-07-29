import { useEffect, useState } from "react";
import { api } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";

export interface HealthPayload {
  network: string;
  db: boolean;
  redis: boolean;
  zgChain: { reachable: boolean; blockNumber: number | null };
}

export function networkLabel(network: string | null | undefined) {
  if (!network) return "0G Chain";
  if (network.toUpperCase().includes("MAINNET")) return "0G mainnet";
  if (network.toUpperCase().includes("TESTNET")) return "0G testnet";
  return network;
}

/**
 * Live chain-tip readout for the app chrome. Polls the caller's own health
 * endpoint (`/admin/system-health` or `/observer/system-health`) — the block
 * number is a real RPC read, so a stalled or unreachable node shows as such
 * instead of quietly rendering a stale value.
 */
export function NetworkBadge({
  endpoint,
  intervalMs = 30_000,
  className,
}: {
  endpoint: string;
  intervalMs?: number;
  className?: string;
}) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<HealthPayload>(endpoint)
        .then((h) => {
          if (!cancelled) {
            setHealth(h);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [endpoint, intervalMs]);

  const ok = !failed && !!health?.zgChain.reachable;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          ok ? "bg-success" : failed ? "bg-danger" : "bg-muted-foreground",
        )}
      />
      <span className="min-w-0">
        <span className="ui-label block normal-case tracking-normal">
          {networkLabel(health?.network)}
        </span>
        <span className="block truncate font-mono text-2xs text-muted-foreground">
          {ok && health?.zgChain.blockNumber != null
            ? `block ${health.zgChain.blockNumber.toLocaleString()}`
            : failed
              ? "unreachable"
              : "connecting…"}
        </span>
      </span>
    </div>
  );
}
