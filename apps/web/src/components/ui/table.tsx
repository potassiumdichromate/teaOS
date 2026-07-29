import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { EmptyState } from "@/components/ui/empty-state.js";
import { TableSkeleton } from "@/components/ui/loading.js";

export interface Column<T> {
  /** Stable key; also used as the React key for the cell. */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** Tailwind width class, e.g. "w-40". */
  width?: string;
  className?: string;
  /** Hide below the `md` breakpoint — for secondary columns. */
  hideOnMobile?: boolean;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * The one table in the design system. Every portal's list view uses it so
 * row height, header treatment, hover state, and the empty/loading states
 * are identical everywhere.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRowClick,
  dense = false,
  className,
  maxHeight,
}: {
  columns: Column<T>[];
  rows: T[] | null | undefined;
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  className?: string;
  /** e.g. "max-h-72" — makes the body scroll with the header pinned. */
  maxHeight?: string;
}) {
  if (loading || rows == null) {
    return <TableSkeleton columns={columns.length} className={className} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  const pad = dense ? "px-4 py-1.5" : "px-4 py-2.5";

  return (
    <div className={cn("overflow-x-auto", maxHeight && `${maxHeight} overflow-y-auto`, className)}>
      <table className="w-full border-collapse text-sm">
        <thead className={cn("sticky top-0 z-10 bg-card", maxHeight && "shadow-[0_1px_0_0_hsl(222_14%_18%)]")}>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "ui-label whitespace-nowrap bg-card px-4 pb-2 pt-2 font-medium",
                  ALIGN[c.align ?? "left"],
                  c.width,
                  c.hideOnMobile && "hidden md:table-cell",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "transition-colors",
                onRowClick ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/30",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    pad,
                    "align-middle text-foreground",
                    ALIGN[c.align ?? "left"],
                    c.className,
                    c.hideOnMobile && "hidden md:table-cell",
                  )}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Label/value rows — the non-tabular counterpart to DataTable. */
export function KeyValueList({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; key?: string }[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-border/70", className)}>
      {items.map((item, i) => (
        <div
          key={item.key ?? i}
          className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
        >
          <dt className="shrink-0 text-sm text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
