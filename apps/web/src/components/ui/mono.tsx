import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils.js";

/** Inline monospace value — hashes, roots, ids, block numbers. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs tracking-tight text-foreground", className)}>
      {children}
    </span>
  );
}

function middleTruncate(value: string, head: number, tail: number) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * The product's signature element: a truncated cryptographic value with
 * copy-to-clipboard and, where one exists, a link out to an independent
 * explorer. Full value is always available via `title` and the copy button —
 * nothing is shown that a reviewer can't check for themselves.
 */
export function HashValue({
  value,
  head = 8,
  tail = 6,
  href,
  label,
  className,
  copyable = true,
}: {
  value: string | null | undefined;
  head?: number;
  tail?: number;
  href?: string;
  label?: string;
  className?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className={cn("font-mono text-xs text-muted-foreground", className)}>—</span>;
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked (insecure origin / permissions); the full
      // value is still readable from the title attribute, so fail quietly.
    }
  };

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <span
        title={value}
        className="truncate font-mono text-xs tracking-tight text-foreground/90"
      >
        {label ? `${label} ` : ""}
        {middleTruncate(value, head, tail)}
      </span>
      {copyable ? (
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy full value"
          title="Copy full value"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      ) : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in block explorer"
          title="Verify independently in the block explorer"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </span>
  );
}

/**
 * 0G Chain explorer links. `network` is whatever `/admin/system-health` and
 * `/observer/system-health` report (`ZG_MAINNET` / `ZG_TESTNET`); anything
 * unrecognised returns undefined so the UI simply omits the link rather than
 * pointing a reviewer at a wrong chain.
 */
export function explorerTxUrl(txHash: string, network: string | null | undefined) {
  if (!txHash) return undefined;
  const n = (network ?? "").toUpperCase();
  if (n.includes("MAINNET")) return `https://chainscan.0g.ai/tx/${txHash}`;
  if (n.includes("TESTNET")) return `https://chainscan-galileo.0g.ai/tx/${txHash}`;
  return undefined;
}
