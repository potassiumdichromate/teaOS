import { Outlet } from "react-router-dom";
import { Cpu, Database, FileStack, LayoutDashboard, ScrollText, Trophy } from "lucide-react";
import { AppShell, type NavItem } from "@/components/ui/app-shell.js";
import { NetworkBadge } from "@/components/ui/network-badge.js";

const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/blueprints", label: "Blueprints", icon: ScrollText },
  { to: "/admin/papers", label: "Paper generation", icon: FileStack },
  { to: "/admin/evaluation", label: "Evaluation & Ranking", icon: Trophy },
  { to: "/admin/compute", label: "Confidential compute", icon: Cpu },
  { to: "/admin/storage", label: "Storage explorer", icon: Database },
];

export default function AdminLayout() {
  return (
    <AppShell
      role="ADMIN"
      nav={NAV}
      sidebarFooter={<NetworkBadge endpoint="/admin/system-health" />}
    >
      <Outlet />
    </AppShell>
  );
}
