import { Navigate } from "react-router-dom";
import type { Role } from "@nvei/shared";
import { useAuth } from "@/lib/auth-context.js";

export function ProtectedRoute({ role, children }: { role: Role; children: React.ReactNode }) {
  const { role: currentRole } = useAuth();
  if (currentRole !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
