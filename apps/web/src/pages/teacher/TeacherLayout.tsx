import { Outlet } from "react-router-dom";
import { FilePlus2, History, LayoutDashboard } from "lucide-react";
import { AppShell, type NavItem } from "@/components/ui/app-shell.js";

const NAV: NavItem[] = [
  { to: "/teacher", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/teacher/submit", label: "Submit question", icon: FilePlus2 },
  { to: "/teacher/history", label: "Question history", icon: History },
];

export default function TeacherLayout() {
  return (
    <AppShell role="TEACHER" nav={NAV}>
      <Outlet />
    </AppShell>
  );
}
