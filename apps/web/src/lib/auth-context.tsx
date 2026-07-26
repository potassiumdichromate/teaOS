import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role } from "@nvei/shared";
import { clearToken, setToken } from "./api.js";

interface AuthState {
  role: Role | null;
  login: (token: string, role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(
    () => (localStorage.getItem("nvei_role") as Role | null) ?? null,
  );

  const login = (token: string, r: Role) => {
    setToken(token);
    localStorage.setItem("nvei_role", r);
    setRole(r);
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("nvei_role");
    setRole(null);
  };

  return <AuthContext.Provider value={{ role, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
