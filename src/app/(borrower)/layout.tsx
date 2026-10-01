import type { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

export default function BorrowerLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="borrower">{children}</RoleGuard>;
}
