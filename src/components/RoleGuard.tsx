"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Role } from "@/services/AuthService";
import { AppShell } from "./AppShell";
import { useAuth } from "./AuthProvider";
import { Loading } from "./ui";

export function homeFor(role: Role | null): string {
  if (!role) return "/login";
  return role === "admin" ? "/dashboard" : "/my-loans";
}

/** Client-side routing guard. Real protection is enforced by Firestore rules. */
export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const allowed = !auth.loading && auth.user && auth.verified && auth.role === role;

  useEffect(() => {
    if (auth.loading) return;
    // Unverified email accounts finish verification on the login page.
    if (!auth.user || !auth.verified) router.replace("/login");
    else if (auth.role !== role) router.replace(homeFor(auth.role));
  }, [auth.loading, auth.user, auth.verified, auth.role, role, router]);

  if (!allowed) return <Loading />;
  return <AppShell>{children}</AppShell>;
}
