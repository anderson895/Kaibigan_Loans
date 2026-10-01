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
  /** Email/password accounts must verify their email before they can access data. */
  verified: boolean;
  refreshRole: () => Promise<void>;
  /** Re-checks verification after the user clicks the email link. Returns true when verified. */
  reloadUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  const resolve = async (next: User | null) => {
    setUser(next);
    setVerified(!!next?.emailVerified);
    // Unverified users cannot read Firestore yet, so they get no role until they verify.
    setRole(next?.emailVerified ? await authService.resolveRole(next).catch(() => "borrower" as const) : null);
  };

  useEffect(
    () =>
      authService.onChange(async (next) => {
        setLoading(true);
        await resolve(next);
        setLoading(false);
      }),
    [],
  );

  const refreshRole = async () => {
    if (user) setRole(await authService.resolveRole(user));
  };

  const reloadUser = async () => {
    const next = await authService.reloadUser();
    await resolve(next);
    return !!next?.emailVerified;
  };

  return (
    <AuthContext.Provider value={{ user, email: user?.email?.toLowerCase() ?? "", role, loading, verified, refreshRole, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
