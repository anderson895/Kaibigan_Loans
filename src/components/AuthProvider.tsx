"use client";
import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/services/AuthService";
import { authService } from "@/services/container";

interface AuthState {
  user: User | null;
  email: string;
  role: Role | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      authService.onChange(async (next) => {
        setLoading(true);
        setUser(next);
        setRole(next ? await authService.resolveRole(next).catch(() => "borrower" as const) : null);
        setLoading(false);
      }),
    [],
  );

  const refreshRole = async () => {
    if (user) setRole(await authService.resolveRole(user));
  };

  return (
    <AuthContext.Provider value={{ user, email: user?.email?.toLowerCase() ?? "", role, loading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
