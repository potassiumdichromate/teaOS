import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth-context.js";
import { Button } from "@/components/ui/button.js";

const TABS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/blueprints", label: "Blueprint generator" },
  { to: "/admin/papers", label: "Paper generation" },
  { to: "/admin/evaluation", label: "Evaluation & AIR" },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-medium">NTA admin dashboard</h1>
        <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
      </div>
      <nav className="mb-8 flex gap-2 border-b border-border pb-3">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
