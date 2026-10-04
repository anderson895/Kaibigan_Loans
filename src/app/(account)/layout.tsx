import type { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

/** Pages for any signed-in user, admin or borrower (My Profile). */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <RoleGuard>{children}</RoleGuard>;
}
