import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { Building2, Eye, GraduationCap, PenLine, SlidersHorizontal } from "lucide-react";
import type { Role } from "@nvei/shared";
import hexMark from "@/assets/hex.png";
import { cn } from "@/lib/utils.js";

/** Icon per role, shared by login and every portal header. */
export const ROLE_ICON: Record<Role, ComponentType<{ className?: string }>> = {
  TEACHER: PenLine,
  ADMIN: SlidersHorizontal,
  CENTER: Building2,
  STUDENT: GraduationCap,
  OBSERVER: Eye,
};

/** How each role's portal is named in the UI. Single source of truth. */
export const PORTAL_LABEL: Record<Role, string> = {
  TEACHER: "Author portal",
  ADMIN: "Control plane",
  CENTER: "Examination center",
  STUDENT: "Candidate client",
  OBSERVER: "Independent oversight",
};

/** One-line description of what each role is for, used on login. */
export const PORTAL_BLURB: Record<Role, string> = {
  TEACHER: "Author items and watch them through confidential validation",
  ADMIN: "Blueprints, paper generation, evaluation, and system health",
  CENTER: "Machine readiness, release authorization, and candidate enrolment",
  STUDENT: "Sit the assessment and verify your own result afterwards",
  OBSERVER: "Read-only assurance — anchoring coverage and audit trail",
};

/** teaOS lockup: hexagon mark + wordmark + optional sub-label. */
export function Brand({
  subLabel,
  to,
  className,
  compact = false,
}: {
  subLabel?: string;
  to?: string;
  className?: string;
  compact?: boolean;
}) {
  const inner = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <img
        src={hexMark}
        alt=""
        aria-hidden
        className={cn("shrink-0", compact ? "h-6 w-6" : "h-7 w-7")}
      />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block font-semibold tracking-tight text-foreground",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          teaOS
        </span>
        {subLabel ? (
          <span className="ui-label block truncate normal-case tracking-normal">{subLabel}</span>
        ) : null}
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        {inner}
      </Link>
    );
  }
  return inner;
}
