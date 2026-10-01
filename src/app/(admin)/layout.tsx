import type { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="admin">{children}</RoleGuard>;
}
