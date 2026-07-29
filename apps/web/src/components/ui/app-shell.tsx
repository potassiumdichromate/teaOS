import { useState, type ComponentType, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import type { Role } from "@nvei/shared";
import { useAuth } from "@/lib/auth-context.js";
import { cn } from "@/lib/utils.js";
import { Brand, PORTAL_LABEL } from "@/components/ui/brand.js";

export interface NavItem {
  /** Route path. Omit and pass `anchor` for single-page portals. */
  to?: string;
  /** In-page section id (without the `#`) for single-page portals. */
  anchor?: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

const NAV_BASE =
  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors";
const NAV_ACTIVE = "bg-muted/80 font-medium text-foreground";
const NAV_IDLE = "text-muted-foreground hover:bg-muted/50 hover:text-foreground";

/**
 * The single application chrome shared by every authenticated portal:
 * brand + role identity, primary navigation, sign-out, and a scrollable
 * content column. The Student exam client deliberately does NOT use this —
 * a timed assessment gets its own distraction-free chrome.
 */
export function AppShell({
  role,
  nav,
  sidebarFooter,
  contentWidth = "max-w-6xl",
  children,
}: {
  role: Role;
  nav: NavItem[];
  sidebarFooter?: ReactNode;
  contentWidth?: string;
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Single-page portals (Center, Observer) navigate by in-page section.
  const [activeAnchor, setActiveAnchor] = useState<string | undefined>(
    () => nav.find((n) => n.anchor)?.anchor,
  );

  const navInner = (item: NavItem, isActive: boolean) => (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-colors",
          isActive ? "bg-primary" : "bg-transparent",
        )}
      />
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="truncate">{item.label}</span>
    </>
  );

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {nav.map((item) =>
        item.anchor ? (
          <a
            key={item.anchor}
            href={`#${item.anchor}`}
            onClick={() => {
              setActiveAnchor(item.anchor!);
              setMobileOpen(false);
            }}
            className={cn(NAV_BASE, activeAnchor === item.anchor ? NAV_ACTIVE : NAV_IDLE)}
          >
            {navInner(item, activeAnchor === item.anchor)}
          </a>
        ) : (
          <NavLink
            key={item.to}
            to={item.to!}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(NAV_BASE, isActive ? NAV_ACTIVE : NAV_IDLE)}
          >
            {({ isActive }) => navInner(item, isActive)}
          </NavLink>
        ),
      )}
    </nav>
  );

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Brand to="/" subLabel={PORTAL_LABEL[role]} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">{navList}</div>
      <div className="border-t border-border px-3 py-3">
        {sidebarFooter ? <div className="mb-3 px-1">{sidebarFooter}</div> : null}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="ui-label truncate">Signed in</p>
            <p className="truncate text-xs text-foreground">{role.toLowerCase()}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[228px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-card/60 lg:block">
        {sidebarInner}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand compact subLabel={PORTAL_LABEL[role]} />
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {mobileOpen ? (
        <div className="sticky top-[49px] z-20 border-b border-border bg-card px-3 py-3 lg:hidden">
          {navList}
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}

      <main className="min-w-0">
        <div className={cn("mx-auto w-full px-5 py-6 sm:px-8 sm:py-8", contentWidth)}>
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </div>
  );
}
