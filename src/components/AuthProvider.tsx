"use client";
import type { User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/services/AuthService";
import { authService, loanService } from "@/services/container";

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
    const nextRole = next?.emailVerified ? await authService.resolveRole(next).catch(() => "borrower" as const) : null;
    if (next?.email && nextRole === "borrower") {
      // Registered users become borrowers automatically (no manual "add contact" step).
      await loanService
        .ensureBorrowerFor({ uid: next.uid, email: next.email.toLowerCase(), displayName: next.displayName })
        .catch((e) => console.error("Could not create borrower profile", e));
    }
    setRole(nextRole);
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

  const reloadUser = useCallback(async () => {
    const next = await authService.reloadUser();
    // Only re-resolve (role, borrower profile) when something actually changed.
    if (next?.emailVerified) await resolve(next);
    return !!next?.emailVerified;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
